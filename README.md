<picture>
  <source
    srcset="https://raw.githubusercontent.com/ParthSarthi-tech/relayd/main/.github/banner-dark.svg"
    media="(prefers-color-scheme: dark)"
  />
  <img
    src="https://raw.githubusercontent.com/ParthSarthi-tech/relayd/main/.github/banner-light.svg"
    alt="Relayd — Ingest. Deliver. Trust."
  />
</picture>

<h3 align="center">
  Self-hostable webhook delivery infrastructure — HMAC-signed, at-least-once, real-time dashboard.
</h3>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quickstart">Quickstart</a> •
  <a href="#docs">Docs</a> •
  <a href="https://github.com/ParthSarthi-tech/relayd">GitHub</a>
</p>

<br/>

## Why Relayd

Webhooks are the backbone of modern integrations, but shipping a reliable delivery system is harder than it looks. Relayd gives you a complete, self-hosted platform that handles **ingestion, signing, retries, rate limiting, transformations, and observability** — so you don't have to build it yourself.

- **At-least-once delivery** — messages persisted before queuing, never lost on crash
- **HMAC-SHA256 signing** — Stripe-compatible `t=...,v1=...` signature scheme
- **Real-time dashboard** — metrics, message browser, inline replay, and live stream
- **Isolated transformations** — sandboxed JavaScript transformations via child process
- **Multi-tenant** — JWT auth with HttpOnly cookies, scoped API keys, RBAC
- **Self-hosted** — your data, your infrastructure, full control

## Features

| Area | Capabilities |
|------|-------------|
| **Delivery** | At-least-once, exponential retry (8 max attempts), dead-letter queue, HMAC signing |
| **Rate limiting** | Per-endpoint (req/s + burst) + per-tenant global — Lua-scripted Redis |
| **Transformations** | Isolated Node.js child process (1.5s timeout), preview before saving |
| **Connections** | Link endpoints with optional transformations for fan-out routing |
| **API keys** | Scoped, revocable `rel_` keys with SHA256 digest lookup |
| **Circuit breaker** | Half-open probe, auto-cooldown, Redis-backed TTL |
| **Observability** | OpenTelemetry metrics, correlation IDs, structured Pino logging |
| **Dashboard** | Real-time SSE stream, metric sparklines, message timeline, inline sender |
| **Quick Start** | Create an endpoint and send a test event in 2 clicks |
| **Command palette** | `⌘K` / `Ctrl+K` — navigate everything from the keyboard |

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

| Layer | Technology |
|-------|-----------|
| **API** | Hono on Node 22, Zod validation, JWT + HttpOnly cookies |
| **Dashboard** | React 19 + Vite + TanStack Router + Tailwind CSS 3 |
| **Landing Page** | Next.js 15 (App Router) |
| **Worker** | BullMQ consumer with HMAC-SHA256 signing |
| **Database** | Postgres 16 + Drizzle ORM |
| **Queue** | BullMQ + Redis 7 |
| **Transformations** | Isolated child process (`--input-type=module`) |
| **Tooling** | Turborepo, pnpm, Biome, Vitest, Lefthook |
| **Infra** | Docker Compose — Postgres, Redis, MailHog |

## Quickstart

### Prerequisites

- Node 22+, pnpm 10+, Docker + Docker Compose

### 1. Clone & install

```bash
git clone https://github.com/ParthSarthi-tech/relayd.git
cd relayd
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit DATABASE_URL and REDIS_URL if needed
```

### 3. Start the stack

```bash
pnpm docker:up          # Postgres + Redis
pnpm db:migrate         # Apply schema
pnpm dev:all            # API (3000), worker (3002), dashboard (5173), landing (3003)
```

### 4. Create an account

```bash
curl -X POST http://localhost:3003/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@relay.dev","password":"password123","name":"Demo User","org":"Acme"}'
```

### 5. Send your first event

```bash
# Login
curl -X POST http://localhost:3003/auth/login -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@relay.dev","password":"password123"}'

# Create an endpoint
curl -X POST http://localhost:3003/v1/endpoints -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"url":"https://webhook.site/your-uuid","description":"My first endpoint"}'

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

Your endpoint receives a signed POST with headers:
- `X-Relay-Signature: t=<unix>,v1=<hex>`
- `X-Relay-Message-Id`, `X-Relay-Event-Id`, `X-Relay-Event-Type`
- `X-Relay-Attempt: <n>`

### 6. Open the dashboard

Visit `http://localhost:3003/app` — metrics, messages, live stream, and inline event sender at your fingertips.

## Docs

- [Integration Guide](https://github.com/ParthSarthi-tech/relayd/tree/main/apps/dashboard/src/routes/integration) — send events and verify webhooks
- [API Reference](https://github.com/ParthSarthi-tech/relayd/tree/main/apps/api) — full endpoint documentation
- [Contributing](./CONTRIBUTING.md) — local dev setup and conventions
- [Security](./SECURITY.md) — signing scheme and vulnerability reporting

## Project layout

```
relayd/
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

## Development

```bash
pnpm dev:all              # Run everything
pnpm test:all             # 92 tests across all packages
pnpm typecheck:all        # TypeScript strict check
pnpm lint                 # Biome lint + format
```

## License

MIT © ParthSarthi
