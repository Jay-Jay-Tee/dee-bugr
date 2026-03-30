// src/components/panels/LeftPanel.tsx
// FIXES vs original:
//   1. Watch expression input now wired — evaluates via IPC.EVALUATE on Enter
//   2. handleThreadChange uses IPC.SWITCH_THREAD instead of hardcoded string
//   3. REPL/evaluate input added at bottom of variables panel
//   4. AI variable tooltip on hover (beginner mode)

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { MOCK_CHILDREN_MAP } from '../../renderer/mockData'
import { IPC } from '../../shared/ipc'
import type { Variable, StackFrame } from '../../shared/types'
import BreakpointPanel from './BreakpointPanel'
import WatchPanel from './WatchPanel'
import CollectionFilter from './CollectionFilter'

// ── IPC helper ────────────────────────────────────────────────────────────────

type AnyIPC = typeof IPC[keyof typeof IPC]

function invoke(channel: AnyIPC, args?: unknown) {
  const api = (window as Window & {
    electronAPI?: { invoke: (ch: AnyIPC, payload?: unknown) => Promise<unknown> }
  }).electronAPI
  return api?.invoke(channel, args)
    .catch((err: unknown) => console.error(`[IPC] ${channel} failed:`, err))
}

// ── Type guard ────────────────────────────────────────────────────────────────

