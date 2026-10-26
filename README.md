# Clipr

**Post a job. Make the clip. Get paid.** A clipping marketplace: creators post campaigns with a rate per 1,000 views and fund a budget through Whop checkout, clippers submit their posts, and approved clips are paid out per 1,000 verified views by Whop transfer straight to the clipper's Whop balance.

Next.js 14 App Router + Tailwind + Framer Motion, Sign in with Whop (OAuth 2.1 + PKCE), Whop checkout / webhooks / transfers for all money movement, and Postgres (Neon serverless driver with a node-postgres fallback).

> **Note:** this repository is a rebuild of the Clipr app that was deployed to Vercel (`clipr-vercel-drop-bl86.vercel.app`) without a linked Git repo. The UI, routes, file layout and data model follow the live deployment; the code is not byte-for-byte identical to the original. See *Before real money moves* below.

Start with [`SECURITY.md`](./SECURITY.md) for the threat model and audit map, and `/docs` in the running app for the plain-English version.

---

## Quick start

```bash
cp .env.example .env    # fill DATABASE_URL, JWT_SECRET and the Whop keys
psql "$DATABASE_URL" -f db/schema.sql
node scripts/seed.mjs   # optional: three demo campaigns
npm install && npm run dev
# → http://localhost:3000
```

## Whop setup

1. **Company API key** (`WHOP_API_KEY`, `WHOP_COMPANY_ID`) with `payout:transfer_funds` and read scopes. Checkout payments land in this company's balance and transfers pay out of it.
2. **OAuth app** (`WHOP_CLIENT_ID`, optional `WHOP_CLIENT_SECRET`) with redirect URI `<app url>/api/auth/whop/callback` and scopes `openid profile email`.
3. **Webhook** for `payment.succeeded` pointed at `<app url>/api/webhooks/whop`, with its secret in `WHOP_WEBHOOK_SECRET`.

## How money moves

| Step | Route | What happens |
|---|---|---|
| Fund | `POST /api/campaigns/:id/fund` | Creator-only. Creates a Whop checkout with the campaign id in metadata. Credits nothing. |
| Credit | `POST /api/webhooks/whop` | Verifies the signature, re-reads the payment from Whop, inserts a `deposits` row keyed by payment id (retries are no-ops), raises `budget_cents`, activates the campaign. |
| Pay | `POST /api/submissions/:id/pay` | Creator or admin. `owed = earned − paid`, capped by remaining budget. Whop transfer with an idempotence key derived from ledger state; ledger written after Whop accepts. |
| Withdraw | `POST /api/campaigns/:id/withdraw` | Creator-only. Closes the campaign and transfers the unspent budget to the creator's Whop account. |

All money is stored as integer cents. Rates are cents per 1,000 views; `earned = floor(views × rate ÷ 1000)`, zero below the minimum views, capped per clip.

## Before real money moves

These parts were rebuilt from Whop's public docs and need checking against a Whop sandbox:

- **Webhook signatures** — `lib/whop.ts#verifyWebhook` assumes the Standard Webhooks format (`webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<base64>`; `whsec_` secrets are base64-decoded).
- **Payment fields** — the webhook reads `subtotal` / `usd_total` / `total` (dollars), `status`, `currency` and `metadata` from `GET /payments/:id`.
- **Transfers** — `POST /transfers` with `amount` in dollars and `idempotence_key`.

## Deploy

Import the repo on Vercel (framework auto-detected) and set the variables from `.env.example`. The e2e suite (`scripts/e2e.mjs`) runs against any running instance:

```bash
DATABASE_URL=... JWT_SECRET=... BASE=http://127.0.0.1:3100 node scripts/e2e.mjs
```

## Layout

```
app/                 pages (landing, campaigns, dashboard, docs, token) + API routes
app/api/auth/whop    OAuth start + callback
app/api/webhooks     Whop payment webhook
components/          UI kit, nav, footer, motion, providers
lib/                 db, auth, whop, earnings, format, token, types
db/schema.sql        Postgres schema (cents)
scripts/             seed + e2e
```
