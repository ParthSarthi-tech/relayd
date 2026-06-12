import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

interface LiveStreamOptions {
  onStats?: (stats: Record<string, unknown>) => void
  onMessage?: (msg: Record<string, unknown>) => void
}

export function useLiveStream(options: LiveStreamOptions = {}) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const esRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queryClient = useQueryClient()

  const connect = useCallback(() => {
    if (esRef.current?.readyState === EventSource.OPEN) return

    setStatus('connecting')
    const es = new EventSource('/v1/stream/live')
    esRef.current = es

    es.addEventListener('open', () => {
      setStatus('connected')
    })

    es.addEventListener('stats', (event) => {
      try {
        const data = JSON.parse(event.data)
        queryClient.setQueryData(['stats'], data)
        options.onStats?.(data)
      } catch {}
    })

    es.addEventListener('new-message', (event) => {
      try {
        const data = JSON.parse(event.data)
        options.onMessage?.(data)
      } catch {}
    })

    es.addEventListener('heartbeat', () => {
      // Keeps connection alive — no action needed
    })

    es.onerror = () => {
      setStatus('disconnected')
      es.close()
      esRef.current = null
      // Auto-reconnect after 3s
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 3000)
    }
  }, [queryClient, options])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    setStatus('disconnected')
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return { status, connect, disconnect }
}
