# Security

Relayd takes webhook security seriously. Every payload is signed, every secret is hashed, and every endpoint is rate-limited.

## Webhook signing

Every delivery is signed with **HMAC-SHA256** over `timestamp + "." + body`, using the same scheme as Stripe. The signature is sent in the `X-Relay-Signature` header:

```
X-Relay-Signature: t=1712345678,v1=<64-char hex digest>
```

**You must verify this signature** on every webhook request to confirm it was sent by Relayd and hasn't been tampered with. See the [verification guide](https://github.com/ParthSarthi-tech/relayd/tree/main/apps/dashboard/src/routes/integration/verify.tsx) for code examples in curl, Node.js, and Python.

### Replay protection

Reject deliveries whose `t=` timestamp is more than **5 minutes** old. The tolerance is configurable.

### Secret rotation

Endpoints support multiple active signing keys (kid-based), so you can rotate secrets without downtime.

## Authentication

- **JWT tokens** are HttpOnly, SameSite=Lax cookies — not accessible from JavaScript.
- **API keys** use a `rel_` prefix with 32 random bytes, stored as SHA256 digests. The raw key is shown exactly once at creation.
- **Rate limiting** is enforced at the Lua-scripted Redis level — per-endpoint and per-tenant.

## Reporting a vulnerability

If you find a security issue, **do not open a public issue**. Email **security@relayd.dev** (placeholder) or reach out via [GitHub Security Advisories](https://github.com/ParthSarthi-tech/relayd/security/advisories).

We'll respond within 48 hours and coordinate a fix before disclosure.

## Best practices for consumers

- Always verify the `X-Relay-Signature` header.
- Use constant-time comparison (`timingSafeEqual`, `hmac.compare_digest`).
- Reject stale timestamps (>5 min tolerance).
- Rotate signing keys periodically.
- Use scoped API keys with the minimum permissions needed.
