import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Eye, EyeOff, PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Relayd" }] }),
  component: SettingsPage,
});

const tabs = ["Workspace", "Security", "API Keys", "Team", "Billing", "Notifications"] as const;
type Tab = (typeof tabs)[number];

function SettingsPage() {
  const [tab, setTab] = useState<Tab>("Workspace");
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <PageHeader title="Settings" description="Manage workspace, access, billing, and notification preferences." />

      <div className="mt-5 flex gap-8">
        <nav className="hidden w-48 shrink-0 flex-col gap-0.5 md:flex">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "h-8 rounded-md px-2.5 text-left text-sm font-medium transition-colors",
                tab === t ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-4">
          {tab === "Workspace" && <WorkspaceSection />}
          {tab === "Security" && <SecuritySection />}
          {tab === "API Keys" && <ApiKeysSection />}
          {tab === "Team" && <TeamSection />}
          {tab === "Billing" && <BillingSection />}
          {tab === "Notifications" && <NotificationsSection />}
        </div>
      </div>
    </div>
  );
}

function Card({ title, description, children, footer }: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border p-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="p-4">{children}</div>
      {footer && <div className="flex items-center justify-end gap-2 border-t border-border bg-surface px-4 py-2.5">{footer}</div>}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid grid-cols-1 gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[180px_1fr]">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-8 w-full rounded-md border border-border bg-surface px-2.5 text-sm focus:border-border-strong focus:outline-none",
        props.className,
      )}
    />
  );
}

function PrimaryBtn({ children }: { children: React.ReactNode }) {
  return (
    <button className="inline-flex h-8 items-center rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90">
      {children}
    </button>
  );
}

function WorkspaceSection() {
  return (
    <Card title="Workspace" description="General details visible to your team." footer={<PrimaryBtn>Save changes</PrimaryBtn>}>
      <div className="divide-y divide-border">
        <Field label="Name"><Input defaultValue="Acme, Inc." /></Field>
        <Field label="Slug" hint="Used in URLs"><Input defaultValue="acme" /></Field>
        <Field label="Region" hint="Where events are processed">
          <select className="h-8 w-full rounded-md border border-border bg-surface px-2 text-sm">
            <option>us-east-1</option><option>eu-west-1</option><option>ap-southeast-1</option>
          </select>
        </Field>
      </div>
    </Card>
  );
}

function SecuritySection() {
  return (
    <>
      <Card title="Authentication" description="Enforce secure access for everyone in this workspace.">
        <div className="divide-y divide-border">
          <ToggleRow title="Require SSO" description="All members must sign in via your identity provider." defaultOn />
          <ToggleRow title="Enforce MFA" description="Multi-factor authentication required for all members." defaultOn />
          <ToggleRow title="Session timeout" description="Auto sign-out after 12 hours of inactivity." />
        </div>
      </Card>
      <Card title="Signing secrets" description="Rotate the secrets used to verify webhook signatures.">
        <SecretRow label="Production" value="whsec_8aN2qLpXm7Yb4FvR9TcQ" />
        <SecretRow label="Staging" value="whsec_3KdM2oXqL8aN6PbR4VcZ" />
      </Card>
    </>
  );
}

function ApiKeysSection() {
  return (
    <Card
      title="API keys"
      description="Use these tokens to authenticate with the Relayd API."
      footer={
        <button className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> Create key
        </button>
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="py-2 text-left font-medium">Name</th>
            <th className="py-2 text-left font-medium">Token</th>
            <th className="py-2 text-left font-medium">Created</th>
            <th className="py-2 text-right font-medium">Last used</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {[
            { n: "Production server", t: "rk_live_••••••••QrT9", c: "Feb 14, 2025", u: "12s ago" },
            { n: "CI / GitHub Actions", t: "rk_live_••••••••8aN2", c: "Jan 03, 2025", u: "2h ago" },
            { n: "Local dev — Lena", t: "rk_test_••••••••3KdM", c: "Dec 21, 2024", u: "yesterday" },
          ].map((k) => (
            <tr key={k.t}>
              <td className="py-2.5 text-foreground">{k.n}</td>
              <td className="py-2.5 font-mono text-[13px] text-muted-foreground">{k.t}</td>
              <td className="py-2.5 text-muted-foreground">{k.c}</td>
              <td className="py-2.5 text-right text-muted-foreground">{k.u}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function TeamSection() {
  return (
    <Card title="Members" description="People with access to this workspace." footer={<PrimaryBtn>Invite member</PrimaryBtn>}>
      <ul className="divide-y divide-border">
        {[
          { n: "Lena Mendez", e: "lena@acme.io", r: "Owner" },
          { n: "Marcus Hale", e: "marcus@acme.io", r: "Admin" },
          { n: "Priya Shah", e: "priya@acme.io", r: "Member" },
          { n: "Jonas Weber", e: "jonas@acme.io", r: "Member" },
        ].map((m) => (
          <li key={m.e} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                {m.n.split(" ").map((s) => s[0]).join("")}
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">{m.n}</div>
                <div className="text-xs text-muted-foreground">{m.e}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge tone="muted">{m.r}</StatusBadge>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function BillingSection() {
  return (
    <>
      <Card title="Plan" description="You are on the Scale plan, billed monthly.">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-semibold tabular-nums text-foreground">$499<span className="text-base font-normal text-muted-foreground">/mo</span></div>
            <div className="mt-1 text-xs text-muted-foreground">Renews on July 1, 2026</div>
          </div>
          <button className="h-8 rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-accent">Change plan</button>
        </div>
      </Card>
      <Card title="Usage" description="Current billing period">
        <UsageRow label="Events" used={1240000} limit={5000000} fmt={(n) => n.toLocaleString()} />
        <UsageRow label="Endpoints" used={24} limit={100} fmt={(n) => n.toString()} />
        <UsageRow label="Retention" used={30} limit={90} fmt={(n) => `${n} days`} />
      </Card>
    </>
  );
}

function NotificationsSection() {
  return (
    <Card title="Email notifications" description="Choose which events should email you.">
      <div className="divide-y divide-border">
        <ToggleRow title="Delivery failures" description="When a webhook fails after final retry." defaultOn />
        <ToggleRow title="Endpoint disabled" description="When an endpoint is automatically disabled." defaultOn />
        <ToggleRow title="Weekly digest" description="Summary of webhook activity every Monday." />
        <ToggleRow title="Product updates" description="Occasional news about new features." />
      </div>
    </Card>
  );
}

function ToggleRow({ title, description, defaultOn }: { title: string; description: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <button
        onClick={() => setOn(!on)}
        className={cn(
          "relative h-5 w-9 rounded-full border transition-colors",
          on ? "border-foreground bg-foreground" : "border-border bg-surface",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
            on ? "translate-x-4 bg-background" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

function SecretRow({ label, value }: { label: string; value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <code className="rounded border border-border bg-surface px-2 py-1 font-mono text-[12px] text-muted-foreground">
          {shown ? value : "whsec_••••••••••••••••"}
        </code>
        <button onClick={() => setShown((s) => !s)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button className="ml-1 h-7 rounded-md border border-border bg-surface px-2 text-xs font-medium hover:bg-accent">Rotate</button>
      </div>
    </div>
  );
}

function UsageRow({ label, used, limit, fmt }: { label: string; used: number; limit: number; fmt: (n: number) => string }) {
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{fmt(used)} / {fmt(limit)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
