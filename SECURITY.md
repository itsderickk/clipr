# Security Policy

Clipr moves real money between Whop accounts, so this document is written for
people auditing the code, not just reporting bugs. Read it together with the
in-app trust-model docs at `/docs#trust`.

## Reporting a vulnerability

Please use **GitHub's private vulnerability reporting** on this repository
(Security → Report a vulnerability) rather than a public issue. Include a
reproduction if you can.

## Threat model (honest version)

1. **The operator is trusted.** Campaign budgets sit in the platform's Whop
   company balance; Clipr's database tracks how much belongs to each campaign.
   Anyone holding `WHOP_API_KEY` can move platform funds.
2. **Review power is spending power.** Whoever sets a submission's view count
   (the campaign creator or a platform admin) determines what the budget owes.
   Admins cannot pay themselves directly — payouts only route to the
   submitting clipper's Whop account, and withdrawals only route to the
   creator — but a dishonest reviewer plus a second account can extract value.
3. **Views are attested, not proven** — except YouTube, which can be verified
   against the YouTube Data API.
4. **Sessions** are 7-day HS256 JWTs in an httpOnly cookie, issued after Whop
   OAuth 2.1 + PKCE sign-in. There are no passwords.

## Where the money is (audit map)

| Path | What it does |
|---|---|
| `lib/whop.ts` | Checkout creation, transfers, webhook signature verification, OAuth helpers |
| `app/api/webhooks/whop/route.ts` | The **only** path that credits a budget: verify signature → re-read payment from Whop → insert deposit keyed by payment id |
| `app/api/campaigns/[id]/fund/route.ts` | Creator-only checkout link; credits nothing |
| `app/api/submissions/[id]/pay/route.ts` | Payout authorization, `owed = earned − paid`, idempotent transfer, ledger after Whop accepts |
| `app/api/campaigns/[id]/withdraw/route.ts` | Creator-only refund of unspent budget |
| `lib/earnings.ts` | Earnings formula: floor, minimum views, per-clip cap, never-below-paid |
| `lib/auth.ts` + `app/api/auth/*` | OAuth flow, JWT session, admin resolution (`ADMIN_WHOP_USER_IDS` + `is_admin`) |

## Known limitations

- **Rebuilt code, not yet verified against live Whop.** The webhook verifier
  assumes the Standard Webhooks format (`webhook-id`, `webhook-timestamp`,
  `webhook-signature: v1,<base64>`), and the payment/transfer field names
  follow Whop's public API docs. Test the full fund → webhook → pay →
  withdraw loop against a Whop sandbox before real money moves.
- No rate limiting beyond auth and ownership checks.
- The published 10% protocol fee is not collected; payouts transfer 100%.
