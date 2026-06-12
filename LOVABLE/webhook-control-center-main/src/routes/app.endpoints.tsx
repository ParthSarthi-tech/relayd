import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Filter, MoreHorizontal, PlusIcon, Search } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status";
import { endpoints, type EndpointStatus } from "@/lib/mock-data";

export const Route = createFileRoute("/app/endpoints")({
  head: () => ({ meta: [{ title: "Endpoints — Relayd" }] }),
  component: EndpointsPage,
});

const toneFor = (s: EndpointStatus) =>
  s === "active" ? "success" : s === "failing" ? "destructive" : "muted";

function EndpointsPage() {
  const [q, setQ] = useState("");
  const rows = endpoints.filter(
    (e) => e.url.toLowerCase().includes(q.toLowerCase()) || e.description.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6">
      <PageHeader
        title="Endpoints"
        description="HTTPS destinations that receive webhook deliveries from your workspace."
        actions={
          <button className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90">
            <PlusIcon className="h-3.5 w-3.5" /> New endpoint
          </button>
        }
      />

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
        <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-sm font-medium hover:bg-accent">
          Events
        </button>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-medium">Endpoint</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
              <th className="px-4 py-2.5 text-left font-medium">Events</th>
              <th className="px-4 py-2.5 text-right font-medium">Success</th>
              <th className="px-4 py-2.5 text-right font-medium">Last delivery</th>
              <th className="w-10 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((e) => (
              <tr key={e.id} className="group hover:bg-surface/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] text-foreground">{e.url}</span>
                    <button className="opacity-0 transition-opacity group-hover:opacity-100" aria-label="Copy">
                      <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{e.description} · {e.id}</div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone={toneFor(e.status)}>
                    {e.status === "active" ? "Active" : e.status === "failing" ? "Failing" : "Paused"}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {e.events.slice(0, 2).map((ev) => (
                      <span key={ev} className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {ev}
                      </span>
                    ))}
                    {e.events.length > 2 && (
                      <span className="text-[11px] text-muted-foreground">+{e.events.length - 2}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">{e.successRate.toFixed(2)}%</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{e.lastDelivery}</td>
                <td className="px-4 py-3 text-right">
                  <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>{rows.length} of {endpoints.length} endpoints</span>
          <div className="flex items-center gap-1">
            <button className="rounded border border-border bg-surface px-2 py-1 hover:bg-accent">Previous</button>
            <button className="rounded border border-border bg-surface px-2 py-1 hover:bg-accent">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
