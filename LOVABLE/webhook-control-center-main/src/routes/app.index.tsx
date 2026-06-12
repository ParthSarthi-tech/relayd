import { createFileRoute, Link } from "@tanstack/react-router";
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
} from "recharts";
import {
  ArrowUpRight,
  CheckCircle2,
  Plug,
  PlusIcon,
  RotateCw,
  Webhook,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { StatusDot } from "@/components/app/status";
import { activity, deliveriesSeries, throughputSeries } from "@/lib/mock-data";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [{ title: "Dashboard — Relayd" }],
  }),
  component: Overview,
});

const spark = [12, 14, 11, 16, 18, 22, 19, 24, 27, 25, 29, 33];

function Overview() {
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
            <button className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90">
              <PlusIcon className="h-3.5 w-3.5" /> New endpoint
            </button>
          </>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <MetricCard label="Endpoints" value="24" delta={{ value: "+2", positive: true }} hint="2 added this week" spark={spark} />
        <MetricCard label="Events processed" value="1.24M" delta={{ value: "+8.4%", positive: true }} hint="24h" spark={spark} />
        <MetricCard label="Success rate" value="99.84%" delta={{ value: "+0.12%", positive: true }} hint="rolling 24h" spark={[98,99,99,99.4,99.5,99.6,99.7,99.8,99.82,99.83,99.84,99.84]} />
        <MetricCard label="Failed" value="312" delta={{ value: "-14%", positive: true }} hint="24h" />
        <MetricCard label="Retry queue" value="48" hint="next attempt in 12s" />
        <MetricCard label="Active connections" value="6" hint="3 messaging · 3 other" />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Deliveries"
          subtitle="Successful vs failed over 24h"
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={deliveriesSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="t" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
              <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" width={48} />
              <Tooltip
                cursor={{ stroke: "var(--color-border-strong)", strokeWidth: 1 }}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: "0 4px 12px -4px rgba(0,0,0,0.08)",
                }}
              />
              <Area type="monotone" dataKey="success" stroke="currentColor" strokeWidth={1.5} fill="url(#g1)" className="text-foreground" />
              <Area type="monotone" dataKey="failed" stroke="var(--color-destructive)" strokeWidth={1.25} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Throughput" subtitle="Requests per second">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={throughputSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="t" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
              <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" width={48} />
              <Tooltip
                cursor={{ fill: "var(--color-accent)" }}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="rps" fill="currentColor" className="text-foreground" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
              <p className="text-xs text-muted-foreground">Latest events across the workspace</p>
            </div>
            <Link to="/app/messages" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <ActivityIcon kind={a.kind} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{a.text}</p>
                  <p className="text-xs text-muted-foreground">{a.who}</p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{a.time}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">System status</h3>
          <p className="text-xs text-muted-foreground">All systems operational</p>
          <ul className="mt-4 space-y-3">
            {[
              { name: "Ingestion API", status: "Operational", tone: "success" as const },
              { name: "Delivery workers", status: "Operational", tone: "success" as const },
              { name: "Retry queue", status: "Elevated latency", tone: "warning" as const },
              { name: "Dashboard", status: "Operational", tone: "success" as const },
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
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">P50 / P95 latency</p>
            <div className="mt-2 flex items-baseline gap-2 text-foreground">
              <span className="text-xl font-semibold tabular-nums">84ms</span>
              <span className="text-xs text-muted-foreground">/ 412ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border bg-card ${className ?? ""}`}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="p-2 pr-3">{children}</div>
    </div>
  );
}

function ActivityIcon({ kind }: { kind: string }) {
  const map: Record<string, { Icon: React.ComponentType<{ className?: string }>; tone: string }> = {
    "endpoint.created": { Icon: Webhook, tone: "text-foreground" },
    "endpoint.disabled": { Icon: Webhook, tone: "text-muted-foreground" },
    "message.delivered": { Icon: CheckCircle2, tone: "text-success" },
    "retry.triggered": { Icon: RotateCw, tone: "text-foreground" },
    "connection.added": { Icon: Plug, tone: "text-foreground" },
  };
  const entry = map[kind] ?? { Icon: Zap, tone: "text-foreground" };
  const Icon = entry.Icon;
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface">
      <Icon className={`h-3.5 w-3.5 ${entry.tone}`} />
    </div>
  );
}
