// src/components/panels/WatchPanel.tsx
// Watch expressions panel — evaluates user-typed expressions after every stop.
// Pure UI — all logic lives in useWatchExpressions hook.

import { useState, useCallback, useRef, useId } from 'react'
import { useWatchExpressions, type WatchEntry } from '../../renderer/hooks/useWatchExpressions'
import { useDebugStore } from '../../renderer/store/debugStore'

// ── Icons ─────────────────────────────────────────────────────────────────────

function RemoveIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="1" y1="1" x2="10" y2="10" />
      <line x1="10" y1="1" x2="1"  y2="10" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
      stroke="currentColor" strokeWidth="1.5"
      style={{ animation: 'spin 0.8s linear infinite' }}>
      <path d="M5 1 A4 4 0 0 1 9 5" strokeLinecap="round" />
    </svg>
  )
}

// ── Result colour by status ───────────────────────────────────────────────────

function resultClass(s: WatchEntry['status']): string {
  if (s === 'error')   return 'text-[#f48771]'
  if (s === 'pending') return 'text-[#555]'
  return 'text-[#9cdcfe]'
}

// ── Single watch row ──────────────────────────────────────────────────────────

interface WatchRowProps {
  entry:    WatchEntry
  onRemove: (id: string) => void
  onUpdate: (id: string, expr: string) => void
}

function WatchRow({ entry, onRemove, onUpdate }: Readonly<WatchRowProps>) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(entry.expression)

  const commitEdit = useCallback(() => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== entry.expression) {
      onUpdate(entry.id, trimmed)
    } else {
      setDraft(entry.expression)
    }
    setEditing(false)
  }, [draft, entry.expression, entry.id, onUpdate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') { setDraft(entry.expression); setEditing(false) }
  }, [commitEdit, entry.expression])

  return (
    <div className="flex items-center gap-1 px-2 py-0.5 hover:bg-[#2a2d2e] group text-xs font-mono border-b border-[#2d2d2d]">

      {/* Expression — double-click to edit */}
      <div className="w-32 shrink-0">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-full bg-[#3c3c3c] text-[#cccccc] px-1 rounded outline-none focus:ring-1 focus:ring-blue-500"
          />
        ) : (
          <span
            className="text-[#dcdcaa] cursor-pointer truncate block"
            title="Double-click to edit"
            onDoubleClick={() => { setDraft(entry.expression); setEditing(true) }}
          >
            {entry.expression}
          </span>
        )}
      </div>

      {/* Result */}
      <span className={`flex-1 truncate flex items-center gap-1 ${resultClass(entry.status)}`}>
        {entry.status === 'pending' && <SpinnerIcon />}
        {entry.result}
      </span>

      {/* Remove button — visible on hover */}
      <button
        onClick={() => onRemove(entry.id)}
        title="Remove watch"
        className="text-[#555] hover:text-[#f48771] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0.5"
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
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()

  const commit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
    inputRef.current?.focus()
  }, [value, onAdd])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
  }, [commit])

  return (
    <div className="px-2 py-1.5 border-t border-[#3c3c3c] shrink-0 flex gap-1">
      <input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add expression…"
        className="flex-1 bg-[#3c3c3c] text-xs text-white placeholder:text-[#555] px-2 py-1 rounded outline-none focus:ring-1 focus:ring-blue-500 font-mono"
      />
      <button
        onClick={commit}
        disabled={!value.trim()}
        className="text-[10px] px-2 py-1 rounded bg-[#3c3c3c] text-[#969696] hover:text-white hover:bg-[#4a4a4a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Add
      </button>
    </div>
  )
}

// ── Watch panel ───────────────────────────────────────────────────────────────

export default function WatchPanel() {
  const { entries, addExpression, removeExpression, updateExpression, clearAll } =
    useWatchExpressions()

  const status = useDebugStore((s) => s.status)

  return (
    <div className="flex flex-col h-full">

      {/* Column headers + clear all */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-[#3c3c3c] shrink-0">
        <div className="flex gap-2 text-[10px] uppercase tracking-wide text-[#969696]">
          <span className="w-32 shrink-0">Expression</span>
          <span>Value</span>
        </div>
        {entries.length > 0 && (
          <button
            onClick={clearAll}
            className="text-[10px] text-[#555] hover:text-[#f48771] transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="p-3 text-xs text-[#555] text-center mt-4">
            {status === 'idle'
              ? 'Add an expression below — values update on every step.'
              : 'No watches yet. Add an expression below.'}
          </div>
        ) : (
          entries.map((entry) => (
            <WatchRow
              key={entry.id}
              entry={entry}
              onRemove={removeExpression}
              onUpdate={updateExpression}
            />
          ))
        )}
      </div>

      <AddWatchInput onAdd={addExpression} />
    </div>
  )
}
