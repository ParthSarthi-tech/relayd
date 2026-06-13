import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock, Copy, Inbox, ListTree, RotateCcw, Terminal, Timer, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/app/confirm-dialog'
import { StatusBadge, StatusDot, attemptStatusTone } from '../../components/app/status'
import { DetailSkeleton } from '../../components/skeleton'
import { useToast } from '../../components/toast'
import { api } from '../../lib/api-client'
import type { Attempt, Message } from '../../lib/types'

interface MessageDetail extends Message {
  attempts: Attempt[]
}

export function MessageDetailPage() {
  const { id } = useParams({ from: '/messages/$id' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data: message, isLoading } = useQuery({
    queryKey: ['message', id],
    queryFn: () => api.getMessage(id),
    refetchInterval: 5_000,
  })

  const replayMutation = useMutation({
    mutationFn: () => api.replayMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message', id] })
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

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      toast('success', 'Message deleted')
      navigate({ to: '/messages' })
    },
    onError: (err) => {
      toast(
        'error',
        'Failed to delete message',
        err instanceof Error ? err.message : 'Unknown error',
      )
    },
  })

  if (isLoading) {
    return <DetailSkeleton />
  }

  if (!message) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
        Message not found
      </div>
    )
  }

  const canReplay = message.status === 'failed' || message.status === 'dead_letter'
  const attempts = 'attempts' in message ? (message as MessageDetail).attempts : undefined

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/messages"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-foreground/10 to-foreground/5 ring-1 ring-foreground/10">
              <Inbox className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{message.eventType}</h1>
              <p className="text-sm text-muted-foreground font-mono">{message.id}</p>
            </div>
          </div>
        </div>
        {canReplay && (
          <button
            onClick={() => replayMutation.mutate()}
            disabled={replayMutation.isPending}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            {replayMutation.isPending ? 'Replaying...' : 'Replay'}
          </button>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-6 lg:grid-cols-2"
      >
        <div className="relative rounded-xl border border-border bg-card overflow-hidden p-5 card-hover">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/10">
              <Inbox className="h-3.5 w-3.5 text-foreground" />
            </div>
            <h3 className="text-sm font-medium text-card-foreground">Details</h3>
          </div>
          <div className="space-y-0">
            <Row label="Event ID" value={message.eventId} mono />
            <Row label="Event Type" value={message.eventType} />
            <Row
              label="Status"
              value={
                <motion.span
                  key={message.status}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  <StatusBadge status={message.status}>
                    {message.status.replace(/_/g, ' ')}
                  </StatusBadge>
                </motion.span>
              }
            />
            <Row label="Endpoint" value={message.endpointId} mono />
            <Row label="Attempts" value={String(message.attemptCount)} />
            {message.lastError && <Row label="Last Error" value={message.lastError} />}
          </div>
        </div>

        <div className="relative rounded-xl border border-border bg-card overflow-hidden p-5 card-hover">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/10">
              <Timer className="h-3.5 w-3.5 text-foreground" />
            </div>
            <h3 className="text-sm font-medium text-card-foreground">Timeline</h3>
          </div>
          <div className="space-y-0">
            <Row label="Created" value={new Date(message.createdAt).toLocaleString()} />
            <Row label="Updated" value={new Date(message.updatedAt).toLocaleString()} />
            {message.deliveredAt && (
              <Row label="Delivered" value={new Date(message.deliveredAt).toLocaleString()} />
            )}
            {message.nextRetryAt && (
              <Row label="Next Retry" value={new Date(message.nextRetryAt).toLocaleString()} />
            )}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="relative rounded-xl border border-border bg-card overflow-hidden card-hover"
      >
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
        <div className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/10">
            <Terminal className="h-3.5 w-3.5 text-foreground" />
          </div>
          <h3 className="text-sm font-medium text-card-foreground">Payload</h3>
        </div>
        <div className="relative rounded-lg overflow-hidden border border-border">
          <div className="flex items-center justify-between bg-muted/80 px-3 py-1.5 border-b border-border">
            <div className="flex gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(JSON.stringify(message.payload ?? {}, null, 2)); toast('success', 'Payload copied') }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <pre className="bg-muted/30 p-4 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {JSON.stringify(message.payload ?? {}, null, 2)}
          </pre>
        </div>
        </div>
      </motion.div>

      {attempts && attempts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative rounded-xl border border-border bg-card overflow-hidden p-5 card-hover"
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground/10">
              <ListTree className="h-3.5 w-3.5 text-foreground" />
            </div>
            <h3 className="text-sm font-medium text-card-foreground">Delivery Attempts</h3>
          </div>
          <div className="relative pl-6">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            {[...attempts].reverse().map((attempt, idx) => {
              const tone = attemptStatusTone(attempt.status)
              const dotColor =
                tone === 'success'
                  ? 'bg-emerald-500'
                  : tone === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              const isLast = idx === attempts.length - 1
              return (
                <motion.div
                  key={attempt.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="relative pb-6 last:pb-0"
                >
                  <div
                    className={`absolute left-[-15px] top-[5px] h-3 w-3 rounded-full border-2 border-card ${dotColor} z-10`}
                  />
                  {!isLast && (
                    <div className="absolute left-[-11px] top-[16px] bottom-0 w-px bg-border" />
                  )}
                  <div className="rounded-lg border border-border bg-secondary/30 p-4 ml-2">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          Attempt #{attempt.attemptNumber}
                        </span>
                        <StatusBadge status={attempt.status}>
                          {attempt.status.replace(/_/g, ' ')}
                        </StatusBadge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {attempt.durationMs ? `${attempt.durationMs}ms` : '—'}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div>
                        <span className="text-muted-foreground">HTTP Status: </span>
                        <span className="font-medium text-foreground">{attempt.httpStatus ?? '—'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">URL: </span>
                        <span className="font-mono text-foreground break-all">
                          {attempt.requestUrl}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Time: </span>
                        <span className="text-foreground">
                          {new Date(attempt.attemptedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {attempt.httpStatus && attempt.httpStatus >= 400 && (
                      <pre className="mt-2 rounded bg-background p-2 font-mono text-foreground text-xs overflow-x-auto max-h-24">
                        {attempt.responseBody || attempt.errorMessage || '—'}
                      </pre>
                    )}
                    {attempt.errorMessage && !(attempt.httpStatus && attempt.httpStatus >= 400) && (
                      <p className="mt-1.5 text-xs text-red-400">{attempt.errorMessage}</p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}

      <div className="relative rounded-xl border border-red-500/20 bg-card overflow-hidden p-5">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500/30 via-red-500/50 to-red-500/30" />
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10">
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
          </div>
          <h3 className="text-sm font-medium text-red-400">Danger Zone</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Permanently delete this message and all its delivery attempts.
        </p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleteMutation.isPending}
          className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all duration-200 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {deleteMutation.isPending ? 'Deleting...' : 'Delete Message'}
        </button>
      </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={() => {
          setShowDeleteConfirm(false)
          deleteMutation.mutate()
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete message?"
        description="Permanently delete this message and all its delivery attempts. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
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
