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

## License

MIT © ParthSarthi
