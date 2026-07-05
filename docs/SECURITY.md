# Security

This is a summary reference. The authoritative, evidence-based record is
`REPORT.md` - the original Phase 0 audit plus a security re-review
appended at the end of Phase 6 (Section 9) and Phase 7 (Section 10),
each listing exactly what was checked and what was found.

## Authentication

- Argon2id password hashing (`@node-rs/argon2`), OWASP-recommended
  parameters (`lib/security/password.ts`).
- Password policy prioritizes length (12-128 chars) over forced
  complexity rules, per OWASP ASVS guidance; common weak passwords and
  passwords containing the account's own email are rejected.
- Sessions are opaque, HMAC-signed, single-use-per-login tokens, hashed
  again before storage - the database never holds a raw, replayable token.
- A password reset revokes every existing session for that user.
- Login failures return an identical, generic message regardless of
  whether the email exists (`invalid email or password`) - no account
  enumeration via the login or password-reset-request endpoints.
- API keys (Phase 7b) use the same signed-token mechanism as sessions,
  are hashed at rest, support expiry, and are revocable; the raw value
  is shown exactly once, at creation.

## Authorization

- `requireRoutePermission(permission)` is the single gate every
  org-scoped route uses; `organizationId` is always derived from the
  session, never from client input (path param, query string, or body).
- Every service function repeats the `organizationId` filter in both the
  ownership check and the actual mutating Prisma call (defense in
  depth) - see `docs/ARCHITECTURE.md`.
- The Super Admin console (`isSuperAdmin`) is a separate, orthogonal
  grant from org-level RBAC - see `docs/ARCHITECTURE.md` and
  `REPORT.md` Section 10 for why that separation matters.

## CSRF

Double-submit cookie pattern (`csrf_token` cookie + `x-csrf-token`
header, `lib/security/csrf.ts`) enforced on every state-changing route.
Bearer API-key requests are exempted from this specific check, since
CSRF targets ambient browser cookies, not explicit headers a browser
never attaches on its own - see `REPORT.md` Section 10 and
`tests/csrf-api-key-exemption.test.ts`.

## Rate limiting

In-memory, per-instance fixed-window limiter (`lib/security/rate-limit.ts`)
applied to every auth endpoint and every resource-intensive or
abuse-prone route (VIN analysis, PDF report generation, email/SMS
sending, the AI copilot, checkout/portal session creation, team
invitations, API key creation, feature-flag changes). Being in-memory,
it does not share state across horizontally-scaled instances - the same
documented limitation applies to `lib/cache/cache-client.ts`'s default
implementation. A Redis-backed limiter/cache is the natural upgrade path
for a multi-instance deployment.

## Injection / XSS / SSRF

- No raw SQL string interpolation anywhere; all queries go through
  Prisma's parameterized query builder (the only raw SQL is a
  parameterless `SELECT 1` health check).
- No `dangerouslySetInnerHTML`, `eval`, or `new Function`.
- The only outbound `fetch()` calls target hardcoded base URLs (NHTSA);
  user input is only ever placed in the URL-encoded path/query, never
  the hostname, and is format-validated first.
- Stripe requests go through the official `stripe` SDK, never a
  hand-built URL.

## Webhook authenticity

`/api/webhooks/stripe` is the one intentionally-unauthenticated endpoint
(Stripe calls it directly, with no user session). It verifies the
`Stripe-Signature` header via `stripe.webhooks.constructEvent()` before
trusting anything in the payload, and is idempotent against Stripe's
at-least-once redelivery via a `StripeWebhookEvent` ledger.

## Secrets management

- No real secret is committed to the repository. `.env`/`.env.local`
  are gitignored; `.env.test`/`.env.test.example` intentionally contain
  only non-sensitive placeholder values used exclusively in CI/local
  tests.
- Every optional premium-provider key and every required production
  variable is documented (not valued) in `.env.example` /
  `.env.production.example`.
- `instrumentation.ts` fails the server startup fast if a required
  secret/config value is missing, rather than serving requests in a
  half-configured state.

## Audit trail

Every mutation writes both an `AuditLog` (before/after state) and an
`ActivityLog` (human-readable summary) entry, org-scoped. Platform-level
Super Admin actions (feature flags, etc.) write to a separate
`SuperAdminAuditLog`, since they aren't scoped to one organization.

## Known, documented limitations

- Rate limiting and caching are in-memory and per-instance - fine for a
  single-instance deployment, insufficient on their own for a
  horizontally-scaled one without a shared backing store (Redis).
- E-signatures are tracked as `MANUAL_WET_SIGNATURE` until a real
  e-signature provider is configured - this is an honest label, not a
  missing feature disguised as complete.
- No file-upload endpoint exists anywhere in the app (documents are
  server-generated PDFs), so that OWASP category doesn't currently apply.
