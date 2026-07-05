# DealersOS AI — Codebase Audit Report

**Scope:** Full read-through of the repository (Next.js 14 App Router + Prisma/Postgres + Supabase Auth SaaS scaffold). No code was modified in the production of this report.

**Date:** 2026-07-04

---

## 1. Executive Summary

This repository is an early-stage ("Phase 1") scaffold for a multi-tenant dealership acquisition/VIN-analysis SaaS product. The API layer, RBAC, and org-scoping conventions are implemented consistently and are reasonably well tested at the unit level. However, three issues are severe enough that **the application cannot be deployed or even fully tested as-is**:

1. The initial Prisma migration is an empty placeholder — the database schema is never actually created by `prisma migrate deploy`, which breaks CI, local test pipelines, and any real deployment.
2. Login/registration are unimplemented stubs (HTTP 501) — there is no way for a real user to ever obtain the `sb-access-token` cookie the rest of the app depends on.
3. The Vendor dashboard query has no organization scoping, leaking cross-tenant vehicle/activity data to any vendor user.

Beyond these, the "AI" layer (VIN intelligence, damage analysis, auction calculator, pricing, repair estimator, opportunity scoring) is entirely deterministic heuristic arithmetic — there is no ML model, no external AI/LLM call, and no real VIN-decoding integration anywhere in the codebase, despite the product name and UI copy ("AI-driven acquisition signal scoring", "AI review workflow"). This is a significant gap between the product's stated value proposition and its implementation, and should be a top strategic priority regardless of the bug list below.

Roughly a third of the "integration test" suite consists of tautological assertions (`expect(401).toBe(401)`, `expect('x').toContain('x')`) that provide no real coverage and inflate confidence in the test suite.

---

## 2. Architecture Overview

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14.2 (App Router) | Server components for pages, Route Handlers for `/api/*` |
| Database | PostgreSQL via Prisma 5.17 | Multi-tenant via `Organization` → `Membership` → `User`, `Vehicle`, `VinAnalysis`, `ActivityLog`, `AuditLog` |
| Auth | Supabase Auth (cookie-based: `sb-access-token` / `sb-refresh-token`) | No Supabase client-side SDK usage found; purely server-side cookie forwarding |
| Validation | Zod | One schema per entity in `lib/validators` |
| AI/"intelligence" layer | Hand-written heuristics in `lib/ai/*` | No model inference, no external API calls |
| Frontend | React 18 Server Components + a few `'use client'` islands, Tailwind | `DashboardShell` + role-specific pages (`/dealer`, `/vendor`, `/admin`) |
| Testing | Vitest (unit + route/integration), Playwright (1 smoke e2e test) | Route tests gate on Docker Postgres via `docker-compose.test.yml` |
| CI | GitHub Actions, Postgres service container | Runs migrate+seed+test, but **not** lint or build |

**Request flow:** `middleware.ts` performs a coarse cookie-presence gate → page/layout calls `requireSession()` (redirects) or route handler calls `requireRoutePermission()` (401/403 JSON) → both ultimately call `getSession()` in `lib/auth/session.ts`, which is the only place that actually calls Supabase (`auth.getUser()`) and resolves the caller's `Membership` (and thus `organizationId`/`role`) from Postgres. All service functions in `lib/server/*` take `organizationId` as an explicit parameter and filter every Prisma query by it — this is the correct multi-tenancy pattern and is applied consistently for vehicles and VIN analyses.

---

## 3. Findings

Findings are ordered by severity. Each includes file/line references.

### 🔴 CRITICAL

