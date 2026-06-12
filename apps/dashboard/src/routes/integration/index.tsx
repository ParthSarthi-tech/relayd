import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, BookOpen, Check, ChevronRight, Copy, FileCode, Key, RefreshCw, Shield, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, getApiBaseUrl } from '../../lib/api-client'
import { getStoredTenant, getStoredUser } from '../../lib/auth'
import type { ApiKey } from '../../lib/types'

type Lang = 'curl' | 'node' | 'python'

const apiUrl = getApiBaseUrl()

function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className={`text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative rounded-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between bg-muted/80 px-3 py-1.5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </div>
          {lang && (
            <span className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-wider ml-2">
              {lang}
            </span>
          )}
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className="bg-muted/30 p-4 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed">
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
    <div className="flex gap-1 rounded-lg bg-muted p-0.5 w-fit border border-border">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onSelect(t.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            selected === t.value
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground border border-transparent'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[11px] font-bold text-foreground">
      {n}
    </span>
  )
}

function createEndpointSnippet(lang: Lang, key: string): string {
  switch (lang) {
    case 'curl':
      return `curl -X POST ${apiUrl}/v1/endpoints \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-app.com/webhooks/relay",
    "description": "Production webhook",
    "eventTypes": ["*"]
  }'`
    case 'node':
      return `const response = await fetch('${apiUrl}/v1/endpoints', {
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
// Save endpoint.id — you'll need it to send events`
    case 'python':
      return `import requests

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
# Save endpoint['id'] — you'll need it to send events`
  }
}

function sendEventSnippet(lang: Lang, key: string): string {
  switch (lang) {
    case 'curl':
      return `curl -X POST ${apiUrl}/v1/events \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "endpointId": "<endpoint-id-from-step-1>",
    "eventId": "evt_$(date +%s)",
    "eventType": "user.created",
    "payload": {"user_id": 42, "email": "user@example.com"}
  }'`
    case 'node':
      return `await fetch('${apiUrl}/v1/events', {
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
})`
    case 'python':
      return `import requests

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
)`
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
    <div className="w-full px-4 py-6 md:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-foreground/10 to-foreground/5 ring-1 ring-foreground/10">
          <FileCode className="h-5 w-5 text-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Integration Guide</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Everything you need to send events and verify webhooks
          </p>
        </div>
      </div>

      {!activeKey && (
        <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-amber-500/10 p-4 mb-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(251,191,36,0.08),transparent_60%)]" />
          <p className="relative text-sm text-amber-600 dark:text-amber-400">
            Create an API key in{' '}
            <button
              onClick={() => navigate({ to: '/settings' })}
              className="underline font-medium hover:text-amber-500 transition-colors"
            >
              Settings
            </button>{' '}
            to get started with the code snippets below.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* Main content */}
        <div className="space-y-8">
          {/* Sending Events */}
          <div className="relative rounded-xl border border-border bg-card overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10">
                    <Zap className="h-4 w-4 text-foreground" />
                  </div>
                  <h2 className="text-base font-semibold text-foreground">Sending Events</h2>
                </div>
                <TabBar selected={lang} onSelect={setLang} />
              </div>
              <div className="space-y-8">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <StepNumber n={1} />
                    <p className="text-sm font-medium text-foreground">
                      Create an endpoint to receive webhooks
                    </p>
                  </div>
                  <CodeBlock code={createEndpointSnippet(lang, activeKey?.id ?? 'YOUR_API_KEY')} lang={lang} />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <StepNumber n={2} />
                    <p className="text-sm font-medium text-foreground">
                      Send events to that endpoint
                    </p>
                  </div>
                  <CodeBlock code={sendEventSnippet(lang, activeKey?.id ?? 'YOUR_API_KEY')} lang={lang} />
                </div>
              </div>
            </div>
          </div>

          {/* Event Reference */}
          <div className="relative rounded-xl border border-border bg-card overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
            <div className="p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10">
                  <BookOpen className="h-4 w-4 text-foreground" />
                </div>
                <h2 className="text-base font-semibold text-foreground">Event Reference</h2>
              </div>

              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                When an event is delivered, your endpoint receives a <strong className="text-foreground">POST</strong> request with the following format:
              </p>

              <CodeBlock
                code={`Headers:
  content-type       application/json
  x-relay-message-id uuid
  x-relay-event-id   your-event-id
  x-relay-event-type user.created
  x-relay-signature  t=...,v1=...
  x-relay-attempt    1
  user-agent         Relay/1.0

Body:
{
  "id": "msg_uuid",
  "event_id": "your-event-id",
  "event_type": "user.created",
  "payload": { "user_id": 42 },
  "created_at": "2026-01-01T00:00:00Z"
}`}
                lang="json"
              />

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <RefreshCw className="h-3.5 w-3.5 text-foreground" />
                    <span className="text-xs font-semibold text-foreground">Retries</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Up to 8 attempts with exponential backoff + full jitter.
                    Dead-letter after exhaustion.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Zap className="h-3.5 w-3.5 text-foreground" />
                    <span className="text-xs font-semibold text-foreground">Timeout</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    10 seconds per attempt. Slow responses are treated as failures.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Key className="h-3.5 w-3.5 text-foreground" />
                    <span className="text-xs font-semibold text-foreground">Idempotency</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Use <code className="text-foreground font-mono text-[11px]">eventId</code> to prevent duplicates.
                    Same eventId + endpointId = safe to retry.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Shield className="h-3.5 w-3.5 text-foreground" />
                    <span className="text-xs font-semibold text-foreground">Best practice</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Respond with 2xx as soon as you've queued the event. Don't process synchronously.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Credentials */}
          <div className="relative rounded-xl border border-border bg-card overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
            <div className="p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Your Credentials</h2>
              <div className="space-y-3.5">
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">API Key</span>
                  <div className="flex items-center justify-between mt-1">
                    <code className="text-xs font-mono text-foreground truncate">
                      {keyDisplay ?? <span className="text-muted-foreground">No key yet</span>}
                    </code>
                    {activeKey && (
                      <CopyButton text={activeKey.id} className="ml-2 shrink-0" />
                    )}
                  </div>
                </div>
                <div className="border-t border-border pt-3">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tenant ID</span>
                  <div className="flex items-center justify-between mt-1">
                    <code className="text-xs font-mono text-muted-foreground truncate">{tenantId}</code>
                    <CopyButton text={tenantId} className="ml-2 shrink-0" />
                  </div>
                </div>
                <div className="border-t border-border pt-3">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">API Base URL</span>
                  <div className="flex items-center justify-between mt-1">
                    <code className="text-xs font-mono text-muted-foreground truncate">{apiUrl}</code>
                    <CopyButton text={apiUrl} className="ml-2 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Verifying Webhooks */}
          <div className="relative rounded-xl border border-border bg-card overflow-hidden group hover:shadow-md transition-shadow">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/30 via-amber-500/50 to-amber-500/30" />
            <div className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <Shield className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Verifying Webhooks</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    HMAC-SHA256 signed payloads
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Every webhook payload is signed so your customers can verify it came from Relayd.
                We provide ready-to-use verification code in curl, Node.js, and Python.
              </p>
              <button
                onClick={() => navigate({ to: '/integration/verify' })}
                className="inline-flex items-center justify-center gap-1.5 w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors group"
              >
                View verification docs
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
