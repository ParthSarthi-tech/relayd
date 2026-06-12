import { useNavigate } from '@tanstack/react-router'
import { Command } from 'cmdk'
import { GitBranch, LayoutDashboard, Mail, Plus, Settings, Webhook, Workflow } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/endpoints', label: 'Endpoints', icon: Webhook },
  { to: '/messages', label: 'Messages', icon: Mail },
  { to: '/transformations', label: 'Transformations', icon: Workflow },
  { to: '/connections', label: 'Connections', icon: GitBranch },
  { to: '/settings', label: 'Settings', icon: Settings },
]

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  function handleSelect(value: string) {
    onOpenChange(false)
    setSearch('')

    if (value.startsWith('navigate:')) {
      navigate({
        to: value.slice(9) as
          | '/'
          | '/endpoints'
          | '/messages'
          | '/transformations'
          | '/connections'
          | '/settings',
      })
    } else if (value === 'create:endpoint') {
      navigate({ to: '/endpoints' })
    } else if (value === 'create:transformation') {
      navigate({ to: '/transformations' })
    } else if (value === 'create:connection') {
      navigate({ to: '/connections' })
    }
  }

  return (
    <div className={`fixed inset-0 z-50 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={() => onOpenChange(false)}
      />
      <div
        className={`fixed left-1/2 top-[15%] w-full max-w-lg -translate-x-1/2 transition-all duration-200 ${
          open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
        }`}
      >
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/30">
          <Command
            label="Command palette"
            shouldFilter={true}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onOpenChange(false)
              }
            }}
          >
            <div className="flex items-center border-b border-border px-4">
              <Command.Input
                ref={inputRef}
                value={search}
                onValueChange={setSearch}
                placeholder="Search pages, create resources..."
                className="flex h-12 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-none"
              />
            </div>
            <Command.List className="max-h-72 overflow-y-auto p-2">
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                No results found.
              </Command.Empty>
              <Command.Group
                heading="Navigate"
                className="text-xs font-medium text-muted-foreground px-2 py-1.5"
              >
                {navItems.map((item) => (
                  <Command.Item
                    key={item.to}
                    value={`navigate:${item.to}`}
                    onSelect={handleSelect}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors aria-selected:bg-secondary/70"
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group
                heading="Create"
                className="text-xs font-medium text-muted-foreground px-2 py-1.5"
              >
                <Command.Item
                  value="create:endpoint"
                  onSelect={handleSelect}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors aria-selected:bg-secondary/70"
                >
                  <Webhook className="h-4 w-4 text-muted-foreground" />
                  New Endpoint
                </Command.Item>
                <Command.Item
                  value="create:transformation"
                  onSelect={handleSelect}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors aria-selected:bg-secondary/70"
                >
                  <Workflow className="h-4 w-4 text-muted-foreground" />
                  New Transformation
                </Command.Item>
                <Command.Item
                  value="create:connection"
                  onSelect={handleSelect}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors aria-selected:bg-secondary/70"
                >
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  New Connection
                </Command.Item>
              </Command.Group>
              {search && (
                <div className="border-t border-border px-2 py-2 text-xs text-muted-foreground/60">
                  Press{' '}
                  <kbd className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 font-mono text-[10px]">
                    Enter
                  </kbd>{' '}
                  to navigate,{' '}
                  <kbd className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 font-mono text-[10px]">
                    Esc
                  </kbd>{' '}
                  to close
                </div>
              )}
            </Command.List>
          </Command>
        </div>
      </div>
    </div>
  )
}
