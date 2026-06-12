import { useNavigate } from '@tanstack/react-router'
import { Building2, Check, Copy, Key, LogOut, Plus, Settings, Terminal, Trash2, User, X } from 'lucide-react'
import { getStoredTenant, getStoredUser, logout } from '../lib/auth'
import { useCallback, useEffect, useState } from 'react'
import { api, getApiBaseUrl } from '../lib/api-client'
import type { ApiKey } from '../lib/types'

function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className={`inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {!copied && 'Copy'}
    </button>
  )
}

function CodeBlock({ code, step }: { code: string; step?: string }) {
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
          {step && (
            <span className="text-[10px] font-mono font-medium text-muted-foreground tracking-wider ml-1">
              {step}
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
      <pre className="bg-muted/30 p-4 text-xs font-mono text-foreground overflow-x-auto leading-relaxed">
        {code}
      </pre>
    </div>
  )
}

function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [createdKey, setCreatedKey] = useState<{
    fullKey: string
    name: string
  } | null>(null)
  const [creating, setCreating] = useState(false)

  const loadKeys = useCallback(async () => {
    try {
      const res = await api.listApiKeys()
      setKeys(res.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await api.createApiKey({ name: newName.trim() })
      setCreatedKey({ fullKey: res.fullKey, name: res.name })
      setNewName('')
      setShowCreate(false)
      await loadKeys()
    } catch {
      // ignore
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string) {
    try {
      await api.revokeApiKey(id)
      await loadKeys()
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative rounded-xl border border-border bg-card overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10">
              <Key className="h-4 w-4 text-foreground" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">API Keys</h2>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Key
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
          </div>
        ) : keys.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <Key className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No API keys yet. Create one for programmatic access.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-2.5 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">
                    {key.name}
                  </span>
                  <code className="text-xs font-mono text-muted-foreground shrink-0 bg-muted/50 px-1.5 py-0.5 rounded">
                    {key.keyPrefix}
                  </code>
                  {!key.active && (
                    <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider shrink-0">
                      Revoked
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {key.lastUsedAt && (
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                      Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                    </span>
                  )}
                  {key.active && (
                    <button
                      onClick={() => handleRevoke(key.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors"
                      title="Revoke key"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Create API Key</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. CI/CD Pipeline"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {createdKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Key Created</h3>
              <button onClick={() => setCreatedKey(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 mb-3">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                This is the only time the full key will be shown. Copy it now.
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3 mb-4">
              <div className="text-xs font-medium text-foreground mb-1">{createdKey.name}</div>
              <code className="text-xs font-mono text-foreground break-all select-all">
                {createdKey.fullKey}
              </code>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdKey.fullKey)
                  setCreatedKey(null)
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-background hover:opacity-90 transition-opacity"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const tenant = getStoredTenant()
  const apiUrl = getApiBaseUrl()

  function handleLogout() {
    logout()
    navigate({ to: '/login' })
  }

  const curlLogin = `curl -X POST ${apiUrl}/auth/login -c cookies.txt \\
  -H "Content-Type: application/json" \\
  -d '{"email":"your@email.com","password":"your-password"}'`

  const curlCreateEndpoint = `curl -X POST ${apiUrl}/v1/endpoints \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com/webhook","description":"My endpoint"}'`

  const curlSendEvent = `curl -X POST ${apiUrl}/v1/events \\
  -H "Content-Type: application/json" \\
  -d '{
    "endpointId": "<endpoint_id>",
    "eventId": "evt_$(date +%s)",
    "eventType": "user.created",
    "payload": {"user_id": 42}
  }'`

  return (
    <div className="w-full px-4 py-6 md:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-foreground/10 to-foreground/5 ring-1 ring-foreground/10">
          <Settings className="h-5 w-5 text-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your workspace, profile, and API access
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Workspace + Profile grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative rounded-xl border border-border bg-card overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
            <div className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10">
                  <Building2 className="h-4 w-4 text-foreground" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">Workspace</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">Name</span>
                  <span className="text-sm font-medium text-foreground">{tenant?.name ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">Slug</span>
                  <span className="text-sm font-mono text-foreground">{tenant?.slug ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-muted-foreground">Tenant ID</span>
                  <span className="text-sm font-mono text-muted-foreground">{tenant?.id ?? '—'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative rounded-xl border border-border bg-card overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
            <div className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10">
                  <User className="h-4 w-4 text-foreground" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">Profile</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">Name</span>
                  <span className="text-sm font-medium text-foreground">{user?.name ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">Email</span>
                  <span className="text-sm font-mono text-foreground">{user?.email ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-muted-foreground">Role</span>
                  <span className="text-sm text-foreground capitalize">{user?.role ?? '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* API Access */}
        <div className="relative rounded-xl border border-border bg-card overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
          <div className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10">
                <Terminal className="h-4 w-4 text-foreground" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">API Access</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
              Use these commands to interact with the Relay API programmatically.
              You'll need to log in first to get a session cookie.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-foreground">1. Log in</span>
                  <CopyButton text={curlLogin} />
                </div>
                <CodeBlock code={curlLogin} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-foreground">2. Create endpoint</span>
                  <CopyButton text={curlCreateEndpoint} />
                </div>
                <CodeBlock code={curlCreateEndpoint} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-foreground">3. Send an event</span>
                  <CopyButton text={curlSendEvent} />
                </div>
                <CodeBlock code={curlSendEvent} />
              </div>
            </div>
          </div>
        </div>

        <ApiKeysSection />

        {/* Sign Out */}
        <div className="relative rounded-xl border border-red-500/20 bg-gradient-to-r from-red-500/5 to-transparent overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500/30 via-red-500/50 to-red-500/30" />
          <div className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <LogOut className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-red-400">Sign Out</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              End your current session. You can sign back in anytime.
            </p>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
