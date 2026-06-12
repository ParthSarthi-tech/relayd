import type { QueryClient } from '@tanstack/react-query'
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  useLocation,
} from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { CommandPalette } from '../components/command-palette'
import { ErrorBoundary } from '../components/error-boundary'
import { ShortcutsModal } from '../components/shortcuts-modal'
import { Sidebar } from '../components/layout/sidebar'
import { Topbar } from '../components/layout/topbar'
import { useLiveStream } from '../hooks/use-live-stream'
import { getStoredUser, isAuthenticated } from '../lib/auth'
import { SidebarContext } from '../lib/sidebar'
import { ConnectionsListPage } from './connections/index'
import { DashboardPage } from './dashboard'
import { EndpointDetailPage } from './endpoints/$id'
import { EndpointsListPage } from './endpoints/index'
import { IntegrationPage } from './integration/index'
import { VerifyPage } from './integration/verify'
import { LoginPage } from './login'
import { MessageDetailPage } from './messages/$id'
import { MessagesListPage } from './messages/index'
import { RegisterPage } from './register'
import { SettingsPage } from './settings'
import { TransformationsListPage } from './transformations/index'

interface RouterContext {
  queryClient: QueryClient
}

function requireAuth() {
  if (!isAuthenticated()) {
    throw redirect({ to: '/login' })
  }
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: AuthLayout,
})

function AuthLayout() {
  const authed = isAuthenticated()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true',
  )
  const [commandOpen, setCommandOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }, [])

  const openCommandPalette = useCallback(() => setCommandOpen(true), [])

  const { status: liveStatus } = useLiveStream()

  useEffect(() => {
    let gPending = false
    function handleKey(e: KeyboardEvent) {
      if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (e.key === 'g' && !(e.metaKey || e.ctrlKey)) {
        if (gPending) {
          gPending = false
          return
        }
        gPending = true
        setTimeout(() => { gPending = false }, 500)
        return
      }
      if (gPending) {
        gPending = false
        const nav: Record<string, string> = {
          d: '/', e: '/endpoints', m: '/messages',
          t: '/transformations', c: '/connections', s: '/settings', i: '/integration',
        }
        const path = nav[e.key.toLowerCase()]
        if (path) window.location.hash = path
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  if (!authed) {
    return <Outlet />
  }

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, toggle: toggleCollapsed }}>
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="bg-noise fixed inset-0 z-0" />
        <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
        <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-background/80 px-2 backdrop-blur-md md:px-0 md:border-0 md:bg-transparent md:backdrop-blur-none">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Topbar onOpenCommandPalette={openCommandPalette} liveStatus={liveStatus} />
          </div>
          <main className="flex-1 overflow-y-auto p-6 bg-grid">
            <div className="mx-auto max-w-7xl">
              <ErrorBoundary>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <Outlet />
                  </motion.div>
                </AnimatePresence>
              </ErrorBoundary>
            </div>
          </main>
        </div>
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
        <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </div>
    </SidebarContext.Provider>
  )
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: RegisterPage,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: requireAuth,
  component: DashboardPage,
})

const endpointsListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/endpoints',
  beforeLoad: requireAuth,
  component: EndpointsListPage,
})

const endpointDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/endpoints/$id',
  beforeLoad: requireAuth,
  component: EndpointDetailPage,
})

const messagesListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/messages',
  beforeLoad: requireAuth,
  component: MessagesListPage,
})

const messageDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/messages/$id',
  beforeLoad: requireAuth,
  component: MessageDetailPage,
})

const transformationsListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/transformations',
  beforeLoad: requireAuth,
  component: TransformationsListPage,
})

const connectionsListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/connections',
  beforeLoad: requireAuth,
  component: ConnectionsListPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  beforeLoad: requireAuth,
  component: SettingsPage,
})

const integrationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/integration',
  beforeLoad: requireAuth,
  component: IntegrationPage,
})

const integrationVerifyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/integration/verify',
  beforeLoad: requireAuth,
  component: VerifyPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  dashboardRoute,
  endpointsListRoute,
  endpointDetailRoute,
  messagesListRoute,
  messageDetailRoute,
  transformationsListRoute,
  connectionsListRoute,
  settingsRoute,
  integrationRoute,
  integrationVerifyRoute,
])

export function createRouterInstance(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    basepath: '/app',
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouterInstance>
  }
}
