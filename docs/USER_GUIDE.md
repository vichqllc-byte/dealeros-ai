# User Guide

## Roles

| Role | Typical use |
| --- | --- |
| `DEALER_OWNER` | Full access: vehicles, VIN analysis, CRM, sales, billing, team management |
| `DEALER_BUYER` | Vehicle/VIN/CRM access for day-to-day acquisition work; read-only on team |
| `VENDOR_MANAGER` | Quote-only access for an external vendor relationship |
| `ADMIN` | Full access within their organization (wildcard permission) |

A separate, platform-level `isSuperAdmin` flag exists for operating the
whole platform across all organizations - see `docs/ADMIN_GUIDE.md`.
It's unrelated to these four roles.

## Getting started

1. Register (`POST /api/auth/register`) - this creates your account *and*
   a brand-new Organization with you as `DEALER_OWNER`.
2. Verify your email (a real, single-use, time-limited token is emailed -
   logged to the server console in this environment, since no SMTP
   provider is configured; see `.env.example`).
3. Invite your team: `POST /api/team/invitations` with an email and role.
   They'll get an invite link valid for 7 days.

## VIN Intelligence

`POST /api/vin-analyses/analyze` with a VIN runs the full pipeline:
NHTSA decode (make/model/trim/engine/safety equipment), open recalls,
risk/fraud/odometer-anomaly assessment, market/wholesale/retail
valuation, damage and reconditioning estimates, desirability and
profitability scoring, an auction-bid recommendation if applicable, a
vehicle health score, and a plain-language explanation of the overall
BUY/NEGOTIATE/WAIT/PASS recommendation.

Premium data sources (CARFAX, AutoCheck, Black Book, JD Power, Manheim
MMR, Copart/IAAI, ...) are used automatically once their API key is
configured (`.env.example`); until then, each falls back to a
clearly-labeled estimate rather than silently guessing.

`GET /api/vehicles/[id]/report` turns all of this into a PDF you can
hand to a buyer or file for records.

## CRM

Customers, leads, tasks (assigning one notifies the assignee), notes,
communications (with real send-email/send-sms actions), appointments,
and reusable email templates - all under `/api/crm/*`.

## Inventory workflow

A vehicle moves through `ACQUISITION → PURCHASE → INSPECTION →
RECONDITIONING → PRICING → PUBLISHING → SOLD` via
`POST /api/vehicles/[id]/stage`. Completing a sale always moves the
vehicle to `SOLD`, even if it skipped earlier stages - a completed sale
is a real business event that overrides the normal ordering.

## Sales

`POST /api/sales` builds a deal (creates the delivery checklist
automatically). From there: trade-ins (auto-appraised from a decoded VIN
if you don't supply a manual value), financing applications (real loan
amortization math), and sale documents with a real generated PDF. Until
an e-signature provider is configured, signatures are recorded as
`MANUAL_WET_SIGNATURE` - an honest label, not a fake e-signature.

## AI Dealer Copilot

`POST /api/copilot/ask` answers questions about VIN analyses, inventory,
pricing, and KPIs using real keyword/intent classification over your
organization's actual data - it explains its reasoning rather than just
returning a number.

## Analytics

`GET /api/analytics/dashboard` - revenue, gross/net profit, inventory
turn rate, average days to sell, acquisition sources, lead conversion,
sales performance, ROI, and market-trend breakdowns, all computed from
your organization's real rows (a fresh org correctly shows zeros, not
sample data). Export as CSV/Excel from `/api/analytics/dashboard/export`.

## Billing (owners/admins only)

`POST /api/billing/checkout` starts a Stripe Checkout session for a plan
(new subscribers get a 14-day trial automatically); `POST /api/billing/portal`
opens Stripe's own billing portal for managing payment methods and
cancellation. `GET /api/billing/subscription` and `/invoices` show your
current plan and invoice history.

## Team management (owners/admins only)

Invite/remove members and change roles under `/api/team/*` - an
organization can never be left with zero owners (the last-owner guard
blocks both demoting and removing the final `DEALER_OWNER`). API keys
(`/api/team/api-keys`) are real bearer credentials for programmatic
access - the raw key is shown exactly once, at creation time.

## Your account

`/api/account/*` is self-service, available to any authenticated role
regardless of org permissions: your own active sessions (a real login
history - revoke one to sign that device out), your recent activity, and
your notification center + preferences (email/SMS/push/in-app toggles).
