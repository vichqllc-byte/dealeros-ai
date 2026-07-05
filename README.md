# DealersOS Phase 1 Production Scaffold

This repository is the safe Phase 1 foundation for converting DealersOS from a static prototype into a production SaaS application.

## Batch 10 changes
- Added Docker Compose PostgreSQL runtime for route/database tests.
- Added test DB lifecycle commands for start, stop, migrate, seed, and route test execution.
- CI now provisions PostgreSQL before route tests.
- Route/database hardening remains limited to vehicle and VIN critical paths.

## Route/database hardening commands
- Start test DB: `npm run db:test:start`
- Stop test DB: `npm run db:test:stop`
- Reset isolated test DB: `npm run db:test:reset`
- Apply test migrations: `npm run db:test:migrate`
- Seed test DB: `npm run db:test:seed`
- Run route tests: `npm run test:routes`
- Run full route pipeline: `npm run test:routes:pipeline`

## Critical limitation
Do not call this Beta yet. Real DB-backed route tests require Docker or another reachable PostgreSQL runtime in the environment where they execute.
