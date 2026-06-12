import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, BarChart3, Check, Copy, Fingerprint, Key, Lock, RefreshCw, ScrollText, Shield, Tag, Timer } from 'lucide-react'
import { useState } from 'react'

type Lang = 'curl' | 'node' | 'python'

function CodeBlock({ code }: { code: string }) {
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
    <div className="w-full px-4 py-6 md:px-6 lg:px-8">
      {/* Back button */}
      <button
        onClick={() => navigate({ to: '/integration' })}
        className="group inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
        Back to Integration Guide
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 ring-1 ring-amber-500/20">
          <Shield className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Verifying Webhooks</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            HMAC-SHA256 signature verification for your customers
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        {/* Main content */}
        <div className="space-y-8">
          {/* How it works */}
          <div className="relative rounded-xl border border-border bg-card overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/20 via-amber-500/40 to-amber-500/20" />
            <div className="p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <Fingerprint className="h-4 w-4 text-amber-500" />
                </div>
                <h2 className="text-base font-semibold text-foreground">How It Works</h2>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Every webhook payload is signed with <strong className="text-foreground">HMAC-SHA256</strong>{' '}
                  using your endpoint's signing secret before delivery. The signature is sent in the{' '}
                  <code className="text-foreground font-mono text-xs px-1 py-0.5 rounded bg-muted">x-relay-signature</code>{' '}
                  header in the format <code className="text-foreground font-mono text-xs px-1 py-0.5 rounded bg-muted">t=&lt;timestamp&gt;,v1=&lt;hex&gt;</code>.
                </p>
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">You should verify this signature</strong> on every webhook
                    request to confirm it was sent by Relayd and has not been tampered with. The{' '}
                    <code className="text-foreground font-mono text-[11px]">t</code> parameter provides
                    replay protection — reject signatures older than your tolerance window (default 5 minutes).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Code */}
          <div className="relative rounded-xl border border-border bg-card overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10">
                    <ScrollText className="h-4 w-4 text-foreground" />
                  </div>
                  <h2 className="text-base font-semibold text-foreground">Verification Code</h2>
                </div>
                <TabBar selected={lang} onSelect={setLang} />
              </div>
              <CodeBlock code={verifySnippet(lang)} />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Headers Reference */}
          <div className="relative rounded-xl border border-border bg-card overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
            <div className="p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Headers Reference</h2>
              <div className="space-y-0 divide-y divide-border">
                {[
                  { header: 'x-relay-signature', icon: Shield, desc: 'HMAC-SHA256: t={ts},v1={hex}', color: 'text-amber-500' },
                  { header: 'x-relay-message-id', icon: Fingerprint, desc: 'Unique delivery attempt ID', color: 'text-foreground' },
                  { header: 'x-relay-event-id', icon: Key, desc: 'Your idempotency key for dedup', color: 'text-foreground' },
                  { header: 'x-relay-event-type', icon: Tag, desc: 'Event type (e.g. user.created)', color: 'text-foreground' },
                  { header: 'x-relay-attempt', icon: BarChart3, desc: 'Attempt number (1, 2, 3...)', color: 'text-foreground' },
                ].map(({ header, icon: Icon, desc, color }) => (
                  <div key={header} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Icon className={`h-3 w-3 ${color}`} />
                      <code className="text-xs font-mono text-foreground">{header}</code>
                    </div>
                    <p className="text-[11px] text-muted-foreground pl-5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Best Practices */}
          <div className="relative rounded-xl border border-border bg-card overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/20 via-emerald-500/40 to-emerald-500/20" />
            <div className="p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Best Practices</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 mt-0.5">
                    <Check className="h-3 w-3 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Verify always</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      Always verify the signature before processing. Without it, anyone can send fake webhooks.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 mt-0.5">
                    <Timer className="h-3 w-3 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Use timestamps</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      Enforce a tolerance window (5 minutes) on <code className="text-foreground font-mono text-[10px]">t</code> to prevent replay attacks.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 mt-0.5">
                    <Lock className="h-3 w-3 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Constant time</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      Use <code className="text-foreground font-mono text-[10px]">timingSafeEqual</code> or{' '}
                      <code className="text-foreground font-mono text-[10px]">compare_digest</code> to avoid timing attacks.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 mt-0.5">
                    <RefreshCw className="h-3 w-3 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Rotate secrets</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      Rotate signing secrets periodically. Old keys remain valid for in-flight deliveries.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

