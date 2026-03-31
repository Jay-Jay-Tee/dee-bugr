// src/components/panels/subpanels/VariablesPanel.tsx
// Variables tab: tree of local variables with inline REPL and watch input.
// Extracted from LeftPanel.tsx to keep files under 100 lines each.

import { useState, useCallback, useRef } from 'react'
import { useDebugStore } from '../../../renderer/store/debugStore'
import { MOCK_CHILDREN_MAP } from '../../../renderer/mockData'
import { IPC } from '../../../shared/ipc'
import type { Variable } from '../../../shared/types'
import CollectionFilter from './CollectionFilter'
import { invoke } from './ipcInvoke'

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeColor(type: string): string {
  if (/^(int|short|long|uint|size_t|unsigned)/.test(type)) return 'text-[#b5cea8]'
  if (/^(float|double)/.test(type))                        return 'text-[#dcdcaa]'
  if (/^(bool)/.test(type))                                return 'text-[#569cd6]'
  if (/^(char \*|std::string|string)/.test(type))          return 'text-[#ce9178]'
  if (/\*/.test(type))                                     return 'text-[#c586c0]'
  return 'text-[#9cdcfe]'
}

function humanType(type: string): string {
  if (/^(int|short|long|int32|int64)/.test(type)) return 'whole number'
  if (/^(float|double)/.test(type))               return 'decimal'
  if (/^bool/.test(type))                         return 'true/false'
  if (/^(char \*|std::string|string|str)/.test(type)) return 'text'
  if (/\*/.test(type))                            return 'pointer'
  return type
}

function isVariableArray(v: unknown): v is Variable[] {
  return Array.isArray(v) && v.every(
    (x) => typeof x === 'object' && x !== null &&
      typeof (x as Record<string, unknown>)['name'] === 'string'
  )
}

// ── VariableRow ───────────────────────────────────────────────────────────────

interface VariableRowProps {
  variable: Variable
  depth?: number
  isBeginnerMode?: boolean
}

function VariableRow({ variable, depth = 0, isBeginnerMode = false }: Readonly<VariableRowProps>) {
  const [expanded,         setExpanded]         = useState(false)
  const [liveChildren,     setLiveChildren]     = useState<Variable[] | null>(null)
  const [filteredChildren, setFilteredChildren] = useState<Variable[] | null>(null)
  const [tooltip,          setTooltip]          = useState('')
  const [tooltipVis,       setTooltipVis]       = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const rawChildren = liveChildren ?? MOCK_CHILDREN_MAP[variable.variablesReference] ?? []
  const children    = filteredChildren ?? rawChildren
  const hasChildren = variable.variablesReference > 0
  const isNull      = ['0x0000000000000000', 'nullptr', '0x0'].includes(variable.value)

  const handleExpand = useCallback(async () => {
    if (!hasChildren) return
    if (!expanded && liveChildren === null) {
      const result = await invoke(IPC.GET_VARIABLES, { variablesReference: variable.variablesReference })
      if (isVariableArray(result)) setLiveChildren(result)
    }
    setExpanded((e) => !e)
  }, [hasChildren, expanded, liveChildren, variable.variablesReference])

  const handleMouseEnter = useCallback(() => {
    // Tooltip works in both Beginner and Expert mode.
    // In Expert mode it's a quick technical note; in Beginner mode it's plain English.
    hoverTimer.current = setTimeout(async () => {
      try {
        const result = await invoke(IPC.AI_EXPLAIN_VAR, { varName: variable.name })
        if (
          typeof result === 'object' && result !== null &&
          (result as Record<string, unknown>)['success'] === true &&
          typeof (result as Record<string, unknown>)['explanation'] === 'string'
        ) {
          setTooltip((result as Record<string, unknown>)['explanation'] as string)
          setTooltipVis(true)
        }
      } catch { /* ignore */ }
    }, 600)
  }, [isBeginnerMode, variable.name])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setTooltipVis(false)
    setTooltip('')
  }, [])

  return (
    <>
      <div
        className={['relative flex items-start gap-1 py-0.5 hover:bg-[#2a2d2e] cursor-default text-xs font-mono', isNull ? 'bg-red-950/20' : ''].join(' ')}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleExpand}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="w-3 shrink-0 text-[#969696]">{hasChildren ? (expanded ? '▾' : '▸') : ' '}</span>
        <span className="text-[#9cdcfe] w-28 shrink-0 truncate">{variable.name}</span>
        <span className={['flex-1 truncate', isNull ? 'text-red-400 font-medium' : typeColor(variable.type)].join(' ')}>
          {variable.value}
        </span>
        <span className="text-[#4ec9b0] w-28 shrink-0 truncate text-right pr-2">
          {isBeginnerMode ? humanType(variable.type) : variable.type}
        </span>
        {tooltipVis && tooltip && (
          <div className="absolute left-0 top-full z-50 bg-[#252526] border border-[#3c3c3c] rounded p-2 text-[11px] text-[#cccccc] max-w-xs whitespace-normal leading-relaxed"
            style={{ marginTop: 2, marginLeft: 8 + depth * 16 }}>
            {tooltip}
          </div>
        )}
      </div>
      {expanded && rawChildren.length > 1 && (
        <CollectionFilter
          children={rawChildren}
          onFiltered={(f) => setFilteredChildren(f.length === rawChildren.length ? null : f)}
        />
      )}
      {expanded && children.map((child) => (
        <VariableRow key={child.name} variable={child} depth={depth + 1} isBeginnerMode={isBeginnerMode} />
      ))}
    </>
  )
}

