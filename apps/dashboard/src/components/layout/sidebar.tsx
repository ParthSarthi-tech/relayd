import type { LucideIcon } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { ChevronsLeft, LayoutDashboard, Mail, Plug, Shield, Wand2, Webhook } from 'lucide-react'
import { ChevronLeft, LogOut, Settings, User } from 'lucide-react'
import { getStoredUser, logout } from '../../lib/auth'
import { useSidebar } from '../../lib/sidebar'
import { cn } from '../../lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  exact?: boolean
  indent?: boolean
}

const nav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/endpoints', label: 'Endpoints', icon: Webhook },
  { to: '/messages', label: 'Messages', icon: Mail },
  { to: '/transformations', label: 'Transformations', icon: Wand2 },
  { to: '/connections', label: 'Connections', icon: Plug },
  { to: '/integration', label: 'Integration', icon: Shield },
  { to: '/integration/verify', label: 'Verify', icon: Shield, indent: true },
  { to: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { collapsed, toggle } = useSidebar()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const user = getStoredUser()

  function handleNav() {
    onCloseMobile?.()
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={cn(
          'shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200',
          /* Desktop: always visible, sticky */
          'sticky top-0 hidden md:flex',
          collapsed ? 'w-[64px]' : 'w-[240px]',
          /* Mobile: overlay when open */
          mobileOpen
            ? 'fixed inset-y-0 left-0 z-50 flex h-screen w-[240px]'
            : '',
        )}
      >
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M5 12h6l3-7 3 14 3-7h2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              Relayd
            </span>
            <span className="rounded border border-sidebar-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Beta
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {nav.filter((item) => !collapsed || !item.indent).map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to)
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={handleNav}
              className={cn(
                'group flex h-8 items-center gap-2.5 rounded-md text-sm font-medium transition-colors',
                item.indent ? 'pl-8 pr-2.5' : 'px-2.5',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
              )}
              title={collapsed ? item.label : undefined}
            >
              {!item.indent && (
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
                  )}
                />
              )}
              {!collapsed && (
                <span className={cn(item.indent && 'text-xs text-muted-foreground')}>
                  {item.label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border space-y-1 p-2">
        {user && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors h-8',
                  collapsed ? 'justify-center px-0' : '',
                  'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                )}
                title={collapsed ? user.name || user.email : undefined}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[11px] font-semibold text-sidebar-foreground">
                  {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                </div>
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate text-left text-xs">
                      {user.name || user.email}
                    </span>
                    <ChevronLeft className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                  </>
                )}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                side="right"
                sideOffset={8}
                align="start"
                className="z-50 min-w-[180px] overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-xl shadow-black/20"
              >
                <div className="px-3 py-2 border-b border-border mb-1">
                  <p className="text-sm font-medium text-card-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenu.Item
                  onSelect={() => navigate({ to: '/settings' })}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-card-foreground transition-colors hover:bg-accent/70 outline-none"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Settings
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="mx-2 my-1 h-px bg-border" />
                <DropdownMenu.Item
                  onSelect={logout}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 outline-none"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
        <button
          onClick={toggle}
          className={cn(
            'flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
            collapsed && 'justify-center px-0',
          )}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronsLeft
            className={cn('h-4 w-4 shrink-0 transition-transform', collapsed && 'rotate-180')}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
    </>
  )
}
