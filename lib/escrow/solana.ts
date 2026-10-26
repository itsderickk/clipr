import { createHmac } from 'crypto';
import bs58 from 'bs58';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { RailRejected, type Rail } from './types';
import { isSolanaAddress } from '../solana-address';

/**
 * Solana USDC rail. Each campaign wallet is an ed25519 keypair derived from
 * ESCROW_MASTER_SEED and its derivation index, so no private key is ever
 * written to the database or the repo: lose the env secret and the keys are
 * gone, leak it and every campaign wallet is exposed. Keep it in your host's
 * secret store only.
 *
 * Network fees and recipients' token accounts are paid by a fee-payer wallet
 * derived from the same seed; top it up with a little SOL.
 */

const USDC_DECIMALS = 6;
/** 1 cent = 10^4 USDC base units. */
const UNITS_PER_CENT = BigInt(10 ** (USDC_DECIMALS - 2));
const MAINNET_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function masterSeed(): Buffer {
  const hex = process.env.ESCROW_MASTER_SEED || '';
  if (!/^[0-9a-fA-F]{64,}$/.test(hex)) throw new Error('ESCROW_MASTER_SEED must be at least 32 bytes of hex');
  return Buffer.from(hex, 'hex');
}

function derive(label: string): Keypair {
  return Keypair.fromSeed(createHmac('sha256', masterSeed()).update(`clipr-escrow:${label}`).digest());
}

const campaignKeypair = (index: number) => derive(`campaign:${index}`);
export const feePayer = () => derive('fee-payer');

export function usdcMint(): PublicKey {
  return new PublicKey(process.env.SOLANA_USDC_MINT || MAINNET_USDC);
}

let conn: Connection | null = null;
export function connection(): Connection {
  if (!conn) conn = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
  return conn;
}

const tokenAccount = (owner: PublicKey) => getAssociatedTokenAddressSync(usdcMint(), owner, true);

export const solanaRail: Rail = {
  id: 'solana',
  currency: 'USDC',

  configured: () => /^[0-9a-fA-F]{64,}$/.test(process.env.ESCROW_MASTER_SEED || ''),

  depositAddress: (index) => campaignKeypair(index).publicKey.toBase58(),

  depositDetails: () => ({
    network: process.env.SOLANA_CLUSTER || 'mainnet-beta',
    token: 'USDC',
    mint: usdcMint().toBase58(),
  }),

  validDestination: (address) => isSolanaAddress(address),

  async findDeposits(index, cursor) {
    const c = connection();
    const mint = usdcMint().toBase58();
    const ata = tokenAccount(campaignKeypair(index).publicKey);

    // Newest first; page back until we reach the cursor.
    const sigs: { signature: string; err: unknown }[] = [];
    let before: string | undefined;
    for (;;) {
      const page = await c.getSignaturesForAddress(ata, { until: cursor ?? undefined, before, limit: 1000 }, 'finalized');
      sigs.push(...page);
      if (page.length < 1000) break;
      before = page[page.length - 1].signature;
    }

    const deposits = [];
    for (const s of sigs.slice().reverse()) {
      if (s.err) continue;
      const tx = await c.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: 'finalized' });
      if (!tx?.meta || tx.meta.err) continue;
      const idx = tx.transaction.message.accountKeys.findIndex((k) => k.pubkey.equals(ata));
      if (idx < 0) continue;
      const bal = (list: typeof tx.meta.preTokenBalances, i: number) =>
        BigInt(list?.find((b) => b.accountIndex === i && b.mint === mint)?.uiTokenAmount.amount ?? '0');
      const delta = bal(tx.meta.postTokenBalances, idx) - bal(tx.meta.preTokenBalances, idx);
      if (delta <= BigInt(0)) continue; // outgoing payouts/refunds are already in the ledger

      // Sub-cent dust stays on chain and is never credited.
      const amountCents = Number(delta / UNITS_PER_CENT);
      if (amountCents <= 0) continue;
      const sender = tx.meta.preTokenBalances?.find(
        (b) => b.mint === mint && b.accountIndex !== idx && bal(tx.meta!.postTokenBalances, b.accountIndex) < BigInt(b.uiTokenAmount.amount)
      );
      deposits.push({ key: `solana:${s.signature}`, ref: s.signature, amountCents, from: sender?.owner ?? null });
    }
    return { deposits, cursor: sigs[0]?.signature ?? cursor };
  },

  async send({ index, to, amountCents }) {
    if (!isSolanaAddress(to)) throw new RailRejected('Invalid destination address');
    const c = connection();
    const mint = usdcMint();
    const owner = campaignKeypair(index);
    const payer = feePayer();
    const toOwner = new PublicKey(to);
    const units = BigInt(amountCents) * UNITS_PER_CENT;

    const { blockhash, lastValidBlockHeight } = await c.getLatestBlockhash('confirmed');
    const tx = new Transaction({ feePayer: payer.publicKey, blockhash, lastValidBlockHeight }).add(
      createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, tokenAccount(toOwner), toOwner, mint),
      createTransferCheckedInstruction(tokenAccount(owner.publicKey), mint, tokenAccount(toOwner), owner.publicKey, units, USDC_DECIMALS)
    );
    tx.sign(payer, owner);
    const signature = bs58.encode(tx.signature!);

    try {
      // Preflight simulation runs first; if it fails nothing was broadcast.
      await c.sendRawTransaction(tx.serialize(), { maxRetries: 5 });
    } catch (e: any) {
      if (/simulation failed|insufficient|custom program error/i.test(e?.message || '')) {
        throw new RailRejected(e.message);
      }
      throw Object.assign(e instanceof Error ? e : new Error(String(e)), { ref: signature });
    }

    try {
      const res = await c.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
      if (res.value.err) throw new RailRejected(`Transaction failed on chain: ${JSON.stringify(res.value.err)}`);
    } catch (e: any) {
      if (e instanceof RailRejected) throw e;
      // Timeout or RPC hiccup: ask the chain what actually happened. When it
      // still can't say, stay pending; never release funds on a guess.
      const status = await solanaRail.status!(signature).catch(() => 'pending' as const);
      if (status === 'confirmed') return { status: 'confirmed', ref: signature };
      if (status === 'failed') throw new RailRejected('Transaction failed on chain');
      return { status: 'pending', ref: signature };
    }
    return { status: 'confirmed', ref: signature };
  },

  async status(ref) {
    const { value } = await connection().getSignatureStatus(ref, { searchTransactionHistory: true });
    if (!value) return 'pending';
    if (value.err) return 'failed';
    return value.confirmationStatus === 'confirmed' || value.confirmationStatus === 'finalized' ? 'confirmed' : 'pending';
  },
};
