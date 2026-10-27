# Security Policy

Clippa custodies real money in per-campaign escrow wallets, so this document is written for
people auditing the code, not just reporting bugs. Read it together with the
in-app trust-model docs at `/docs#trust`.

## Reporting a vulnerability

Please use **GitHub's private vulnerability reporting** on this repository
(Security → Report a vulnerability) rather than a public issue. Include a
reproduction if you can.

## Threat model (honest version)

1. **The operator is trusted.** Each campaign's budget sits in its own wallet
   whose key is derived from `ESCROW_MASTER_SEED`. Anyone holding that seed can
   move every campaign's funds. It must live only in the host's secret store
   (never in the repo, logs or the database) and be backed up offline.
2. **Review power is spending power.** Whoever sets a submission's view count
   (the campaign creator or a platform admin) determines what the budget owes.
   Admins cannot pay themselves directly — payouts only route to the
   submitting clipper's wallet, and withdrawals only route to the
   creator — but a dishonest reviewer plus a second account can extract value.
3. **Views are attested, not proven** — except YouTube, which can be verified
   against the YouTube Data API.
4. **Sessions** are 7-day HS256 JWTs in an httpOnly cookie, issued after the
   wallet signs a one-time challenge (ed25519, verified server-side). There
   are no passwords.

## Where the money is (audit map)

| Path | What it does |
|---|---|
| `db/schema.sql` (`escrow_credit`, `escrow_reserve`, `escrow_settle`) | The only writers of the ledger: lock the campaign, check balance, write the entry + audit event and cached totals atomically |
| `lib/escrow/ledger.ts` | Reserve → send → settle; only the call that created a reservation sends |
| `lib/escrow/solana.ts` | Key derivation, deposit scan, USDC transfers |
| `app/api/campaigns/[id]/escrow/*` | Public ledger, deposit sync, admin manual deposits |
| `app/api/submissions/[id]/pay/route.ts` | Payout authorization, `owed = earned − paid` |
| `app/api/campaigns/[id]/withdraw/route.ts` | Creator-only refund of unspent budget |
| `app/api/admin/ledger/[entryId]/route.ts` | Admin settlement of pending entries |
| `lib/earnings.ts` | Earnings formula: floor, minimum views, per-clip cap, never-below-paid |
| `lib/auth.ts`, `lib/wallet-auth.ts`, `app/api/auth/*` | Wallet sign-in, JWT session, admin resolution (`ADMIN_WALLETS` + `is_admin`) |

## Known limitations

- **Not yet run against mainnet.** Test the fund → sync → pay → withdraw loop
  on devnet before real money moves.
- A send whose outcome is unknown (RPC timeout) stays `pending` with its
  signature and holds the funds until an admin reconciles it; funds are never
  released on a guess.
- No rate limiting beyond auth and ownership checks.
- The published 10% protocol fee is not collected; payouts transfer 100%.
