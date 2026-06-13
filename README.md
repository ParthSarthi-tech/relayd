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
  Webhook delivery infrastructure — HMAC-signed, at-least-once, real-time dashboard.
</h3>

<p align="center">
  <a href="https://relayd.dev">Website</a> •
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="https://github.com/ParthSarthi-tech/relayd">GitHub</a>
</p>

<br/>

## Why Relayd

Webhooks are the backbone of modern integrations, but shipping a reliable delivery system is harder than it looks. Relayd gives you a complete platform that handles **ingestion, signing, retries, rate limiting, transformations, and observability** — so you don't have to build it yourself.

- **At-least-once delivery** — messages persisted before queuing, never lost on crash
- **HMAC-SHA256 signing** — Stripe-compatible `t=...,v1=...` signature scheme
- **Real-time dashboard** — metrics, message browser, inline replay, and live stream
- **Isolated transformations** — sandboxed JavaScript transformations
- **Multi-tenant** — JWT auth with HttpOnly cookies, scoped API keys, RBAC

## Features

| Area | Capabilities |
|------|-------------|
| **Delivery** | At-least-once, exponential retry (8 max attempts), dead-letter queue, HMAC signing |
| **Rate limiting** | Per-endpoint (req/s + burst) + per-tenant global — Lua-scripted Redis |
| **Transformations** | Isolated Node.js sandbox (1.5s timeout), preview before saving |
| **Connections** | Link endpoints with optional transformations for fan-out routing |
| **API keys** | Scoped, revocable `rel_` keys with SHA256 digest lookup |
| **Circuit breaker** | Half-open probe, auto-cooldown, Redis-backed TTL |
| **Observability** | OpenTelemetry metrics, correlation IDs, structured logging |
| **Dashboard** | Real-time SSE stream, metric sparklines, message timeline, inline sender |
| **Quick Start** | Create an endpoint and send a test event in 2 clicks |
| **Command palette** | `⌘K` / `Ctrl+K` — navigate everything from the keyboard |

## Getting Started

The fastest way to experience Relayd is to sign up at **[relayd.app](https://relayd.app)** — no credit card required.

Once you're in, the **[Integration Guide](https://relayd.app/integration)** walks you through:

1. Creating your first endpoint
2. Sending events via curl, Node.js, or Python
3. Verifying HMAC-SHA256 webhook signatures
4. Monitoring deliveries in real-time

## Docs

- [Integration Guide](https://relayd.app/integration) — send events and verify webhooks
- [API Reference](https://relayd.app/api) — full endpoint documentation
- [Verifying Webhooks](https://relayd.app/integration/verify) — HMAC-SHA256 signature verification
- [Security](./SECURITY.md) — signing scheme and vulnerability reporting

## Self-Hosting

Deploy Relayd on your own infrastructure with Docker Compose.

### One-command local setup

```bash
# Clone the repo
git clone https://github.com/ParthSarthi-tech/relayd.git
cd relayd

# Start Postgres and Redis (for local dev)
pnpm docker:up

# Install deps and run migrations
pnpm install
pnpm db:generate
pnpm db:migrate

# Start API, worker, and dashboard (hot reload)
pnpm dev:all
```

### Production deployment

Relayd ships with a production `docker-compose.prod.yml` stack that includes Postgres, Redis, the API, worker, dashboard (nginx-served SPA), and Caddy (reverse proxy with auto-TLS).

```bash
# 1. Set required environment variables
export DOMAIN=relayd.yourdomain.com
export DB_PASSWORD=$(openssl rand -base64 32)
export REDIS_PASSWORD=$(openssl rand -base64 32)
export JWT_SECRET=$(openssl rand -base64 32)
export GRAFANA_PASSWORD=$(openssl rand -base64 16)

# 2. Start the stack
docker compose -f docker/docker-compose.prod.yml up -d

# 3. Run database migrations
docker compose -f docker/docker-compose.prod.yml exec api \
  pnpm --filter @relay/db migrate

# 4. Your site is live at https://$DOMAIN
```

Caddy auto-provisions Let's Encrypt TLS certificates. No Nginx config, no Certbot.

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DOMAIN` | Yes | — | Public domain for TLS and API base URL |
| `DB_PASSWORD` | Yes | — | Postgres password |
| `REDIS_PASSWORD` | No | *(empty)* | Redis password |
| `JWT_SECRET` | Yes | — | Auth signing key (min 32 chars) |
| `DB_USER` | No | `relay` | Postgres user |
| `DB_NAME` | No | `relay` | Postgres database name |
| `DATA_RETENTION_DAYS` | No | `90` | Message retention in days |
| `WEBHOOK_MAX_ATTEMPTS` | No | `8` | Max delivery attempts before dead-letter |
| `CIRCUIT_BREAKER_THRESHOLD` | No | `10` | Consecutive failures before pausing endpoint |

### Observability

Launch the optional metrics stack alongside the production services:

```bash
docker compose -f docker/docker-compose.prod.yml \
  -f docker/docker-compose.observability.yml up -d
```

This adds:
- **Prometheus** — scrapes `/metrics` from the API (:3000) and worker (:3002/metrics)
- **Tempo** — ingests OpenTelemetry traces via OTLP HTTP (port 4318)
- **Grafana** — pre-configured with Prometheus and Tempo datasources at `http://localhost:3003` (default login: `admin` / `${GRAFANA_PASSWORD}`)

The API and worker already export OpenTelemetry traces. Set `OTEL_EXPORTER_OTLP_ENDPOINT` to `http://tempo:4318` in `.env.production` to enable trace export.

### Dead-letter alerting

When a message exhausts all retry attempts, it's moved to the dead-letter queue. The worker can fire an optional webhook on dead-letter — configure it per-endpoint via the API or dashboard:

```json
{
  "url": "https://hooks.example.com/callback",
  "dead_letter_webhook_url": "https://hooks.slack.com/services/..."
}
```

When a message dead-letters, the worker POSTs a JSON payload to `dead_letter_webhook_url`:

```json
{
  "event": "message.dead_letter",
  "message_id": "uuid",
  "endpoint_id": "uuid",
  "last_error": "HTTP 500",
  "attempts": 8
}
```

## License

MIT © ParthSarthi
