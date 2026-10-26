import { PublicKey } from '@solana/web3.js';

export function isSolanaAddress(address: string | null | undefined): address is string {
  if (!address || address.length < 32 || address.length > 44) return false;
  try {
    return new PublicKey(address).toBase58() === address;
  } catch {
    return false;
  }
}
