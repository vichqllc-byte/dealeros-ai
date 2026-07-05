# Architecture

DealerOS AI is a Next.js 14 (App Router) monolith backed by PostgreSQL via
Prisma. There is no separate backend service - route handlers under
`app/api/**` are the entire API surface, calling into a plain TypeScript
service layer under `lib/server/**`.

## Layering

```
app/api/**/route.ts        - HTTP concerns only: auth, CSRF, rate limiting,
                              request parsing, response shaping
lib/server/**               - DB-touching business logic, org-scoped
lib/<domain>/**             - Pure logic with no DB access (calculators,
                              scoring, provider gateways, validators)
lib/validators/**           - Zod schemas, one file per domain
prisma/schema.prisma         - Single source of truth for the data model
```

A route handler's job is small and mechanical:

```ts
export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('vehicles.write');
    requireCsrfToken(request);
    enforceRateLimit(request, `vehicles:create:${auth.session.organizationId}`, 30, 60 * 60);
    const body = await request.json();
    const vehicle = await createVehicleForOrg(auth.session.organizationId, auth.session.userId, body);
    return ok(vehicle, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
```

Every mutating route follows this same shape. `lib/api/responses.ts`'s
`handleRouteError` is the single place that turns a thrown `AppError`,
`ZodError`, or unexpected `Error` into the right HTTP response - see
"Error handling" below for why it re-throws certain Next.js-internal
errors instead of converting them.

## Multi-tenancy

Every tenant-owned row carries an `organizationId` column. The
`organizationId` used in a query is **always** derived from the caller's
session (`getSession()` → `Membership.organizationId`), never from a
client-supplied value. Every service function repeats the
`organizationId` filter in both the ownership check *and* the actual
mutating call:

```ts
const existing = await db.vehicle.findFirst({ where: { id, organizationId } });
if (!existing) throw new AppError('Not found', 404, 'NOT_FOUND');

const { count } = await db.vehicle.updateMany({ where: { id, organizationId }, data: input });
if (count === 0) throw new AppError('Not found', 404, 'NOT_FOUND');
```

This defense-in-depth pattern means a bug that skips the ownership check
still can't leak or mutate another organization's row, because the
`organizationId` filter is baked into the write itself. See
`tests/routes/tenant-isolation.route.test.ts` for the regression suite
this was built to satisfy (Phase 3).

Platform-level Super Admin access (`User.isSuperAdmin`, Phase 7d) is a
deliberately separate, orthogonal grant - it does **not** flow through
`organizationId` scoping at all, and `requireSuperAdmin()` is a distinct
gate from `requireRoutePermission()`. A super admin still needs a normal
org `Membership` to log in in the first place (`getSession()` requires
one), but that membership's role has nothing to do with console access.

## Authentication

Self-hosted, cookie-based sessions (no third-party auth provider):

- Passwords hashed with Argon2id (`@node-rs/argon2`), OWASP-recommended parameters.
- Session/refresh tokens are opaque, HMAC-signed (`<random-id>.<signature>`,
  Web Crypto `crypto.subtle`), and hashed again before storage (`Session.accessTokenHash`).
  The DB never stores a raw token.
- `middleware.ts` runs on the Edge runtime and can only verify a token's
  HMAC signature (no Prisma in Edge). The authoritative check - expiry,
  revocation, which org/role it maps to - happens in `getSession()`
  (Node runtime), called at the top of every route handler.
- API keys (Phase 7b) are minted with the *same* signed-token format, so
  the Edge middleware admits a valid `Authorization: Bearer dos_<token>`
  header exactly like the cookie, and `getSession()` resolves it against
  the `ApiKey` table as a second credential type.

## RBAC

`lib/rbac/permissions.ts` maps each `RoleKey` (`DEALER_OWNER`,
`DEALER_BUYER`, `VENDOR_MANAGER`, `ADMIN`) to a flat list of permission
strings (`vehicles.write`, `billing.read`, ...). `ADMIN` holds a wildcard.
`requireRoutePermission(permission)` is the single call every protected
route makes; there is no per-route special-casing.

## The "honesty framework" for external dependencies

Several features depend on a paid vendor (Stripe, CARFAX, NHTSA-adjacent
premium providers, DocuSign-style e-signature, SMS/push) or an LLM that
this environment has no live credentials for. Every one of these follows
the same rule, applied consistently since Phase 4:

1. Build a **real, correctly-shaped adapter** matching the vendor's
   actual documented request/response contract - never guessed field names.
2. Provide a **real default implementation** using free/public data where
   one genuinely exists (NHTSA vPIC/recalls - no key required).
3. Where no free equivalent exists, fail with a typed
   `ProviderNotConfiguredError` (naming the missing env var) or fall back
   to an honestly-labeled estimate/manual process - never fabricate a
   vendor's wire format or pretend a fake capability is real.

Concretely: sale documents are tracked as `MANUAL_WET_SIGNATURE` unless a
real e-signature provider is configured; the AI Dealer Copilot uses real
keyword/intent classification, not a simulated LLM; email/SMS/push all
have a real transport interface with a console-logging default transport.

## Dependency injection / repository pattern

`lib/vin-intelligence/**` and `lib/billing/**` both follow the same
shape: a narrow repository/gateway interface, a real default
implementation (`NhtsaVinDecoderRepository`, `RealStripeGateway`), and a
service class/function that takes the interface as a constructor/default
parameter. Tests substitute a fake only at that true I/O boundary - every
line of actual business logic (VIN checksum validation, risk scoring,
checkout-session construction, webhook processing) runs for real in
tests, nothing is mocked away.

## Background work

There is no persistent worker process in this deployment (Next.js route
handlers are the only compute). `lib/jobs/job-queue.ts` is a real,
Postgres-backed queue (claim via conditional `PENDING -> RUNNING`
update, retry with backoff, dead-letter after `maxAttempts`), but jobs
only run when `POST /api/superadmin/jobs/tick` is invoked - by an
external scheduler (cron, a platform's scheduled-function feature). This
is a standard, honest pattern for background work in a serverless app,
not a shortcut.

## Caching

`lib/cache/cache-client.ts` is a generic `CacheClient` interface with a
real in-memory default implementation (single-instance only - same
documented limitation as `lib/security/rate-limit.ts`'s in-memory rate
limiter). It's used for the maintenance-mode flag check (avoids a DB
round trip on every request) and the analytics dashboard (avoids
re-running several full-table aggregate queries on every dashboard
open). A Redis-backed implementation of the same interface is the
natural next step for horizontally-scaled deployments; it isn't built
here since no Redis client package/instance exists to verify one against.

## Error handling

`handleRouteError` re-throws any error carrying a Next.js-internal
`digest` (`DYNAMIC_SERVER_USAGE`, `NEXT_REDIRECT`, `NEXT_NOT_FOUND`)
instead of reporting/converting it - these are framework control-flow
signals, not application bugs, and swallowing them either produces
false-positive error reports or breaks the framework behavior they
exist for. Every genuine unexpected error is both reported
(`lib/errors/error-reporter.ts` - console by default, a real interface
ready for Sentry/etc.) and converted to a `{ ok: false, error }` JSON
response with the right status code.
