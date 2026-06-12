import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status";
import { samplePayload, transformationCode, transformations } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/transformations")({
  head: () => ({ meta: [{ title: "Transformations — Relayd" }] }),
  component: TransformationsPage,
});

function TransformationsPage() {
  const [selectedId, setSelectedId] = useState(transformations[0].id);
  const selected = transformations.find((t) => t.id === selectedId)!;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6">
      <PageHeader
        title="Transformations"
        description="Reshape, redact, or enrich payloads before they reach your endpoints."
        actions={
          <button className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90">
            <PlusIcon className="h-3.5 w-3.5" /> New transformation
          </button>
        }
      />

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[240px_1fr_360px]">
        {/* List */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Library
          </div>
          <ul className="p-1">
            {transformations.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors",
                    selectedId === t.id ? "bg-accent" : "hover:bg-surface/80",
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{t.name}</span>
                    {t.status === "warning" && <span className="h-1.5 w-1.5 rounded-full bg-warning" />}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{t.language} · {t.lastEdited}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Editor */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{selected.name}</h3>
              <StatusBadge tone={selected.status === "valid" ? "success" : "warning"}>
                {selected.status === "valid" ? "Valid" : "Warning"}
              </StatusBadge>
            </div>
            <div className="flex items-center gap-1">
              <button className="h-7 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">Discard</button>
              <button className="inline-flex h-7 items-center gap-1 rounded-md bg-foreground px-2.5 text-xs font-medium text-background hover:opacity-90">
                <Check className="h-3 w-3" /> Save
              </button>
            </div>
          </div>
          <pre className="flex-1 overflow-auto bg-surface p-4 font-mono text-[12.5px] leading-relaxed text-foreground">
            <code>{transformationCode}</code>
          </pre>
        </div>

        {/* Preview */}
        <div className="flex flex-col gap-3">
          <PreviewBlock title="Input" code={JSON.stringify(samplePayload, null, 2)} />
          <PreviewBlock
            title="Output"
            code={JSON.stringify(
              {
                event_id: samplePayload.id,
                type: samplePayload.type,
                customer_id: samplePayload.data.object.customer,
                amount_cents: samplePayload.data.object.amount_paid,
                currency: samplePayload.data.object.currency,
                status: samplePayload.data.object.status,
                line_items: samplePayload.data.object.lines.map((l) => ({
                  label: l.description,
                  qty: l.quantity,
                  amount: l.amount,
                })),
                received_at: new Date(samplePayload.created * 1000).toISOString(),
              },
              null,
              2,
            )}
          />
        </div>
      </div>
    </div>
  );
}

function PreviewBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <pre className="max-h-[280px] overflow-auto bg-surface p-3 font-mono text-[12px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}
