# Contributing to Clipr

## Getting a dev environment

```bash
cp .env.example .env          # fill DATABASE_URL (any Postgres), JWT_SECRET, Whop keys
psql "$DATABASE_URL" -f db/schema.sql
node scripts/seed.mjs         # optional demo campaigns
npm install && npm run dev    # http://localhost:3000
```

Sign-in and payments need a Whop OAuth app and company API key (see `.env.example`).

## Before opening a PR

- `npm run build` must pass.
- The e2e suite must pass. CI runs it against a throwaway Postgres; locally:

```bash
npx next start -p 3100 &
BASE=http://127.0.0.1:3100 node scripts/e2e.mjs
```

- Changes touching the money paths (see the audit map in `SECURITY.md`) should add or extend e2e assertions.
- Never commit `.env` or any key material.

## Reporting security issues

Privately, please — see `SECURITY.md`.
