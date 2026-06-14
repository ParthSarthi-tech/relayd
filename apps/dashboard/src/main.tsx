import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { ColdStartBanner } from './components/cold-start-banner'
import { ThemeProvider } from './components/layout/theme-provider'
import { ToastProvider } from './components/toast'
import { createRouterInstance } from './routes/index'
import './styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
})

const router = createRouterInstance(queryClient)

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <ThemeProvider>
        <ColdStartBanner />
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </ToastProvider>
      </ThemeProvider>
    </StrictMode>,
  )
}
