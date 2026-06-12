import { AlertTriangle } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  description: string
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  loading = false,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl shadow-black/30 outline-none"
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              destructive ? 'bg-red-500/10' : 'bg-warning/10'
            }`}
          >
            <AlertTriangle
              className={`h-4 w-4 ${destructive ? 'text-red-400' : 'text-warning'}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-white transition-colors disabled:opacity-50 ${
              destructive
                ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20'
                : 'bg-foreground text-background hover:opacity-90'
            }`}
          >
            {loading ? `${confirmLabel}...` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
