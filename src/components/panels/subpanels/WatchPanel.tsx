// src/components/panels/WatchPanel.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Watch expressions panel.
// - User types an expression and presses Enter to add it
// - Expressions persist across steps
// - Results re-evaluate automatically on every EVENT_STOPPED (handled in store)
// - Displays <evaluating> while a session is running between stops
// - Displays <not paused> when idle or running
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from 'react'
import { useDebugStore } from '../../../renderer/store/debugStore'
import { useWatchExpressions } from '../../../hooks/useWatchExpressions'

// ── Icons ─────────────────────────────────────────────────────────────────────

function RemoveIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="2" x2="9" y2="9" />
      <line x1="9" y1="2" x2="2" y2="9" />
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resultColor(result: string): string {
  if (result === '<e>')          return 'text-[#f48771]'
  if (result === '<not paused>') return 'text-[#555]'
  if (result.startsWith('Error')) return 'text-[#f48771]'
  return 'text-[#ce9178]'
}

// ── Watch row ─────────────────────────────────────────────────────────────────

interface WatchRowProps {
  expr:   string
  result: string
  onRemove: () => void
}

function WatchRow({ expr, result, onRemove }: Readonly<WatchRowProps>) {
  return (
    <div className="flex items-start gap-1 px-2 py-0.5 hover:bg-[#2a2d2e] group text-xs font-mono">
      <span className="text-[#9cdcfe] flex-1 truncate">{expr}</span>
      <span className={`flex-1 truncate text-right ${resultColor(result)}`}>
        {result}
      </span>
      <button
        onClick={onRemove}
        title="Remove watch"
        className="text-[#555] hover:text-[#f48771] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1"
      >
        <RemoveIcon />
      </button>
    </div>
  )
}

// ── Add expression input ──────────────────────────────────────────────────────

interface AddWatchInputProps {
  onAdd: (expr: string) => void
}

function AddWatchInput({ onAdd }: Readonly<AddWatchInputProps>) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = useCallback(() => {
    const trimmed = draft.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setDraft('')
  }, [draft, onAdd])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  commit()
    if (e.key === 'Escape') { setDraft(''); inputRef.current?.blur() }
  }, [commit])

  return (
    <div className="border-t border-[#3c3c3c] px-2 py-1.5 shrink-0">
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full bg-[#3c3c3c] text-xs text-white placeholder:text-[#555] px-2 py-1 rounded outline-none focus:ring-1 focus:ring-blue-500 font-mono"
        placeholder="Add watch expression…"
      />
    </div>
  )
}

// ── Watch panel ───────────────────────────────────────────────────────────────

export default function WatchPanel() {
const status = useDebugStore((s) => s.status)
  const { entries, addExpression, removeExpression } = useWatchExpressions()

  // Placeholder result when we can't evaluate
  const placeholderResult = status === 'paused' ? '…' : '<not paused>'

  const handleAdd = useCallback((expr: string) => {
    addExpression(expr)
  }, [addExpression])

  const handleRemove = useCallback((expr: string) => {
    removeExpression(expr)
  }, [removeExpression])

  return (
    <div className="flex flex-col h-full">
      {/* Column headers */}
      <div className="flex gap-1 px-2 py-1 text-[10px] uppercase tracking-wide text-[#969696] border-b border-[#3c3c3c] shrink-0">
        <span className="flex-1">Expression</span>
        <span className="flex-1 text-right">Value</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="p-3 text-xs text-[#555]">
            No watch expressions. Add one below.
          </div>
        ) : (
          entries.map((entry) => (
            <WatchRow
              key={entry.id}
              expr={entry.expression}
              result={entry.result !== '—' ? entry.result : placeholderResult}
              onRemove={() => removeExpression(entry.id)}
            />
          ))
        )}
      </div>

      {/* Input */}
      <AddWatchInput onAdd={handleAdd} />
    </div>
  )
}
