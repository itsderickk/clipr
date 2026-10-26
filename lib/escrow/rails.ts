import { manualRail } from './manual';
import { solanaRail } from './solana';
import type { Rail } from './types';

export { RailRejected, type Rail, type SendResult } from './types';

const RAILS: Record<Rail['id'], Rail> = { solana: solanaRail, manual: manualRail };

export function railById(id: string): Rail {
  const rail = RAILS[id as Rail['id']];
  if (!rail) throw new Error(`Unknown escrow rail "${id}"`);
  return rail;
}

/** Rail for newly created campaign wallets: ESCROW_RAIL, else Solana when a
 *  master seed is configured, else manual. Existing wallets keep their rail. */
export function defaultRail(): Rail {
  const id = process.env.ESCROW_RAIL || (solanaRail.configured() ? 'solana' : 'manual');
  return railById(id);
}
