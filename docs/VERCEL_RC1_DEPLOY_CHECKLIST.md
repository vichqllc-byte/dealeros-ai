# Vercel RC1 Deployment Checklist

This checklist is for deploying the current RC1 build to Vercel without adding any new features.

## 1. Preflight (local)

- Confirm branch/commit is RC1-ready.
- Run:
  - `npx prisma validate`
  - `npm run build`
- Confirm no pending Prisma migrations:
  - `npx prisma migrate status`

## 2. Vercel Project Setup

- Import GitHub repo into Vercel.
- Framework preset: `Next.js`.
- Root directory: repository root.
- Build command: `npm run build`.
- Install command: `npm ci` (or Vercel default).
- Output directory: leave default for Next.js.

## 3. Required Production Environment Variables

Set these in Vercel for Production (and Preview if desired):

- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_TOKEN_SECRET` (16+ chars; strong random secret)

These are startup-blocking and validated by `instrumentation.ts` / `lib/config/validate-env.ts`.

## 4. Billing Variables (required only if Stripe billing/webhooks are enabled)

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_STARTER_ANNUAL`
- `STRIPE_PRICE_PROFESSIONAL_MONTHLY`
- `STRIPE_PRICE_PROFESSIONAL_ANNUAL`
- `STRIPE_PRICE_ENTERPRISE_MONTHLY`
- `STRIPE_PRICE_ENTERPRISE_ANNUAL`

## 5. Optional Integration Variables

Set only if enabling those external integrations in production:

- Auction + marketplace
  - `COPART_API_URL`
  - `COPART_API_KEY`
  - `IAA_API_URL`
  - `IAA_API_KEY`
  - `MANHEIM_API_URL`
  - `MANHEIM_API_KEY`
  - `MARKETPLACE_POSTING_API_URL`
  - `MARKETPLACE_POSTING_API_KEY`
- Premium VIN intelligence providers
  - `NMVTIS_API_KEY`
  - `CARFAX_API_KEY`
  - `AUTOCHECK_API_KEY`
  - `BLACKBOOK_API_KEY`
  - `JD_POWER_API_KEY`
  - `KBB_API_KEY`
  - `MANHEIM_MMR_API_KEY`
  - `EDMUNDS_API_KEY`
  - `IAAI_API_KEY`
  - `AUTO_AUCTION_SERVICES_API_KEY`
  - `ESIGN_PROVIDER_API_KEY`

## 6. Production Migration Step (before first traffic)

Run once against production DB:

- `npx prisma migrate deploy`

Important:

- Use `DIRECT_URL` for direct DB connectivity (no pooler interference).
- Do not use `prisma migrate dev` or `prisma db push` in production.

## 7. Deploy RC1

- Trigger Production deployment from Vercel dashboard (or push `main` if auto-deploy enabled).
- Wait for deployment success.

## 8. Post-Deploy Smoke Verification

- Open app root and verify login/register page loads.
- Register test account.
- Login and verify dashboard loads.
- Verify authenticated endpoints:
  - `/api/account/sessions`
  - `/api/vehicles`
  - `/api/crm/customers`
  - `/api/deals`
  - `/api/vin-analyses`
  - `/api/analytics/dashboard`
- Verify logout and post-logout session rejection (`401` on `/api/account/sessions`).
- Verify health endpoint:
  - `/api/health/ready` returns `{"status":"ok","database":true}`

## 9. Rollback Readiness

- Keep previous stable Vercel deployment available for instant rollback.
- If migration-related failure occurs, stop traffic and restore DB from backup before reattempting.
