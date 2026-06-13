import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Gauge,
  Inbox,
  Loader2,
  Plug,
  PlusIcon,
  RotateCw,
  Sparkles,
  Webhook,
} from 'lucide-react'
import { useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { MetricCard } from '../components/app/metric-card'
import { PageHeader } from '../components/app/page-header'
import { StatusBadge, StatusDot } from '../components/app/status'
import { DashboardSkeleton } from '../components/skeleton'
import { useToast } from '../components/toast'
import { api, getApiBaseUrl } from '../lib/api-client'

const spark = [12, 14, 11, 16, 18, 22, 19, 24, 27, 25, 29, 33]

export function DashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [testEndpointId, setTestEndpointId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', 24],
    queryFn: () => api.getStats(24),
    refetchInterval: 30_000,
  })

  const { data: endpointsData } = useQuery({
    queryKey: ['endpoints'],
    queryFn: () => api.listEndpoints(1),
  })

  const endpointCount = endpointsData?.data?.length ?? 0
  const showQuickStart = true

  const createTestEndpoint = useMutation({
    mutationFn: () =>
      api.createEndpoint({
        url: `${getApiBaseUrl()}/v1/echo`,
        description: 'Quick Start — test endpoint',
        eventTypes: ['test.ping'],
      }),
    onSuccess: (result) => {
      setTestEndpointId(result.id)
      queryClient.invalidateQueries({ queryKey: ['endpoints'] })
      toast('success', 'Test endpoint created', 'Ready to send a test event')
    },
    onError: (err) => {
      toast(
        'error',
        'Failed to create endpoint',
        err instanceof Error ? err.message : 'Unknown error',
      )
    },
  })

  const sendTestEvent = useMutation({
    mutationFn: (endpointId: string) =>
      api.sendEvent(endpointId, 'test.ping', {
        id: `test_${Date.now()}`,
        type: 'test.ping',
        timestamp: new Date().toISOString(),
        data: {
          message: 'Hello from Relay!',
          source: 'quick-start',
        },
      }),
    onSuccess: () => {
      setTestResult('delivered')
      setTestError(null)
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      toast('success', 'Test event sent!', 'Check the Messages page to see delivery details')
    },
    onError: (err) => {
      setTestError(err instanceof Error ? err.message : 'Failed to send test event')
      toast('error', 'Test event failed', err instanceof Error ? err.message : 'Unknown error')
    },
  })

  if (isLoading || !stats) {
    return <DashboardSkeleton />
  }

  const timelineData = stats.timeline.map((t) => ({
    ...t,
    t: t.hour.slice(11, 16),
  }))

  const throughputData = stats.timeline.map((t) => ({
    t: t.hour.slice(11, 16),
    rps: Math.round((t.delivered + t.failed) / 60),
  }))

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6">
      <PageHeader
        title="Overview"
        description="Operational view of webhook delivery across all endpoints in this workspace."
        actions={
          <>
            <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-sm font-medium hover:bg-accent">
              Last 24 hours
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate({ to: '/endpoints' })}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90"
            >
              <PlusIcon className="h-3.5 w-3.5" /> New endpoint
            </button>
          </>
        }
      />

      {showQuickStart && (
        <div className="relative mt-5 rounded-xl border border-border bg-card overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
          <div className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-foreground/10 to-foreground/5 ring-1 ring-foreground/10">
                <Sparkles className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Quick Start</h3>
                <p className="text-xs text-muted-foreground">
                  Test the platform in under 30 seconds
                </p>
              </div>
            </div>
            {testEndpointId && !testResult && (
              <span className="rounded border border-success/30 bg-success/10 px-2 py-1 text-[11px] font-medium text-success">
                Step 1 done
              </span>
            )}
            {testResult && <StatusBadge tone="success">All done</StatusBadge>}
          </div>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            {/* Step 1 */}
            <div className={`flex items-center gap-3 flex-1 ${testEndpointId ? 'opacity-60' : ''}`}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium text-muted-foreground">
                {testEndpointId ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : 1}
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">Create test endpoint</p>
                <p className="text-[11px] text-muted-foreground">Auto-routes to our echo service</p>
              </div>
              <button
                onClick={() => createTestEndpoint.mutate()}
                disabled={!!testEndpointId || createTestEndpoint.isPending}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-foreground px-2.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {createTestEndpoint.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : testEndpointId ? (
                  'Created'
                ) : (
                  'Create'
                )}
              </button>
            </div>

            {/* Arrow */}
            <div className="hidden sm:block text-muted-foreground/30">→</div>

            {/* Step 2 */}
            <div className={`flex items-center gap-3 flex-1 ${testResult ? 'opacity-60' : ''}`}>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium text-muted-foreground">
                {testResult ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : 2}
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">Send test event</p>
                <p className="text-[11px] text-muted-foreground">
                  {testResult ? 'Event delivered successfully!' : 'Triggers a delivery attempt'}
                </p>
              </div>
              <button
                onClick={() => testEndpointId && sendTestEvent.mutate(testEndpointId)}
                disabled={!testEndpointId || sendTestEvent.isPending || !!testResult}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-foreground px-2.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {sendTestEvent.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : testResult ? (
                  'Sent ✓'
                ) : (
                  'Send'
                )}
              </button>
            </div>
          </div>

          {testError && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {testError}
            </div>
          )}

          {testResult && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => navigate({ to: '/messages' })}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                View in Messages →
              </button>
            </div>
          )}
        </div>
        </div>
      )}

      {stats && stats.deadLetterCount > 0 && (
        <div className="relative mt-6 rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500/30 via-red-500/50 to-red-500/30" />
          <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {stats.deadLetterCount} message{stats.deadLetterCount !== 1 ? 's' : ''} in dead-letter
              </p>
              <p className="text-xs text-muted-foreground">
                These messages exhausted all delivery retries. Review and replay them.
              </p>
            </div>
            <a
              href="/app/messages"
              className="inline-flex h-7 shrink-0 items-center rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              View messages
            </a>
          </div>
        </div>
        </div>
      )}

      {endpointCount > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <MetricCard
            label="Endpoints"
            value={String(stats.activeEndpoints)}
            delta={{ value: '+0', positive: true }}
            hint="active"
            spark={spark}
          />
          <MetricCard
            label="Events processed"
            value={String(stats.totalMessages)}
            delta={{ value: '+0%', positive: true }}
            hint="24h"
            spark={spark}
          />
          <MetricCard
            label="Success rate"
            value={`${stats.successRate}%`}
            delta={{ value: '+0%', positive: true }}
            hint="rolling 24h"
            spark={[98, 99, 99, 99.4, 99.5, 99.6, 99.7, 99.8, 99.82, 99.83, 99.84, 99.84]}
          />
          <MetricCard
            label="Failed"
            value={String(stats.failedCount)}
            delta={{ value: '-0%', positive: true }}
            hint="24h"
          />
          <MetricCard label="Retry queue" value={String(stats.pendingCount)} hint="pending" />
          <MetricCard
            label="P95 Latency"
            value={`${stats.latencyMs.p95}ms`}
            hint={`p50 ${stats.latencyMs.p50}ms`}
          />
        </div>
      )}

      {endpointCount > 0 && (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <ChartCard
              className="lg:col-span-2"
              title="Deliveries"
              subtitle="Successful vs failed over 24h"
              icon={BarChart3}
            >
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={timelineData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="2 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="t"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="hsl(var(--muted-foreground))"
                    width={48}
                  />
                  <Tooltip
                    cursor={{ stroke: 'hsl(var(--border-strong))', strokeWidth: 1 }}
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                      boxShadow: '0 4px 12px -4px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="delivered"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    fill="url(#g1)"
                    className="text-foreground"
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={1.25}
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Throughput" subtitle="Requests per second" icon={Activity}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={throughputData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="2 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="t"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="hsl(var(--muted-foreground))"
                    width={48}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--accent))' }}
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="rps"
                    fill="currentColor"
                    className="text-foreground"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="relative rounded-xl border border-border bg-card overflow-hidden lg:col-span-2">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10">
                    <Inbox className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
                    <p className="text-xs text-muted-foreground">
                      Latest events across the workspace
                    </p>
                  </div>
                </div>
              </div>
              <ul className="divide-y divide-border">
                {[
                  {
                    id: 1,
                    kind: 'message.delivered',
                    text: 'Events processed — see Messages',
                    who: 'system',
                    time: '24h',
                  },
                ].map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <ActivityIcon kind={a.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{a.text}</p>
                      <p className="text-xs text-muted-foreground">{a.who}</p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {a.time}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative rounded-xl border border-border bg-card overflow-hidden p-4">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10">
                  <Gauge className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">System status</h3>
                  <p className="text-xs text-muted-foreground">All systems operational</p>
                </div>
              </div>
              <ul className="mt-4 space-y-3">
                {[
                  { name: 'Ingestion API', status: 'Operational', tone: 'success' as const },
                  { name: 'Delivery workers', status: 'Operational', tone: 'success' as const },
                  {
                    name: 'Retry queue',
                    status: stats.pendingCount > 50 ? 'Elevated latency' : 'Operational',
                    tone: stats.pendingCount > 50 ? ('warning' as const) : ('success' as const),
                  },
                  { name: 'Dashboard', status: 'Operational', tone: 'success' as const },
                ].map((s) => (
                  <li key={s.name} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{s.name}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <StatusDot tone={s.tone} />
                      {s.status}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  P50 / P95 latency
                </p>
                <div className="mt-2 flex items-baseline gap-2 text-foreground">
                  <span className="text-xl font-semibold tabular-nums">
                    {stats.latencyMs.p50}ms
                  </span>
                  <span className="text-xs text-muted-foreground">/ {stats.latencyMs.p95}ms</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
}: {
  title: string
  subtitle?: string
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`relative rounded-xl border border-border bg-card overflow-hidden ${className ?? ''}`}>
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-foreground/20 via-foreground/40 to-foreground/20" />
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/10">
              <Icon className="h-4 w-4 text-foreground" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="p-2 pr-3">{children}</div>
    </div>
  )
}

function ActivityIcon({ kind }: { kind: string }) {
  const map: Record<string, { Icon: React.ComponentType<{ className?: string }>; tone: string }> = {
    'endpoint.created': { Icon: Webhook, tone: 'text-foreground' },
    'endpoint.disabled': { Icon: Webhook, tone: 'text-muted-foreground' },
    'message.delivered': { Icon: Webhook, tone: 'text-success' },
    'retry.triggered': { Icon: RotateCw, tone: 'text-foreground' },
    'connection.added': { Icon: Plug, tone: 'text-foreground' },
  }
  const entry = map[kind] ?? { Icon: RotateCw, tone: 'text-foreground' }
  const Icon = entry.Icon
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-foreground/10 to-foreground/5 ring-1 ring-foreground/10">
      <Icon className={`h-3.5 w-3.5 ${entry.tone}`} />
    </div>
  )
}
