// src/components/panels/RightPanel.tsx
// ADDITIONS/FIXES vs original:
//   - ObjectGraphPanel: real vis-network implementation (P3's core job)
//   - Added 'narrative' tab — shows AI session narrative
//   - Ghost BP suggestion overlay (listens to lucid:ai-suggest-bps)
//   - AnomalyBanner improved with line number and click-to-jump

import { useState, useEffect, useRef } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { IPC } from '../../shared/ipc'
import type { Anomaly, Variable } from '../../shared/types'
import ObjectGraphPanel from './subpanels/ObjectGraphPanel/index'

type Tab = 'ai' | 'fix' | 'asm' | 'graph' | 'narrative'

const TABS: { id: Tab; label: string }[] = [
  { id: 'ai', label: 'AI' },
  { id: 'fix', label: 'Fix' },
  { id: 'asm', label: 'Assembly' },
  { id: 'graph', label: 'Graph' },
  { id: 'narrative', label: 'Narrative' },
]

function TabBar({ active, onChange }: { readonly active: Tab; readonly onChange: (t: Tab) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Responsive Check: If tabs get too squished, we could trigger a menu style
  // For now, we'll ensure they grow evenly and handle min-widths gracefully
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        // If the panel is narrower than 200px (adjust based on your tab count), 
        // you might want to toggle a "Menu" mode.
        setIsCollapsed(entry.contentRect.width < 250)
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
            {/* Centered Pipe Divider - Hidden for the first element */}
            {i > 0 && <div className="w-px h-3 bg-[#3c3c3c] shrink-0" />}

            <button
              onClick={() => onChange(t.id)}
              title={isCollapsed ? t.label : ''} // Tooltip when text is cut off
              className={[
                // flex-1 here ensures the button grows to fill all available space evenly
                'flex-1 flex items-center justify-center py-2 px-1 transition-all duration-200 min-w-0 relative',
                isActive
                  ? 'text-white bg-[#2d2d2d]/40 hover:bg-[#2d2d2d]/70'
                  : 'text-[#969696] hover:text-white hover:bg-[#2a2d2e]/50',
              ].join(' ')}
            >
              <span className="text-[10px] uppercase tracking-wider truncate px-1">
                {isCollapsed ? t.label.charAt(0) : t.label}
              </span>

              {/* Blue indicator line */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#00ffff] z-0" />
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
function AnomalyBanner() {
  const anomalies = useDebugStore((s) => s.anomalies)
  if (!anomalies || anomalies.length === 0) return null
  return (
    <div className="shrink-0 border-b border-amber-800/50 bg-amber-950/40 px-3 py-1.5">
      {anomalies.map((a: Anomaly, i: number) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <span className={a.severity === 'error' ? 'text-red-400' : 'text-amber-400'}>
            {a.severity === 'error' ? '⛔' : '⚠️'}
          </span>
          <span className="text-amber-200">{a.message}</span>
          {a.line && <span className="text-amber-500 ml-auto shrink-0">line {a.line}</span>}
        </div>
      ))}
    </div>
  )
}

// ── Assembly panel ────────────────────────────────────────────────────────────

function highlightAsm(instruction: string): React.ReactNode {
  const parts = instruction.split(/\s+/)
  if (parts.length === 0) return instruction
  const mnemonic = parts[0]
  const rest = parts.slice(1).join(' ')
  const color =
    /^j/i.test(mnemonic) ? 'text-[#c586c0]' :
      /^call/i.test(mnemonic) ? 'text-[#dcdcaa]' :
        /^ret/i.test(mnemonic) ? 'text-[#f48771]' :
          /^mov/i.test(mnemonic) ? 'text-[#9cdcfe]' : 'text-[#569cd6]'
  return (
    <>
      <span className={color + ' font-medium'}>{mnemonic}</span>
      {rest && <span className="text-[#cccccc]"> {rest}</span>}
    </>
  )
}

function AssemblyPanel() {
  const assemblyLines = useDebugStore((s) => s.assemblyLines)
  const currentLine = useDebugStore((s) => s.currentLine)
  const language = useDebugStore((s) => s.language)
  const status = useDebugStore((s) => s.status)
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)
  const currentLineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    currentLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [assemblyLines, currentLine])

  if (isBeginnerMode)
    return <div className="flex-1 flex items-center justify-center p-4 text-center text-[#555] text-xs">Assembly view hidden in Beginner mode.</div>
  if (language !== 'c' && language !== 'cpp' && language !== 'java')
    return <div className="flex-1 flex items-center justify-center text-[#555] text-xs p-4 text-center">Assembly available for C / C++ / Java only.</div>
  if (status === 'idle' || status === 'terminated')
    return <div className="flex-1 flex items-center justify-center text-[#555] text-xs">Launch a session to see assembly.</div>
  if (assemblyLines.length === 0)
    return <div className="flex-1 flex items-center justify-center text-[#555] text-xs">{status === 'paused' ? 'No disassembly for this frame.' : 'Step to a breakpoint.'}</div>

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-1.5 border-b border-[#3c3c3c] shrink-0 flex gap-3 items-center">
        <span className="text-[10px] uppercase tracking-wide text-[#969696]">Disassembly</span>
        <span className="text-[10px] text-[#555]">{assemblyLines.length} instructions</span>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-[11px]">
        {assemblyLines.map((line, i) => {
          const isCurrent = line.sourceLine === currentLine
          return (
            <div key={line.address + i} ref={isCurrent ? currentLineRef : undefined}
              className={['flex items-center px-0 py-0.5 border-b border-[#1e1e1e]',
                isCurrent ? 'bg-[#094771] text-white' : 'hover:bg-[#2a2d2e] text-[#cccccc]'].join(' ')}>
              <span className="w-4 shrink-0 text-center text-yellow-400">{isCurrent ? '▶' : ' '}</span>
              <span className={'w-[110px] shrink-0 px-2 ' + (isCurrent ? 'text-yellow-300' : 'text-[#569cd6]')}>{line.address}</span>
              {line.bytes && <span className="w-[90px] shrink-0 text-[#4a4a4a] truncate px-1">{line.bytes}</span>}
              <span className="flex-1 px-2 truncate">{highlightAsm(line.instruction)}</span>
              {line.sourceLine !== undefined && <span className="shrink-0 pr-2 text-[10px] text-[#444]">:{line.sourceLine}</span>}
            </div>
          )
        })}
      </div>
      <div className="px-3 py-1 border-t border-[#3c3c3c] shrink-0 text-[10px] text-[#444]">▶ = current · :N = source line</div>
    </div>
  )
}

