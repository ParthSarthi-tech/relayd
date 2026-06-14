# Contributing to Relay

Thanks for considering contributing to Relay. This document covers the development workflow, coding standards, and how to get started.

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Development workflow](#development-workflow)
- [Commit conventions](#commit-conventions)
- [Coding standards](#coding-standards)
- [Testing](#testing)
- [Pull request process](#pull-request-process)

## Code of conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) code of conduct. By participating, you agree to uphold this standard.

## Getting started

### Prerequisites

- **Node.js** >= 22
- **pnpm** >= 10
- **Docker** (for Postgres and Redis in local dev)

### Setup

```bash
# Clone the repo
git clone https://github.com/ParthSarthi-tech/relay.git
cd relay

# Start Postgres and Redis
pnpm docker:up

# Install dependencies
pnpm install

# Generate and run database migrations
pnpm db:generate
pnpm db:migrate

# Start all dev servers (API, worker, dashboard, landing page)
pnpm dev:all
```

The API runs on `http://localhost:3000`, the worker on `http://localhost:3001`, the dashboard on `http://localhost:5173`, and the landing page on `http://localhost:3003`.

### Environment variables

Copy `.env.example` to `.env` in the root and adjust as needed. Sensible defaults are provided for local development.

## Project structure

```
relay/
  apps/
    api/          — Hono.js HTTP API (port 3000)
    worker/       — BullMQ background worker (port 3001)
    dashboard/    — Vite + React SPA (TanStack Router)
  packages/
    config/       — Zod-validated environment configuration
    db/           — Drizzle ORM schema, migrations, client
  landing-page/   — Next.js marketing site (port 3003)
  docker/         — Docker Compose stacks, Dockerfiles, Caddy config
  k6/             — Load testing scripts
```

- `apps/api` and `apps/worker` depend on `@relay/config` and `@relay/db`.
- `apps/dashboard` and `landing-page` are standalone frontends.
- `@relay/config` validates all environment variables through a centralised Zod schema.

## Development workflow

1. **Create a branch** from `main` with a descriptive name:
   ```
   git checkout -b feat/add-retry-dashboard
   ```

2. **Make your changes** following the coding standards below.

3. **Run typecheck and lint** before committing:
   ```bash
   pnpm typecheck:all
   pnpm lint
   ```

   Biome runs automatically via lefthook on pre-commit for staged files.

4. **Write or update tests** for your changes.

5. **Commit** using conventional commit formatting (see below). Lefthook will run Biome and typechecks on staged files.

6. **Push** and open a pull request against `main`.

## Commit conventions

This project uses [conventional commits](https://www.conventionalcommits.org/):

```
<type>: <short description>

[optional body]
```

Common types:
- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code change that neither fixes nor adds
- `docs:` — documentation only
- `test:` — adding or updating tests
- `chore:` — tooling, CI, dependencies
- `perf:` — performance improvement

Examples:
```
feat: add retry dashboard with per-attempt timeline
fix: handle empty endpoint ID in event fan-out
docs: update API reference for signing keys
```

## Coding standards

### Linting and formatting

This project uses [Biome](https://biomejs.dev) for both linting and formatting.

```bash
pnpm lint          # Check all files
pnpm lint:fix      # Auto-fix
pnpm format        # Format all files
```

Key rules enforced:

- Single quotes, no semicolons (as-needed), trailing commas
- 100-character line width, 2-space indent, LF line endings
- No explicit `any` types (warning)
- No non-null assertions (warning)
- Import types with `type` keyword (warning)
- Exhaustive dependency arrays in hooks (warning)

### TypeScript

- `strict: true` is enabled across all packages
- Prefer interfaces over type aliases for object shapes
- Use Zod schemas for runtime validation of external data
- Avoid `as` casts — prefer type narrowing or proper generics
- Mark client-side files with `"use client"` directive

### Error handling

- Throw typed errors (`HttpError`, `BadRequestError`, etc.) in the API
- Do not use bare `catch {}` blocks — always handle or re-throw
- Use `.catch()` with at least a log statement for fire-and-forget operations

### Environment variables

All environment variables must be defined and validated in `packages/config/src/index.ts`. Do not read `process.env` directly — import from `@relay/config` instead.

## Testing

Tests use [Vitest](https://vitest.dev). Run them with:

```bash
pnpm test:all                        # All tests
pnpm --filter @relay/api test        # API tests only
pnpm --filter @relay/worker test     # Worker tests only
```

### Test guidelines

- Write tests alongside the code they test in a `tests/` directory at the package level.
- Use factories and builders rather than raw `as any` casts for test data.
- Cover error paths, not just happy paths.
- Add integration tests for new API routes.

### Coverage

Coverage reports are generated automatically. Open `coverage/index.html` in a browser to view them after running tests.

## Pull request process

1. Ensure the PR description clearly describes the problem and solution.
2. Reference any related issues with `Closes #123` or `Fixes #456`.
3. All CI checks must pass (typecheck, lint, test, build).
4. Maintain or improve test coverage.
5. Squash commits into logical units before merging.

The `main` branch is protected — all PRs require CI to pass before merging.

---

Questions? Open a [discussion](https://github.com/ParthSarthi-tech/relay/discussions) or reach out via the [Relay website](https://relayd.dev).
