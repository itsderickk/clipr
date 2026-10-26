import { db } from '../db';
import { defaultRail, railById, RailRejected, type Rail } from './rails';

/**
 * Per-campaign escrow. The platform custodies one wallet per campaign:
 * creators fund it, approved clips are paid out of it and unspent budget is
 * refunded from it. Every movement is an append-only ledger entry; the SQL
 * functions in db/schema.sql do the balance check, the entry and the cached
 * campaign totals in one atomic call.
 */

export type EntryKind = 'deposit' | 'payout' | 'refund';
export type EntryStatus = 'pending' | 'confirmed' | 'failed';

export interface LedgerEntry {
  id: string;
  campaignId: string;
  kind: EntryKind;
  amountCents: number;
  status: EntryStatus;
  rail: string;
  externalRef: string | null;
  submissionId: string | null;
  destination: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EscrowWallet {
  campaignId: string;
  rail: string;
  currency: string;
  address: string | null;
  details: Record<string, string>;
}

function mapEntry(r: any): LedgerEntry & { created?: boolean } {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    kind: r.kind,
    amountCents: Number(r.amount_cents),
    status: r.status,
    rail: r.rail,
    externalRef: r.external_ref ?? null,
    submissionId: r.submission_id ?? null,
    destination: r.destination ?? null,
    memo: r.memo ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...(r.created === undefined ? {} : { created: !!r.created }),
  };
}

interface WalletRow {
  campaign_id: string;
  rail: string;
  currency: string;
  address: string | null;
  derivation_index: string | number | null;
  synced_until: string | null;
}

function toWallet(w: WalletRow): EscrowWallet {
  return {
    campaignId: w.campaign_id,
    rail: w.rail,
    currency: w.currency,
    address: w.address,
    details: railById(w.rail).depositDetails(),
  };
}

async function walletRow(campaignId: string): Promise<WalletRow | null> {
  return ((await db()`select * from escrow_wallets where campaign_id = ${campaignId}`)[0] as WalletRow) ?? null;
}

/** The campaign's wallet, created on first use with the default rail. */
export async function ensureWallet(campaignId: string): Promise<EscrowWallet> {
  const existing = await walletRow(campaignId);
  if (existing) return toWallet(existing);

  const rail = defaultRail();
  if (!rail.configured()) throw new Error('Escrow is not configured');
  const [{ idx }] = await db()`select nextval('escrow_wallet_index_seq') as idx`;
  const index = Number(idx);
  const address = rail.depositAddress(index);
  await db()`
    insert into escrow_wallets (campaign_id, rail, currency, address, derivation_index)
    values (${campaignId}, ${rail.id}, ${rail.currency}, ${address}, ${index})
    on conflict (campaign_id) do nothing
  `;
  // A concurrent call may have won the insert; theirs is the wallet.
  return toWallet((await walletRow(campaignId))!);
}

export async function getWallet(campaignId: string): Promise<EscrowWallet | null> {
  const w = await walletRow(campaignId);
  return w ? toWallet(w) : null;
}

export async function listEntries(campaignId: string, limit = 50): Promise<LedgerEntry[]> {
  const rows = await db()`
    select * from ledger_entries where campaign_id = ${campaignId}
    order by created_at desc limit ${limit}
  `;
  return rows.map(mapEntry);
}

/** Record a confirmed deposit. Idempotent on `key`. */
export async function credit(opts: {
  campaignId: string;
  amountCents: number;
  key: string;
  rail: string;
  ref?: string | null;
  counterpartyId?: string | null;
  actorId?: string | null;
  memo?: string | null;
}) {
  const [row] = await db()`
    select escrow_credit(${opts.campaignId}, ${opts.amountCents}, ${opts.key}, ${opts.rail},
      ${opts.ref ?? null}, ${opts.counterpartyId ?? null}, ${opts.actorId ?? null}, ${opts.memo ?? null}) as e
  `;
  return mapEntry(row.e);
}

export async function settle(entryId: string, status: 'confirmed' | 'failed', opts: { ref?: string | null; actorId?: string | null; note?: string | null } = {}) {
  const [row] = await db()`
    select escrow_settle(${entryId}, ${status}, ${opts.ref ?? null}, ${opts.actorId ?? null}, ${opts.note ?? null}) as e
  `;
  return mapEntry(row.e);
}

