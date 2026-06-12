# Contributing to Relayd

Thanks for your interest in making webhook infrastructure better. Whether you're fixing a bug, adding a feature, or improving docs — every contribution counts.

## Getting started

1. **Fork** the repo and clone your fork.
2. Follow the [Quickstart](./README.md#quickstart) to get the stack running locally.
3. Create a branch: `git checkout -b feat/your-feature`.
4. Make your changes, then run the checks below.
5. Open a pull request against `main`.

```bash
pnpm install
pnpm docker:up
cp .env.example .env
pnpm db:migrate
```

## Project layout

```
apps/
  api/          Hono HTTP server — routes, middleware, schemas
  worker/       BullMQ consumer — dispatcher, circuit breaker, cleanup
  dashboard/    React SPA — components, routes, hooks, lib
packages/
  db/           Drizzle schema, migrations, client
  config/       Shared Zod-validated environment variables
```

## Coding conventions

- **TypeScript strict** — no `any`, no `as` casts without justification.
- **Zod at every boundary** — validate request bodies, env vars, external responses.
- **Biome for lint + format** — run `pnpm lint` before committing.
- **Pino for logging** — structured logs only, never `console.log` in app code.
- **Errors as values** — use the `HttpError` family in `apps/api/src/lib/errors.ts`.
- **No comments unless necessary** — the code should speak for itself.
- **One concept per PR** — keep changes focused and reviewable.

## Commit messages

We use [Conventional Commits](http://conventionalcommits.org):

```
feat(api): add batch event endpoint
fix(worker): correct retry schedule calculation
docs: update integration guide
chore(deps): bump drizzle-orm to 0.36
```

## Testing

- Unit tests live in `tests/` and next to the code they cover.
- Run all tests before opening a PR:

```bash
pnpm test:all
pnpm --filter @relay/worker test
pnpm --filter @relay/worker test:watch
```

## Database changes

1. Edit `packages/db/src/schema.ts`.
2. Generate a migration: `pnpm db:generate`.
3. Review the SQL in `packages/db/migrations/`.
4. Apply locally: `pnpm db:migrate`.

**Never edit a published migration** — create a new one.

## Questions?

Open a [discussion](https://github.com/ParthSarthi-tech/relayd/discussions) or tag `@ParthSarthi-tech` on your PR.
