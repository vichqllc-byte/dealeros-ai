# DealerOS AI

An enterprise dealership operating system: real VIN decoding/valuation/
risk intelligence (NHTSA-backed, with pluggable premium data providers),
CRM, inventory workflows, a sales/deal-builder pipeline, an AI Dealer
Copilot, analytics, Stripe billing, team/API-key management, in-app
notifications, and a platform-wide Super Admin console - built on
Next.js 14 (App Router) and PostgreSQL via Prisma.

## Documentation

| Doc | Covers |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layering, multi-tenancy, auth, RBAC, the honesty framework for external providers, background jobs, caching |
| [`docs/API.md`](docs/API.md) | Every route, grouped by domain, with the permission each requires |
| [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) | How a dealer uses the platform day to day |
| [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md) | The Super Admin console (tenants, billing, feature flags, jobs) |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Security posture summary (see `REPORT.md` for the full audit trail) |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Docker/PaaS deployment, env vars, migrations, CI/CD, monitoring |
| [`docs/DISASTER_RECOVERY.md`](docs/DISASTER_RECOVERY.md) | Backup/restore procedure and recovery objectives |
| [`REPORT.md`](REPORT.md) | The original codebase audit, plus a security re-review appended after each major phase |

## Local development

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL/DIRECT_URL/AUTH_TOKEN_SECRET at minimum
npx prisma generate
npx prisma migrate deploy
npm run dev
```

## Testing

```bash
npm run db:test:start        # docker compose Postgres for route/DB tests
npm run db:test:wait
npm run db:test:reset
npm run db:test:migrate
npm run db:test:seed
npm run test                 # full Vitest suite (skips DB-backed tests if no DB is reachable)
```

Or run the whole pipeline in one shot: `npm run test:routes:pipeline`.

## Quality gate

```bash
npx prisma validate
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

This is exactly what `.github/workflows/ci.yml` runs on every push/PR.

## Production deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) - Docker Compose is the
primary supported path (`Dockerfile` + `docker-compose.yml`), with notes
for PaaS platforms (Vercel, Railway, Fly.io, Render).
