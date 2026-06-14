import { X } from 'lucide-react'
import { useState } from 'react'

const STORAGE_KEY = 'relay_cold_start_dismissed'

export function ColdStartBanner() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')

  if (dismissed) return null

  return (
    <div className="relative z-50 flex items-center justify-center gap-3 bg-amber-500/10 px-4 py-2 text-xs text-amber-600 dark:text-amber-400 border-b border-amber-500/20">
      <span>
        Free-tier deployment — services may take ~30s to wake after inactivity.{' '}
        <button
          type="button"
          onClick={() => {
            setDismissed(true)
            localStorage.setItem(STORAGE_KEY, 'true')
          }}
          className="underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-300"
        >
          Dismiss
        </button>
      </span>
      <button
        type="button"
        onClick={() => {
          setDismissed(true)
          localStorage.setItem(STORAGE_KEY, 'true')
        }}
        className="absolute right-3 rounded p-0.5 hover:bg-amber-500/20"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
