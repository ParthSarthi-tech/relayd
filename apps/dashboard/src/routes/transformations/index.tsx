import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, PlusIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/app/page-header'
import { StatusBadge } from '../../components/app/status'
import { Skeleton } from '../../components/skeleton'
import { useToast } from '../../components/toast'
import { api } from '../../lib/api-client'
import type { Transformation } from '../../lib/types'
import { cn } from '../../lib/utils'

export function TransformationsListPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    code: '// Write your transformation code here\n',
  })
  const [editCode, setEditCode] = useState('')
  const [isDirty, setIsDirty] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['transformations'],
    queryFn: () => api.listTransformations(50),
  })

  const createMutation = useMutation({
    mutationFn: (input: { name: string; description?: string; code: string }) =>
      api.createTransformation(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transformations'] })
      setShowCreate(false)
      setForm({ name: '', description: '', code: '// Write your transformation code here\n' })
      toast('success', 'Transformation created')
    },
    onError: (err) => {
      toast(
        'error',
        'Failed to create transformation',
        err instanceof Error ? err.message : 'Unknown error',
      )
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) =>
      api.updateTransformation(id, { code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transformations'] })
      setIsDirty(false)
      toast('success', 'Transformation saved')
    },
    onError: (err) => {
      toast(
        'error',
        'Failed to save transformation',
        err instanceof Error ? err.message : 'Unknown error',
      )
    },
  })

  const transformations = data?.data ?? []
  const [selectedId, setSelectedId] = useState(transformations[0]?.id ?? '')
  const selected = transformations.find((t) => t.id === selectedId) ?? transformations[0]

  useEffect(() => {
    setEditCode(selected?.code ?? '')
    setIsDirty(false)
  }, [selected?.code])

  useEffect(() => {
    if (editCode !== (selected?.code ?? '')) {
      setIsDirty(true)
    } else {
      setIsDirty(false)
    }
  }, [editCode, selected?.code])

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate({
      name: form.name,
      description: form.description || undefined,
      code: form.code,
    })
  }

  function handleSave() {
    if (!selected || !editCode.trim()) return
    updateMutation.mutate({ id: selected.id, code: editCode })
  }

  function handleDiscard() {
    setEditCode(selected?.code ?? '')
    setIsDirty(false)
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6">
      <PageHeader
        title="Transformations"
        description="Reshape, redact, or enrich payloads before they reach your endpoints."
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90"
          >
            <PlusIcon className="h-3.5 w-3.5" /> New transformation
          </button>
        }
      />

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mt-5 rounded-lg border border-border bg-card p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-foreground">New Transformation</h3>
          <div className="grid gap-3">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Transformation name"
              className="h-8 w-full rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
              required
            />
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description (optional)"
              className="h-8 w-full rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
            />
            <textarea
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="// JavaScript transformation code"
              rows={6}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex h-8 items-center rounded-md bg-foreground px-2.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="mt-10 grid grid-cols-1 gap-3 lg:grid-cols-[240px_1fr_360px]">
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      ) : transformations.length === 0 ? (
        <div className="mt-10 flex items-center justify-center rounded-lg border border-dashed border-border p-10 text-sm text-muted-foreground">
          No transformations yet. Create one to start reshaping payloads.
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[240px_1fr_360px]">
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Library
            </div>
            <ul className="p-1">
              {transformations.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setSelectedId(t.id)}
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors',
                      selectedId === t.id ? 'bg-accent' : 'hover:bg-surface/80',
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{t.name}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {t.description || 'No description'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {selected?.name ?? 'Untitled'}
                </h3>
                {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-warning" />}
              </div>
              <div className="flex items-center gap-1">
                {isDirty && (
                  <>
                    <button
                      onClick={handleDiscard}
                      className="h-7 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                      className="inline-flex h-7 items-center gap-1 rounded-md bg-foreground px-2.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      <Check className="h-3 w-3" />
                      {updateMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                  </>
                )}
              </div>
            </div>
            {selected ? (
              <textarea
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                className="flex-1 resize-none border-0 bg-surface p-4 font-mono text-[12.5px] leading-relaxed text-foreground focus:outline-none"
              />
            ) : (
              <pre className="flex-1 overflow-auto bg-surface p-4 font-mono text-[12.5px] leading-relaxed text-muted-foreground">
                <code>// Select a transformation</code>
              </pre>
            )}
          </div>

          <PreviewBlock title="Input" code={`{\n  "event": "example",\n  "data": {}\n}`} />
        </div>
      )}
    </div>
  )
}

function PreviewBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <pre className="max-h-[280px] overflow-auto bg-surface p-3 font-mono text-[12px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  )
}
