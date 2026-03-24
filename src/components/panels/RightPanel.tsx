import { useState, useEffect, useRef } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { IPC } from '../../shared/ipc'
import type { Anomaly } from '../../shared/types'
import AILogBreakpointsPanel from './AILogBreakpointsPanel'

type Tab = 'ai' | 'fix' | 'asm' | 'graph'

const TABS: { id: Tab; label: string }[] = [
  { id: 'ai',    label: 'AI'       },
  { id: 'fix',   label: 'Fix'      },
  { id: 'asm',   label: 'Assembly' },
  { id: 'graph', label: 'Graph'    },
]

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex border-b border-[#3c3c3c] shrink-0">
      {TABS.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={['px-3 py-1.5 text-xs uppercase tracking-wide transition-colors',
            active === t.id ? 'text-white border-b-2 border-blue-500 -mb-px' : 'text-[#969696] hover:text-white'].join(' ')}>
          {t.label}
        </button>
      ))}
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
        </div>
      ))}
    </div>
  )
}

function highlightAsm(instruction: string): React.ReactNode {
  const parts = instruction.split(/\s+/)
  if (parts.length === 0) return instruction
  const mnemonic = parts[0]
  const rest = parts.slice(1).join(' ')
  const color =
    /^j/i.test(mnemonic)    ? 'text-[#c586c0]' :
    /^call/i.test(mnemonic) ? 'text-[#dcdcaa]' :
    /^ret/i.test(mnemonic)  ? 'text-[#f48771]' :
    /^mov/i.test(mnemonic)  ? 'text-[#9cdcfe]' : 'text-[#569cd6]'
  return (
    <>
      <span className={color + ' font-medium'}>{mnemonic}</span>
      {rest && <span className="text-[#cccccc]"> {rest}</span>}
    </>
  )
}

function AssemblyPanel() {
  const assemblyLines  = useDebugStore((s) => s.assemblyLines)
  const currentLine    = useDebugStore((s) => s.currentLine)
  const language       = useDebugStore((s) => s.language)
  const status         = useDebugStore((s) => s.status)
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

function AIExplanationPanel() {
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const status         = useDebugStore((s) => s.status)
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
        {error && (
          <div className="text-xs p-2 bg-red-900/20 rounded border border-red-800/50">
            <div className="text-red-400 mb-2">⚠️ {error}</div>
            <button
              onClick={fetchExplanation}
              className="px-2 py-1 text-[10px] rounded bg-red-800/40 text-red-200 hover:bg-red-700/50"
            >
              Retry
            </button>
          </div>
        )}
        {explanation && !loading && (
          <>
            {isBeginnerMode && <div className="text-[10px] text-[#569cd6] mb-2 uppercase tracking-wide">Beginner explanation</div>}
            <div className="text-[#e0e0e0] text-xs whitespace-pre-wrap break-words">{explanation}</div>
          </>
        )}
        {!explanation && !loading && !error && (
          <div className="text-[#555] text-xs">Hit a breakpoint then click Explain Bug.</div>
        )}

        <AILogBreakpointsPanel />
      </div>
    </div>
  )
}

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
      if (f !== undefined) result.push({ type: 'add',    text: f })
    }
  }
  return result
}

function AIFixPanel() {
  const [fix, setFix]           = useState<FixResult | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
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
        {error && (
          <div className="text-xs p-2 bg-red-900/20 rounded border border-red-800/50">
            <div className="text-red-400 mb-2">⚠️ {error}</div>
            <button
              onClick={fetchFix}
              className="px-2 py-1 text-[10px] rounded bg-red-800/40 text-red-200 hover:bg-red-700/50"
            >
              Retry
            </button>
          </div>
        )}
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
                    line.type === 'add'    ? 'bg-green-950/50 text-green-300' : 'text-[#888]'].join(' ')}>
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

function ObjectGraphPanel() {
  const variables      = useDebugStore((s) => s.variables)
  const status         = useDebugStore((s) => s.status)
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)
  const objectVars     = variables.filter((v) => v.variablesReference > 0)

  if (status === 'idle' || status === 'terminated')
    return <div className="flex-1 flex items-center justify-center text-[#555] text-xs">Launch a session to visualize objects.</div>
  if (objectVars.length === 0)
    return (
      <div className="flex-1 flex items-center justify-center text-[#555] text-xs text-center px-4">
        No objects yet.<br /><span className="text-[#444] mt-1 block">Step to a frame with object variables.</span>
      </div>
    )
  return (
    <div className="flex-1 flex flex-col overflow-hidden p-3">
      <div className="text-[10px] text-[#969696] uppercase tracking-wide mb-2 shrink-0">Objects ({objectVars.length})</div>
      <div className="flex-1 overflow-y-auto space-y-1">
        {objectVars.map((v) => (
          <div key={v.name} className="flex items-center gap-2 p-2 rounded bg-[#2a2a2a] hover:bg-[#333] cursor-pointer text-xs">
            <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
            <span className="text-[#9cdcfe] font-medium">{v.name}</span>
            <span className="text-[#555]">{v.type}</span>
            <span className="text-[#888] truncate">{v.value}</span>
            {v.memoryReference && !isBeginnerMode && (
              <span className="text-[10px] text-[#444] ml-auto shrink-0 font-mono">{v.memoryReference}</span>
            )}
          </div>
        ))}
      </div>
      <div className="text-[10px] text-[#444] mt-2 shrink-0">P3 wires D3/vis-network graph here.</div>
    </div>
  )
}

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

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e] border-l border-[#3c3c3c]">
      <TabBar active={activeTab} onChange={setActiveTab} />
      <AnomalyBanner />
      {activeTab === 'ai'    && <AIExplanationPanel />}
      {activeTab === 'fix'   && <AIFixPanel />}
      {activeTab === 'asm'   && <AssemblyPanel />}
      {activeTab === 'graph' && <ObjectGraphPanel />}
    </div>
  )
}
