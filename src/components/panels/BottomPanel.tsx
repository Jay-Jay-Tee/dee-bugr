// src/components/BottomPanel.tsx
// Day 7: Console + History Timeline + Memory View tabs

import { useEffect, useRef, useState, useMemo } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import AIFixPanel from './AIFixPanel'
import type { HistoryEntry } from '../../shared/types'

// ── Tab bar ───────────────────────────────────────────────────────────────────

type Tab = 'console' | 'history' | 'memory' | 'aifix'

const TABS: { id: Tab; label: string }[] = [
  { id: 'console', label: 'Console' },
  { id: 'history', label: 'History' },
  { id: 'memory',  label: 'Memory'  },
  { id: 'aifix',   label: 'AI Fix'  },
]

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex border-b border-[#3c3c3c] shrink-0">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={[
            'px-3 py-1 text-[10px] uppercase tracking-wide transition-colors',
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

// ── Console tab ───────────────────────────────────────────────────────────────

function LogLine({ text, category }: { readonly text: string; readonly category: string }) {
  const color =
    category === 'stderr' ? 'text-red-400' :
    category === 'debug'  ? 'text-yellow-400' :
    'text-[#cccccc]'
  return (
    <div className={`font-mono text-xs whitespace-pre-wrap leading-5 ${color}`}>{text}</div>
  )
}

function ConsoleTab() {
  const outputLog    = useDebugStore((s) => s.outputLog)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [outputLog])

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
      {outputLog.length === 0
        ? <div className="text-[#555] text-xs pt-1">No output yet</div>
        : outputLog.map((line, i) => <LogLine key={i} text={line.text} category={line.category} />)
      }
    </div>
  )
}

// ── History timeline tab ──────────────────────────────────────────────────────
// Simple chart: plots selected variable value over execution steps.
// Pure CSS — no Chart.js dependency needed for this basic version.

function HistoryTab() {
  const history     = useDebugStore((s) => s.executionHistory)
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)
  const [selectedVar, setSelectedVar] = useState<string>('')

  // Collect all variable names seen across history
  const varNames = useMemo(() => {
    const names = new Set<string>()
    for (const entry of history) {
      Object.keys(entry.variables).forEach(n => names.add(n))
    }
    return [...names].sort()
  }, [history])

  // Auto-select first var
  useEffect(() => {
    if (!selectedVar && varNames.length > 0) setSelectedVar(varNames[0])
  }, [varNames, selectedVar])

  // Data points for selected variable
  const points = useMemo(() => {
    return history.map(entry => ({
      step:    entry.step,
      file:    entry.file,
      line:    entry.line,
      value:   entry.variables[selectedVar]?.value ?? '—',
      changed: entry.variables[selectedVar]?.changed ?? false,
    }))
  }, [history, selectedVar])

  if (history.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#555] text-xs">
        {isBeginnerMode
          ? 'Run your program and step through it — variable history will appear here.'
          : 'No execution history yet. Launch a debug session and step.'}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-2 gap-2">
      {/* Variable selector */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-[#969696] uppercase tracking-wide">Variable:</span>
        <select
          value={selectedVar}
          onChange={e => setSelectedVar(e.target.value)}
          className="bg-[#3c3c3c] text-xs text-[#cccccc] px-2 py-0.5 rounded outline-none"
        >
          {varNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="text-[10px] text-[#555]">{points.length} steps recorded</span>
      </div>

      {/* Timeline rows */}
      <div className="flex-1 overflow-y-auto space-y-0.5">
        {points.map((p) => (
          <div
            key={p.step}
            className={[
              'flex items-center gap-3 px-2 py-0.5 rounded text-xs font-mono',
              p.changed ? 'bg-amber-900/30 text-amber-300' : 'text-[#969696]',
            ].join(' ')}
          >
            <span className="w-12 shrink-0 text-[#555]">step {p.step}</span>
            <span className="w-6 shrink-0 text-center">{p.changed ? '↑' : ' '}</span>
            <span className="flex-1 truncate">{p.value}</span>
            <span className="text-[10px] text-[#444] truncate">
              {p.file.split('/').pop()}:{p.line}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Memory view tab ───────────────────────────────────────────────────────────
// Renders the raw memory bytes from Zustand as a hex grid.

const BYTES_PER_ROW = 16

function MemoryTab() {
  const memoryBytes    = useDebugStore((s) => s.memoryBytes)
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)

  const bytes: number[] = useMemo(() => {
    if (!memoryBytes) return []
    try {
      const bin = atob(memoryBytes)
      return Array.from(bin, c => c.charCodeAt(0))
    } catch {
      return []
    }
  }, [memoryBytes])

  if (isBeginnerMode) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#555] text-xs text-center px-4">
        Memory view is hidden in Beginner mode.<br />
        Switch to Expert mode to see the raw hex dump.
      </div>
    )
  }

  if (bytes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#555] text-xs">
        No memory data. Right-click a variable in Expert mode → Read Memory.
      </div>
    )
  }

  const rows: number[][] = []
  for (let i = 0; i < bytes.length; i += BYTES_PER_ROW) {
    rows.push(bytes.slice(i, i + BYTES_PER_ROW))
  }

  return (
    <div className="flex-1 overflow-auto p-2 font-mono text-[11px]">
      <div className="text-[#555] mb-1 flex gap-2">
        <span className="w-20">Address</span>
        <span>{'00 01 02 03 04 05 06 07  08 09 0a 0b 0c 0d 0e 0f'}</span>
        <span className="ml-2">ASCII</span>
      </div>
      {rows.map((row, rowIdx) => {
        const addr = (rowIdx * BYTES_PER_ROW).toString(16).padStart(8, '0')
        const hex  = row.map(b => b.toString(16).padStart(2, '0'))
        const left  = hex.slice(0, 8).join(' ')
        const right = hex.slice(8).join(' ')
        const ascii = row.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('')
        return (
          <div key={rowIdx} className="flex gap-3 hover:bg-[#2a2a2a] px-1 rounded">
            <span className="text-[#569cd6] w-20 shrink-0">{addr}</span>
            <span className="text-[#9cdcfe]">{left.padEnd(23)}</span>
            <span className="text-[#9cdcfe]">{right.padEnd(23)}</span>
            <span className="text-[#ce9178] ml-2">{ascii}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function BottomPanel() {
  const [tab, setTab] = useState<Tab>('console')

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e] border-t border-[#3c3c3c]">
      <TabBar active={tab} onChange={setTab} />
      {tab === 'console' && <ConsoleTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'memory'  && <MemoryTab  />}
      {tab === 'aifix'   && <AIFixPanel />}
    </div>
  )
}
