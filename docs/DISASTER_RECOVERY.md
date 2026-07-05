# Disaster Recovery

## What's at risk

A single PostgreSQL instance holds all state: every organization, user,
vehicle, VIN analysis, CRM record, sale, subscription, and audit trail.
There is no secondary datastore. Losing this database means losing
everything since the last backup.

## Backup procedure

`scripts/backup-db.sh` wraps `pg_dump` in the Postgres custom format
(compressed, supports selective/parallel restore):

```
DATABASE_URL=<prod-url> ./scripts/backup-db.sh ./backups
```

Run this on a schedule (cron, or a CI workflow with a schedule trigger)
against production. Recommended cadence: at minimum daily; hourly if
your write volume/RPO tolerance warrants it. Store backups somewhere
other than the database host itself (S3, another region, etc.) - a
backup that lives next to the thing it's backing up doesn't protect
against a host-level failure.

## Restore procedure

```
DATABASE_URL=<target-url> ./scripts/restore-db.sh ./backups/dealeros-backup-<timestamp>.dump
```

This **overwrites** the target database (`pg_restore --clean`) and
prompts for an explicit `yes` confirmation before doing anything. Always
restore into a fresh/isolated instance first to verify the backup is
good before pointing production traffic at it.

After restoring, run `npx prisma migrate deploy` to confirm the restored
schema matches `prisma/schema.prisma` (it should, if the backup was
recent and taken after the last migration was applied) - a mismatch here
means the backup predates a migration and needs the corresponding
`prisma/migrations/*/migration.sql` replayed manually.

## Recovery objectives

These are targets to design your backup cadence and infrastructure
around, not guarantees this document can make on its own - they depend
entirely on your actual backup frequency, storage durability, and how
quickly a human can execute the restore procedure above:

- **RPO (Recovery Point Objective):** bounded by your backup interval.
  Hourly backups → up to one hour of data loss in the worst case.
- **RTO (Recovery Time Objective):** the time to provision a fresh
  Postgres instance + run `restore-db.sh` + `prisma migrate deploy` +
  redeploy the app pointed at it. Rehearse this at least once - an
  untested restore procedure is not a real one.

## Stripe as a secondary source of truth for billing

`Subscription` and `Invoice` rows are a *cache* of Stripe's own state,
kept in sync via webhooks (`lib/server/billing/webhook-service.ts`). If
these tables are lost or restored from a stale backup, Stripe itself
still has the authoritative subscription/invoice history - a targeted
reconciliation job (fetch each customer's current subscription from the
Stripe API and re-upsert) can rebuild this state without any billing
data actually being lost, since Stripe wasn't affected by the outage.

## Application-level failure modes

- **Database unreachable:** `/api/health/ready` returns 503;
  `requireRoutePermission`/`requireSession` calls that hit the DB will
  fail with a 500 (reported via the error reporter). There's no
  read-through cache deep enough to serve real traffic without the DB.
- **Maintenance mode:** if you need to take the app offline for
  maintenance without a full outage, use
  `PUT /api/superadmin/feature-flags` with `{"key":"maintenance_mode","enabled":true}`
  as a super admin - every non-superadmin request gets a clean 503
  instead of an inconsistent partial failure. Remember to disable it
  afterward.
