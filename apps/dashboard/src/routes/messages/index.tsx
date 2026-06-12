import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Filter, RefreshCw, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/app/confirm-dialog'
import { PageHeader } from '../../components/app/page-header'
import { StatusBadge, type Tone } from '../../components/app/status'
import { TableSkeleton } from '../../components/skeleton'
import { useToast } from '../../components/toast'
import { api } from '../../lib/api-client'
import type { Message } from '../../lib/types'
import { cn } from '../../lib/utils'

const STATUSES = ['all', 'delivered', 'failed', 'pending', 'processing', 'dead_letter'] as const

const tone = (s: string): Tone =>
  s === 'delivered'
    ? 'success'
    : s === 'failed'
      ? 'destructive'
      : s === 'processing'
        ? 'warning'
        : 'muted'

export function MessagesListPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [selected, setSelected] = useState<Message | null>(null)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showFilter, setShowFilter] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchConfirmAction, setBatchConfirmAction] = useState<'replay' | 'delete' | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['messages', cursor],
    queryFn: () => api.listMessages({ limit: 25, cursor }),
  })

  const { data: selectedMsg } = useQuery({
    queryKey: ['message', selected?.id],
    queryFn: () => api.getMessage(selected!.id),
    enabled: !!selected?.id,
  })

  const replayMutation = useMutation({
    mutationFn: (id: string) => api.replayMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      toast('success', 'Message re-queued for delivery')
    },
    onError: (err) => {
      toast(
        'error',
        'Failed to replay message',
        err instanceof Error ? err.message : 'Unknown error',
      )
    },
  })

  const batchReplayMutation = useMutation({
    mutationFn: (ids: string[]) => api.batchReplayMessages(ids),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      toast('success', `${result.summary.replayed} message${result.summary.replayed !== 1 ? 's' : ''} replayed`)
      setSelectedIds(new Set())
    },
    onError: (err) => {
      toast('error', 'Batch replay failed', err instanceof Error ? err.message : 'Unknown error')
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.batchDeleteMessages(ids),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      toast('success', `${result.summary.deleted} message${result.summary.deleted !== 1 ? 's' : ''} deleted`)
      setSelectedIds(new Set())
    },
    onError: (err) => {
      toast('error', 'Batch delete failed', err instanceof Error ? err.message : 'Unknown error')
    },
  })

  const freshMessages = data?.data ?? []
  const hasMore = data?.pagination?.hasMore ?? false

  const all = cursor ? [...allMessages, ...freshMessages] : freshMessages
  const statuses: string[] =
    statusFilter === 'all'
      ? ['delivered', 'failed', 'pending', 'processing', 'dead_letter']
      : [statusFilter]

  const filtered = all.filter(
    (m) =>
      statuses.includes(m.status) &&
      (m.eventId.toLowerCase().includes(q.toLowerCase()) ||
        m.eventType.toLowerCase().includes(q.toLowerCase())),
  )

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((m) => m.id)))
    }
  }

  function loadMore() {
    if (hasMore) {
      setAllMessages(all)
      setCursor(data!.pagination.nextCursor!)
    }
  }

  function handleRowClick(m: Message) {
    if (selectedIds.size > 0) return
    setSelected((prev) => (prev?.id === m.id ? null : m))
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col px-4 py-6 md:px-6">
      <PageHeader
        title="Messages"
        description="Every delivery attempt, with full payload, response, and retry history."
        actions={
          <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-sm font-medium hover:bg-accent">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" /> Refresh
          </button>
        }
      />

      <div className="mt-5 grid flex-1 grid-cols-1 gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by event id or type"
                className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setShowFilter(!showFilter)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-sm font-medium hover:bg-accent"
              >
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                {statusFilter === 'all' ? 'Status' : statusFilter.replace(/_/g, ' ')}
              </button>
              {showFilter && (
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-xl">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setStatusFilter(s)
                        setShowFilter(false)
                      }}
                      className={cn(
                        'flex w-full items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                        statusFilter === s
                          ? 'bg-accent text-foreground'
                          : 'text-muted-foreground hover:bg-surface hover:text-foreground',
                      )}
                    >
                      {s === 'all' ? 'All statuses' : s.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
                <span className="text-xs font-medium text-foreground">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={() => setBatchConfirmAction('replay')}
                  disabled={batchReplayMutation.isPending}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-foreground px-2.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Replay
                </button>
                <button
                  onClick={() => setBatchConfirmAction('delete')}
                  disabled={batchDeleteMutation.isPending}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-red-500 px-2.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-auto rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {isLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="w-8 px-2 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-border"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium">Status</th>
                    <th className="px-3 py-2.5 text-left font-medium">Event</th>
                    <th className="px-3 py-2.5 text-right font-medium">Attempts</th>
                    <th className="px-3 py-2.5 text-right font-medium">When</th>
                    <th className="w-10 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-10 text-center text-sm text-muted-foreground"
                      >
                        No messages yet. Send a test event to see deliveries here.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((m) => (
                      <tr
                        key={m.id}
                        onClick={() => handleRowClick(m)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          selected?.id === m.id ? 'bg-accent' : 'hover:bg-surface/60',
                          selectedIds.has(m.id) && 'bg-accent/50',
                        )}
                      >
                        <td className="w-8 px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(m.id)}
                            onChange={() => toggleSelect(m.id)}
                            className="rounded border-border"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge tone={tone(m.status)}>{m.status}</StatusBadge>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-mono text-[13px] text-foreground">{m.eventType}</div>
                          <div className="text-xs text-muted-foreground">{m.endpointId}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-foreground">
                          {m.attemptCount}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {new Date(m.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {(m.status === 'failed' || m.status === 'dead_letter') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                replayMutation.mutate(m.id)
                              }}
                              disabled={replayMutation.isPending}
                              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              title="Replay"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
            {hasMore && !isLoading && (
              <button
                onClick={loadMore}
                className="flex w-full items-center justify-center border-t border-border py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface/60 transition-colors"
              >
                Load more
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <MessagePanel
              msg={
                (selectedMsg as Message & { attempts: import('../../lib/types').Attempt[] }) ??
                selected
              }
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border p-10 text-sm text-muted-foreground">
              Select a message
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={batchConfirmAction === 'replay'}
        onConfirm={() => {
          setBatchConfirmAction(null)
          batchReplayMutation.mutate(Array.from(selectedIds))
        }}
        onCancel={() => setBatchConfirmAction(null)}
        title={`Replay ${selectedIds.size} message${selectedIds.size !== 1 ? 's' : ''}?`}
        description="This will re-queue all selected failed or dead-lettered messages for delivery."
        confirmLabel="Replay"
        loading={batchReplayMutation.isPending}
      />
      <ConfirmDialog
        open={batchConfirmAction === 'delete'}
        onConfirm={() => {
          setBatchConfirmAction(null)
          batchDeleteMutation.mutate(Array.from(selectedIds))
        }}
        onCancel={() => setBatchConfirmAction(null)}
        title={`Delete ${selectedIds.size} message${selectedIds.size !== 1 ? 's' : ''}?`}
        description="Permanently delete all selected messages and their delivery attempts. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={batchDeleteMutation.isPending}
      />
    </div>
  )
}

function MessagePanel({
  msg,
  onClose,
}: {
  msg: Message & { attempts?: import('../../lib/types').Attempt[] }
  onClose: () => void
}) {
  const payloadStr = JSON.stringify(msg.payload ?? {}, null, 2)

  return (
    <div className="sticky top-[72px] flex max-h-[calc(100vh-96px)] flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between border-b border-border p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge tone={tone(msg.status)}>{msg.status}</StatusBadge>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {new Date(msg.createdAt).toLocaleTimeString()}
            </span>
          </div>
          <h3 className="mt-2 truncate font-mono text-sm text-foreground">{msg.eventType}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{msg.id}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border-b border-border text-center text-xs">
        <Stat label="Endpoint" value={msg.endpointId} />
        <Stat label="Event ID" value={msg.eventId} />
        <Stat label="Attempts" value={String(msg.attemptCount)} />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <CodeBlock title="Request payload" code={payloadStr} />
        {msg.lastError && (
          <div>
            <h4 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-destructive">
              Last error
            </h4>
            <pre className="overflow-x-auto rounded-md border border-destructive/30 bg-surface p-3 font-mono text-[12px] leading-relaxed text-destructive">
              {msg.lastError}
            </pre>
          </div>
        )}
        {msg.attempts && msg.attempts.length > 0 && (
          <div>
            <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Attempt history
            </h4>
            <ul className="space-y-1.5">
              {msg.attempts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-xs"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-foreground">#{a.attemptNumber}</span>
                    <span className="text-muted-foreground">
                      {new Date(a.attemptedAt).toLocaleTimeString()}
                    </span>
                  </span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {a.httpStatus ? `${a.httpStatus}` : '—'} ·{' '}
                    {a.durationMs ? `${a.durationMs}ms` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm tabular-nums text-foreground truncate">{value}</div>
    </div>
  )
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          }}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-md border border-border bg-surface p-3 font-mono text-[12px] leading-relaxed text-foreground">
        <code>{highlight(code)}</code>
      </pre>
    </div>
  )
}

function highlight(json: string) {
  const parts = json.split(/(\".*?\":|\".*?\"|\b(?:true|false|null)\b|\b\d+\b)/g)
  return parts.map((p, i) => {
    if (!p) return null
    if (/^".*?":$/.test(p))
      return (
        <span key={i} className="text-foreground">
          {p}
        </span>
      )
    if (/^".*?"$/.test(p))
      return (
        <span key={i} className="text-muted-foreground">
          {p}
        </span>
      )
    if (/^(true|false|null)$/.test(p))
      return (
        <span key={i} className="text-foreground/80 italic">
          {p}
        </span>
      )
    if (/^\d+$/.test(p))
      return (
        <span key={i} className="text-foreground/80">
          {p}
        </span>
      )
    return (
      <span key={i} className="text-muted-foreground/80">
        {p}
      </span>
    )
  })
}