// ── VariablesPanel ────────────────────────────────────────────────────────────

export default function VariablesPanel() {
  const vars           = useDebugStore((s) => s.variables)
  const status         = useDebugStore((s) => s.status)
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)

  const [watchExpr,    setWatchExpr]    = useState('')
  const [watchResults, setWatchResults] = useState<{ expr: string; value: string }[]>([])
  const [replInput,    setReplInput]    = useState('')
  const [replOutput,   setReplOutput]   = useState<{ expr: string; result: string }[]>([])

  const isPaused = status === 'paused'

  const handleWatchSubmit = useCallback(async () => {
    if (!watchExpr.trim() || !isPaused) return
    const result = await invoke(IPC.EVALUATE, { expr: watchExpr })
    setWatchResults(prev => [...prev, { expr: watchExpr, value: typeof result === 'string' ? result : '(no result)' }])
    setWatchExpr('')
  }, [watchExpr, isPaused])

  const handleReplSubmit = useCallback(async () => {
    if (!replInput.trim() || !isPaused) return
    const result = await invoke(IPC.EVALUATE, { expr: replInput })
    setReplOutput(prev => [...prev.slice(-19), { expr: replInput, result: typeof result === 'string' ? result : '(no result)' }])
    setReplInput('')
  }, [replInput, isPaused])

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 px-2 py-1 text-[10px] uppercase tracking-wide text-[#969696] border-b border-[#3c3c3c] shrink-0">
        <span className="w-3 shrink-0" /><span className="w-28 shrink-0">Name</span>
        <span className="flex-1">Value</span><span className="w-28 shrink-0 text-right pr-2">Type</span>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {vars.length === 0
          ? <div className="p-3 text-xs text-[#555]">{status === 'idle' ? 'Launch a debug session to see variables' : 'No variables in scope'}</div>
          : vars.map((v) => <VariableRow key={v.name} variable={v} isBeginnerMode={isBeginnerMode} />)
        }
        {watchResults.length > 0 && (
          <div className="border-t border-[#3c3c3c] mt-1">
            <div className="px-2 py-0.5 text-[9px] uppercase tracking-wide text-[#4ec9b0]">Watch</div>
            {watchResults.map((w, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-0.5 text-xs font-mono text-[#cccccc] hover:bg-[#2a2d2e]">
                <span className="text-[#9cdcfe] w-28 shrink-0 truncate">{w.expr}</span>
                <span className="flex-1 truncate text-[#dcdcaa]">{w.value}</span>
                <button onClick={() => setWatchResults(p => p.filter((_, j) => j !== i))} className="text-[#555] hover:text-red-400 text-[10px] shrink-0">✕</button>
              </div>
            ))}
          </div>
        )}
        {replOutput.length > 0 && (
          <div className="border-t border-[#3c3c3c] mt-1">
            <div className="px-2 py-0.5 text-[9px] uppercase tracking-wide text-[#75beff]">REPL</div>
            {replOutput.map((r, i) => (
              <div key={i} className="px-3 py-0.5 text-xs font-mono">
                <span className="text-[#969696]">&gt; {r.expr}</span>
                <div className="text-[#4ec9b0] pl-2">{r.result}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-[#3c3c3c] px-2 py-1 shrink-0">
        <input className="w-full bg-[#3c3c3c] text-xs text-white placeholder:text-[#555] px-2 py-1 rounded outline-none focus:ring-1 focus:ring-yellow-500 font-mono disabled:opacity-40"
          placeholder={isPaused ? 'Watch expression, Enter to add' : 'Watch (pause first)'}
          value={watchExpr} onChange={e => setWatchExpr(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleWatchSubmit() }} disabled={!isPaused} />
      </div>
      <div className="border-t border-[#3c3c3c] px-2 py-1 shrink-0">
        <input className="w-full bg-[#2d2d2d] text-xs text-white placeholder:text-[#555] px-2 py-1 rounded outline-none focus:ring-1 focus:ring-blue-500 font-mono disabled:opacity-40"
          placeholder={isPaused ? '> evaluate expression' : 'REPL (pause first)'}
          value={replInput} onChange={e => setReplInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleReplSubmit() }} disabled={!isPaused} />
      </div>
    </div>
  )
}