function isVariableArray(value: unknown): value is Variable[] {
  if (!Array.isArray(value)) return false
  return value.every(
    (v) =>
      typeof v === 'object' &&
      v !== null &&
      typeof (v as Record<string, unknown>)['name'] === 'string' &&
      typeof (v as Record<string, unknown>)['value'] === 'string'
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type Tab = 'variables' | 'callstack' | 'breakpoints' | 'watch'

const TABS: { id: Tab; label: string }[] = [
  { id: 'variables', label: 'Vars' },
  { id: 'callstack', label: 'Stack' },
  { id: 'breakpoints', label: 'BPs' },
  { id: 'watch', label: 'Watch' },
]

function TabBar({ active, onChange }: { readonly active: Tab; readonly onChange: (t: Tab) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Responsive Check: If the Left Panel is dragged very thin
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        // Left panels are often thinner; collapse if under 180px
        setIsCollapsed(entry.contentRect.width < 180)
      }
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex w-full border-b border-[#3c3c3c] shrink-0 bg-[#1e1e1e] overflow-hidden"
    >
      {TABS.map((t, i) => {
        const isActive = active === t.id

        return (
          <div key={t.id} className="flex flex-1 items-center min-w-0">
            {/* Divider - only between items */}
            {i > 0 && <div className="w-px h-3 bg-[#3c3c3c] shrink-0" />}

            <button
              onClick={() => onChange(t.id)}
              title={t.label} // Shows full name on hover even if collapsed
              className={[
                'flex-1 flex items-center justify-center py-2 transition-all duration-200 min-w-0 relative group',
                isActive
                  ? 'text-white bg-[#2d2d2d]/40'
                  : 'text-[#969696] hover:text-white hover:bg-[#2a2d2e]/50',
              ].join(' ')}
            >
              <span className="text-[12px] uppercase tracking-wider truncate px-1 font-medium">
                {isCollapsed ? t.label.charAt(0) : t.label}
              </span>

              {/* Hover highlight for active tab */}
              {isActive && (
                <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}

              {/* Bottom active indicator */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#00ffff]" />
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Variables panel ───────────────────────────────────────────────────────────

function typeColor(type: string): string {
  if (/^(int|short|long|uint|size_t|unsigned)/.test(type)) return 'text-[#b5cea8]'
  if (/^(float|double)/.test(type)) return 'text-[#dcdcaa]'
  if (/^(bool)/.test(type)) return 'text-[#569cd6]'
  if (/^(char \*|std::string|string)/.test(type)) return 'text-[#ce9178]'
  if (/\*/.test(type)) return 'text-[#c586c0]'
  return 'text-[#9cdcfe]'
}

interface VariableRowProps {
  variable: Variable
  depth?: number
  isBeginnerMode?: boolean
}

function VariableRow({ variable, depth = 0, isBeginnerMode = false }: Readonly<VariableRowProps>) {
  const [filteredChildren, setFilteredChildren] = useState<Variable[] | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [liveChildren, setLiveChildren] = useState<Variable[] | null>(null)
  const [tooltip, setTooltip] = useState('')
  const [tooltipVis, setTooltipVis] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const rawChildren = liveChildren ?? MOCK_CHILDREN_MAP[variable.variablesReference] ?? []
  const children = filteredChildren ?? rawChildren
  const hasChildren = variable.variablesReference > 0
  const isNull = variable.value === '0x0000000000000000' || variable.value === 'nullptr' || variable.value === '0x0'

  const handleExpand = useCallback(async () => {
    if (!hasChildren) return
    if (!expanded && liveChildren === null) {
      const result = await invoke(IPC.GET_VARIABLES, { variablesReference: variable.variablesReference })
      if (isVariableArray(result)) setLiveChildren(result)
    }
    setExpanded((e) => !e)
  }, [hasChildren, expanded, liveChildren, variable.variablesReference])

  // AI tooltip on hover (beginner mode)
  const handleMouseEnter = useCallback(() => {
    if (!isBeginnerMode) return
    hoverTimer.current = setTimeout(async () => {
      try {
        const result = await invoke(IPC.AI_EXPLAIN_VAR, { varName: variable.name }) as any
        if (result?.success && result.explanation) {
          setTooltip(result.explanation)
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
        className={[
          'relative flex items-start gap-1 py-0.5 hover:bg-[#2a2d2e] cursor-default text-xs font-mono',
          isNull ? 'bg-red-950/20' : '',
        ].join(' ')}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleExpand}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="w-3 shrink-0 text-[#969696]">
          {hasChildren ? (expanded ? '▾' : '▸') : ' '}
        </span>
        <span className="text-[#9cdcfe] w-28 shrink-0 truncate">{variable.name}</span>
        <span className={['flex-1 truncate', isNull ? 'text-red-400 font-medium' : typeColor(variable.type)].join(' ')}>
          {variable.value}
        </span>
        <span className="text-[#4ec9b0] w-28 shrink-0 truncate text-right pr-2">
          {isBeginnerMode ? humanType(variable.type) : variable.type}
        </span>

        {/* AI tooltip popover */}
        {tooltipVis && tooltip && (
          <div className="absolute left-0 top-full z-50 bg-[#252526] border border-[#3c3c3c] rounded shadow-lg p-2 text-[11px] text-[#cccccc] max-w-xs whitespace-normal leading-relaxed"
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

// Beginner mode: translate raw C types to plain English
function humanType(type: string): string {
  if (/^(int|short|long|int32|int64)/.test(type)) return 'whole number'
  if (/^(float|double)/.test(type)) return 'decimal'
  if (/^bool/.test(type)) return 'true/false'
  if (/^(char \*|std::string|string|str)/.test(type)) return 'text'
  if (/\*/.test(type)) return 'pointer'
  return type
}

function VariablesPanel() {
  const vars = useDebugStore((s) => s.variables)
  const status = useDebugStore((s) => s.status)
  const watchValues = useDebugStore((s) => s.watchValues)
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)

  // Watch expression state
  const [watchExpr, setWatchExpr] = useState('')
  const [watchResults, setWatchResults] = useState<{ expr: string; value: string }[]>([])

  // REPL state
  const [replInput, setReplInput] = useState('')
  const [replOutput, setReplOutput] = useState<{ expr: string; result: string }[]>([])

  const isPaused = status === 'paused'

  // FIX: wire watch expression — evaluate on Enter
  const handleWatchSubmit = useCallback(async () => {
    if (!watchExpr.trim() || !isPaused) return
    const result = await invoke(IPC.EVALUATE, { expr: watchExpr }) as string | undefined
    const value = typeof result === 'string' ? result : '(no result)'
    setWatchResults(prev => [...prev, { expr: watchExpr, value }])
    setWatchExpr('')
  }, [watchExpr, isPaused])

  // FIX: wire REPL evaluate on Enter
  const handleReplSubmit = useCallback(async () => {
    if (!replInput.trim() || !isPaused) return
    const result = await invoke(IPC.EVALUATE, { expr: replInput }) as string | undefined
    const value = typeof result === 'string' ? result : '(no result)'
    setReplOutput(prev => [...prev.slice(-19), { expr: replInput, result: value }])
    setReplInput('')
  }, [replInput, isPaused])

  return (
    <div className="flex flex-col h-full">
      {/* Header row */}
      <div className="flex gap-1 px-2 py-1 text-[10px] uppercase tracking-wide text-[#969696] border-b border-[#3c3c3c] shrink-0">
        <span className="w-3 shrink-0" />
        <span className="w-28 shrink-0">Name</span>
        <span className="flex-1">Value</span>
        <span className="w-28 shrink-0 text-right pr-2">Type</span>
      </div>

      {/* Variable list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {vars.length === 0 ? (
          <div className="p-3 text-xs text-[#555]">
            {status === 'idle' ? 'Launch a debug session to see variables' : 'No variables in scope'}
          </div>
        ) : (
          vars.map((v) => <VariableRow key={v.name} variable={v} isBeginnerMode={isBeginnerMode} />)
        )}

        {/* Watch results */}
        {watchResults.length > 0 && (
          <div className="border-t border-[#3c3c3c] mt-1">
            <div className="px-2 py-0.5 text-[9px] uppercase tracking-wide text-[#4ec9b0]">Watch</div>
            {watchResults.map((w, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-0.5 text-xs font-mono text-[#cccccc] hover:bg-[#2a2d2e]">
                <span className="text-[#9cdcfe] w-28 shrink-0 truncate">{w.expr}</span>
                <span className="flex-1 truncate text-[#dcdcaa]">{w.value}</span>
                <button onClick={() => setWatchResults(p => p.filter((_, j) => j !== i))}
                  className="text-[#555] hover:text-red-400 text-[10px] shrink-0">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* REPL history */}
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

      {/* Watch input */}
      <div className="border-t border-[#3c3c3c] px-2 py-1 shrink-0">
        <input
          className="w-full bg-[#3c3c3c] text-xs text-white placeholder:text-[#555] px-2 py-1 rounded outline-none focus:ring-1 focus:ring-yellow-500 font-mono disabled:opacity-40"
          placeholder={isPaused ? 'Watch expression, Enter to add' : 'Watch (pause first)'}
          value={watchExpr}
          onChange={e => setWatchExpr(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleWatchSubmit() }}
          disabled={!isPaused}
        />
      </div>

      {/* REPL input */}
      <div className="border-t border-[#3c3c3c] px-2 py-1 shrink-0">
        <input
          className="w-full bg-[#2d2d2d] text-xs text-white placeholder:text-[#555] px-2 py-1 rounded outline-none focus:ring-1 focus:ring-blue-500 font-mono disabled:opacity-40"
          placeholder={isPaused ? '> evaluate expression' : 'REPL (pause first)'}
          value={replInput}
          onChange={e => setReplInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleReplSubmit() }}
          disabled={!isPaused}
        />
      </div>
    </div>
  )
}

// ── Call stack panel ──────────────────────────────────────────────────────────

function shortFile(filePath: string): string {
  return filePath.split('/').slice(-2).join('/')
}

function CallStackPanel() {
  const frames = useDebugStore((s) => s.stackFrames)
  const threads = useDebugStore((s) => s.threads)
  const status = useDebugStore((s) => s.status)
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)
  const [activeFrame, setActiveFrame] = useState(0)

  const handleFrameClick = useCallback((frame: StackFrame) => {
    setActiveFrame(frame.id)
    invoke(IPC.SWITCH_FRAME, { frameId: frame.id })
  }, [])

  // FIX: use IPC.SWITCH_THREAD constant instead of hardcoded string
  const handleThreadChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const threadId = Number(e.target.value)
    if (!isNaN(threadId)) {
      invoke(IPC.SWITCH_THREAD, { threadId })
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-1.5 border-b border-[#3c3c3c] shrink-0">
        <select
          onChange={handleThreadChange}
          className="w-full bg-[#3c3c3c] text-xs text-white px-2 py-1 rounded outline-none focus:ring-1 focus:ring-blue-500"
        >
          {threads.length === 0 ? (
            <option>No threads</option>
          ) : (
            threads.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — {t.status}</option>
            ))
          )}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto">
        {frames.length === 0 ? (
          <div className="p-3 text-xs text-[#555]">
            {status === 'idle' ? 'Launch a debug session to see call stack' : 'Call stack appears when paused'}
          </div>
        ) : (
          frames.map((frame) => (
            <button
              key={frame.id}
              onClick={() => handleFrameClick(frame)}
              className={[
                'w-full text-left px-3 py-2 cursor-pointer hover:bg-[#2a2d2e] border-b border-[#2d2d2d]',
                activeFrame === frame.id ? 'bg-[#094771]' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                {!isBeginnerMode && (
                  <span className="text-[#969696] text-[10px] w-4 shrink-0">#{frame.id}</span>
                )}
                <span className="text-[#dcdcaa] text-xs font-mono truncate">{frame.name}</span>
              </div>
              <div className="text-[#969696] text-[10px] font-mono mt-0.5 ml-6 truncate">
                {isBeginnerMode
                  ? `${frame.file.split('/').pop()}  line ${frame.line}`
                  : `${shortFile(frame.file)}:${frame.line}`}
              </div>
              {isBeginnerMode && !!frame.variableCount && frame.variableCount > 0 && (
                <div className="text-[10px] text-[#569cd6] ml-6 mt-0.5">
                  {frame.variableCount} local {frame.variableCount === 1 ? 'variable' : 'variables'}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ── Left panel shell ──────────────────────────────────────────────────────────

export default function LeftPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('variables')

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] border-r border-[#3c3c3c]">
      <TabBar active={activeTab} onChange={setActiveTab} />
      <div className="flex-1 overflow-hidden">
        {activeTab === 'variables' && <VariablesPanel />}
        {activeTab === 'callstack' && <CallStackPanel />}
        {activeTab === 'breakpoints' && <BreakpointPanel />}
        {activeTab === 'watch' && <WatchPanel />}
      </div>
    </div>
  )
}