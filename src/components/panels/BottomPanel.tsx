// src/components/panels/BottomPanel.tsx
// Three tabs: Console (output log), History (P3 delivers), Memory (hex view).
// Beginner mode: Memory tab hidden.

import { useState, useEffect, useRef } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import MemoryPanel from './MemoryPanel'

// ── Log line ──────────────────────────────────────────────────────────────────

function LogLine({ text, category }: { readonly text: string; readonly category: string }) {
  const color =
    category === 'stderr' ? 'text-red-400' :
    category === 'debug'  ? 'text-yellow-400' :
    'text-[#cccccc]'
  return (
    <div className={`font-mono text-xs whitespace-pre-wrap leading-5 ${color}`}>
      {text}
    </div>
  )
}

// ── Console tab ───────────────────────────────────────────────────────────────

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
        : outputLog.map((line, i) => (
            <LogLine key={i} text={line.text} category={line.category} />
          ))
      }
    </div>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type Tab = 'console' | 'history' | 'memory'

interface TabBarProps {
  active:        Tab
  onChange:      (t: Tab) => void
  hideMemory:    boolean
}

function TabBar({ active, onChange, hideMemory }: Readonly<TabBarProps>) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'console', label: 'Console' },
    { id: 'history', label: 'History' },
    ...(!hideMemory ? [{ id: 'memory' as Tab, label: 'Memory' }] : []),
  ]
  return (
    <div className="flex border-b border-[#3c3c3c] shrink-0">
      {tabs.map((t) => (
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

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function BottomPanel() {
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)
  const [activeTab, setActiveTab] = useState<Tab>('console')

  // If beginner mode hides memory and user was on it, fall back to console
  const handleChange = (t: Tab) => {
    if (t === 'memory' && isBeginnerMode) return
    setActiveTab(t)
  }

  if (activeTab === 'memory' && isBeginnerMode) {
    setActiveTab('console')
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e] border-t border-[#3c3c3c]">
      <TabBar active={activeTab} onChange={handleChange} hideMemory={isBeginnerMode} />
      {activeTab === 'console' && <ConsoleTab />}
      {activeTab === 'history' && (
        <div className="flex-1 flex items-center justify-center text-[#555] text-xs">
          Variable history timeline — P3 delivers this component
        </div>
      )}
      {activeTab === 'memory' && <MemoryPanel />}
    </div>
  )
}
