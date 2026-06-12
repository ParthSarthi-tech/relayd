import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '../../lib/utils'

export function MetricCard({
  label,
  value,
  delta,
  hint,
  spark,
}: {
  label: string
  value: string
  delta?: { value: string; positive?: boolean }
  hint?: string
  spark?: number[]
}) {
  return (
    <div className="group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {delta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums',
              delta.positive ? 'text-success' : 'text-muted-foreground',
            )}
          >
            {delta.positive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {delta.value}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {value}
          </div>
          {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        </div>
        {spark && <Sparkline data={spark} />}
      </div>
    </div>
  )
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * 72
      const y = 24 - ((d - min) / range) * 22
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg viewBox="0 0 72 24" className="h-6 w-[72px]" fill="none">
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="1.25"
        className="text-foreground/70"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
