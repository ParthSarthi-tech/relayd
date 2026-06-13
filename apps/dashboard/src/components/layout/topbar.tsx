import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Bell, ChevronDown, Moon, Search, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getStoredUser } from '../../lib/auth'
import { api } from '../../lib/api-client'
import { cn } from '../../lib/utils'
import { useTheme } from './theme-provider'

interface TopbarProps {
  onOpenCommandPalette: () => void
  liveStatus?: 'connecting' | 'connected' | 'disconnected'
}

export function Topbar({ onOpenCommandPalette, liveStatus }: TopbarProps) {
  const { theme, toggle } = useTheme()
  const user = getStoredUser()
  const [focused, setFocused] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const { data: recentFailures } = useQuery({
    queryKey: ['messages', { status: 'failed', limit: 5 }],
    queryFn: () => api.listMessages({ status: 'failed', limit: 5 }),
    refetchInterval: 15_000,
  })

  const { data: recentDead } = useQuery({
    queryKey: ['messages', { status: 'dead_letter', limit: 5 }],
    queryFn: () => api.listMessages({ status: 'dead_letter', limit: 5 }),
    refetchInterval: 15_000,
  })

  const failures = recentFailures?.data ?? []
  const deadLetters = recentDead?.data ?? []
  const notifCount = failures.length + deadLetters.length

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenCommandPalette()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenCommandPalette])

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      {/* Mobile: workspace on left */}
      <div className="flex lg:hidden">
        <button className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-sm font-medium text-foreground hover:bg-accent">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-foreground text-[10px] font-semibold text-background">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <span className="hidden sm:inline">{user?.name || 'Workspace'}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Desktop spacer */}
      <div className="hidden flex-1 lg:block" />

      {/* Search bar — centered */}
      <button
        onClick={onOpenCommandPalette}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="relative hidden w-full max-w-md lg:block"
      >
        <div
          className={`flex h-8 w-full items-center rounded-md border pl-8 pr-12 text-sm transition-colors ${
            focused
              ? 'border-border-strong bg-surface text-foreground'
              : 'border-border bg-surface text-muted-foreground'
          }`}
        >
          <Search
            className={`absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-colors ${
              focused ? 'text-foreground' : 'text-muted-foreground'
            }`}
          />
          <span className="text-muted-foreground">Search endpoints, messages...</span>
        </div>
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Right side: workspace + actions */}
      <div className="flex items-center gap-1">
        {/* Desktop workspace button */}
        <button className="hidden h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-sm font-medium text-foreground hover:bg-accent lg:flex">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-foreground text-[10px] font-semibold text-background">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <span className="hidden sm:inline">{user?.name || 'Workspace'}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {liveStatus && (
          <div
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wider ${
              liveStatus === 'connected'
                ? 'text-emerald-500'
                : liveStatus === 'connecting'
                  ? 'text-amber-500'
                  : 'text-muted-foreground'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                liveStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : liveStatus === 'connecting'
                    ? 'bg-amber-500'
                    : 'bg-muted-foreground'
              }`}
            />
            {liveStatus === 'connected' ? 'Live' : liveStatus === 'connecting' ? 'Connecting...' : 'Offline'}
          </div>
        )}
        <button
          onClick={toggle}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            {notifCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[14px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/20">
              <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                Notifications
              </div>
              {notifCount === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No recent issues
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto p-1 space-y-0.5">
                  {failures.slice(0, 3).map((m) => (
                    <a
                      key={m.id}
                      href={`/app/messages/${m.id}`}
                      className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-accent transition-colors"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <div className="min-w-0">
                        <span className="font-medium text-foreground">{m.eventType}</span>
                        <span className="ml-1.5 text-muted-foreground">failed</span>
                        <p className="mt-0.5 truncate text-muted-foreground">
                          {m.lastError || 'No error details'}
                        </p>
                      </div>
                    </a>
                  ))}
                  {deadLetters.slice(0, 3).map((m) => (
                    <a
                      key={m.id}
                      href={`/app/messages/${m.id}`}
                      className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs hover:bg-accent transition-colors"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      <div className="min-w-0">
                        <span className="font-medium text-foreground">{m.eventType}</span>
                        <span className="ml-1.5 text-destructive">dead-lettered</span>
                        <p className="mt-0.5 truncate text-muted-foreground">
                          {m.lastError || 'Exhausted retries'}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
              <a
                href="/app/messages"
                className="block border-t border-border px-3 py-2 text-xs font-medium text-primary hover:bg-accent transition-colors text-center"
              >
                View all messages
              </a>
            </div>
          )}
        </div>
        <button className="ml-1 flex h-8 items-center gap-2 rounded-md pl-1 pr-2 hover:bg-accent">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background">
            {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
        </button>
      </div>
    </header>
  )
}
