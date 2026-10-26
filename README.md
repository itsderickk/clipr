# Clipr

**Post a job. Make the clip. Get paid.** A clipping marketplace: creators post campaigns with a rate per 1,000 views and fund the campaign's own escrow wallet, clippers submit their posts, and approved clips are paid out per 1,000 verified views from that wallet straight to the clipper's wallet.

Next.js 14 App Router + Tailwind + Framer Motion, Sign in with Solana (wallet-signed message), a platform-custodied escrow wallet per campaign (USDC on Solana, or a manual off-chain rail), an append-only escrow ledger, and Postgres (Neon serverless driver with a node-postgres fallback).

> **Note:** this repository is a rebuild of the Clipr app that was deployed to Vercel (`clipr-vercel-drop-bl86.vercel.app`) without a linked Git repo. The UI, routes, file layout and data model follow the live deployment; the code is not byte-for-byte identical to the original. See *Before real money moves* below.

Start with [`SECURITY.md`](./SECURITY.md) for the threat model and audit map, and `/docs` in the running app for the plain-English version.

---

## Quick start

```bash
cp .env.example .env    # fill DATABASE_URL, JWT_SECRET and the escrow settings
psql "$DATABASE_URL" -f db/schema.sql
node scripts/seed.mjs   # optional: one Clipr campaign per platform ($5,000 total)
npm install && npm run dev
# → http://localhost:3000
```

## Campaign escrow

Every campaign gets its own wallet that the platform custodies. Creators fund it, approved clips are paid out of it, and unspent budget is refunded from it. The ledger (`ledger_entries` + `ledger_events`, written only through the `escrow_*` SQL functions in `db/schema.sql`) is the same whichever rail moves the money:

| Rail | When | Deposits | Payouts / refunds |
|---|---|---|---|
| `solana` | `ESCROW_MASTER_SEED` is set | Creator sends USDC to the campaign's address; `POST /api/campaigns/:id/escrow/sync` credits each finalized transaction once | SPL transfer from the campaign wallet, fees paid by the platform fee payer |
| `manual` | no seed (or `ESCROW_RAIL=manual`) | Admin records them with a payment reference | Queued as pending; admin confirms with a reference once sent |

**Keys.** Campaign keypairs are derived from `ESCROW_MASTER_SEED` and the wallet's derivation index (`HMAC-SHA256(seed, "clipr-escrow:campaign:<n>")`), and the fee payer from `"clipr-escrow:fee-payer"`. No private key is stored in the database or the repo; keep the seed in your host's secret store and back it up offline. Fund the fee payer with a little SOL (see `GET /api/admin/escrow`).

### How money moves

| Step | Route | What happens |
|---|---|---|
| Open | `POST /api/campaigns/:id/fund` | Creator-only. Creates (once) and returns the campaign's escrow wallet. Credits nothing. |
| Credit | `POST /api/campaigns/:id/escrow/sync` · `POST /api/campaigns/:id/escrow/deposits` (admin, manual rail) | Confirmed deposits become `deposit` entries keyed by tx signature / reference, so re-syncs are no-ops. Raises `budget_cents`, activates the campaign. |
| Pay | `POST /api/submissions/:id/pay` | Creator or admin. `owed = earned − paid`, capped by remaining budget. Reserved as a pending entry under a key derived from ledger state, then sent. Rejected sends release the reservation; unclear ones stay pending. |
| Withdraw | `POST /api/campaigns/:id/withdraw` | Creator-only. Closes the campaign and refunds the unspent balance to the creator's wallet. |
| Settle | `PATCH /api/admin/ledger/:entryId` | Admin. `{}` re-checks with the chain; `{status, reference}` confirms or fails a pending entry by hand. |
| Audit | `GET /api/campaigns/:id/escrow` | Public wallet, balance and ledger for a campaign. |

All money is stored as integer cents (1 USDC = 100 cents; sub-cent dust is never credited). Rates are cents per 1,000 views; `earned = floor(views × rate ÷ 1000)`, zero below the minimum views, capped per clip.

## Before real money moves

- Run the full fund → sync → pay → withdraw loop on devnet (`SOLANA_RPC_URL`, `SOLANA_CLUSTER=devnet`, `SOLANA_USDC_MINT` set to a devnet mint) first.
- Use a paid RPC provider; the public endpoint rate-limits `getSignaturesForAddress`.
- Pending entries need someone watching them: reconcile with `PATCH /api/admin/ledger/:id`.

## Deploy

Import the repo on Vercel (framework auto-detected) and set the variables from `.env.example`. The e2e suite (`scripts/e2e.mjs`) runs against any running instance:

```bash
DATABASE_URL=... JWT_SECRET=... BASE=http://127.0.0.1:3100 node scripts/e2e.mjs
```

## Layout

```
app/                 pages (landing, campaigns, dashboard, docs, token) + API routes
app/api/auth         wallet sign-in (nonce + verify), session
app/api/campaigns/[id]/escrow  escrow wallet, ledger, deposit sync
components/          UI kit, nav, footer, motion, providers
lib/                 db, auth, wallet-auth, earnings, format, token, types
lib/escrow/          ledger + rails (solana, manual)
db/schema.sql        Postgres schema (cents)
scripts/             seed + e2e
```
