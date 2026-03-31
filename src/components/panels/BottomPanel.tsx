// src/components/panels/BottomPanel.tsx
// Console + History + Memory + Cinema tabs.
//
// FIXES:
//   1. History tab wrapper now has flex flex-col so VariableHistoryPanel fills it
//   2. Removed dead MemoryTab function (replaced by MemoryPanel subpanel import)
//   3. Removed unused imports (useMemo, MemoryAddressInput, BYTES_PER_ROW)
//   4. ConsoleTab auto-clears on new session

import { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import DebugCinema from './subpanels/DebugCinema'
import VariableHistoryPanel from './subpanels/VariableHistoryPanel/index'
import MemoryPanel from './subpanels/MemoryPanel'

class HistoryErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || 'Unknown history panel error' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[History] Render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 overflow-auto p-3 text-xs text-yellow-300 bg-[#1e1e1e]">
          History panel hit a rendering error and was safely recovered.
          <div className="mt-1 text-[#cccccc]">{this.state.message}</div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type Tab = 'console' | 'history' | 'memory' | 'cinema'

const TABS: { id: Tab; label: string }[] = [
  { id: 'console', label: 'Console' },
  { id: 'history', label: 'History' },
  { id: 'memory',  label: 'Memory'  },
  { id: 'cinema',  label: '🎬 Cinema' },
]

function TabBar({ active, onChange }: { readonly active: Tab; readonly onChange: (t: Tab) => void }) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const obs = new ResizeObserver(([entry]) => {
      setCollapsed(entry.contentRect.width < 180)
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="flex w-full border-b border-[#3c3c3c] shrink-0 bg-[#1e1e1e] overflow-hidden">
      {TABS.map((t, i) => {
        const isActive = active === t.id
        return (
          <div key={t.id} className="flex flex-1 items-center min-w-0">
            {i > 0 && <div className="w-px h-3 bg-[#3c3c3c] shrink-0" />}
            <button
              onClick={() => onChange(t.id)}
              title={t.label}
              className={[
                'flex-1 flex items-center justify-center py-2 transition-all duration-200 min-w-0 relative group',
                isActive
                  ? 'text-white bg-[#2d2d2d]/40'
                  : 'text-[#969696] hover:text-white hover:bg-[#2a2d2e]/50',
              ].join(' ')}
            >
              <span className="text-[12px] uppercase tracking-wider truncate px-1 font-medium">
                {collapsed ? t.label.charAt(0) : t.label}
              </span>
              {isActive && (
                <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
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

// ── Console tab ───────────────────────────────────────────────────────────────

interface OutputLine { text: string; category: string }

function LogLine({ text, category }: { readonly text: string; readonly category: string }) {
  const color =
    category === 'stderr' ? 'text-red-400' :
    category === 'debug'  ? 'text-yellow-400' :
                            'text-[#cccccc]'
  return <div className={`font-mono text-xs whitespace-pre-wrap leading-5 ${color}`}>{text}</div>
}

function ConsoleTab() {
  const outputLog    = useDebugStore((s) => s.outputLog as OutputLine[])
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new output
  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [outputLog])

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
      {outputLog.length === 0
        ? <div className="text-[#555] text-xs pt-1">No output yet. Output from your program will appear here.</div>
        : outputLog.map((line, i) => <LogLine key={i} text={line.text} category={line.category} />)
      }
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
      {/* FIX: flex flex-col required so VariableHistoryPanel's height:100% resolves */}
      {tab === 'history' && <div className="flex flex-col flex-1 overflow-hidden min-h-0"><HistoryErrorBoundary><VariableHistoryPanel /></HistoryErrorBoundary></div>}
      {tab === 'memory'  && <MemoryPanel />}
      {tab === 'cinema'  && <DebugCinema />}
    </div>
  )
}
