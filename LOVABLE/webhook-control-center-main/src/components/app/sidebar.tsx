import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Webhook,
  MessageSquare,
  Wand2,
  Plug,
  Settings,
  ChevronsLeft,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/endpoints", label: "Endpoints", icon: Webhook },
  { to: "/app/messages", label: "Messages", icon: MessageSquare },
  { to: "/app/transformations", label: "Transformations", icon: Wand2 },
  { to: "/app/connections", label: "Connections", icon: Plug },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
        collapsed ? "w-[64px]" : "w-[240px]",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h6l3-7 3 14 3-7h2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-foreground">Relayd</span>
            <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Beta
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {nav.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