/**
 * Move money out of a campaign wallet (payout to a clipper, refund to the
 * creator). Reserve first so concurrent sends can't overspend, then hand to
 * the rail, then settle. Only the call that created the reservation sends,
 * so a retried request with the same key never pays twice.
 */
export async function sendOut(opts: {
  campaignId: string;
  kind: 'payout' | 'refund';
  amountCents: number;
  key: string;
  destination: string;
  submissionId?: string | null;
  counterpartyId: string;
  actorId: string;
  memo: string;
}): Promise<LedgerEntry> {
  const w = await walletRow(opts.campaignId);
  if (!w) throw new Error('This campaign has no escrow wallet yet');
  const rail: Rail = railById(w.rail);
  if (!rail.validDestination(opts.destination)) throw new Error('Destination wallet is not valid for this rail');

  const [row] = await db()`
    select escrow_reserve(${opts.campaignId}, ${opts.kind}, ${opts.amountCents}, ${opts.key}, ${rail.id},
      ${opts.submissionId ?? null}, ${opts.counterpartyId}, ${opts.destination}, ${opts.actorId}, ${opts.memo}) as e
  `;
  const entry = mapEntry(row.e);
  if (!entry.created) return entry;

  try {
    const res = await rail.send({ index: Number(w.derivation_index), to: opts.destination, amountCents: opts.amountCents });
    if (res.status === 'confirmed') return settle(entry.id, 'confirmed', { ref: res.ref, note: 'Rail confirmed' });
    if (res.ref) await db()`update ledger_entries set external_ref = ${res.ref}, updated_at = now() where id = ${entry.id}`;
    return { ...entry, externalRef: res.ref };
  } catch (e: any) {
    if (e instanceof RailRejected) {
      await settle(entry.id, 'failed', { note: e.message.slice(0, 500) });
      throw new Error(`Transfer failed: ${e.message}`);
    }
    // Unknown outcome: keep the reservation and the reference for an admin to reconcile.
    if (e?.ref) await db()`update ledger_entries set external_ref = ${e.ref}, updated_at = now() where id = ${entry.id}`;
    await db()`
      insert into ledger_events (entry_id, from_status, to_status, note)
      values (${entry.id}, 'pending', 'pending', ${`Outcome unknown: ${String(e?.message || e).slice(0, 400)}`})
    `;
    return { ...entry, externalRef: e?.ref ?? null };
  }
}

/** Pull new on-chain deposits into the ledger. No-op for off-chain rails. */
export async function syncDeposits(campaignId: string): Promise<LedgerEntry[]> {
  const w = await walletRow(campaignId);
  if (!w) return [];
  const rail = railById(w.rail);
  if (!rail.findDeposits || !rail.configured()) return [];

  const { deposits, cursor } = await rail.findDeposits(Number(w.derivation_index), w.synced_until);
  const credited: LedgerEntry[] = [];
  for (const d of deposits) {
    const funder = d.from ? (await db()`select id from users where wallet = ${d.from}`)[0] : null;
    const e = await credit({
      campaignId,
      amountCents: d.amountCents,
      key: d.key,
      rail: rail.id,
      ref: d.ref,
      counterpartyId: funder?.id ?? null,
      memo: d.from ? `Deposit from ${d.from}` : 'Deposit',
    });
    if (e.created) credited.push(e);
  }
  // Advance the cursor only after every deposit is in the ledger.
  if (cursor !== w.synced_until) {
    await db()`update escrow_wallets set synced_until = ${cursor} where campaign_id = ${campaignId}`;
  }
  return credited;
}

/** Re-check a pending send with its rail. */
export async function reconcile(entryId: string, actorId: string) {
  const e = (await db()`select * from ledger_entries where id = ${entryId}`)[0];
  if (!e) throw new Error('Entry not found');
  if (e.status !== 'pending') return mapEntry(e);
  const rail = railById(e.rail);
  if (!rail.status || !e.external_ref) return mapEntry(e);
  const status = await rail.status(e.external_ref);
  if (status === 'pending') return mapEntry(e);
  return settle(entryId, status, { actorId, note: `Reconciled with ${rail.id}` });
}
