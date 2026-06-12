import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Relayd — Webhook infrastructure for production" },
      { name: "description", content: "Deliver, observe, and transform every webhook with confidence." },
      { property: "og:title", content: "Relayd — Webhook infrastructure" },
      { property: "og:description", content: "Deliver, observe, and transform every webhook with confidence." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h6l3-7 3 14 3-7h2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight">Relayd</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a className="hover:text-foreground" href="#">Product</a>
            <a className="hover:text-foreground" href="#">Docs</a>
            <a className="hover:text-foreground" href="#">Pricing</a>
            <a className="hover:text-foreground" href="#">Changelog</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/app" className="hidden h-8 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex">
              Sign in
            </Link>
            <Link to="/app" className="inline-flex h-8 items-center gap-1 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90">
              Open dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> v2.4 · Transformations beta
          </span>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight leading-[1.05] md:text-6xl">
            Webhook infrastructure
            <br />
            <span className="text-muted-foreground">built for production.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground">
            Deliver, observe, and transform every webhook with confidence. Built for engineering
            teams that treat webhooks as mission-critical infrastructure.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-2">
            <Link to="/app" className="inline-flex h-10 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background hover:opacity-90">
              Open dashboard <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#" className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium hover:bg-accent">
              Read the docs
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
