# Relay

> Production-grade webhook delivery infrastructure, self-hostable.

Relay ingests webhook events via API, persists them to Postgres, delivers them to customer endpoints with at-least-once delivery, HMAC signing, exponential retries, and dead-letter queues. Includes a real-time dashboard for monitoring, a landing page, and a full auth system.

## Architecture

```
                     ┌──────────────────────────────┐
                     │     Landing Page (Next.js)    │
                     │         localhost:3003          │
                     │  ┌──────────────────────────┐ │
                     │  │  Dashboard (Vite SPA)     │ │
                     │  │  localhost:5173 (/app/)   │ │
                     │  └──────────────────────────┘ │
                     └──────────┬───────────────────┘
                                │ /auth/*, /v1/*, /app/*
                                ▼
┌────────────┐    ┌──────────────────────┐    ┌──────────────┐
│ Customer   │───▶│  API Server (Hono)   │───▶│ Postgres 16  │
│ (curl/SDK) │    │  localhost:3000       │    │ (messages,   │
└────────────┘    │  JWT + Cookie Auth    │    │  attempts,   │
                  │  Rate-limited routes  │    │  endpoints)  │
                  └──────┬───────────────┘    └──────────────┘
                         │                        ▲
                         ▼                        │
                  ┌──────────────────┐    ┌───────┴────────┐
                  │ BullMQ Queue     │───▶│ Dispatcher     │
                  │ (Redis 7)        │    │ Worker (Node)  │
                  └──────────────────┘    │ HMAC-SHA256    │
                                          │ Retry + Jitter │
                                          │ Dead-letter     │
                                          └────────────────┘
```

## Stack

