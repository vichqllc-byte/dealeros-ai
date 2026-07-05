# Test Database Setup

## Runtime option
Use `docker-compose.test.yml` for an isolated PostgreSQL route-test database.

## Test database runtime
- database: `dealeros_test`
- user: `dealeros_test`
- password: `dealeros_test_pw`
- port: `54329`

## Start test database
`npm run db:test:start`

## Stop test database
`npm run db:test:stop`

## Reset test database
`npm run db:test:reset`

## Apply migrations for tests
`npm run db:test:migrate`

## Seed test data
`npm run db:test:seed`

## Run route/database tests
`npm run test:routes`

## Run full route pipeline
`npm run test:routes:pipeline`

## Safety rule
Never point `.env.test` at development or production databases.
