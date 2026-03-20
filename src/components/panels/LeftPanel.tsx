// src/components/LeftPanel.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Left panel: Variables tab + Call Stack tab.
// Reads from Zustand (mock data today, live data from Day 3).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { MOCK_VARIABLES, MOCK_STACK_FRAMES, MOCK_THREADS, MOCK_CHILDREN_MAP } from '../../renderer/mockData'
import type { Variable, StackFrame } from '../../shared/types'

// ── Tab bar ───────────────────────────────────────────────────────────────────

type Tab = 'variables' | 'callstack'

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'variables', label: 'Variables' },
    { id: 'callstack', label: 'Call Stack' },
  ]
  return (
    <div className="flex border-b border-[#3c3c3c] shrink-0">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={[
            'px-3 py-1.5 text-xs uppercase tracking-wide transition-colors',
            active === t.id
              ? 'text-white border-b-2 border-blue-500 -mb-px'
              : 'text-[#969696] hover:text-white',
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Variables panel ───────────────────────────────────────────────────────────

function typeColor(type: string): string {
  if (/^(int|short|long|uint|size_t|unsigned)/.test(type)) return 'text-[#b5cea8]'
  if (/^(float|double)/.test(type)) return 'text-[#dcdcaa]'
  if (/^(bool)/.test(type)) return 'text-[#569cd6]'
  if (/^(char \*|std::string|string)/.test(type)) return 'text-[#ce9178]'
  if (/\*/.test(type)) return 'text-[#c586c0]' // pointer
  return 'text-[#9cdcfe]' // object / struct
}

function VariableRow({
  variable,
  depth = 0,
}: {
  variable: Variable
  depth?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = variable.variablesReference > 0
  const children = MOCK_CHILDREN_MAP[variable.variablesReference] ?? []

  const isNull =
    variable.value === '0x0000000000000000' || variable.value === 'nullptr'

  return (
    <>
      <div
        className={[
          'flex items-start gap-1 px-2 py-0.5 hover:bg-[#2a2d2e] cursor-default text-xs font-mono',
          isNull ? 'bg-red-950/20' : '',
        ].join(' ')}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => hasChildren && setExpanded((e) => !e)}
      >
        {/* Expand arrow */}
        <span className="w-3 shrink-0 text-[#969696]">
          {hasChildren ? (expanded ? '▾' : '▸') : ' '}
        </span>

        {/* Name */}
        <span className="text-[#9cdcfe] w-28 shrink-0 truncate">
          {variable.name}
        </span>

        {/* Value */}
        <span
          className={[
            'flex-1 truncate',
            isNull ? 'text-red-400 font-medium' : typeColor(variable.type),
          ].join(' ')}
        >
          {variable.value}
        </span>

        {/* Type */}
        <span className="text-[#4ec9b0] w-28 shrink-0 truncate text-right">
          {variable.type}
        </span>
      </div>

      {/* Children */}
      {expanded &&
        children.map((child) => (
          <VariableRow key={child.name} variable={child} depth={depth + 1} />
        ))}
    </>
  )
}

function VariablesPanel() {
  // Day 3: swap MOCK_VARIABLES for useDebugStore(s => s.variables)
  const liveVars = useDebugStore((s) => s.variables)
  const vars = liveVars.length > 0 ? liveVars : MOCK_VARIABLES

  // Watch expression state
  const [watchInput, setWatchInput] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  const handleGenerateWatch = async () => {
    setSuggestionsLoading(true)
    setSuggestionsOpen(true)
    try {
      if (!globalThis.electronAPI) {
        console.error('Electron API not available')
        setSuggestionsLoading(false)
        return
      }

      const result = await globalThis.electronAPI.invoke('ai:generateWatch', {}) as any
      if (result.success && Array.isArray(result.suggestions)) {
        setSuggestions(result.suggestions)
      } else {
        setSuggestions([])
        console.error('[LeftPanel] AI watch generation failed:', result.error)
      }
    } catch (err: any) {
      console.error('[LeftPanel] handleGenerateWatch failed:', err)
      setSuggestions([])
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const selectSuggestion = (suggestion: string) => {
    setWatchInput(suggestion)
    setSuggestionsOpen(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Column headers */}
      <div className="flex gap-1 px-2 py-1 text-[10px] uppercase tracking-wide text-[#969696] border-b border-[#3c3c3c] shrink-0">
        <span className="w-3 shrink-0" />
        <span className="w-28 shrink-0">Name</span>
        <span className="flex-1">Value</span>
        <span className="w-28 shrink-0 text-right">Type</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {vars.length === 0 ? (
          <div className="p-3 text-xs text-[#969696]">
            No variables — run a debug session
          </div>
        ) : (
          vars.map((v) => <VariableRow key={v.name} variable={v} />)
        )}
      </div>

      {/* Watch input with AI suggestions */}
      <div className="border-t border-[#3c3c3c] px-2 py-1.5 shrink-0">
        <div className="relative">
          <div className="flex gap-1">
            <input
              value={watchInput}
              onChange={(e) => setWatchInput(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setSuggestionsOpen(true)
              }}
              className="flex-1 bg-[#3c3c3c] text-xs text-white placeholder:text-[#969696] px-2 py-1 rounded outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Watch expression"
            />
            <button
              onClick={handleGenerateWatch}
              disabled={suggestionsLoading}
              title="Generate watch expressions with AI"
              className={[
                'px-2 py-1 text-xs rounded font-medium transition-colors',
                suggestionsLoading
                  ? 'bg-[#3c3c3c] text-[#888] cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700',
              ].join(' ')}
            >
              {suggestionsLoading ? '⏳' : '✨'}
            </button>
          </div>

          {/* Suggestions dropdown */}
          {suggestionsOpen && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#252526] border border-[#3c3c3c] rounded shadow-lg z-10">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => selectSuggestion(suggestion)}
                  className="w-full text-left px-2 py-1 text-xs text-[#e0e0e0] hover:bg-[#3c3c3c] transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Call stack panel ──────────────────────────────────────────────────────────

function CallStackPanel() {
  const [activeFrame, setActiveFrame] = useState(0)
  // Day 3: swap MOCK_STACK_FRAMES for useDebugStore(s => s.stackFrames)
  const liveFrames = useDebugStore((s) => s.stackFrames)
  const frames: StackFrame[] = liveFrames.length > 0 ? liveFrames : MOCK_STACK_FRAMES

  // Day 3: swap for useDebugStore(s => s.threads)
  const liveThreads = useDebugStore((s) => s.threads)
  const threads = liveThreads.length > 0 ? liveThreads : MOCK_THREADS

  function shortFile(path: string) {
    const parts = path.split('/')
    return parts.slice(-2).join('/')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Thread selector */}
      <div className="px-2 py-1.5 border-b border-[#3c3c3c] shrink-0">
        <select className="w-full bg-[#3c3c3c] text-xs text-white px-2 py-1 rounded outline-none focus:ring-1 focus:ring-blue-500">
          {threads.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} — {t.status}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {frames.length === 0 ? (
          <div className="p-3 text-xs text-[#969696]">
            Call stack appears when paused
          </div>
        ) : (
          frames.map((frame) => (
            <div
              key={frame.id}
              onClick={() => setActiveFrame(frame.id)}
              className={[
                'px-3 py-2 cursor-pointer hover:bg-[#2a2d2e] border-b border-[#2d2d2d]',
                activeFrame === frame.id ? 'bg-[#094771]' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <span className="text-[#969696] text-[10px] w-4 shrink-0">
                  #{frame.id}
                </span>
                <span className="text-[#dcdcaa] text-xs font-mono truncate">
                  {frame.name}
                </span>
              </div>
              <div className="text-[#969696] text-[10px] font-mono mt-0.5 ml-6 truncate">
                {shortFile(frame.file)}:{frame.line}
              </div>
            </div>
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
        {activeTab === 'variables' ? <VariablesPanel /> : <CallStackPanel />}
      </div>
    </div>
  )
}