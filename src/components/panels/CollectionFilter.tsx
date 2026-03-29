// src/components/panels/CollectionFilter.tsx
// Day 7 — Filter panel for array/list variables.
// Appears above expandable variables (variablesReference > 0).
// User types a JS expression like `item.done === false`.
// Each child value is JSON-parsed and tested with a sandboxed Function.
// Only matching children are shown.

import { useState, useCallback, useMemo } from 'react'
import type { Variable } from '../../shared/types'

interface Props {
  children: Variable[]
  onFiltered: (filtered: Variable[]) => void
}

// Safe eval: wraps expression in a Function that receives `item`.
// Returns true/false. Any throw = treated as no-match.
function testItem(expr: string, raw: string): boolean {
  try {
    const item = JSON.parse(raw)
    // eslint-disable-next-line no-new-func
    return !!new Function('item', `"use strict"; return (${expr})`)(item)
  } catch {
    // Non-JSON values (pointers, structs): test as plain string match
    try {
      // eslint-disable-next-line no-new-func
      return !!new Function('item', `"use strict"; return (${expr})`)(`"${raw}"`)
    } catch {
      return false
    }
  }
}

export default function CollectionFilter({ children, onFiltered }: Readonly<Props>) {
  const [expr,    setExpr]    = useState('')
  const [error,   setError]   = useState('')
  const [active,  setActive]  = useState(false)

  const apply = useCallback((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setActive(false)
      setError('')
      onFiltered(children)
      return
    }
    try {
      const filtered = children.filter((c) => testItem(trimmed, c.value))
      setError('')
      setActive(true)
      onFiltered(filtered)
    } catch (e) {
      setError('Invalid expression')
    }
  }, [children, onFiltered])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setExpr(e.target.value)
    apply(e.target.value)
  }, [apply])

  const handleClear = useCallback(() => {
    setExpr('')
    setActive(false)
    setError('')
    onFiltered(children)
  }, [children, onFiltered])

  const matchCount = useMemo(() => {
    if (!active || !expr.trim()) return null
    return children.filter((c) => testItem(expr.trim(), c.value)).length
  }, [active, expr, children])

  return (
    <div className="flex items-center gap-1 px-2 py-0.5 bg-[#1a1a1a] border-b border-[#2d2d2d]">
      <span className="text-[10px] text-[#555] shrink-0">filter:</span>
      <input
        value={expr}
        onChange={handleChange}
        placeholder="e.g. item.done === false"
        className={[
          'flex-1 bg-transparent text-[11px] font-mono outline-none placeholder:text-[#3a3a3a]',
          error ? 'text-[#f48771]' : active ? 'text-[#4ec9b0]' : 'text-[#cccccc]',
        ].join(' ')}
      />
      {active && matchCount !== null && (
        <span className="text-[10px] text-[#4ec9b0] shrink-0">{matchCount}/{children.length}</span>
      )}
      {(expr || active) && (
        <button
          onClick={handleClear}
          className="text-[#555] hover:text-[#f48771] text-[10px] shrink-0"
          title="Clear filter"
        >✕</button>
      )}
      {error && (
        <span className="text-[10px] text-[#f48771] shrink-0">{error}</span>
      )}
    </div>
  )
}
