import { Bell, ChevronDown, Search } from "lucide-react";

export function AppTopbar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      <button className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-sm font-medium text-foreground hover:bg-accent">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-foreground text-[10px] font-semibold text-background">A</div>
        <span>Acme, Inc.</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">Production</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <div className="relative ml-2 hidden flex-1 max-w-md lg:block">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search endpoints, messages, events..."
          className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-12 text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <a
          href="https://docs.example.com"
          className="hidden h-8 items-center rounded-md px-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground md:flex"
        >
          Docs
        </a>
        <button className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
        </button>
        <button className="ml-1 flex h-8 items-center gap-2 rounded-md pl-1 pr-2 hover:bg-accent">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
            LM
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