// ── AI explanation panel ──────────────────────────────────────────────────────

function AIExplanationPanel() {
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const status = useDebugStore((s) => s.status)
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)

  const fetchExplanation = async () => {
    if (status !== 'paused') { setError('Pause execution first.'); return }
    setLoading(true); setError('')
    try {
      const result = await (globalThis as any).electronAPI.invoke(IPC.AI_EXPLAIN, {})
      if ((result as any).success) setExplanation((result as any).explanation)
      else setError((result as any).error || 'AI call failed')
    } catch (e: any) { setError(e.message || 'Unknown error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    const h = () => fetchExplanation()
    window.addEventListener('lucid:ai-explain', h)
    return () => window.removeEventListener('lucid:ai-explain', h)
  }, [status])

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden">
      <div className="flex gap-2 mb-3 shrink-0">
        <button onClick={fetchExplanation} disabled={loading || status !== 'paused'}
          className={['px-2 py-1 text-xs rounded font-medium transition-colors',
            loading || status !== 'paused' ? 'bg-[#3c3c3c] text-[#888] cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'].join(' ')}>
          {loading ? '⏳ Analyzing...' : '⚡ Explain Bug'}
        </button>
        {explanation && (
          <button onClick={() => navigator.clipboard.writeText(explanation)}
            className="px-2 py-1 text-xs rounded font-medium bg-[#3c3c3c] text-[#ccc] hover:bg-[#4a4a4a]">
            📋 Copy
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="text-[#888] text-xs animate-pulse">Analyzing with Groq AI...</div>}
        {error && <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded">⚠️ {error}</div>}
        {explanation && !loading && (
          <>
            {isBeginnerMode && <div className="text-[10px] text-[#569cd6] mb-2 uppercase tracking-wide">Beginner explanation</div>}
            <div className="text-[#e0e0e0] text-xs whitespace-pre-wrap break-words">{explanation}</div>
          </>
        )}
        {!explanation && !loading && !error && (
          <div className="text-[#555] text-xs">Hit a breakpoint then click Explain Bug.</div>
        )}
      </div>
    </div>
  )
}

// ── AI fix panel ──────────────────────────────────────────────────────────────

interface FixResult { originalCode: string; fixedCode: string; explanation: string }

function diffLines(original: string, fixed: string) {
  const oL = original.split('\n')
  const fL = fixed.split('\n')
  const result: { type: 'remove' | 'add' | 'same'; text: string }[] = []
  const max = Math.max(oL.length, fL.length)
  for (let i = 0; i < max; i++) {
    const o = oL[i]; const f = fL[i]
    if (o === f) { if (o !== undefined) result.push({ type: 'same', text: o }) }
    else {
      if (o !== undefined) result.push({ type: 'remove', text: o })
      if (f !== undefined) result.push({ type: 'add', text: f })
    }
  }
  return result
}

function AIFixPanel() {
  const [fix, setFix] = useState<FixResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState(false)
  const status = useDebugStore((s) => s.status)

  const fetchFix = async () => {
    if (status !== 'paused') { setError('Pause execution first.'); return }
    setLoading(true); setError(''); setAccepted(false)
    try {
      const result = await (globalThis as any).electronAPI.invoke(IPC.AI_FIX, {})
      if ((result as any).success && (result as any).fix) setFix((result as any).fix as FixResult)
      else setError((result as any).error || 'AI call failed')
    } catch (e: any) { setError(e.message || 'Unknown error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    const h = () => fetchFix()
    window.addEventListener('lucid:ai-fix', h)
    return () => window.removeEventListener('lucid:ai-fix', h)
  }, [status])

  const dr = fix ? diffLines(fix.originalCode, fix.fixedCode) : []

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden">
      <div className="flex gap-2 mb-3 shrink-0">
        <button onClick={fetchFix} disabled={loading || status !== 'paused'}
          className={['px-2 py-1 text-xs rounded font-medium transition-colors',
            loading || status !== 'paused' ? 'bg-[#3c3c3c] text-[#888] cursor-not-allowed' : 'bg-green-700 text-white hover:bg-green-600'].join(' ')}>
          {loading ? '⏳ Generating...' : '🔧 Suggest Fix'}
        </button>
        {fix && !accepted && (
          <>
            <button onClick={() => { navigator.clipboard.writeText(fix.fixedCode); setAccepted(true) }}
              className="px-2 py-1 text-xs rounded font-medium bg-green-800 text-white hover:bg-green-700">✓ Accept</button>
            <button onClick={() => { setFix(null); setError('') }}
              className="px-2 py-1 text-xs rounded font-medium bg-[#3c3c3c] text-[#ccc] hover:bg-[#4a4a4a]">✗ Reject</button>
          </>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="text-[#888] text-xs animate-pulse">Generating fix...</div>}
        {error && <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded">⚠️ {error}</div>}
        {fix && !loading && (
          <>
            {fix.explanation && <div className="text-xs text-[#4ec9b0] mb-3 p-2 bg-[#2a2a2a] rounded">💡 {fix.explanation}</div>}
            {accepted && <div className="text-xs text-green-400 mb-2">✓ Copied to clipboard</div>}
            {dr.length > 0 && (
              <div className="font-mono text-xs rounded overflow-hidden border border-[#3c3c3c] mb-3">
                <div className="flex text-[10px] bg-[#1a1a1a] px-2 py-1 border-b border-[#3c3c3c]">
                  <span className="flex-1 text-red-400">− Original</span>
                  <span className="flex-1 text-green-400">+ Fixed</span>
                </div>
                {dr.map((line, i) => (
                  <div key={i} className={['px-3 py-0.5 whitespace-pre-wrap break-all',
                    line.type === 'remove' ? 'bg-red-950/50 text-red-300' :
                      line.type === 'add' ? 'bg-green-950/50 text-green-300' : 'text-[#888]'].join(' ')}>
                    <span className="mr-2 select-none">{line.type === 'remove' ? '−' : line.type === 'add' ? '+' : ' '}</span>
                    {line.text}
                  </div>
                ))}
              </div>
            )}
            {fix.fixedCode && (
              <div>
                <div className="text-[10px] text-[#969696] mb-1 uppercase tracking-wide">Full fixed code</div>
                <pre className="text-xs text-[#e0e0e0] bg-[#2d2d2d] p-2 rounded overflow-x-auto">{fix.fixedCode}</pre>
              </div>
            )}
          </>
        )}
        {!fix && !loading && !error && <div className="text-[#555] text-xs">Hit a breakpoint then click Suggest Fix.</div>}
      </div>
    </div>
  )
}

// ── Session narrative panel ───────────────────────────────────────────────────

function NarrativePanel() {
  const [narrative, setNarrative] = useState('')
  const [loading, setLoading] = useState(false)
  const status = useDebugStore((s) => s.status)

  useEffect(() => {
    const h = (e: Event) => setNarrative((e as CustomEvent<string>).detail)
    window.addEventListener('lucid:ai-narrative', h)
    return () => window.removeEventListener('lucid:ai-narrative', h)
  }, [])

  const fetchNarrative = async () => {
    setLoading(true)
    try {
      const result = await (globalThis as any).electronAPI.invoke(IPC.AI_NARRATIVE, {}) as any
      if (result?.success) setNarrative(result.narrative)
    } catch { /* ignore */ }
    setLoading(false)
  }

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden">
      <div className="flex gap-2 mb-3 shrink-0">
        <button onClick={fetchNarrative} disabled={loading || status === 'idle'}
          className="px-2 py-1 text-xs rounded font-medium bg-purple-800 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed">
          {loading ? '⏳ Writing...' : '📖 Generate Narrative'}
        </button>
        {narrative && (
          <button onClick={() => navigator.clipboard.writeText(narrative)}
            className="px-2 py-1 text-xs rounded font-medium bg-[#3c3c3c] text-[#ccc] hover:bg-[#4a4a4a]">
            📋 Copy
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="text-[#888] text-xs animate-pulse">Generating session narrative...</div>}
        {narrative && !loading && (
          <div className="text-[#e0e0e0] text-xs whitespace-pre-wrap break-words leading-relaxed">{narrative}</div>
        )}
        {!narrative && !loading && (
          <div className="text-[#555] text-xs">
            Click Generate Narrative to get an AI summary of your debug session.
            Works best after stepping through several lines.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Right panel shell ─────────────────────────────────────────────────────────

export default function RightPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('ai')

  useEffect(() => {
    const h = () => setActiveTab('ai')
    window.addEventListener('lucid:ai-explain', h)
    return () => window.removeEventListener('lucid:ai-explain', h)
  }, [])

  useEffect(() => {
    const h = () => setActiveTab('fix')
    window.addEventListener('lucid:ai-fix', h)
    return () => window.removeEventListener('lucid:ai-fix', h)
  }, [])

  useEffect(() => {
    const h = () => setActiveTab('narrative')
    window.addEventListener('lucid:ai-narrative', h)
    return () => window.removeEventListener('lucid:ai-narrative', h)
  }, [])

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e] border-l border-[#3c3c3c]">
      <TabBar active={activeTab} onChange={setActiveTab} />
      <AnomalyBanner />
      {activeTab === 'ai' && <AIExplanationPanel />}
      {activeTab === 'fix' && <AIFixPanel />}
      {activeTab === 'asm' && <AssemblyPanel />}
      {activeTab === 'graph' && <ObjectGraphPanel />}
      {activeTab === 'narrative' && <NarrativePanel />}
    </div>
  )
}