**C1. The initial database migration creates no tables — `prisma migrate deploy` is broken.**
[prisma/migrations/0001_init/migration.sql](prisma/migrations/0001_init/migration.sql) contains only two comment lines:
```
-- Initial DealersOS Phase 1 schema migration placeholder.
-- Run `prisma migrate dev` after environment setup to generate DB-specific SQL.
```
No `Organization`, `User`, `Membership`, `Vehicle`, `VinAnalysis`, or `AuditLog` tables (or the `RoleKey`/`VehicleStatus`/`RecommendationKey` enums) are ever created. Migration `0002_activity_log` immediately does:
```sql
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ...
```
and `0003_workflow_state` does `ALTER TABLE "Vehicle" ADD COLUMN ...` / `ALTER TABLE "VinAnalysis" ADD COLUMN ...` — all against tables that were never created. Running `npx prisma migrate deploy` (exactly what [.github/workflows/ci.yml:39](.github/workflows/ci.yml) and `npm run db:test:migrate` do) will fail outright, or at best silently produce a database missing its core tables. There is also no `prisma/migrations/migration_lock.toml`, which `prisma migrate` normally requires/generates.
**Impact:** CI's route/integration test job and any real environment bootstrap cannot succeed. This is the single highest-priority fix — regenerate migrations from `schema.prisma` (`prisma migrate dev` against a clean shadow DB) and commit real SQL, or squash into one correct baseline migration.

**C2. Login and registration are non-functional stubs.**
[app/api/auth/login/route.ts](app/api/auth/login/route.ts) and [app/api/auth/register/route.ts](app/api/auth/register/route.ts) both unconditionally return `501`. There is no Supabase `signInWithPassword`/`signUp` call anywhere in the repo, and nothing ever calls `cookies().set('sb-access-token', ...)`. The entire auth system (middleware, `getSession`, RBAC) assumes this cookie exists, but nothing in the product can ever create it for a real user.
**Impact:** the product is not usable end-to-end outside of test mode (`NODE_ENV=test`, which bypasses Supabase entirely via `lib/test/session-adapter.ts`). This should be treated as a missing-feature blocker, not a low-priority TODO.

**C3. Vendor dashboard leaks cross-tenant data (no organization scoping).**
[lib/loaders/dashboard.ts:31-43](lib/loaders/dashboard.ts) — `loadVendorDashboard()` takes no `organizationId` argument at all:
```ts
export async function loadVendorDashboard() {
  const [quoteRequestsOpen, activeJobs, recentMessages] = await Promise.all([
    db.vehicle.count({ where: { status: 'ANALYZED' } }),
    db.vehicle.count({ where: { status: 'NEGOTIATING' } }),
    db.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })
  ]);
  ...
}
```
Every `VENDOR_MANAGER` in every organization sees platform-wide vehicle counts and the 5 most recent activity-log entries **from every organization**, including free-text `summary` fields that may contain VINs, pricing, and deal notes from unrelated dealers. Every other data-access path in the codebase (`vehicle-service.ts`, `vin-analysis-service.ts`, `opportunity-service.ts`, `loadDealerDashboard`) is correctly scoped by `organizationId` — this is an isolated regression, not a systemic pattern, which makes it easy to fix but also easy to have missed in review.
**Fix:** thread `organizationId` into `loadVendorDashboard(organizationId)` exactly as `loadDealerDashboard` does, and filter all three queries by it.

### 🟠 HIGH

**H1. Middleware token checks are cosmetic; the real security boundary is entirely downstream.**
[middleware.ts:26-34](middleware.ts) branches on the literal string values `'expired'` and `'invalid'` for the access-token cookie. Real Supabase JWTs are never equal to these literals, so in production this logic is dead code that can never trigger — it exists purely to satisfy [tests/middleware-auth.test.ts](tests/middleware-auth.test.ts) and [tests/routes/middleware-route-integration.test.ts](tests/routes/middleware-route-integration.test.ts), which inject those exact strings as fake cookie values. In production, `middleware.ts` only ever checks *presence* of a cookie, never validity — actual verification happens later, only for page/route handlers that call `getSession()`. This isn't currently exploitable (because `getSession()` does independently verify via `supabase.auth.getUser()`), but it means:
- The middleware provides no real defense-in-depth; a request with any non-empty garbage string as `sb-access-token` sails through the edge gate and pays the full cost of a DB round-trip before being rejected downstream.
- The refresh-token branch (`accessToken === 'expired' && refreshToken` → allow through) does not validate the refresh token at all — it only checks that *a cookie with that name exists*. Again not exploitable today only because nothing downstream trusts middleware's decision, but the logic reads as if it performs refresh validation when it does not.
**Fix:** either move real token verification into middleware (Supabase supports this via `@supabase/ssr` edge-compatible verification), or simplify middleware to a pure "cookie present" gate and delete the misleading expired/invalid literal-string branches, relying on `getSession()` as the single source of truth.

