# Super Admin Console Guide

This covers `/api/superadmin/*` - platform operations, not the
per-organization admin experience (see `docs/USER_GUIDE.md` for that).

## Becoming a super admin

There is no self-service way to grant this - by design. Set
`User.isSuperAdmin = true` directly in the database for a specific,
trusted operator's account:

```sql
UPDATE "User" SET "isSuperAdmin" = true WHERE email = 'ops@yourcompany.com';
```

That user must **also** already belong to at least one Organization as
a normal member (any role) - `getSession()` requires a Membership to
issue a session at all. `isSuperAdmin` only unlocks the endpoints below;
it has no effect on that user's normal per-org permissions.

## Tenants

- `GET /api/superadmin/tenants` - every organization, with real member
  and vehicle counts and current subscription status/plan.
- `GET /api/superadmin/tenants/[id]` - one organization's members.
- `GET /api/superadmin/tenants/[id]/audit` - that organization's real
  audit trail. This is the one place cross-tenant data is intentionally
  visible - regular per-org `audit.read` never sees another org's log.

## Users

`GET /api/superadmin/users` - every user platform-wide, with their
memberships (org + role) and `isSuperAdmin` status.

## Billing

`GET /api/superadmin/billing` reports only numbers actually derivable
from stored data: subscription counts by status, real revenue collected
(sum of paid invoices), and active seats. It does **not** report MRR -
`Subscription` doesn't track billing interval precisely enough to
compute that number honestly, so it's omitted rather than guessed.

## System health

`GET /api/superadmin/system-health` - database connectivity/latency,
process uptime and memory, organization/user/active-session counts, and
per-provider configured status (`GET /api/superadmin/providers` returns
just the provider section on its own). No secret values are ever
returned, only booleans.

## Feature flags & maintenance mode

`GET`/`PUT /api/superadmin/feature-flags` manage arbitrary named
booleans. One key is special: `maintenance_mode`. When enabled, every
request that would otherwise go through `requireRoutePermission()` or
`requireSession()` gets a `503 MAINTENANCE_MODE` response - **except**
requests from a super admin, so you can still operate the console (and
flip it back off) while it's active. The flag is cached for 5 seconds
(`lib/cache/cache-client.ts`), so expect up to that much lag before a
toggle takes effect everywhere.

Every change here is recorded in `SuperAdminAuditLog`
(`GET /api/superadmin/audit`) - a separate trail from the per-org
`AuditLog`, since platform actions aren't scoped to one organization.

## Background jobs

`GET /api/superadmin/jobs` - recent job rows and counts by status.
`POST /api/superadmin/jobs/tick` - runs due scheduled jobs (currently:
hourly Stripe usage reporting) and processes up to 10 due queue jobs,
retrying failures with backoff up to `maxAttempts` before marking a job
`FAILED`. Wire an external scheduler to call this periodically (see
`docs/DEPLOYMENT.md`) - nothing runs on its own otherwise.

An API key minted by a super admin (`POST /api/team/api-keys` while
logged in as one) is the intended credential for that scheduler: it
inherits `requireSuperAdmin` access via the key's `createdByUserId`, and
Bearer-token requests are naturally exempt from the CSRF check.
