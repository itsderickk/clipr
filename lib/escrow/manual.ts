import type { Rail } from './types';
import { isSolanaAddress } from '../solana-address';

/** Off-chain rail. The platform holds the money in its own account; an admin
 *  records deposits as they arrive and confirms each payout once it has been
 *  sent by hand. Useful before on-chain custody is configured. */
export const manualRail: Rail = {
  id: 'manual',
  currency: 'USD',
  configured: () => true,
  depositAddress: () => null,
  depositDetails: () => ({ instructions: 'Contact the Clippa team to fund this campaign.' }),
  validDestination: (address) => isSolanaAddress(address),
  async send() {
    return { status: 'pending', ref: null };
  },
};
