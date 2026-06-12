import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PlusIcon, Search } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status";
import { connections } from "@/lib/mock-data";

export const Route = createFileRoute("/app/connections")({
  head: () => ({ meta: [{ title: "Connections — Relayd" }] }),
  component: ConnectionsPage,
});

const categories = ["All", "Messaging", "Incident", "Observability", "Productivity", "Storage", "Generic"];

function ConnectionsPage() {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const filtered = connections.filter(
    (c) => (cat === "All" || c.category === cat) && c.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6">
      <PageHeader
        title="Connections"
        description="Integrate webhook flows with messaging, observability, and storage providers."
        actions={
          <button className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90">
            <PlusIcon className="h-3.5 w-3.5" /> Add connection
          </button>
        }
      />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search integrations"
            className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`h-8 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                cat === c
                  ? "border-foreground/20 bg-foreground text-background"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <div
            key={c.id}
            className="group flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface font-mono text-sm font-semibold text-foreground">
                {c.name[0]}
              </div>
              {c.connected ? (
                <StatusBadge tone="success">Connected</StatusBadge>
              ) : (
                <StatusBadge tone="muted">Not connected</StatusBadge>
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">{c.name}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
              <span className="text-muted-foreground">{c.events}</span>
              <button
                className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${
                  c.connected
                    ? "border border-border text-foreground hover:bg-accent"
                    : "bg-foreground text-background hover:opacity-90"
                }`}
              >
                {c.connected ? "Configure" : "Connect"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
