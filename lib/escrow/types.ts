/** How money physically moves in and out of a campaign wallet. The ledger
 *  (lib/escrow/ledger.ts) is identical for every rail; a rail only knows how
 *  to name a deposit address, find deposits and send funds. */
export interface Rail {
  id: 'solana' | 'manual';
  currency: string;
  configured(): boolean;
  /** Public deposit address for the wallet at this derivation index (null = off-chain). */
  depositAddress(index: number): string | null;
  /** Extra details a funder needs (token mint, network...). Never secrets. */
  depositDetails(): Record<string, string>;
  /** Is `address` a valid payout destination on this rail? */
  validDestination(address: string | null | undefined): boolean;
  /** New confirmed deposits since `cursor`. Each `key` must be globally unique. */
  findDeposits?(index: number, cursor: string | null): Promise<{
    deposits: { key: string; ref: string; amountCents: number; from: string | null }[];
    cursor: string | null;
  }>;
  /** Send funds out of the campaign wallet. Throw RailRejected only when the
   *  money certainly did not move; attach `ref` to any other error if known. */
  send(opts: { index: number; to: string; amountCents: number }): Promise<SendResult>;
  /** Look up an earlier send by its reference, to settle an entry left pending. */
  status?(ref: string): Promise<'confirmed' | 'failed' | 'pending'>;
}

/** confirmed: money moved. pending: handed off, settle later (manual payouts,
 *  or a broadcast we couldn't confirm). */
export interface SendResult {
  status: 'confirmed' | 'pending';
  ref: string | null;
}

/** Thrown when we know for certain the money did NOT move, so the
 *  reservation can be released. Any other error leaves the entry pending. */
export class RailRejected extends Error {}
