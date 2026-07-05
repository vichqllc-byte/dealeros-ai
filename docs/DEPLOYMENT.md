# Deployment Guide

## Prerequisites

- A PostgreSQL 14+ instance reachable from wherever the app runs.
- Node.js 20 (matches `.github/workflows/ci.yml` and the Dockerfile).
- Real values for every variable in `.env.production.example`.

## Option A: Docker Compose

1. Copy `.env.production.example` to `.env` and fill in real values
   (database credentials, `AUTH_TOKEN_SECRET`, Stripe keys). Never commit
   this file - it's already gitignored.
2. `docker compose build`
3. Run migrations against the target database once, before first boot:
   ```
   DATABASE_URL=<prod-url> DIRECT_URL=<prod-url> npx prisma migrate deploy
   ```
4. `docker compose up -d`
5. Confirm health: `curl http://localhost:3000/api/health/ready` should
   return `{"status":"ok","database":true}`.

The `Dockerfile` is a multi-stage build around Next.js's
`output: 'standalone'` (see `next.config.mjs`), on `node:20-slim`
(glibc) rather than alpine, because Prisma's query engine and
`@node-rs/argon2` both ship prebuilt native binaries most reliably
available for glibc.

## Option B: Platform-as-a-service (Vercel, Railway, Fly.io, Render, ...)

- Build command: `npm run build` (runs `next build`; `prisma generate`
  should run as a `postinstall` or explicit build step - add
  `"postinstall": "prisma generate"` to `package.json` if your platform
  doesn't already run it).
- Start command: `npm run start` (`next start`) if not using the
  standalone Docker output, or `node .next/standalone/server.js` if it is.
- Run `npx prisma migrate deploy` against production as a release step,
  not as part of the build (migrations should run once, not per-instance).
- Set every variable from `.env.production.example` in the platform's
  secrets/environment UI.

## Environment variables

See `.env.production.example` for the full list. `instrumentation.ts`
calls `lib/config/validate-env.ts` at server startup and fails fast
(throws, so the process exits/crash-loops visibly rather than serving
broken requests) if `DATABASE_URL`, `DIRECT_URL`, `AUTH_TOKEN_SECRET`, or
`NEXT_PUBLIC_APP_URL` is missing, or if `AUTH_TOKEN_SECRET` is under 16
characters.

Stripe price IDs (`STRIPE_PRICE_*`) and every premium VIN-data provider
key are optional - each feature honestly reports itself as unconfigured
(`ProviderNotConfiguredError`) rather than failing in a confusing way,
until its corresponding env var is set. See `.env.example` for the full
list of optional providers and what each unlocks.

## Database migrations

- `npx prisma migrate deploy` applies any pending migration in
  `prisma/migrations/` and is safe to re-run (idempotent).
- Never run `prisma migrate dev` or `prisma db push` against production
  - both can generate destructive schema changes interactively meant
    for local development only.
- Verify zero drift before deploying a schema change:
  ```
  npx prisma migrate diff --from-url <prod-url> --to-schema-datamodel prisma/schema.prisma --exit-code
  ```
  A non-zero exit means the live database and `schema.prisma` disagree -
  investigate before proceeding.

## CI/CD

`.github/workflows/ci.yml` runs on every push to `main` and every PR
against a real (ephemeral) Postgres service container: `prisma validate`
→ `prisma generate` → `prisma migrate deploy` → seed → `tsc --noEmit` →
`next lint` → the full Vitest suite (including DB-backed route tests) →
`next build`. Treat a red CI run as a hard blocker - every one of those
steps has caught a real bug at some point during this project's phases.

## Background jobs

There's no persistent worker process (see `docs/ARCHITECTURE.md`).
Configure your scheduler of choice (GitHub Actions `schedule:`, a
platform's cron/scheduled-function feature, an external uptime-style
pinger) to call:

```
POST /api/superadmin/jobs/tick
Authorization: Bearer <api-key minted by a super admin>
```

Recommended interval: every 5-15 minutes. The tick is cheap and a no-op
if nothing is due.

## Monitoring

- `GET /api/health/live` - liveness (process up, no DB dependency).
- `GET /api/health/ready` - readiness (real DB connectivity check).
- `GET /api/superadmin/system-health` - fuller picture: DB latency,
  process uptime/memory, org/user/active-session counts, and which
  premium providers are configured. Gate your monitoring dashboard's
  access on a super-admin-scoped API key.
- Errors are reported through `lib/errors/error-reporter.ts` (console by
  default). To ship errors to a real APM (Sentry, etc.), implement
  `ErrorReporter` and select it in `resolveReporter()` based on an
  `ERROR_REPORTING_PROVIDER` env var - the call site
  (`handleRouteError`) never needs to change.

## Secrets management

- Never commit `.env`, `.env.local`, or any file containing a real
  secret - `.gitignore` already excludes the standard patterns.
- Rotate `AUTH_TOKEN_SECRET` only with an understanding that it
  invalidates every existing session/API key signature immediately
  (all users get logged out; all API keys stop authenticating).
- Stripe webhook signature verification (`STRIPE_WEBHOOK_SECRET`) is the
  only thing standing between `/api/webhooks/stripe` and an attacker
  posting fabricated subscription events - treat it with the same care
  as a database password.

## Backups & disaster recovery

See `docs/DISASTER_RECOVERY.md` and `scripts/backup-db.sh` / `restore-db.sh`.
