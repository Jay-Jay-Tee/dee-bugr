// src/components/panels/SpecialBreakpoints.tsx
// Day 7 — Method breakpoints and exception breakpoints.
// Separate from BreakpointPanel (line BPs) to keep both under 100 lines.
// IPC channels SET_METHOD_BP and SET_EXCEPTION_BP are already registered
// in handlers.ts (currently stubs returning notYet(6) — P1 implements Day 7).

import { useState, useCallback, useId } from 'react'
import { IPC } from '../../shared/ipc'

function invoke(channel: typeof IPC[keyof typeof IPC], args?: unknown) {
  return (globalThis as Window & typeof globalThis).electronAPI?.invoke(channel, args)
    .catch((err: unknown) => console.error('[SpecialBP]', err))
}

// ── Method breakpoint ─────────────────────────────────────────────────────────

function MethodBreakpoint() {
  const [method,  setMethod]  = useState('')
  const [pending, setPending] = useState(false)
  const [result,  setResult]  = useState<string | null>(null)
  const id = useId()

  const handleSet = useCallback(async () => {
    const trimmed = method.trim()
    if (!trimmed) return
    setPending(true)
    setResult(null)
    const res = await invoke(IPC.SET_METHOD_BP, { method: trimmed }) as { success?: boolean; error?: string } | undefined
    setPending(false)
    setResult(res?.success ? `Set on "${trimmed}"` : (res?.error ?? 'Failed'))
  }, [method])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSet()
  }, [handleSet])

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 border-b border-[#2d2d2d]">
      <label htmlFor={id} className="text-[10px] uppercase tracking-wide text-[#969696]">
        Method breakpoint
      </label>
      <div className="flex gap-1">
        <input
          id={id}
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. MyClass.myMethod"
          className="flex-1 bg-[#2d2d2d] text-[11px] text-white px-2 py-1 rounded border border-[#3c3c3c] focus:border-blue-500 focus:outline-none placeholder:text-[#555] font-mono"
        />
        <button
          onClick={handleSet}
          disabled={pending || !method.trim()}
          className="text-[10px] px-2.5 py-1 rounded bg-[#3c3c3c] text-[#969696] hover:text-white hover:bg-[#4a4a4a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? '…' : 'Set'}
        </button>
      </div>
      {result && (
        <div className={`text-[10px] font-mono ${result.startsWith('Set') ? 'text-[#9cdcfe]' : 'text-[#f48771]'}`}>
          {result}
        </div>
      )}
    </div>
  )
}

// ── Exception breakpoint ──────────────────────────────────────────────────────

const EXCEPTION_FILTERS = [
  { id: 'all',        label: 'All exceptions'      },
  { id: 'uncaught',   label: 'Uncaught only'        },
  { id: 'user',       label: 'User-defined only'    },
] as const

type ExceptionFilter = typeof EXCEPTION_FILTERS[number]['id']

function ExceptionBreakpoint() {
  const [filter,  setFilter]  = useState<ExceptionFilter>('uncaught')
  const [active,  setActive]  = useState(false)
  const [pending, setPending] = useState(false)

  const toggle = useCallback(async () => {
    setPending(true)
    const next = !active
    await invoke(IPC.SET_EXCEPTION_BP, { filter, enabled: next })
    setPending(false)
    setActive(next)
  }, [active, filter])

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2">
      <span className="text-[10px] uppercase tracking-wide text-[#969696]">
        Exception breakpoint
      </span>
      <div className="flex items-center gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as ExceptionFilter)}
          disabled={active}
          className="flex-1 bg-[#2d2d2d] text-[11px] text-white px-2 py-1 rounded border border-[#3c3c3c] focus:border-blue-500 focus:outline-none disabled:opacity-50"
        >
          {EXCEPTION_FILTERS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <button
          onClick={toggle}
          disabled={pending}
          className={[
            'text-[10px] px-2.5 py-1 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
            active
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-[#3c3c3c] text-[#969696] hover:text-white hover:bg-[#4a4a4a]',
          ].join(' ')}
        >
          {pending ? '…' : active ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function SpecialBreakpoints() {
  return (
    <div className="flex flex-col">
      <MethodBreakpoint />
      <ExceptionBreakpoint />
    </div>
  )
}
