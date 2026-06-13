import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Copy, Filter, MoreHorizontal, PlusIcon, Search, Send, X } from 'lucide-react'
import React, { useState } from 'react'
import { ConfirmDialog } from '../../components/app/confirm-dialog'
import { PageHeader } from '../../components/app/page-header'
import { StatusBadge, type Tone } from '../../components/app/status'
import { TableSkeleton } from '../../components/skeleton'
import { useToast } from '../../components/toast'
import { api } from '../../lib/api-client'
import type { Endpoint } from '../../lib/types'

const toneFor = (s: string): Tone =>
  s === 'active' ? 'success' : s === 'disabled' ? 'destructive' : 'muted'

export function EndpointsListPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [q, setQ] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ url: '', description: '', eventTypes: '' })
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['endpoints'],
    queryFn: () => api.listEndpoints(100),
    refetchInterval: 15_000,
  })

  const createMutation = useMutation({
    mutationFn: (input: { url: string; description?: string; eventTypes?: string[] }) =>
      api.createEndpoint(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['endpoints'] })
      setShowCreate(false)
      setForm({ url: '', description: '', eventTypes: '' })
      if (result.secret) {
        setCreatedSecret(result.secret)
      }
      navigate({ to: '/endpoints/$id', params: { id: result.id }, search: { tab: 'test' } })
    },
    onError: (err) => {
      toast(
        'error',
        'Failed to create endpoint',
        err instanceof Error ? err.message : 'Unknown error',
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteEndpoint(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endpoints'] })
      toast('success', 'Endpoint deleted')
    },
    onError: (err) => {
      toast(
        'error',
        'Failed to delete endpoint',
        err instanceof Error ? err.message : 'Unknown error',
      )
    },
  })

  const [sendingTo, setSendingTo] = useState<string | null>(null)
  const [sendPayload, setSendPayload] = useState('')
  const sendMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: string }) => {
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(payload)
      } catch {
        throw new Error('Invalid JSON')
      }
      return api.sendEvent(id, 'custom.event', parsed)
    },
    onSuccess: (result) => {
      setSendingTo(null)
      setSendPayload('')
      toast('success', 'Event sent')
      navigate({ to: '/messages/$id', params: { id: result.id } })
    },
    onError: (err) => {
      toast('error', 'Failed to send', err instanceof Error ? err.message : 'Unknown error')
    },
  })

  const rows = (data?.data ?? []).filter(
    (e) =>
      e.url.toLowerCase().includes(q.toLowerCase()) ||
      (e.description ?? '').toLowerCase().includes(q.toLowerCase()),
  )

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate({
      url: form.url,
      description: form.description || undefined,
      eventTypes: form.eventTypes
        ? form.eventTypes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    })
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6">
      <PageHeader
        title="Endpoints"
        description="HTTPS destinations that receive webhook deliveries from your workspace."
        actions={
          <button
            onClick={() => {
              setShowCreate(true)
              setCreatedSecret(null)
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90"
          >
            <PlusIcon className="h-3.5 w-3.5" /> New endpoint
          </button>
        }
      />

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="relative mt-5 rounded-xl border border-border bg-card overflow-hidden p-4 space-y-3"
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
          <h3 className="text-sm font-semibold text-foreground">New Endpoint</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://example.com/webhook"
                className="h-8 w-full rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
                required
              />
            </div>
            <div>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description"
                className="h-8 w-full rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
              />
            </div>
            <div>
              <input
                value={form.eventTypes}
                onChange={(e) => setForm({ ...form, eventTypes: e.target.value })}
                placeholder="Event types (comma-separated)"
                className="h-8 w-full rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
              />
            </div>
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

      {createdSecret && (
        <div className="relative mt-5 rounded-xl border border-warning/30 bg-warning/5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-warning/30 via-warning/50 to-warning/30" />
          <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Signing Secret</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This secret is shown once only. Copy it now — you won't be able to see it again.
              </p>
              <div className="mt-3 relative rounded-lg overflow-hidden border border-warning/30">
                <div className="flex items-center justify-between bg-warning/10 px-3 py-1.5 border-b border-warning/30">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-red-400/70" />
                    <span className="h-2 w-2 rounded-full bg-amber-400/70" />
                    <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(createdSecret); toast('success', 'Secret copied') }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <pre className="bg-warning/5 p-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
                  {createdSecret}
                </pre>
              </div>
            </div>
            <button
              onClick={() => setCreatedSecret(null)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        </div>
      )}

      <div className="mt-5 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by URL or description"
            className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
          />
        </div>
        <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-sm font-medium hover:bg-accent">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" /> Status
        </button>
      </div>

      {isLoading ? (
        <div className="mt-3 relative rounded-xl border border-border bg-card overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
          <TableSkeleton rows={5} cols={5} />
        </div>
      ) : (
        <div className="mt-3 relative rounded-xl border border-border bg-card overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Endpoint</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Events</th>
                <th className="px-4 py-2.5 text-right font-medium">Created</th>
                <th className="w-10 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((e) => (
                <React.Fragment key={e.id}>
                  <tr className="group hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <Link
                        to="/endpoints/$id"
                        params={{ id: e.id }}
                        className="block hover:opacity-80 transition-opacity"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[13px] text-foreground">{e.url}</span>
                          <button
                            onClick={(ev) => {
                              ev.preventDefault()
                              ev.stopPropagation()
                              navigator.clipboard.writeText(e.url)
                              toast('success', 'URL copied')
                            }}
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                            aria-label="Copy"
                          >
                            <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          </button>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {e.description || <span className="italic">No description</span>} · {e.id}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={toneFor(e.status)}>
                        {e.status === 'active'
                          ? 'Active'
                          : e.status === 'disabled'
                            ? 'Disabled'
                            : 'Paused'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {e.eventTypes.length > 0 ? (
                          e.eventTypes.slice(0, 2).map((ev) => (
                            <span
                              key={ev}
                              className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                            >
                              {ev}
                            </span>
                          ))
                        ) : (
                          <span className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                            All
                          </span>
                        )}
                        {e.eventTypes.length > 2 && (
                          <span className="text-[11px] text-muted-foreground">
                            +{e.eventTypes.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSendingTo(sendingTo === e.id ? null : e.id)
                            setSendPayload('{"message": "hello world"}')
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label="Send event"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(e.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {sendingTo === e.id && (
                    <tr>
                      <td colSpan={5} className="bg-surface/50 px-4 py-3">
                        <form
                          onSubmit={(ev) => {
                            ev.preventDefault()
                            sendMutation.mutate({ id: e.id, payload: sendPayload })
                          }}
                          className="flex items-center gap-3"
                        >
                          <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                            Send to {e.url}
                          </span>
                          <input
                            value={sendPayload}
                            onChange={(x) => setSendPayload(x.target.value)}
                            className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-border-strong focus:outline-none"
                            placeholder='{"message": "hello"}'
                          />
                          <button
                            type="submit"
                            disabled={sendMutation.isPending}
                            className="inline-flex h-7 items-center rounded-md bg-foreground px-2.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
                          >
                            {sendMutation.isPending ? 'Sending...' : 'Send'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSendingTo(null)}
                            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span>
              {rows.length} of {data?.data.length ?? 0} endpoints
            </span>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onConfirm={() => {
          if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId)
          setConfirmDeleteId(null)
        }}
        onCancel={() => setConfirmDeleteId(null)}
        title="Delete endpoint?"
        description="This will stop all deliveries and permanently remove this endpoint."
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
