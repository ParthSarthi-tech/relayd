# Contributing

Thanks for your interest in Relay! This document covers local development, coding conventions, and the PR process.

## Development setup

See [README.md](./README.md#quickstart) for prerequisites and the local setup.

```bash
pnpm install
pnpm docker:up
cp .env.example .env
pnpm db:migrate
```

## Project layout

```
apps/
  api/       Hono HTTP server
  worker/    BullMQ consumer
packages/
  db/        Drizzle schema + migrations
  config/    Shared Zod-validated env
```

## Coding conventions

- **TypeScript strict mode** — no `any`, no `as` casts without justification
- **Zod at every boundary** — validate request bodies, env vars, external responses
- **Biome for lint + format** — run `pnpm lint` before committing
- **Pino for logging** — structured logs only, never `console.log` in app code
- **Errors as values** — use the `HttpError` family in `apps/api/src/lib/errors.ts`
- **No comments unless necessary** — code should be self-explanatory
- **One concept per PR** — keep changes focused and reviewable

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(api): add batch event endpoint
fix(worker): correct retry schedule calculation
docs: update README quickstart
chore(deps): bump drizzle-orm to 0.36
```

## Testing

- Unit tests live in `tests/` and `src/` next to the code they cover
- We aim for 80%+ coverage on core paths (signing, dispatch, schema)
- Run `pnpm test` before opening a PR

## Running tests

```bash
pnpm test                # all
pnpm --filter @relay/worker test   # one package
pnpm --filter @relay/worker test:watch
```

## Database changes

1. Edit the schema in `packages/db/src/schema.ts`
2. Generate a migration: `pnpm db:generate`
3. Review the SQL in `packages/db/migrations/`
4. Apply: `pnpm db:migrate`

Never edit a migration file after it's been merged — create a new one.

## Release process (Phase 4+)

We'll cut releases with [Changesets](https://github.com/changesets/changesets). For now, just commit to `main`.
