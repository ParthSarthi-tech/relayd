import { useNavigate } from '@tanstack/react-router'
import { BookOpen, ChevronRight, Copy, FileCode, Key, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, getApiBaseUrl } from '../../lib/api-client'
import { getStoredTenant, getStoredUser } from '../../lib/auth'
import type { ApiKey } from '../../lib/types'

type Lang = 'curl' | 'node' | 'python'

const apiUrl = getApiBaseUrl()

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="absolute right-2 top-2 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="relative">
      {lang && (
        <span className="absolute left-2 top-2 text-[10px] font-mono font-medium text-muted-foreground uppercase">
          {lang}
        </span>
      )}
      <CopyButton text={code} />
      <pre className="mt-0 rounded-md bg-muted p-3 pt-7 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  )
}

function TabBar({ selected, onSelect }: { selected: Lang; onSelect: (l: Lang) => void }) {
  const tabs: { value: Lang; label: string }[] = [
    { value: 'curl', label: 'curl' },
    { value: 'node', label: 'Node.js' },
    { value: 'python', label: 'Python' },
  ]
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit mb-4">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onSelect(t.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            selected === t.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function createEndpointSnippet(lang: Lang, key: string): { label: string; code: string } {
  switch (lang) {
    case 'curl':
      return {
        label: 'Create an endpoint',
        code: `curl -X POST ${apiUrl}/v1/endpoints \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-app.com/webhooks/relay",
    "description": "Production webhook",
    "eventTypes": ["*"]
  }'`,
      }
    case 'node':
      return {
        label: 'Create an endpoint',
        code: `const response = await fetch('${apiUrl}/v1/endpoints', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${key}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://your-app.com/webhooks/relay',
    description: 'Production webhook',
    eventTypes: ['*'],
  }),
})
const endpoint = await response.json()
// Save endpoint.id — you'll need it to send events`,
      }
    case 'python':
      return {
        label: 'Create an endpoint',
        code: `import requests

response = requests.post(
    '${apiUrl}/v1/endpoints',
    headers={
        'Authorization': 'Bearer ${key}',
        'Content-Type': 'application/json',
    },
    json={
        'url': 'https://your-app.com/webhooks/relay',
        'description': 'Production webhook',
        'eventTypes': ['*'],
    },
)
endpoint = response.json()
# Save endpoint['id'] — you'll need it to send events`,
      }
  }
}

function sendEventSnippet(lang: Lang, key: string): { label: string; code: string } {
  switch (lang) {
    case 'curl':
      return {
        label: 'Send an event',
        code: `curl -X POST ${apiUrl}/v1/events \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "endpointId": "<endpoint-id-from-step-1>",
    "eventId": "evt_$(date +%s)",
    "eventType": "user.created",
    "payload": {"user_id": 42, "email": "user@example.com"}
  }'`,
      }
    case 'node':
      return {
        label: 'Send an event',
        code: `await fetch('${apiUrl}/v1/events', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${key}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    endpointId: '<endpoint-id-from-step-1>',
    eventId: 'evt_' + Date.now(),
    eventType: 'user.created',
    payload: { user_id: 42, email: 'user@example.com' },
  }),
})`,
      }
    case 'python':
      return {
        label: 'Send an event',
        code: `import requests

response = requests.post(
    '${apiUrl}/v1/events',
    headers={
        'Authorization': 'Bearer ${key}',
        'Content-Type': 'application/json',
    },
    json={
        'endpointId': '<endpoint-id-from-step-1>',
        'eventId': 'evt_' + str(int(time.time())),
        'eventType': 'user.created',
        'payload': {'user_id': 42, 'email': 'user@example.com'},
    },
)`,
      }
  }
}

function verifySnippet(lang: Lang): { label: string; code: string } {
  switch (lang) {
    case 'curl':
      return {
        label: 'Test with a signature',
        code: `# First, grab your signing secret from the endpoint settings.
# Then generate the signature:
SECRET="whsec_abc123"
BODY='{"id":"msg_001","event_type":"user.created","payload":{"user_id":42}}'

# Compute HMAC-SHA256 (requires openssl)
EXPECTED=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)
TIMESTAMP=$(date +%s)

# Send with the computed signature header
curl -X POST https://your-app.com/webhooks/relay \\
  -H "Content-Type: application/json" \\
  -H "x-relay-signature: t=$TIMESTAMP,v1=$EXPECTED" \\
  -H "x-relay-event-type: user.created" \\
  -d "$BODY"`,
      }
    case 'node':
      return {
        label: 'Verify signature (Express/Hono)',
        code: `import { createHmac, timingSafeEqual } from 'node:crypto'

function verifyRelayWebhook(
  body: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  // signatureHeader format: "t=1712345678,v1=hexdigest"
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => p.split('=')),
  )
  const timestamp = Number(parts['t'])
  const signature = parts['v1']
  if (!timestamp || !signature) return false

  // Reject expired signatures (replay protection)
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) {
    return false
  }

  const expected = createHmac('sha256', secret)
    .update(\`\${timestamp}.\${body}\`)
    .digest('hex')

  if (expected.length !== signature.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}`,
      }
    case 'python':
      return {
        label: 'Verify signature (Flask/FastAPI)',
        code: `import hmac
import hashlib
import time
from flask import request, abort

def verify_relay_webhook(secret: str, tolerance_seconds: int = 300) -> bool:
    signature_header = request.headers.get('x-relay-signature', '')
    body = request.get_data(as_text=True)

    # Parse "t=1712345678,v1=hexdigest"
    parts = dict(p.split('=', 1) for p in signature_header.split(','))
    timestamp = parts.get('t')
    signature = parts.get('v1')
    if not timestamp or not signature:
        return False

    # Reject expired signatures
    if abs(time.time() - float(timestamp)) > tolerance_seconds:
        return False

    expected = hmac.new(
        secret.encode(),
        f"{timestamp}.{body}".encode(),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, signature)`,
      }
  }
}

