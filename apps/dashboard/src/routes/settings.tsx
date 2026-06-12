import { useNavigate } from '@tanstack/react-router'
import { Copy, Key, LogOut, Plus, Settings, Trash2, X } from 'lucide-react'
import { getStoredTenant, getStoredUser, logout } from '../lib/auth'
import { useCallback, useEffect, useState } from 'react'
import { api, getApiBaseUrl } from '../lib/api-client'
import type { ApiKey } from '../lib/types'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <Copy className="h-3 w-3" />
      {copied ? 'Copied!' : 'Copy'}
    </button>
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
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
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
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : keys.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No API keys yet. Create one for programmatic access.
        </p>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-medium text-foreground truncate">
                  {key.name}
                </span>
                <code className="text-xs font-mono text-muted-foreground shrink-0">
                  {key.keyPrefix}
                </code>
                {!key.active && (
                  <span className="text-[10px] font-medium text-red-400 uppercase shrink-0">
                    Revoked
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {key.lastUsedAt && (
                  <span className="text-[10px] text-muted-foreground">
                    Used {new Date(key.lastUsedAt).toLocaleDateString()}
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

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Create API Key</h3>
              <button
                onClick={() => setShowCreate(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. CI/CD Pipeline"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {createdKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Key Created</h3>
              <button
                onClick={() => setCreatedKey(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              This is the only time the full key will be shown. Copy it now.
            </p>
            <div className="rounded-md bg-muted p-3 mb-4">
              <div className="text-xs font-medium text-foreground mb-1">{createdKey.name}</div>
              <code className="text-xs font-mono text-foreground break-all">
                {createdKey.fullKey}
              </code>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdKey.fullKey)
                  setCreatedKey(null)
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-xs font-medium text-background hover:opacity-90 transition-opacity"
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

  const curlLogin = `curl -X POST ${apiUrl}/auth/login -c cookies.txt \\
  -H "Content-Type: application/json" \\
  -d '{"email":"your@email.com","password":"your-password"}'`

  return (
    <div className="mx-auto w-full max-w-[800px] px-4 py-6 md:px-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Workspace</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Name</span>
              <span className="text-sm font-medium text-foreground">{tenant?.name ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Slug</span>
              <span className="text-sm font-mono text-foreground">{tenant?.slug ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Tenant ID</span>
              <span className="text-sm font-mono text-muted-foreground">{tenant?.id ?? '—'}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Profile</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Name</span>
              <span className="text-sm font-medium text-foreground">{user?.name ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Email</span>
              <span className="text-sm font-mono text-foreground">{user?.email ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Role</span>
              <span className="text-sm text-foreground capitalize">{user?.role ?? '—'}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">API Access</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Use these commands to interact with the Relay API programmatically. You'll need to log in first to get a session cookie.
          </p>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-foreground">1. Log in</span>
                <CopyButton text={curlLogin} />
              </div>
              <pre className="rounded-md bg-muted p-3 text-xs font-mono text-foreground overflow-x-auto">
                {curlLogin}
              </pre>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-foreground">2. Create an endpoint</span>
                <CopyButton text={curlCreateEndpoint} />
              </div>
              <pre className="rounded-md bg-muted p-3 text-xs font-mono text-foreground overflow-x-auto">
                {curlCreateEndpoint}
              </pre>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-foreground">3. Send an event</span>
                <CopyButton text={curlSendEvent} />
              </div>
              <pre className="rounded-md bg-muted p-3 text-xs font-mono text-foreground overflow-x-auto">
                {curlSendEvent}
              </pre>
            </div>
          </div>
        </div>

        <ApiKeysSection />

        <div className="rounded-lg border border-red-500/20 bg-card p-5">
          <h2 className="text-sm font-semibold text-red-400 mb-2">Sign Out</h2>
          <p className="text-xs text-muted-foreground mb-3">
            End your current session. You can sign back in anytime.
          </p>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
