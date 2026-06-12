import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  override render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-red-400 mb-3" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            {this.state.error.message || 'An unexpected error occurred'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