export function IntegrationPage() {
  const navigate = useNavigate()
  const tenant = getStoredTenant()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [lang, setLang] = useState<Lang>('curl')

  useEffect(() => {
    api.listApiKeys().then((res: { data: ApiKey[] }) => setApiKeys(res.data)).catch(() => {})
  }, [])

  const activeKey = apiKeys.find((k) => k.active)
  const keyDisplay = activeKey ? `${activeKey.keyPrefix}...` : null
  const tenantId = tenant?.id ?? '—'

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 md:px-6">
      <div className="flex items-center gap-2 mb-6">
        <FileCode className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Integration Guide</h1>
      </div>

      {!activeKey && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 mb-6">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Create an API key in{' '}
            <button
              onClick={() => navigate({ to: '/settings' })}
              className="underline font-medium hover:text-amber-500"
            >
              Settings
            </button>{' '}
            to get started with the code snippets below.
          </p>
        </div>
      )}

      {/* Credentials */}
      <div className="rounded-lg border border-border bg-card p-5 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Your Credentials</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">API Key</span>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-foreground">
                {keyDisplay ?? <span className="text-muted-foreground">No key yet</span>}
              </code>
              {activeKey && (
                <button
                  onClick={() => navigator.clipboard.writeText(activeKey.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Tenant ID</span>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-muted-foreground">{tenantId}</code>
              <button
                onClick={() => navigator.clipboard.writeText(tenantId)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">API Base URL</span>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-muted-foreground">{apiUrl}</code>
              <button
                onClick={() => navigator.clipboard.writeText(apiUrl)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Code snippets */}
      <div className="rounded-lg border border-border bg-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Sending Events</h2>
          <TabBar selected={lang} onSelect={setLang} />
        </div>
        <div className="space-y-6">
          <div>
            <p className="text-xs font-medium text-foreground mb-2">
              1. Create an endpoint to receive webhooks
            </p>
            <CodeBlock code={createEndpointSnippet(lang, activeKey?.id ?? 'YOUR_API_KEY').code} />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground mb-2">
              2. Send events to that endpoint
            </p>
            <CodeBlock code={sendEventSnippet(lang, activeKey?.id ?? 'YOUR_API_KEY').code} />
          </div>
        </div>
      </div>

      {/* Verifying webhooks card */}
      <div className="rounded-lg border border-border bg-card p-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground/5">
            <Shield className="h-4 w-4 text-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Verifying Webhooks</h3>
            <p className="text-xs text-muted-foreground">
              Every webhook payload is signed with HMAC-SHA256 so your customers can verify it came
              from Relay. We provide ready-to-use verification code.
            </p>
          </div>
          <button
            onClick={() => navigate({ to: '/integration/verify' })}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors shrink-0"
          >
            View docs
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Event Reference */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Event Reference</h2>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              When an event is delivered, your endpoint receives a POST request with the following
              format:
            </p>
            <CodeBlock
              lang="json"
              code={`Headers:
  content-type: application/json
  x-relay-message-id:        uuid
  x-relay-event-id:          your-event-id
  x-relay-event-type:        user.created
  x-relay-signature:         t=...,v1=...
  x-relay-attempt:           1
  user-agent:                Relay/1.0

Body:
{
  "id": "msg_uuid",
  "event_id": "your-event-id",
  "event_type": "user.created",
  "payload": { "user_id": 42 },
  "created_at": "2026-01-01T00:00:00Z"
}`}
            />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground mb-2">Delivery behavior</p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="text-foreground font-mono shrink-0">Retries</span>
                <span>Up to 3 retries with exponential backoff + full jitter</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-foreground font-mono shrink-0">Timeout</span>
                <span>10 seconds per attempt. Slow responses are treated as failures</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-foreground font-mono shrink-0">Idempotency</span>
                <span>
                  Use eventId to prevent duplicates. Same eventId + endpointId = safe to retry
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-foreground font-mono shrink-0">Best practice</span>
                <span>
                  Respond with 2xx as soon as you've queued the event internally. Don't process
                  synchronously in the webhook handler
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
