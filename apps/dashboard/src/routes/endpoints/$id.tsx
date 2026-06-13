import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ArrowLeft, Copy, Key, RefreshCw, Webhook } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/app/confirm-dialog'
import { StatusBadge } from '../../components/app/status'
import { DetailSkeleton } from '../../components/skeleton'
import { useToast } from '../../components/toast'
import { api } from '../../lib/api-client'
import type { SigningKey } from '../../lib/types'

type Tab = 'overview' | 'messages' | 'keys' | 'test' | 'settings'

export function EndpointDetailPage() {
  const { id } = useParams({ from: '/endpoints/$id' })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const params = new URLSearchParams(window.location.search)
    return (params.get('tab') as Tab) || 'overview'
  })
  const [showCreateKey, setShowCreateKey] = useState(false)
  const [confirmRevokeKid, setConfirmRevokeKid] = useState<string | null>(null)
  const [confirmDeleteEndpoint, setConfirmDeleteEndpoint] = useState(false)

  const { data: endpoint, isLoading } = useQuery({
    queryKey: ['endpoint', id],
    queryFn: () => api.getEndpoint(id),
  })

  const { data: keysData } = useQuery({
    queryKey: ['keys', id],
    queryFn: () => api.listKeys(id),
    enabled: activeTab === 'keys',
  })

  const { data: messagesData } = useQuery({
    queryKey: ['messages', { endpointId: id, limit: 10 }],
    queryFn: () => api.listMessages({ endpointId: id, limit: 10 }),
    enabled: activeTab === 'messages',
  })

  const createKeyMutation = useMutation({
    mutationFn: () => api.createKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys', id] })
      queryClient.invalidateQueries({ queryKey: ['endpoint', id] })
      setShowCreateKey(true)
      toast('success', 'Signing key created', "Copy the secret now — it won't be shown again")
    },
    onError: (err) => {
      toast('error', 'Failed to create key', err instanceof Error ? err.message : 'Unknown error')
    },
  })

  const revokeKeyMutation = useMutation({
    mutationFn: (kid: string) => api.revokeKey(id, kid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keys', id] })
      queryClient.invalidateQueries({ queryKey: ['endpoint', id] })
      toast('success', 'Signing key revoked')
    },
    onError: (err) => {
      toast('error', 'Failed to revoke key', err instanceof Error ? err.message : 'Unknown error')
    },
  })

  const [testResult, setTestResult] = useState<{
    text: string
    isError: boolean
    messageId?: string
  } | null>(null)
  const sendTestMutation = useMutation({
    mutationFn: (data: { eventType: string; payload: Record<string, unknown> }) =>
      api.sendEvent(id, data.eventType, data.payload),
    onSuccess: (result) => {
      setTestResult({ text: 'Event sent successfully!', isError: false, messageId: result.id })
      queryClient.invalidateQueries({ queryKey: ['messages', id] })
    },
    onError: (err: Error) => {
      setTestResult({ text: `Failed: ${err.message}`, isError: true })
    },
  })

  const [editForm, setEditForm] = useState<{
    url: string
    description: string
    eventTypes: string
    rateLimitPerSecond: string
    rateLimitBurst: string
    timeoutMs: string
    deadLetterWebhookUrl: string
  } | null>(null)

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.updateEndpoint(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endpoint', id] })
      setEditForm(null)
      toast('success', 'Endpoint updated')
    },
    onError: (err) => {
      toast(
        'error',
        'Failed to update endpoint',
        err instanceof Error ? err.message : 'Unknown error',
      )
    },
  })

  if (isLoading) {
    return <DetailSkeleton />
  }

  if (!endpoint) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
        Endpoint not found
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'messages', label: 'Messages' },
    { key: 'keys', label: 'Signing Keys' },
    { key: 'test', label: 'Send Test' },
    { key: 'settings', label: 'Settings' },
  ]

  const keys = keysData?.data ?? []
  const messages = messagesData?.data ?? []
  const newKeySecret = createKeyMutation.data?.secret

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/endpoints"
          className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-foreground/10 to-foreground/5 ring-1 ring-foreground/10">
            <Webhook className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{endpoint.description || endpoint.url}</h1>
            <p className="text-sm text-muted-foreground font-mono">{endpoint.id}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-card p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
              activeTab === tab.key
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {activeTab === tab.key && (
              <motion.span
                layoutId="endpoint-tab"
                className="absolute inset-0 rounded-lg bg-secondary"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-6 lg:grid-cols-2"
        >
          <div className="relative rounded-xl border border-border bg-card overflow-hidden p-5 space-y-3 card-hover">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/10">
                <Webhook className="h-3.5 w-3.5 text-foreground" />
              </div>
              <h3 className="text-sm font-medium text-card-foreground">Details</h3>
            </div>
            <div className="space-y-0">
              <Row label="URL" value={endpoint.url} mono />
              <Row
                label="Status"
                value={
                  <StatusBadge status={endpoint.status}>
                    {endpoint.status.replace(/_/g, ' ')}
                  </StatusBadge>
                }
              />
              <Row label="Description" value={endpoint.description || '—'} />
              <Row
                label="Event Types"
                value={
                  endpoint.eventTypes.length > 0 ? endpoint.eventTypes.join(', ') : 'All events'
                }
              />
            </div>
          </div>
          <div className="relative rounded-xl border border-border bg-card overflow-hidden p-5 space-y-3 card-hover">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/10">
                <RefreshCw className="h-3.5 w-3.5 text-foreground" />
              </div>
              <h3 className="text-sm font-medium text-card-foreground">Rate Limits</h3>
            </div>
            <div className="space-y-0">
              <Row
                label="Per Second"
                value={endpoint.rateLimitPerSecond?.toString() || 'Default'}
              />
              <Row label="Burst" value={endpoint.rateLimitBurst?.toString() || 'Default'} />
              <Row label="Created" value={new Date(endpoint.createdAt).toLocaleString()} />
              <Row label="Updated" value={new Date(endpoint.updatedAt).toLocaleString()} />
            </div>
          </div>
        </motion.div>
      )}

      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <BatchReplaySection
          messages={messages}
          endpointId={id}
          queryClient={queryClient}
          toast={toast}
        />
      )}

      {/* Signing Keys Tab */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => createKeyMutation.mutate()}
              disabled={createKeyMutation.isPending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Key className="h-4 w-4" />
              {createKeyMutation.isPending ? 'Creating...' : 'Rotate Key'}
            </button>
          </div>

          {newKeySecret && (
            <div className="relative rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/30 via-emerald-500/50 to-emerald-500/30" />
              <div className="p-4">
                <p className="text-xs font-medium text-emerald-400 mb-2">
                  New signing key created — copy it now, it won't be shown again
                </p>
                <div className="relative rounded-lg overflow-hidden border border-emerald-500/20">
                  <div className="flex items-center justify-between bg-emerald-500/10 px-3 py-1.5 border-b border-emerald-500/20">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-400/70" />
                      <span className="h-2 w-2 rounded-full bg-amber-400/70" />
                      <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(newKeySecret); toast('success', 'Secret copied') }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <pre className="bg-emerald-500/5 p-3 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
                    {newKeySecret}
                  </pre>
                </div>
              </div>
            </div>
          )}

          <div className="relative rounded-xl border border-border bg-card overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3.5">Kid</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Created</th>
                  <th className="px-4 py-3.5">Retired</th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {keys.map((key: SigningKey, i) => (
                  <motion.tr
                    key={key.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.25, ease: 'easeOut' }}
                    className="hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-mono font-medium">{key.kid}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={key.status}>{key.status.replace(/_/g, ' ')}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {key.retiredAt ? new Date(key.retiredAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {key.status === 'active' && (
                        <button
                          onClick={() => setConfirmRevokeKid(key.kid)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Send Test Tab */}
      {activeTab === 'test' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg space-y-4"
        >
          <div className="relative rounded-xl border border-border bg-card overflow-hidden p-5 card-hover">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
            <h3 className="text-sm font-medium text-card-foreground mb-4">Send Test Event</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.currentTarget
                const data = new FormData(form)
                let payload: Record<string, unknown>
                try {
                  payload = JSON.parse(data.get('payload') as string)
                } catch {
                  setTestResult({ text: 'Invalid JSON payload', isError: true })
                  return
                }
                sendTestMutation.mutate({
                  eventType: data.get('eventType') as string,
                  payload,
                })
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Event Type</label>
                <input
                  name="eventType"
                  defaultValue="test.ping"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Payload (JSON)</label>
                <textarea
                  name="payload"
                  rows={6}
                  defaultValue={'{\n  "message": "hello world"\n}'}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                type="submit"
                disabled={sendTestMutation.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {sendTestMutation.isPending ? 'Sending...' : 'Send Test Event'}
              </button>
              {testResult && (
                <div
                  className={`text-sm ${testResult.isError ? 'text-red-400' : 'text-emerald-400'}`}
                >
                  <p>{testResult.text}</p>
                  {testResult.messageId && (
                    <Link
                      to="/messages/$id"
                      params={{ id: testResult.messageId }}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View delivery details →
                    </Link>
                  )}
                </div>
              )}
            </form>
          </div>
        </motion.div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg space-y-6"
        >
          {!editForm ? (
            <div className="relative rounded-xl border border-border bg-card overflow-hidden p-5 card-hover">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-card-foreground">Endpoint Details</h3>
                <button
                  type="button"
                  onClick={() =>
                    setEditForm({
                      url: endpoint.url,
                      description: endpoint.description || '',
                      eventTypes: endpoint.eventTypes.join(', '),
                      rateLimitPerSecond: endpoint.rateLimitPerSecond?.toString() || '',
                      rateLimitBurst: endpoint.rateLimitBurst?.toString() || '',
                      timeoutMs: endpoint.timeoutMs?.toString() || '',
                      deadLetterWebhookUrl: endpoint.deadLetterWebhookUrl || '',
                    })
                  }
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Edit
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">URL</span>
                  <span className="font-mono text-foreground break-all max-w-[70%] text-right">
                    {endpoint.url}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description</span>
                  <span className="text-foreground max-w-[70%] text-right">
                    {endpoint.description || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Event Types</span>
                  <span className="text-foreground max-w-[70%] text-right">
                    {endpoint.eventTypes.length > 0 ? endpoint.eventTypes.join(', ') : 'All'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rate Limit /s</span>
                  <span className="text-foreground">
                    {endpoint.rateLimitPerSecond ?? 'Default'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rate Burst</span>
                  <span className="text-foreground">{endpoint.rateLimitBurst ?? 'Default'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Timeout</span>
                  <span className="text-foreground">
                    {endpoint.timeoutMs ? `${endpoint.timeoutMs}ms` : 'Default'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dead-letter Webhook</span>
                  <span className="font-mono text-foreground break-all max-w-[60%] text-right">
                    {endpoint.deadLetterWebhookUrl || '—'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative rounded-xl border border-border bg-card overflow-hidden p-4">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
              <h3 className="text-sm font-medium text-card-foreground mb-4">Edit Endpoint</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const data: Record<string, unknown> = { url: editForm.url }
                  if (editForm.description) data.description = editForm.description
                  if (editForm.eventTypes) {
                    data.eventTypes = editForm.eventTypes
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  }
                  if (editForm.rateLimitPerSecond)
                    data.rateLimitPerSecond = Number(editForm.rateLimitPerSecond)
                  if (editForm.rateLimitBurst) data.rateLimitBurst = Number(editForm.rateLimitBurst)
                  if (editForm.timeoutMs) data.timeoutMs = Number(editForm.timeoutMs)
                  data.deadLetterWebhookUrl = editForm.deadLetterWebhookUrl || null
                  updateMutation.mutate(data)
                }}
                className="space-y-3"
              >
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">URL</label>
                  <input
                    value={editForm.url}
                    onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <input
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Event Types</label>
                  <input
                    value={editForm.eventTypes}
                    onChange={(e) => setEditForm({ ...editForm, eventTypes: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Rate Limit /s
                    </label>
                    <input
                      value={editForm.rateLimitPerSecond}
                      onChange={(e) =>
                        setEditForm({ ...editForm, rateLimitPerSecond: e.target.value })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Rate Burst</label>
                    <input
                      value={editForm.rateLimitBurst}
                      onChange={(e) => setEditForm({ ...editForm, rateLimitBurst: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Timeout (ms)
                    </label>
                    <input
                      type="number"
                      value={editForm.timeoutMs}
                      onChange={(e) => setEditForm({ ...editForm, timeoutMs: e.target.value })}
                      placeholder="(global default — 30000)"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Dead-letter Webhook URL
                  </label>
                  <input
                    value={editForm.deadLetterWebhookUrl}
                    onChange={(e) => setEditForm({ ...editForm, deadLetterWebhookUrl: e.target.value })}
                    placeholder="https://example.com/dead-letter"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Receives a POST when a message exhausts all retries.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditForm(null)}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="relative rounded-xl border border-red-500/20 bg-card overflow-hidden p-5">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500/30 via-red-500/50 to-red-500/30" />
            <h3 className="text-sm font-medium text-red-400 mb-2">Danger Zone</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Deleting this endpoint will stop all deliveries and permanently remove it.
            </p>
            <button
              onClick={() => setConfirmDeleteEndpoint(true)}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all duration-200"
            >
              Delete Endpoint
            </button>
          </div>
        </motion.div>
      )}
      <ConfirmDialog
        open={confirmRevokeKid !== null}
        onConfirm={() => {
          if (confirmRevokeKid) revokeKeyMutation.mutate(confirmRevokeKid)
          setConfirmRevokeKid(null)
        }}
        onCancel={() => setConfirmRevokeKid(null)}
        title="Revoke signing key?"
        description="Revoked keys will no longer be accepted for webhook verification."
        confirmLabel="Revoke"
        destructive
        loading={revokeKeyMutation.isPending}
      />
      <ConfirmDialog
        open={confirmDeleteEndpoint}
        onConfirm={() => {
          setConfirmDeleteEndpoint(false)
          void navigate({ to: '/endpoints' })
        }}
        onCancel={() => setConfirmDeleteEndpoint(false)}
        title="Delete endpoint?"
        description="This will stop all deliveries and permanently remove this endpoint. This cannot be undone."
        confirmLabel="Delete"
        destructive
      />
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-border/50 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-sm text-card-foreground text-right max-w-[60%] break-all ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}

function BatchReplaySection({
  messages,
  endpointId,
  queryClient,
  toast,
}: {
  messages: {
    id: string
    eventType: string
    status: string
    attemptCount: number
    createdAt: string
  }[]
  endpointId: string
  queryClient: QueryClient
  toast: (type: 'success' | 'error' | 'info', title: string, message?: string) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const batchReplayMutation = useMutation({
    mutationFn: (ids: string[]) => api.batchReplayMessages(ids),
    onSuccess: (result) => {
      const count = result.summary.replayed
      queryClient.invalidateQueries({ queryKey: ['messages', endpointId] })
      toast('success', `${count} message${count !== 1 ? 's' : ''} replayed`)
      setSelected(new Set())
    },
    onError: (err: Error) => {
      toast('error', 'Batch replay failed', err.message)
    },
  })

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const toggleAll = () => {
    if (selected.size === messages.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(messages.map((m) => m.id)))
    }
  }

  const replayable = messages.filter((m) => m.status === 'failed' || m.status === 'dead_letter')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={selected.size === messages.length && messages.length > 0}
                onChange={toggleAll}
                className="rounded border-border"
              />
              Select all
            </label>
          )}
        </div>
        {selected.size > 0 && (
          <button
            onClick={() => batchReplayMutation.mutate(Array.from(selected))}
            disabled={batchReplayMutation.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {batchReplayMutation.isPending ? 'Replaying...' : `Replay Selected (${selected.size})`}
          </button>
        )}
      </div>

      <div className="relative rounded-xl border border-border bg-card overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
        {messages.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No messages for this endpoint yet.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3 w-10" />
                <th className="px-4 py-3">Event Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Created</th>
                {selected.size > 0 && <th className="px-4 py-3">Replayable</th>}
              </tr>
            </thead>
            <tbody>
              {messages.map((msg) => (
                <tr
                  key={msg.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/50"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(msg.id)}
                      onChange={() => toggle(msg.id)}
                      className="rounded border-border"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{msg.eventType}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={msg.status}>{msg.status.replace(/_/g, ' ')}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{msg.attemptCount}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(msg.createdAt).toLocaleString()}
                  </td>
                  {selected.size > 0 && (
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {msg.status === 'failed' || msg.status === 'dead_letter' ? (
                        <span className="text-emerald-400">Yes</span>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="border-t border-border px-4 py-2">
          <Link
            to="/messages"
            search={{ endpointId }}
            className="text-xs text-primary hover:underline"
          >
            View all messages →
          </Link>
        </div>
      </div>

      {replayable.length > 0 && selected.size === 0 && (
        <p className="text-xs text-muted-foreground">
          {replayable.length} message{replayable.length !== 1 ? 's' : ''} available for replay.
          Select messages above to replay.
        </p>
      )}
    </div>
  )
}
