# Security

## Signing

Relay signs every webhook delivery with **HMAC-SHA256** over `timestamp + "." + body`, in the same format as Stripe's webhook signatures. The signature is sent in the `X-Relay-Signature` header as `t=<unix>,v1=<hex>`.

**Always verify the signature on your end** before processing the payload. We will publish `@relay/sign` (Node) and `relay-py` (Python) helpers in Phase 4.

### Replay protection

Reject deliveries whose `t=` timestamp is more than **5 minutes** old. The default tolerance is configurable.

### Secret rotation

In Phase 2, endpoints support multiple active signing keys (kid-based) so you can rotate without downtime.

## Reporting vulnerabilities

Email security@relay.local (placeholder until launch). Do not open public issues for security reports.
