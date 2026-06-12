import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy, Filter, RefreshCw, Search, X } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, type Tone } from "@/components/app/status";
import { messages, samplePayload, sampleResponse, type Message, type MessageStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/messages")({
  head: () => ({ meta: [{ title: "Messages — Relayd" }] }),
  component: MessagesPage,
});

const tone = (s: MessageStatus): Tone =>
  s === "delivered" ? "success" : s === "failed" ? "destructive" : s === "retrying" ? "warning" : "muted";

function MessagesPage() {
  const [selected, setSelected] = useState<Message | null>(messages[0]);

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
                placeholder="Search by event id or type"
                className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
              />
            </div>
            <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-sm font-medium hover:bg-accent">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" /> Status
            </button>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2.5 text-left font-medium">Status</th>
                  <th className="px-3 py-2.5 text-left font-medium">Event</th>
                  <th className="px-3 py-2.5 text-right font-medium">Code</th>
                  <th className="px-3 py-2.5 text-right font-medium">Duration</th>
                  <th className="px-3 py-2.5 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {messages.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => setSelected(m)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selected?.id === m.id ? "bg-accent" : "hover:bg-surface/60",
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <StatusBadge tone={tone(m.status)}>{m.status}</StatusBadge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-[13px] text-foreground">{m.event}</div>
                      <div className="text-xs text-muted-foreground">{m.endpoint}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-foreground">
                      {m.code === 0 ? "—" : m.code}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {m.duration === 0 ? "—" : `${m.duration}ms`}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{m.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selected ? <MessagePanel msg={selected} onClose={() => setSelected(null)} /> : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border p-10 text-sm text-muted-foreground">
              Select a message
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessagePanel({ msg, onClose }: { msg: Message; onClose: () => void }) {
  return (
    <div className="sticky top-[72px] flex max-h-[calc(100vh-96px)] flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between border-b border-border p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge tone={tone(msg.status)}>{msg.status}</StatusBadge>
            <span className="text-[11px] tabular-nums text-muted-foreground">{msg.timestamp}</span>
          </div>
          <h3 className="mt-2 truncate font-mono text-sm text-foreground">{msg.event}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{msg.id}</p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border-b border-border text-center text-xs">
        <Stat label="Status code" value={msg.code === 0 ? "—" : String(msg.code)} />
        <Stat label="Duration" value={msg.duration === 0 ? "—" : `${msg.duration}ms`} />
        <Stat label="Attempts" value={String(msg.attempts)} />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <CodeBlock title="Request payload" code={JSON.stringify(samplePayload, null, 2)} />
        <CodeBlock title="Response" code={JSON.stringify(sampleResponse, null, 2)} />
        <div>
          <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Attempt history</h4>
          <ul className="space-y-1.5">
            {Array.from({ length: Math.max(msg.attempts, 1) }).map((_, i) => (
              <li key={i} className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-xs">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-foreground">#{i + 1}</span>
                  <span className="text-muted-foreground">{i === msg.attempts - 1 ? msg.timestamp : `${(msg.attempts - i) * 2}m ago`}</span>
                </span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {i === msg.attempts - 1 && msg.status === "delivered" ? "200 · 142ms" : `${msg.code || 503} · ${msg.duration || 0}ms`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</h4>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-md border border-border bg-surface p-3 font-mono text-[12px] leading-relaxed text-foreground">
        <code>{highlight(code)}</code>
      </pre>
    </div>
  );
}

function highlight(json: string) {
  // Very light syntax tinting without a dep
  const parts = json.split(/(\".*?\":|\".*?\"|\b(?:true|false|null)\b|\b\d+\b)/g);
  return parts.map((p, i) => {
    if (!p) return null;
    if (/^".*?":$/.test(p)) return <span key={i} className="text-foreground">{p}</span>;
    if (/^".*?"$/.test(p)) return <span key={i} className="text-muted-foreground">{p}</span>;
    if (/^(true|false|null)$/.test(p)) return <span key={i} className="text-foreground/80 italic">{p}</span>;
    if (/^\d+$/.test(p)) return <span key={i} className="text-foreground/80">{p}</span>;
    return <span key={i} className="text-muted-foreground/80">{p}</span>;
  });
}
