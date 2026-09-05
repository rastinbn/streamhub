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

## Bootstrap gotchas (worth knowing before adding a spec)

- The suite boots the real `AppModule` and swaps only Postgres/Redis for
  in-memory fakes (`test/utils/`). Global plumbing that `main.ts` adds
  (`AllExceptionsFilter`, the `ValidationPipe`) must be added manually in
  each spec's `beforeAll` — the error-envelope assertions throughout the
  suites depend on `app.useGlobalFilters(new AllExceptionsFilter())`.
- The global rate limit (`ThrottlerGuard` bound via `APP_GUARD`) cannot be
  overridden by swapping the guard class out of the test container.
  Neutralize its **storage** instead:

  ```ts
  .overrideProvider(ThrottlerStorage)
  .useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }) })
  ```

  Without this, a spec that makes more than 20 requests in a minute gets
  intermittent `429`s. (`Phase 8 analytics`: the flush timer is disabled
  under `NODE_ENV=test`; specs drive `AnalyticsService.flushNow()` directly.)

## Adding tests for a new module

- Add a unit spec next to any non-trivial service/util as you write it.
- Add (or extend) an e2e spec in `test/` for the module's public HTTP
  surface once its controller exists. Reuse `test/utils/fake-prisma.service.ts`
  and `test/utils/fake-redis.service.ts` — extend their in-memory model
  coverage rather than adding a second mocking approach.
