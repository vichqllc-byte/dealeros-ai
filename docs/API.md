# API Reference

All responses are JSON, shaped `{ "ok": true, "data": ... }` on success or
`{ "ok": false, "error": { "code": string, "message": string, "details"?: unknown } }`
on failure. Endpoints marked **Auth** require a valid session (cookie or
`Authorization: Bearer <api-key>`); the **Permission** column is the
string checked by `requireRoutePermission()` (see `lib/rbac/permissions.ts`).
Mutating endpoints (POST/PATCH/PUT/DELETE) require a CSRF cookie+header
pair unless the request is authenticated via a Bearer API key (see
`docs/ARCHITECTURE.md`).

## Auth (`/api/auth/*`) - public

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/auth/csrf` | Issues a CSRF token cookie |
| POST | `/api/auth/register` | Creates a user + a new Organization (role `DEALER_OWNER`) |
| POST | `/api/auth/login` | Authenticates, sets session cookies |
| POST | `/api/auth/logout` | Revokes the current session |
| POST | `/api/auth/refresh` | Rotates access/refresh tokens |
| POST | `/api/auth/verify-email/request` | (Re)sends a verification email |
| POST | `/api/auth/verify-email/confirm` | Consumes a verification token |
| POST | `/api/auth/password-reset/request` | Sends a reset email (always 200, no account-enumeration) |
| POST | `/api/auth/password-reset/confirm` | Consumes a reset token, sets new password, revokes all sessions |

## Invitations (`/api/invitations/*`) - public

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/invitations/accept` | Accepts a team invitation by token; creates the user if new |

## Vehicles (`/api/vehicles/*`) - Auth

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| GET | `/api/vehicles` | `vehicles.read` | List vehicles for the org |
| POST | `/api/vehicles` | `vehicles.write` | Create a vehicle |
| GET | `/api/vehicles/[id]` | `vehicles.read` | Get one vehicle |
| PATCH | `/api/vehicles/[id]` | `vehicles.write` | Update a vehicle |
| DELETE | `/api/vehicles/[id]` | `vehicles.write` | Delete a vehicle |
| GET | `/api/vehicles/[id]/history` | `vehicles.read` | Vehicle history report (NMVTIS/CARFAX/AutoCheck pipeline) |
| GET | `/api/vehicles/[id]/report` | `vehicles.read` | Full intelligence report as a PDF |
| POST | `/api/vehicles/[id]/stage` | `vehicles.write` | Transition inventory stage (acquisition → sold) |

## VIN Intelligence (`/api/vin-analyses/*`) - Auth

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| GET | `/api/vin-analyses` | `vehicles.read` | List analyses |
| GET | `/api/vin-analyses/[id]` | `vehicles.read` | Get one analysis |
| POST | `/api/vin-analyses/analyze` | `vin.write` | Runs the full engine: decode, recalls, risk, valuation, damage, reconditioning, desirability, profitability, auction bid, health, explanation |

## CRM (`/api/crm/*`) - Auth, `crm.read` / `crm.write`

Customers, leads, tasks, notes, communications (+ `send-email` /
`send-sms`), appointments, email templates, and `follow-ups` (due-task
digest). Standard list/create at the collection path, get/update/delete
at `/[id]`.

## Inventory (`/api/inventory/*`) - Auth, `vehicles.read` / `vehicles.write`

Inspections, price records, listings (+ `/[id]`), `analytics` (workflow
funnel), and `export` (CSV/Excel of the current inventory).

## Sales (`/api/sales/*`) - Auth, `sales.read` / `sales.write`

| Method | Path | Description |
| --- | --- | --- |
| GET/POST | `/api/sales` | List / build a deal (creates the delivery checklist) |
| GET/PATCH | `/api/sales/[id]` | Get / update a sale (completing it moves the vehicle to Sold) |
| PATCH | `/api/sales/[id]/checklist` | Toggle a delivery-checklist item |
| POST | `/api/sales/[id]/trade-ins` | Add a trade-in (auto-appraises from a decoded VIN if no manual value given) |
| POST/PATCH | `/api/sales/[id]/financing[/[financingId]]` | Submit / update a financing application (real amortization math) |
| POST | `/api/sales/[id]/documents` | Create a sale document |
| GET | `/api/sales/[id]/documents/[documentId]/pdf` | Real PDF of the document |
| POST | `/api/sales/[id]/documents/[documentId]/sign` | Record a signature (`MANUAL_WET_SIGNATURE` unless `ESIGN_PROVIDER_API_KEY` is configured) |
| POST | `/api/sales/payment-calculator` | Stateless loan-payment calculator |

## AI Dealer Copilot (`/api/copilot/ask`) - Auth, any authenticated role

Real keyword/intent classification (`lib/copilot/intent-classifier.ts`)
over VIN analyses, inventory, and pricing data - not a simulated LLM.

## Analytics (`/api/analytics/*`) - Auth, `vehicles.read`

`dashboard` (revenue/profit/turn/lead-conversion/ROI/market-trend
metrics, cached 30s) and `dashboard/export` (CSV/Excel).

## Billing (`/api/billing/*`) - Auth, `billing.read` / `billing.write`

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/billing/checkout` | Creates a Stripe Checkout session for a plan |
| POST | `/api/billing/portal` | Creates a Stripe Billing Portal session |
| GET | `/api/billing/subscription` | Current subscription + the plan catalog |
| GET | `/api/billing/invoices` | Invoice history (synced from Stripe webhooks) |
| GET/POST | `/api/billing/usage` | List / record metered-usage records |

## Webhooks (`/api/webhooks/stripe`) - public, signature-verified

Verifies `Stripe-Signature`, is idempotent (`StripeWebhookEvent`), syncs
`Subscription`/`Invoice` state from `checkout.session.completed`,
`customer.subscription.*`, and `invoice.*` events.

## Team management (`/api/team/*`) - Auth, `team.read` / `team.write`

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/team/members` | List members |
| PATCH/DELETE | `/api/team/members/[id]` | Change role / remove (blocked if it would leave zero owners) |
| GET/POST | `/api/team/invitations` | List / send an invitation |
| DELETE | `/api/team/invitations/[id]` | Revoke a pending invitation |
| GET/POST | `/api/team/api-keys` | List (metadata only) / create (raw key returned once) |
| DELETE | `/api/team/api-keys/[id]` | Revoke a key |

## Account self-service (`/api/account/*`) - Auth, session only (no RBAC permission)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/account/sessions` | List your own active sessions (real login history) |
| DELETE | `/api/account/sessions/[id]` | Revoke one of your own sessions |
| GET | `/api/account/activity` | Your recent ActivityLog entries |
| GET | `/api/account/notifications` | List (optionally `?unread=true`) + unread count |
| POST | `/api/account/notifications/[id]/read` | Mark one read |
| POST | `/api/account/notifications/read-all` | Mark all read |
| GET/PATCH | `/api/account/notifications/preferences` | Email/SMS/push/in-app toggles |

## Super Admin console (`/api/superadmin/*`) - Auth, `User.isSuperAdmin` only

Independent of org-scoped RBAC - see `docs/ARCHITECTURE.md`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/superadmin/tenants` | All organizations with member/vehicle counts and subscription status |
| GET | `/api/superadmin/tenants/[id]` | One organization's detail, including its members |
| GET | `/api/superadmin/tenants/[id]/audit` | That organization's real AuditLog (cross-tenant view) |
| GET | `/api/superadmin/users` | All users platform-wide |
| GET | `/api/superadmin/billing` | Real billing overview (counts by status, revenue actually collected, active seats) |
| GET | `/api/superadmin/system-health` | DB connectivity/latency, process uptime/memory, counts, provider config status |
| GET | `/api/superadmin/providers` | Per-provider configured true/false (no secret values) |
| GET/PUT | `/api/superadmin/feature-flags` | List / set a platform-wide flag (e.g. `maintenance_mode`) |
| GET | `/api/superadmin/audit` | Platform-level `SuperAdminAuditLog` |
| GET | `/api/superadmin/jobs` | Recent job queue rows + counts by status |
| POST | `/api/superadmin/jobs/tick` | Runs due scheduled jobs + processes due queue jobs (call this from an external scheduler) |

## Health (public)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Basic liveness (legacy) |
| GET | `/api/health/live` | Liveness probe - no DB dependency |
| GET | `/api/health/ready` | Readiness probe - real DB connectivity check |
| GET | `/api/health/insights` | Org-scoped operational counts (Auth, `audit.read`) |
