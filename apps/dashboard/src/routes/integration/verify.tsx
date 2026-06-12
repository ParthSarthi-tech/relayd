import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Copy, Shield } from 'lucide-react'
import { useState } from 'react'

type Lang = 'curl' | 'node' | 'python'

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

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <CopyButton text={code} />
      <pre className="rounded-md bg-muted p-3 pt-7 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
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

function verifySnippet(lang: Lang): string {
  switch (lang) {
    case 'curl':
      return `# Grab your signing secret from the endpoint settings page.
SECRET="whsec_your_secret_here"
BODY='{"id":"msg_001","event_type":"user.created","payload":{"user_id":42}}'

# Compute the expected HMAC-SHA256 signature
TIMESTAMP=$(date +%s)
EXPECTED=$(echo -n "$TIMESTAMP.$BODY" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Compare EXPECTED with the value in x-relay-signature header
echo "Expected: t=$TIMESTAMP,v1=$EXPECTED"`
    case 'node':
      return `import { createHmac, timingSafeEqual } from 'node:crypto'

function verifyRelayWebhook(
  body: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  // Header format: "t=1712345678,v1=hexdigest"
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => p.split('=')),
  )
  const timestamp = Number(parts['t'])
  const signature = parts['v1']
  if (!timestamp || !signature) return false

  // Reject signatures older than tolerance (prevents replay attacks)
  const age = Math.abs(Date.now() / 1000 - timestamp)
  if (age > toleranceSeconds) return false

  // Recompute the signature
  const expected = createHmac('sha256', secret)
    .update(\`\${timestamp}.\${body}\`)
    .digest('hex')

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

// --- Usage in Express ---
app.post('/webhooks/relay', (req, res) => {
  const rawBody = JSON.stringify(req.body)
  const sig = req.headers['x-relay-signature']
  const secret = 'whsec_your_secret_here'

  if (!verifyRelayWebhook(rawBody, sig, secret)) {
    return res.status(401).send('Invalid signature')
  }

  // Process the webhook
  res.status(200).json({ received: true })
})

// --- Usage in Hono ---
app.post('/webhooks/relay', async (c) => {
  const rawBody = await c.req.text()
  const sig = c.req.header('x-relay-signature') ?? ''
  const secret = 'whsec_your_secret_here'

  if (!verifyRelayWebhook(rawBody, sig, secret)) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  return c.json({ received: true })
})`
    case 'python':
      return `import hmac
import hashlib
import time
from flask import request, abort

def verify_relay_webhook(
    secret: str,
    tolerance_seconds: int = 300,
) -> bool:
    signature_header = request.headers.get('x-relay-signature', '')
    body = request.get_data(as_text=True)

    # Header format: "t=1712345678,v1=hexdigest"
    parts = dict(p.split('=', 1) for p in signature_header.split(','))
    timestamp = parts.get('t')
    signature = parts.get('v1')
    if not timestamp or not signature:
        return False

    # Reject signatures older than tolerance
    if abs(time.time() - float(timestamp)) > tolerance_seconds:
        return False

    # Recompute the signature
    expected = hmac.new(
        secret.encode(),
        f"{timestamp}.{body}".encode(),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, signature)


# --- Usage in Flask ---
@app.route('/webhooks/relay', methods=['POST'])
def webhook():
    if not verify_relay_webhook('whsec_your_secret_here'):
        abort(401)

    data = request.get_json()
    # Process the webhook
    return {'received': True}


# --- Usage in FastAPI ---
from fastapi import Request, HTTPException

async def verify_relay_fastapi(request: Request, secret: str) -> bool:
    signature_header = request.headers.get('x-relay-signature', '')
    body = await request.body()
    # ... same verification logic as above ...`
  }
}

export function VerifyPage() {
  const navigate = useNavigate()
  const [lang, setLang] = useState<Lang>('node')

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 md:px-6">
      <button
        onClick={() => navigate({ to: '/integration' })}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to Integration Guide
      </button>

      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Verifying Webhooks</h1>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-2">How It Works</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every webhook payload is signed with <strong className="text-foreground">HMAC-SHA256</strong>{' '}
            using your endpoint's signing secret. The signature is sent in the{' '}
            <code className="text-foreground font-mono text-[11px]">x-relay-signature</code> header
            in the format <code className="text-foreground font-mono text-[11px]">t=&lt;timestamp&gt;,v1=&lt;hex&gt;</code>.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-2">
            You should verify this signature on every webhook request to confirm it was sent by
            Relay and has not been tampered with. The <code className="text-foreground font-mono text-[11px]">t</code>{' '}
            parameter provides replay protection — reject signatures older than your tolerance
            window (default 5 minutes).
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Verification Code</h2>
            <TabBar selected={lang} onSelect={setLang} />
          </div>
          <CodeBlock code={verifySnippet(lang)} />
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Headers Reference</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-medium text-muted-foreground py-2 pr-4">Header</th>
                  <th className="text-left font-medium text-muted-foreground py-2 pr-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-2 pr-4 font-mono text-foreground">x-relay-signature</td>
                  <td className="py-2 text-muted-foreground">
                    HMAC-SHA256 signature: <code className="text-foreground font-mono text-[11px]">t=&lbrace;timestamp&rbrace;,v1=&lbrace;hex&rbrace;</code>
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-foreground">x-relay-message-id</td>
                  <td className="py-2 text-muted-foreground">Unique ID for this delivery attempt</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-foreground">x-relay-event-id</td>
                  <td className="py-2 text-muted-foreground">
                    Your idempotency key — use for deduplication
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-foreground">x-relay-event-type</td>
                  <td className="py-2 text-muted-foreground">The event type (e.g. user.created)</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-foreground">x-relay-attempt</td>
                  <td className="py-2 text-muted-foreground">Which attempt this is (1, 2, 3)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Best Practices</h2>
          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-foreground font-semibold shrink-0 w-24">Verify always</span>
              <span>
                Always verify the signature before processing. Without verification, anyone can send
                fake webhooks to your endpoint.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-foreground font-semibold shrink-0 w-24">Use timestamps</span>
              <span>
                Enforce a tolerance window (5 minutes recommended) on the{' '}
                <code className="text-foreground font-mono text-[11px]">t</code> parameter to prevent
                replay attacks.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-foreground font-semibold shrink-0 w-24">Constant time</span>
              <span>
                Use constant-time comparison (like Node's{' '}
                <code className="text-foreground font-mono text-[11px]">timingSafeEqual</code> or
                Python's <code className="text-foreground font-mono text-[11px]">compare_digest</code>)
                to avoid timing side-channel attacks.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-foreground font-semibold shrink-0 w-24">Rotate secrets</span>
              <span>
                Rotate your signing secret periodically using the Keys section on your endpoint page.
                Old keys remain valid for in-flight deliveries.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