- **API** — [Hono](https://hono.dev/) on Node 22, Zod validation, JWT auth with HttpOnly cookies
- **Dashboard** — React 19 + Vite + TanStack Router + Tailwind CSS 3 (B&W themed)
- **Landing Page** — Next.js 15 (App Router), hosted on Vercel
- **Worker** — BullMQ consumer with HMAC-SHA256 signing (Stripe-compatible scheme)
- **DB** — Postgres 16 + [Drizzle ORM](https://orm.drizzle.team/)
- **Queue** — BullMQ + Redis 7
- **Transformations** — Isolated Node.js child process (`--input-type=module -e`) with 1.5s timeout
- **Tooling** — Turborepo, pnpm workspaces, Biome, Vitest, lefthook
- **Infra** — Docker Compose for local dev

## Packages

```
relay/
├── apps/
│   ├── api/              # Hono HTTP server (port 3000)
│   ├── worker/           # BullMQ dispatcher (port 3002)
│   ├── dashboard/        # React SPA (Vite, port 5173)
│   └── landing/          # Next.js marketing site (port 3003)
├── packages/
│   ├── db/               # Drizzle schema + migrations
│   └── config/           # Shared Zod-validated env
├── docker/               # Postgres, Redis, MailHog
└── .github/              # CI workflow
```

## Quickstart

### Prerequisites

- Node 22+
- pnpm 10+
- Docker + Docker Compose

### 1. Clone & install

```bash
git clone <repo-url>
cd relay
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL and REDIS_URL
```

### 3. Start the stack

```bash
pnpm docker:up          # Postgres + Redis
pnpm db:migrate         # Create tables
pnpm dev:all            # API, worker, dashboard, landing page
```

Visit `http://localhost:3003` — landing page with "Sign in" linking to the dashboard.

### 4. Create an account & send a webhook

```bash
# Register
curl -X POST http://localhost:3003/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@relay.dev","password":"password123","name":"Demo User","org":"Acme"}'

# Login (sets HttpOnly cookie)
curl -X POST http://localhost:3003/auth/login -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@relay.dev","password":"password123"}'

# Create an endpoint
curl -X POST http://localhost:3003/v1/endpoints -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"url":"https://webhook.site/your-uuid","description":"My webhook"}'

# Send an event
curl -X POST http://localhost:3003/v1/events -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "endpointId": "<id from above>",
    "eventId": "evt_001",
    "eventType": "user.created",
    "payload": {"user_id": 42}
  }'
```

The worker signs the payload with HMAC-SHA256 and POSTs to your endpoint with:
- `X-Relay-Signature: t=<unix>,v1=<hex_hmac>`
- `X-Relay-Message-Id`, `X-Relay-Event-Id`, `X-Relay-Event-Type`
- `X-Relay-Attempt: <n>`

### 5. Open the dashboard

Visit `http://localhost:3003/app` — the dashboard shows metrics, endpoints, messages, transformations, connections, and settings.

## Features

- **Multi-tenant** — Isolated by tenant ID, JWT auth with HttpOnly cookies
- **At-least-once delivery** — Messages persisted before queuing
- **Exponential retry** — `60s → 5m → 30m → 2h → 12h → 24h` (configurable), 8 max attempts
- **HMAC signing** — Stripe-compatible `t=...,v1=...` scheme
- **Idempotency** — Re-sending `eventId` returns the original message (24h window)
- **Dead-letter queue** — After exhausting retries, message stays in `dead_letter` state
- **Rate limiting** — Per-endpoint (req/s + burst) + per-tenant global limit
- **Per-endpoint signing keys** — Key rotation with `kid` versioning, revoke without re-creating endpoint
- **Event filtering** — Subscribe endpoints to specific `eventType`s
- **Fan-out via connections** — Route events to multiple endpoints with optional transformations
- **Transformations** — Isolated JavaScript transformations (child process, 1.5s timeout)
- **Dashboard** — Real-time metrics, message browser with status filter, inline event sender
- **Quick Start** — Create a test endpoint and send a test event in 2 clicks
- **Command palette** — `⌘K` keyboard navigation across all pages

## Development

```bash
# Start everything
pnpm dev:all

# Run tests (92 passing)
pnpm test:all

# Typecheck across all packages
pnpm typecheck:all

# Lint + format
pnpm lint
pnpm format
```

## API Reference

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/healthz` | Liveness probe |
| `GET` | `/readyz` | Readiness probe (DB + Redis) |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Register (email, password, name, org) |
| `POST` | `/auth/login` | Login, sets HttpOnly cookie |
| `POST` | `/auth/logout` | Clears auth cookie |

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/endpoints` | Create endpoint (returns `secret` once) |
| `GET` | `/v1/endpoints` | List (paginated) |
| `GET` | `/v1/endpoints/:id` | Get one |
| `PATCH` | `/v1/endpoints/:id` | Update (URL, status, eventTypes, rate limits) |
| `DELETE` | `/v1/endpoints/:id` | Soft-delete |

### Events

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/events` | Enqueue single event (idempotent on `eventId`) |
| `POST` | `/v1/events/batch` | Enqueue up to 1000 events |

### Messages

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/messages` | List (paginated, filter by status/endpointId) |
| `GET` | `/v1/messages/:id` | Get one with attempt history |
| `POST` | `/v1/messages/:id/replay` | Replay a message |
| `DELETE` | `/v1/messages/:id` | Delete message + attempts |

### Signing Keys

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/endpoints/:id/keys` | List signing keys |
| `POST` | `/v1/endpoints/:id/keys` | Create new key (rotates secret) |
| `POST` | `/v1/endpoints/:id/keys/:kid/revoke` | Revoke a key |

### Stats

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/stats?period=24` | Aggregated stats (endpoints, deliveries, latency, timeline) |

### Transformations

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/transformations` | Create transformation |
| `GET` | `/v1/transformations` | List |
| `GET` | `/v1/transformations/:id` | Get one |
| `PATCH` | `/v1/transformations/:id` | Update code |
| `DELETE` | `/v1/transformations/:id` | Delete |

### Connections

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/connections` | Create connection (links endpoint + optional transformation) |
| `GET` | `/v1/connections` | List |
| `GET` | `/v1/connections/:id` | Get one |
| `PATCH` | `/v1/connections/:id` | Update |
| `DELETE` | `/v1/connections/:id` | Delete |

### Diagnostics

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/echo` | Returns request details (no auth required — used by delivery worker) |
| `GET` | `/metrics` | OpenTelemetry metrics |

## Testing

```
apps/api:      65 tests  (9 files)
apps/worker:   20 tests  (2 files)
packages/config: 7 tests (1 file)
Total:         92 tests
```

Tests use Vitest with mocked Drizzle ORM (chainable `.from().where().limit()` mock builder) and faked Redis connections. The JWT auth middleware is tested end-to-end via `createTestToken()` helpers.

## Roadmap

- [x] **Phase 1** — Foundation: monorepo, schema, API, worker, Docker, signing
- [x] **Phase 2** — Reliability: retry engine, DLQ, idempotency, rate limiting, key rotation, metrics, circuit breaker
- [x] **Phase 3** — Dashboard: Vite SPA, auth (JWT + cookies), metrics, message browser, inline sender
- [ ] **Phase 4** — Premium: email/Slack notifications for dead-letter, webhook retry webhooks
- [ ] **Phase 5** — SDKs, docs site, public launch

## License

MIT
