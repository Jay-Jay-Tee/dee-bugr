// src/components/panels/REPLInput.tsx
// Evaluate-expression input at the bottom of the variables panel.
// Enter an expression → sends IPC.EVALUATE → shows result inline.
// Collapses to a single "▸ Evaluate" toggle when not focused.

import { useState, useRef, useCallback, useId } from 'react'
import { IPC } from '../../shared/ipc'

function invoke(channel: typeof IPC[keyof typeof IPC], args?: unknown) {
  return globalThis.electronAPI?.invoke(channel, args)
    .catch((err: unknown) => console.error('[REPL]', err))
}

interface Props {
  disabled?: boolean
}

export default function REPLInput({ disabled }: Readonly<Props>) {
  const [expr,   setExpr]   = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [open,   setOpen]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()

  const evaluate = useCallback(async () => {
    const trimmed = expr.trim()
    if (!trimmed) return
    setPending(true)
    setResult(null)
    const raw = await invoke(IPC.EVALUATE, { expr: trimmed })
    setPending(false)
    setResult(typeof raw === 'string' ? raw : raw != null ? String(raw) : 'undefined')
  }, [expr])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); evaluate() }
    if (e.key === 'Escape') { setOpen(false); setExpr(''); setResult(null) }
  }, [evaluate])

  const handleOpen = useCallback(() => {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        disabled={disabled}
        className="w-full text-left px-3 py-1.5 text-[11px] text-[#555] hover:text-[#969696] border-t border-[#3c3c3c] transition-colors disabled:cursor-not-allowed"
      >
        ▸ Evaluate expression…
      </button>
    )
  }

  const isError = typeof result === 'string' && result.startsWith('Error:')

  return (
    <div className="border-t border-[#3c3c3c] px-2 py-1.5 flex flex-col gap-1">
      <div className="flex gap-1">
        <input
          id={id}
          ref={inputRef}
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="expression…"
          disabled={disabled || pending}
          className="flex-1 bg-[#3c3c3c] text-xs text-white placeholder:text-[#555] px-2 py-1 rounded font-mono outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          onClick={evaluate}
          disabled={disabled || pending || !expr.trim()}
          className="text-[10px] px-2 py-1 rounded bg-[#3c3c3c] text-[#969696] hover:text-white hover:bg-[#4a4a4a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? '…' : '▶'}
        </button>
        <button
          onClick={() => { setOpen(false); setExpr(''); setResult(null) }}
          className="text-[10px] px-1.5 py-1 rounded text-[#555] hover:text-[#f48771] transition-colors"
          title="Close"
        >
          ✕
        </button>
      </div>
      {result !== null && (
        <div className={`text-[11px] font-mono px-1 truncate ${isError ? 'text-[#f48771]' : 'text-[#9cdcfe]'}`}>
          = {result}
        </div>
      )}
    </div>
  )
}
