import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, Search } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/app/confirm-dialog'
import { PageHeader } from '../../components/app/page-header'
import { StatusBadge } from '../../components/app/status'
import { useToast } from '../../components/toast'
import { api } from '../../lib/api-client'

export function ConnectionsListPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [q, setQ] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    endpointId: '',
    transformationId: '',
    enabled: true,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.listConnections(50),
    refetchInterval: 15_000,
  })

  const { data: endpointsData } = useQuery({
    queryKey: ['endpoints'],
    queryFn: () => api.listEndpoints(100),
  })

  const { data: transformationsData } = useQuery({
    queryKey: ['transformations'],
    queryFn: () => api.listTransformations(50),
  })

  const createMutation = useMutation({
    mutationFn: (input: {
      name: string
      description?: string
      endpointId: string
      transformationId?: string | null
      enabled?: boolean
    }) => api.createConnection(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      setShowCreate(false)
      setForm({ name: '', description: '', endpointId: '', transformationId: '', enabled: true })
      toast('success', 'Connection created')
    },
    onError: (err) => {
      toast(
        'error',
        'Failed to create connection',
        err instanceof Error ? err.message : 'Unknown error',
      )
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.updateConnection(id, { enabled }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      toast('success', `Connection ${vars.enabled ? 'enabled' : 'disabled'}`)
    },
    onError: (err) => {
      toast(
        'error',
        'Failed to update connection',
        err instanceof Error ? err.message : 'Unknown error',
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      toast('success', 'Connection deleted')
    },
    onError: (err) => {
      toast(
        'error',
        'Failed to delete connection',
        err instanceof Error ? err.message : 'Unknown error',
      )
    },
  })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const endpoints = endpointsData?.data ?? []
  const transformations = transformationsData?.data ?? []

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate({
      name: form.name,
      description: form.description || undefined,
      endpointId: form.endpointId,
      transformationId: form.transformationId || null,
      enabled: form.enabled,
    })
  }

  const filtered = (data?.data ?? []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6">
      <PageHeader
        title="Connections"
        description="Route webhook events to endpoints with optional filtering and transformation."
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Add connection
          </button>
        }
      />

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="relative mt-5 rounded-xl border border-border bg-card overflow-hidden p-4 space-y-3"
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
          <h3 className="text-sm font-semibold text-foreground">New Connection</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Connection name"
                className="h-8 w-full rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
                className="h-8 w-full rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Endpoint</label>
              <select
                value={form.endpointId}
                onChange={(e) => setForm({ ...form, endpointId: e.target.value })}
                className="h-8 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-border-strong focus:outline-none"
                required
              >
                <option value="" disabled>
                  Select an endpoint
                </option>
                {endpoints.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.description || ep.url}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Transformation (optional)
              </label>
              <select
                value={form.transformationId}
                onChange={(e) => setForm({ ...form, transformationId: e.target.value })}
                className="h-8 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-border-strong focus:outline-none"
              >
                <option value="">None</option>
                {transformations.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                className="rounded border-border"
              />
              Enable immediately
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex h-8 items-center rounded-md bg-foreground px-2.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search connections"
            className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="relative h-36 animate-pulse rounded-xl border border-border bg-card overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-10 flex items-center justify-center rounded-lg border border-dashed border-border p-10 text-sm text-muted-foreground">
          {q
            ? 'No connections match your search.'
            : 'No connections yet. Create one to route events.'}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden p-4 transition-colors hover:border-border-strong"
            >
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-foreground/10 to-foreground/5 ring-1 ring-foreground/10 font-mono text-sm font-semibold text-foreground">
                  {c.name[0]}
                </div>
                {c.enabled ? (
                  <StatusBadge tone="success">Active</StatusBadge>
                ) : (
                  <StatusBadge tone="muted">Disabled</StatusBadge>
                )}
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{c.name}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {c.description || 'No description'}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                <span className="text-muted-foreground">
                  → endpoint: {c.endpointId.slice(0, 12)}...
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleMutation.mutate({ id: c.id, enabled: !c.enabled })}
                    className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${
                      c.enabled
                        ? 'border border-border text-foreground hover:bg-accent'
                        : 'bg-foreground text-background hover:opacity-90'
                    }`}
                  >
                    {c.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(c.id)}
                    className="h-7 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onConfirm={() => {
          if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId)
          setConfirmDeleteId(null)
        }}
        onCancel={() => setConfirmDeleteId(null)}
        title="Delete connection?"
        description="This will permanently remove this connection and stop routing events through it."
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
