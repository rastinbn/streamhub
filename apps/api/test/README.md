# apps/api — Testing

Two kinds of tests, both run by Jest (`jest.config.js` at the package root):

## Unit tests — `src/**/*.spec.ts`

Colocated next to the code they test, following standard NestJS convention.
Exercise a single class in isolation (a filter, a config loader, a service)
with mocked/hand-built collaborators — no HTTP server, no real Postgres/Redis.

Examples: `src/common/filters/all-exceptions.filter.spec.ts`,
`src/config/configuration.spec.ts`, `src/redis/redis.service.spec.ts`.

Run: `pnpm --filter @streamhub/api test:unit`

## Integration / e2e tests — `test/*.spec.ts`

Boot the real Nest application (real controllers, guards, DTO validation,
module wiring) and exercise it over HTTP via `supertest`. External
infrastructure (Postgres, Redis) is swapped for in-memory fakes registered
under the real `PrismaService`/`RedisService` DI tokens (see `test/utils/`),
so the suite needs no running database to execute — it still exercises the
full request pipeline exactly as it runs in production.

Example: `test/auth.e2e.spec.ts`.

Run: `pnpm --filter @streamhub/api test:e2e`

## Everything

`pnpm --filter @streamhub/api test` runs both.

## Adding tests for a new module

- Add a unit spec next to any non-trivial service/util as you write it.
- Add (or extend) an e2e spec in `test/` for the module's public HTTP
  surface once its controller exists. Reuse `test/utils/fake-prisma.service.ts`
  and `test/utils/fake-redis.service.ts` — extend their in-memory model
  coverage rather than adding a second mocking approach.
