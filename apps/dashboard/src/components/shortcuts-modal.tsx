import { Keyboard } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface ShortcutsModalProps {
  open: boolean
  onClose: () => void
}

const shortcuts = [
  { keys: ['⌘K', 'Ctrl+K'], label: 'Command palette' },
  { keys: ['?'], label: 'Show shortcuts' },
  { keys: ['G', 'then', 'D'], label: 'Go to Dashboard' },
  { keys: ['G', 'then', 'E'], label: 'Go to Endpoints' },
  { keys: ['G', 'then', 'M'], label: 'Go to Messages' },
  { keys: ['G', 'then', 'T'], label: 'Go to Transformations' },
  { keys: ['G', 'then', 'C'], label: 'Go to Connections' },
  { keys: ['G', 'then', 'S'], label: 'Go to Settings' },
]

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[22px] items-center justify-center rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground">
      {children}
    </kbd>
  )
}

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl shadow-black/30 outline-none"
      >
        <div className="flex items-center gap-2 mb-4">
          <Keyboard className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-card-foreground">Keyboard Shortcuts</h3>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-xs text-card-foreground">{s.label}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-[10px] text-muted-foreground">{k === 'then' ? 'then' : '+'}</span>}
                    {k !== 'then' && <Kbd>{k}</Kbd>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10px] text-muted-foreground text-center">
          Press <Kbd>?</Kbd> or <Kbd>Esc</Kbd> to close
        </p>
      </div>
    </div>
  )
}