**H2. No CSRF protection on cookie-authenticated mutating routes.**
`POST/PATCH/DELETE` on `/api/vehicles*` and `/api/vin-analyses*` ([app/api/vehicles/route.ts](app/api/vehicles/route.ts), [app/api/vehicles/[id]/route.ts](app/api/vehicles/[id]/route.ts), etc.) authenticate purely via the `sb-access-token` cookie with no CSRF token, no `Origin`/`Referer` check, and no `SameSite` enforcement visible in this codebase (cookie is set outside this repo, so its `SameSite` attribute can't be verified here). If the cookie is anything other than `SameSite=Strict`/`Lax` with a same-site-only auth design, a malicious page could trigger authenticated cross-site POST/DELETE requests.
**Fix:** confirm/enforce `SameSite=Lax` or `Strict` on the auth cookies wherever they're actually set (not present in this repo — see C2), and consider a double-submit CSRF token for defense-in-depth.

**H3. CI never runs `tsc`, `next build`, or `next lint`.**
[.github/workflows/ci.yml](.github/workflows/ci.yml) runs `prisma generate` → `migrate deploy` → seed → `test:routes` → `test`. It never runs `npm run build` or `npm run lint`. TypeScript errors, unused-import lint failures, or a build-breaking change could merge to `main` undetected as long as Vitest specs pass.
**Fix:** add `npm run lint` and `next build` (or `tsc --noEmit`) as required CI steps.

**H4. Roughly a third of the "integration" test suite is tautological and asserts nothing about the code.**
[__tests__/integration/routes.test.ts](__tests__/integration/routes.test.ts), [tests/integration/dealer-routes.test.ts](tests/integration/dealer-routes.test.ts), [tests/activity-log-shape.test.ts](tests/activity-log-shape.test.ts), and [tests/health.test.ts](tests/health.test.ts) contain assertions like:
```ts
it('covers vehicle create route', () => { expect('/api/vehicles').toContain('/api/vehicles'); });
it('tracks unauthorized route access handling', () => { expect(401).toBe(401); });
it('scaffold is present', () => { expect(true).toBe(true); });
```
These import nothing from the application and cannot fail regardless of what the code does. They currently sit alongside genuinely valuable route tests ([tests/routes/vehicles.route.test.ts](tests/routes/vehicles.route.test.ts), [tests/routes/vin-analyses.route.test.ts](tests/routes/vin-analyses.route.test.ts)) that do real DB-backed assertions, which makes it easy to mistake the fake suite for real coverage when reading CI output ("42 passed").
**Fix:** delete these four files (or rewrite them to actually import and exercise the routes, duplicating what the real route tests already do) so the green checkmark reflects real coverage.

### 🟡 MEDIUM

**M1. No real AI/ML or VIN-decoding integration anywhere in the product.**
Every function in `lib/ai/*` — [vin-intelligence.ts](lib/ai/vin-intelligence.ts), [damage-analysis.ts](lib/ai/damage-analysis.ts), [auction-calculator.ts](lib/ai/auction-calculator.ts), [pricing-summary.ts](lib/ai/pricing-summary.ts), [repair-estimator.ts](lib/ai/repair-estimator.ts), [reconditioning-checklist.ts](lib/ai/reconditioning-checklist.ts), [opportunity-scoring.ts](lib/ai/opportunity-scoring.ts) — is pure deterministic arithmetic/if-else over its inputs (e.g. `recommendation = margin >= 2500 ? 'Healthy' : ...`). There is no call to an LLM, no VIN-decode API (NHTSA vPIC, Marketcheck, etc.), no computer-vision damage detection, nothing stochastic or model-backed. This is fine as a placeholder/demo, but the UI actively markets it as AI ("AI-driven acquisition signal scoring", "AI review workflow", "AI opportunity watchlist") which will misrepresent product capability to anyone evaluating a demo or investing engineering trust in these numbers.
**Fix:** either rename UI copy to be honest about "rule-based scoring" for this phase, or scope actual AI/VIN-decode integration work explicitly (this looks like the real Phase 2/3 product work, per [docs/phase2-plan.md](docs/phase2-plan.md), which itself doesn't mention any concrete AI vendor either).

**M2. Dealer dashboard hardcodes fake data for 4 of its 6 panels.**
In [app/dealer/page.tsx:42-112](app/dealer/page.tsx), `DamageAnalysisPanel`, `AuctionCalculatorPanel`, `RepairEstimatorPanel`, and `PricingSummaryPanel`/`ReconditioningChecklistPanel` are all fed literal in-file arrays (`'2020 Civic EX'`, `'Front bumper impact'`, etc.) rather than any data derived from the database or the current organization's vehicles. Only the VIN Intelligence panel and vehicle counts use real DB-backed data (correctly labeled `Badge>Live DB<`). Every dealer in every organization sees the exact same two fictional vehicles in four of six panels.
**Fix:** either wire these panels to real vehicle/VIN-analysis records (even via the existing heuristic functions) or clearly label them as "sample data" in the UI so users don't mistake demo content for their own inventory.

**M3. `loadAdminDashboard()` is intentionally platform-wide but this isn't documented as a design decision.**
[lib/loaders/dashboard.ts:45-56](lib/loaders/dashboard.ts) counts `Organization`, `User`, `Vehicle` globally and shows the 5 most recent activity/audit entries platform-wide, with no `organizationId` filter. Given `ADMIN` is a `Membership` role tied to one `organizationId` (per `rolePermissions` and the schema), it's ambiguous whether "admin" here means "super-admin across the whole platform" or "org admin" — the code currently implements the former while `AppRole`/`Membership` modeling suggests the latter. Combined with M/C3 (vendor leak), this pattern of unscoped dashboard queries appears twice and should be a deliberate, documented product decision rather than incidental.

**M4. `requireSession()` is called twice per request for every protected page (layout + page).**
E.g. [app/dealer/layout.tsx:4](app/dealer/layout.tsx) and [app/dealer/page.tsx:16](app/dealer/page.tsx) both call `requireSession([...])`. `getSession()` is wrapped in React's `cache()` so the second call is deduped within a single render pass, but the role-array check and redirect logic still run twice, and the pattern will silently stop being deduplicated if `getSession`'s caching is ever changed. Low real cost today, but worth consolidating into a single call (e.g., only check role in the layout, or only in the page) for clarity.

**M5. Errors are swallowed silently in `DealerPage` with no logging.**
[app/dealer/page.tsx:171-177](app/dealer/page.tsx) wraps `loadDealerDashboard` in `try { ... } catch { return <...loaderError /> }` — any error (DB down, a bad query, a bug in `summarizeWorkflowStates`) is caught and discarded with no `console.error`/telemetry, so production failures here are invisible to operators.  A dedicated `error.tsx` boundary already exists ([app/dealer/error.tsx](app/dealer/error.tsx)) but is bypassed entirely by this local try/catch.

**M6. `PrismaClient` global caching pattern omits `datasourceUrl`/connection-pool tuning, and there's exactly one shared client for all environments.**
[lib/db/client.ts](lib/db/client.ts) is the standard Next.js dev-hot-reload-safe singleton, which is correct, but there's no connection pool size configuration for serverless/edge deployment (e.g., PgBouncer/`connection_limit` query param patterns commonly needed for Vercel + Supabase). Not a bug today, but will become a scalability issue under concurrent serverless invocations.

### 🟢 LOW

**L1. Duplicated `beforeEach` seed-data blocks.** [tests/routes/vehicles.route.test.ts](tests/routes/vehicles.route.test.ts) and [tests/routes/vin-analyses.route.test.ts](tests/routes/vin-analyses.route.test.ts) each repeat an identical ~25-line org/user/membership/vehicle seeding block. Same for [prisma/seed.ts](prisma/seed.ts) vs [prisma/test-seed/seed.ts](prisma/test-seed/seed.ts) (different data, same shape). Worth extracting a shared `seedBaseFixtures()` test helper in `tests/setup/`.

**L2. `npm run test` re-runs everything `npm run test:routes` already ran.** [package.json:13-14](package.json) — `test:routes` is `vitest run tests/routes`, but plain `vitest run` (the `test` script) already matches `tests/**/*.test.ts`, which includes `tests/routes/**`. CI ([.github/workflows/ci.yml:41-42](.github/workflows/ci.yml)) runs both back-to-back, executing the route/DB tests twice. Harmless but wastes CI time and DB churn.

**L3. `next.config.mjs` has no security headers configured** (no CSP, `X-Frame-Options`, `Strict-Transport-Security`, etc.) — reasonable for a Phase 1 scaffold, but worth tracking before any real launch.

**L4. Zod schemas accept `z.record(z.any())` for `decodedPayload`/`manualCorrections`** ([lib/validators/vin-analysis.ts:5-6](lib/validators/vin-analysis.ts)) with no size limit or shape constraint. Since this is stored as Postgres `Json` and echoed back into `ActivityLog.payload`/`AuditLog.afterState`, a client could submit an arbitrarily large JSON blob on every mutation with no validation, which is both a minor DoS/storage-bloat vector and makes the audit trail harder to reason about.

**L5. `Vehicle.workflowState` and `VinAnalysis.workflowState` are untyped `String` columns** even though [lib/validators/vehicle.ts](lib/validators/vehicle.ts) and [lib/validators/vin-analysis.ts](lib/validators/vin-analysis.ts) each define their own **different** enums of allowed values (`NEW|CONTACTED|QUALIFIED|OFFERED|PURCHASED|SOLD|PASSED` vs `NEW|REVIEWED|QUALIFIED|OFFERED|PURCHASED|SOLD|PASSED`), and [lib/validators/vin-workflow-model.ts](lib/validators/vin-workflow-model.ts) defines yet a **third**, unused stage list (`ENTERED|DECODED|VALIDATED|...`) that doesn't match either. This is dead/unreferenced code (`VinWorkflowStage` type has zero importers found in the repo) and a source of confusion about which workflow model is authoritative.

**L6. No pagination anywhere.** `listVehiclesForOrg`, `listVinAnalysesForOrg`, and `listOpportunitySummariesForOrg` ([lib/server/*.ts](lib/server)) all do unbounded `findMany` over an organization's full history. Fine at demo scale; will degrade linearly as any single dealer accumulates thousands of vehicles/analyses. Worth adding `take`/cursor-based pagination before Phase 2's analytics push.

---

## 4. Duplicated / Dead Code Summary

- **Dead:** `lib/validators/vin-workflow-model.ts` — `VinWorkflowStage` type appears unused anywhere else in the repo (see L5).
- **Duplicated:** route test seed fixtures (L1), the two `prisma/*seed.ts` scripts, and the repeated `requireSession` calls in every layout+page pair (M4).
- **Near-duplicated logic:** `buildAuctionCalculatorResults`, `buildPricingSummary`, and `buildRepairEstimatorResults` in `lib/ai/*` each independently reimplement "sum of cost components → margin/profit → threshold-based recommendation" with slightly different thresholds and no shared helper — consider a common `classifyByThreshold(value, {healthy, watch})` utility if a fourth similar module is added.

---

## 5. Missing Features (relative to what the schema/UI imply)

1. Working login/register/session-issuance flow (C2) — currently the single biggest functional gap.
2. Any real VIN decode/valuation data source (NHTSA vPIC or a commercial VIN API) feeding `decodedPayload`/market values, rather than manual form entry only.
3. Stripe is a declared dependency (`stripe: ^16.7.0` in [package.json](package.json)) and `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` exist in `.env.example`, but there is no billing route, webhook handler, or Stripe SDK usage anywhere in the codebase — likely scaffolded for a future phase but currently 100% unused surface area/attack surface (a secret key config with nothing consuming it).
4. No admin UI for managing organizations/memberships/roles (the `admin` dashboard is read-only counts).
5. No password reset / email verification / multi-factor flows (expected given C2 is unimplemented).
6. No rate limiting on any API route.

---

## 6. Performance & Scalability Notes

- `loadDealerDashboard` fires 6 parallel queries (including a nested `listOpportunitySummariesForOrg` which itself does another `findMany` with a `vinAnalyses` include) on every dealer page load — reasonable at small scale, but `listOpportunitySummariesForOrg` doesn't reuse the `recentVehicles`/`analyses` result already fetched in the same `Promise.all`, causing a redundant vehicle table scan per request ([lib/loaders/dashboard.ts:5-26](lib/loaders/dashboard.ts)).
- No caching layer (React `cache()` is per-request only, not cross-request) — every dashboard view re-queries Postgres from scratch.
- See L6 (no pagination) and M6 (no connection pool tuning) above.

---

## 7. What's Working Well (worth preserving)

- Multi-tenant scoping is done correctly and consistently in `vehicle-service.ts`, `vin-analysis-service.ts`, and `opportunity-service.ts` — every query, update, and delete filters by `organizationId` and returns `404` (not `403`) for cross-tenant access attempts, which correctly avoids leaking existence of other orgs' records.
- RBAC (`lib/rbac/permissions.ts`) is a simple, readable allow-list model with an admin wildcard, and is exercised by real tests (not just tautologies) in `route-auth-execution.test.ts` and the route test suites.
- Every mutation writes both an `AuditLog` and `ActivityLog` entry with before/after state, which is a solid foundation for compliance/observability once the product matures.
- Zod validation is applied at every route boundary, and `handleRouteError` centralizes consistent error envelopes (`{ok, error: {code, message}}`) across all routes.
- Unit tests for the heuristic AI functions and validators are genuine and reasonably thorough (`vin-intelligence.test.ts`, `opportunity-service.test.ts`, `workflow-summary.test.ts`, etc.).

---

## 8. Prioritized Recommendation Roadmap

1. **Fix C1 (migrations)** — regenerate a real baseline migration from `schema.prisma`; nothing else can be verified end-to-end until this works.
2. **Fix C3 (vendor data leak)** — one-line-scope fix, ship immediately.
3. **Decide and implement C2 (real login/register)** — this blocks any actual usage of the product outside of test mode.
4. **Clean up the test suite (H4)** — delete or rewrite the tautological files so CI green means what it appears to mean.
5. **Add `build`/`lint` to CI (H3)**.
6. **Resolve the middleware/refresh-token logic (H1)** and confirm cookie `SameSite`/CSRF posture (H2) before any external exposure.
7. **Make a product decision on the AI layer (M1)** — either relabel as heuristic/rule-based for this phase, or scope real VIN-decode/LLM integration as the next major workstream.
8. **Replace hardcoded dealer-panel demo data (M2)** with real org-scoped data or explicit "sample data" labeling.
9. Address remaining Medium/Low items opportunistically (pagination, dead workflow-model file, duplicated seed fixtures, connection pooling) as the product scales.

---

*No source files were modified in the creation of this report. Awaiting approval before making any changes.*

---

## 9. Phase 6f Security Review (OWASP Top 10-focused, full codebase)

Re-audit performed after Phases 1-6 (auth, multi-tenant hardening, VIN intelligence, vehicle-intelligence platform, and the enterprise CRM/inventory/sales/copilot/analytics platform). One real, significant finding, now fixed; everything else below was verified clean.

### Finding, fixed: CSRF was only ever enforced on the Phase 2 auth routes
Every state-changing route added in Phases 1, 3, 4, 5, and 6 (`/api/vehicles*`, `/api/vin-analyses*`, `/api/crm/*`, `/api/inventory/*`, `/api/sales/*`) authenticates purely via the `access_token` session cookie, which the browser attaches automatically - but none of them verified the double-submit CSRF cookie/header pair that `lib/security/guards.ts` already provides and that the Phase 2 auth routes (login/logout/register/refresh/password-reset/verify-email) already used correctly. A malicious page could have driven a logged-in dealer's browser into creating/deleting vehicles, customers, sales, etc.
**Fixed:** `requireCsrfToken(request)` added to every POST/PATCH/DELETE handler across the app (26 route files). The shared test helper (`tests/setup/route-test-helpers.ts`'s `jsonRequest`) now attaches a matching CSRF cookie+header by default, so all 299 existing tests continued to pass without per-file changes, and a new `tests/routes/csrf-enforcement.route.test.ts` explicitly proves the check rejects requests without it (and that the target record is left untouched). `middleware.ts`'s edge-layer prefix list was also broadened to cover `/api/crm`, `/api/inventory`, `/api/sales`, `/api/copilot`, and `/api/analytics`, which had been missing from the fast-fail gate (the authoritative `getSession()` check in each route handler still covered them, so this was a defense-in-depth gap, not a full bypass).

### Verified clean
- **Injection**: no `$queryRaw`/`$executeRaw` anywhere in the codebase; every query goes through Prisma's parameterized query builder.
- **XSS**: no `dangerouslySetInnerHTML`, `eval`, or `new Function` anywhere; all rendered content goes through React's default escaping.
- **SSRF**: the only outbound `fetch()` calls (NHTSA vPIC decode and recalls) target a hardcoded base URL; user-supplied VIN/make/model/year values are only ever inserted into the path (URL-encoded) or query string, never the hostname, and the VIN is format-validated (17 chars, valid charset) before it ever reaches the fetch call.
- **File upload security**: no file upload endpoint exists anywhere in the app (documents are server-generated PDFs, not user-uploaded files), so this attack surface doesn't apply yet.
- **Rate limiting**: present on every auth endpoint (Phase 2), CRM email/SMS sending (Phase 6a), the AI copilot (Phase 6d), and now added to the two remaining resource-intensive endpoints that had none - VIN intelligence analysis (`/api/vin-analyses/analyze`, calls out to NHTSA) and PDF report generation (`/api/vehicles/[id]/report`).
- **API abuse / authorization**: every route consistently derives `organizationId` from the authenticated session (never client input) and gates on `requireRoutePermission`; the Phase 3 tenant-isolation regression tests and this phase's CSRF tests both confirm cross-tenant mutation attempts are rejected without side effects.
- **Secrets management**: no hardcoded credentials or private keys found in the codebase; `.gitignore` excludes real `.env`/`.env.local` files (`.env.test`/`.env.test.example` are intentionally committed and contain only non-sensitive placeholder values); every premium provider key is read from `process.env` and documented in `.env.example`.
- **Audit logging**: every mutation across every phase writes both an `AuditLog` and `ActivityLog` entry with before/after state, consistently, including every new Phase 6 domain (CRM, inventory workflows, sales).

## 10. Phase 7 Security Review (Payments, User Management, Notifications, Admin, Operations, Deployment)

Re-audit performed after Phase 7 (7a-7e: Stripe billing, invitations/teams/API keys, in-app notifications, the Super Admin console, background jobs/caching/health, and the Docker/CI deployment work). No critical findings; two notable design decisions are called out below since they deliberately deviate from the simplest-possible implementation for security reasons, and everything else was verified clean.

### Design decision: Super Admin is a separate flag, not a role
Phase 3 fixed the per-org `ADMIN` role so its dashboards/queries only ever see its own organization. Phase 7's "Super Admin console" requirement - platform staff needing to see *all* tenants - directly risked re-introducing that same cross-tenant leakage if implemented carelessly (e.g., by just checking `role === 'ADMIN'` for the new endpoints). Instead, `User.isSuperAdmin` is a boolean completely independent of `Membership`/`RoleKey`, checked by a separate `requireSuperAdmin()` gate that every `/api/superadmin/*` route uses instead of `requireRoutePermission()`. The Phase 3 tenant-isolation tests and regression suite are unaffected; a new test (`tests/routes/superadmin.route.test.ts`) explicitly proves a regular `DEALER_OWNER`/`ADMIN` session (without the flag) is rejected from every superadmin route.

### Design decision: CSRF is exempted for bearer API-key requests, not disabled
Phase 7b's API keys are real bearer credentials (`Authorization: Bearer dos_...`). CSRF is specifically an attack against *ambient* browser credentials (a cookie sent automatically); a request that must explicitly attach a bearer token isn't forgeable that way, so `requireCsrfToken()` skips its check only when that specific header prefix is present - `tests/csrf-api-key-exemption.test.ts` confirms this doesn't accidentally exempt arbitrary `Authorization: Bearer <other-token>` traffic, and `tests/routes/csrf-enforcement.route.test.ts`'s existing coverage confirms cookie-authenticated requests are unaffected.

### Verified clean
- **Webhook authenticity**: `/api/webhooks/stripe` is the one endpoint that accepts unauthenticated requests by design (Stripe calls it directly) - it verifies `Stripe-Signature` via `stripe.webhooks.constructEvent` before trusting anything in the payload, and is idempotent (`StripeWebhookEvent` ledger) against Stripe's at-least-once redelivery.
- **Injection / XSS / SSRF**: no new `$queryRaw`/`$executeRaw` beyond the existing `SELECT 1` health/readiness checks (no user input involved); no new `dangerouslySetInnerHTML`/`eval`; no new outbound `fetch()` targets beyond the existing NHTSA calls - Stripe requests go through the official SDK, never a hand-built URL.
- **Authorization**: every new Phase 7 route (billing, team, account, superadmin) derives `organizationId`/`userId` from the session, never from client input; last-owner-removal and cross-org membership checks are covered by `tests/routes/team.route.test.ts`.
- **Secrets management**: dead `SUPABASE_*` env vars left over from the Phase 2 auth rewrite were removed from `.env.example`/`.env.test*`/CI (they were unused, but an unused-looking secret invites confusion about what's actually load-bearing); no real Stripe/production secret is committed anywhere, and `.env.production.example` documents every required variable without values.
- **Rate limiting**: present on every new mutating Phase 7 route (checkout, portal, usage recording, team invitations/role changes/API key creation, notification actions, feature-flag changes).
- **Audit logging**: every Phase 7 mutation writes to `AuditLog`/`ActivityLog` (org-scoped actions) or the new `SuperAdminAuditLog` (platform-scoped actions), consistently with prior phases.
- **Maintenance mode fail-safe**: enabling it 503s all non-superadmin traffic but never locks out the Super Admin console itself, so a mistaken enable can always be reversed without direct database access.
