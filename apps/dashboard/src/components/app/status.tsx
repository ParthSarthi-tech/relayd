import { cn } from '../../lib/utils'

export type Tone = 'neutral' | 'success' | 'warning' | 'destructive' | 'muted'

const statusToneMap: Record<string, Tone> = {
  active: 'success',
  delivered: 'success',
  success: 'success',
  paused: 'warning',
  disabled: 'destructive',
  failed: 'destructive',
  dead_letter: 'destructive',
  timeout: 'warning',
  connection_error: 'destructive',
  processing: 'neutral',
  pending: 'neutral',
  retired: 'muted',
}

export function statusTone(status: string): Tone {
  return statusToneMap[status] ?? 'neutral'
}

export function attemptStatusTone(status: string): Tone {
  const map: Record<string, Tone> = {
    success: 'success',
    failed: 'destructive',
    timeout: 'warning',
    connection_error: 'destructive',
  }
  return map[status] ?? 'neutral'
}

export function StatusDot({ tone = 'neutral', className }: { tone?: Tone; className?: string }) {
  const map: Record<Tone, string> = {
    neutral: 'bg-foreground',
    success: 'bg-success',
    warning: 'bg-warning',
    destructive: 'bg-destructive',
    muted: 'bg-muted-foreground/50',
  }
  return <span className={cn('inline-block h-1.5 w-1.5 rounded-full', map[tone], className)} />
}

export function StatusBadge({
  tone,
  status,
  children,
}: {
  tone?: Tone
  status?: string
  children: React.ReactNode
}) {
  const resolvedTone: Tone = tone ?? statusTone(status ?? '')
  const map: Record<Tone, string> = {
    neutral: 'border-border bg-surface text-foreground',
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/40 bg-warning/15 text-foreground',
    destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
    muted: 'border-border bg-muted text-muted-foreground',
  }
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded-md border px-1.5 text-[11px] font-medium',
        map[resolvedTone],
      )}
    >
      <StatusDot tone={resolvedTone} />
      {children}
    </span>
  )
}
