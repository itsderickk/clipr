import { createPublicKey, randomBytes, verify } from 'crypto';
import bs58 from 'bs58';
import { isSolanaAddress } from './solana-address';

/** "Sign in with Solana": the wallet signs a one-time message, we check the
 *  ed25519 signature against the address. No password, no third party. */

export function signInMessage(opts: { domain: string; address: string; nonce: string; issuedAt: string }) {
  return [
    `${opts.domain} wants you to sign in to Clippa with your Solana account:`,
    opts.address,
    '',
    'This only proves you own this wallet. It costs nothing and moves no funds.',
    '',
    `Nonce: ${opts.nonce}`,
    `Issued At: ${opts.issuedAt}`,
  ].join('\n');
}

export const newNonce = () => randomBytes(16).toString('hex');

/** Verify an ed25519 signature (base58 or base64) over `message` by `address`. */
export function verifySignature(address: string, message: string, signature: string): boolean {
  if (!isSolanaAddress(address)) return false;
  let sig: Uint8Array;
  try {
    sig = /^[1-9A-HJ-NP-Za-km-z]+$/.test(signature) ? bs58.decode(signature) : Buffer.from(signature, 'base64');
  } catch {
    return false;
  }
  if (sig.length !== 64) return false;
  try {
    const key = createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(bs58.decode(address)).toString('base64url') },
      format: 'jwk',
    });
    return verify(null, Buffer.from(message, 'utf8'), key, sig);
  } catch {
    return false;
  }
}
