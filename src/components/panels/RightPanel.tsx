// src/components/panels/RightPanel.tsx
// Day 7: AI panel + structured diff fix + anomaly banner + object graph tab

import { useState, useEffect, useRef } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { IPC } from '../../shared/ipc'
import type { AsmLine, Anomaly } from '../../shared/types'

// ── Tab bar ───────────────────────────────────────────────────────────────────

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

// ── Anomaly banner — shown at top of any panel when anomalies exist ───────────

function AnomalyBanner() {
  const anomalies = useDebugStore((s) => s.anomalies)
  if (anomalies.length === 0) return null

  return (
    <div className="shrink-0 border-b border-amber-800/50 bg-amber-950/40 px-3 py-1.5">
      {anomalies.map((a, i) => (
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

// ── Assembly Panel ────────────────────────────────────────────────────────────

function highlightAsm(instruction: string): React.ReactNode {
  const parts    = instruction.split(/\s+/)
  if (parts.length === 0) return instruction
  const mnemonic = parts[0]
  const rest     = parts.slice(1).join(' ')
  const isJump   = /^j/i.test(mnemonic)
  const isCall   = /^call/i.test(mnemonic)
  const isRet    = /^ret/i.test(mnemonic)
  const isMov    = /^mov/i.test(mnemonic)
  const color    = isJump ? 'text-[#c586c0]' : isCall ? 'text-[#dcdcaa]' :
                   isRet  ? 'text-[#f48771]' : isMov  ? 'text-[#9cdcfe]' : 'text-[#569cd6]'
  return (
    <>
      <span className={`${color} font-medium`}>{mnemonic}</span>
      {rest && <span className="text-[#cccccc]"> {rest}</span>}
    </>
  )
}

function AssemblyPanel() {
  const assemblyLines  = useDebugStore((s) => s.assemblyLines)
  const currentLine    = useDebugStore((s) => s.currentLine)
  const language       = useDebugStore((s) => s.language)
  const status         = useDebugStore((s) => s.status)
  const currentLineRef = useRef<HTMLDivElement>(null)
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)

  useEffect(() => {
    currentLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [assemblyLines, currentLine])

  if (isBeginnerMode) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-center text-[#555] text-xs">
        Assembly view is hidden in Beginner mode.<br />Switch to Expert mode to see it.
      </div>
    )
  }

  if (language !== 'c' && language !== 'cpp' && language !== 'java') {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-center text-[#555] text-xs">
        Assembly view is available for C / C++ / Java programs.
      </div>
    )
  }

  if (status === 'idle' || status === 'terminated') {
    return <div className="flex-1 flex items-center justify-center text-[#555] text-xs">Launch a debug session to see assembly</div>
  }

  if (assemblyLines.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-[#555] text-xs">
      {status === 'paused' ? 'No disassembly for this frame' : 'Step to a breakpoint'}
    </div>
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-1.5 border-b border-[#3c3c3c] shrink-0 flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-wide text-[#969696]">Disassembly</span>
        <span className="text-[10px] text-[#555]">{assemblyLines.length} instructions</span>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-[11px]">
        {assemblyLines.map((line, i) => {
          const isCurrent = line.sourceLine === currentLine
          return (
            <div
              key={`${line.address}-${i}`}
              ref={isCurrent ? currentLineRef : undefined}
              className={[
                'flex items-center gap-0 px-0 py-0.5 border-b border-[#1e1e1e]',
                isCurrent ? 'bg-[#094771] text-white' : 'hover:bg-[#2a2d2e] text-[#cccccc]',
              ].join(' ')}
            >
              <span className="w-4 shrink-0 text-center text-yellow-400">{isCurrent ? '▶' : ' '}</span>
              <span className={`w-[110px] shrink-0 px-2 ${isCurrent ? 'text-yellow-300' : 'text-[#569cd6]'}`}>{line.address}</span>
              {line.bytes && <span className="w-[90px] shrink-0 text-[#4a4a4a] truncate px-1">{line.bytes}</span>}
              <span className="flex-1 px-2 truncate">{highlightAsm(line.instruction)}</span>
              {line.sourceLine !== undefined && <span className="shrink-0 pr-2 text-[10px] text-[#444]">:{line.sourceLine}</span>}
            </div>
          )
        })}
      </div>
      <div className="px-3 py-1 border-t border-[#3c3c3c] shrink-0 text-[10px] text-[#444]">
        ▶ = current instruction · :N = source line
      </div>
    </div>
  )
}

// ── AI Explanation Panel ──────────────────────────────────────────────────────

function AIExplanationPanel({ autoTrigger }: { autoTrigger: boolean }) {
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const status        = useDebugStore((s) => s.status)
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)

  const fetchExplanation = async () => {
    if (status !== 'paused') { setError('Pause execution first.'); return }
    setLoading(true); setError('')
    try {
      const result = await globalThis.electronAPI.invoke(IPC.AI_EXPLAIN, {}) as any
      if (result.success) setExplanation(result.explanation)
      else setError(result.error || 'AI call failed')
    } catch (e: any) {
      setError(e.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Listen for toolbar button event
  useEffect(() => {
    if (autoTrigger) fetchExplanation()
  }, [autoTrigger])

  useEffect(() => {
    const handler = () => fetchExplanation()
    window.addEventListener('lucid:ai-explain', handler)
    return () => window.removeEventListener('lucid:ai-explain', handler)
  }, [status])

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden">
      <div className="flex gap-2 mb-3 shrink-0">
        <button
          onClick={fetchExplanation}
          disabled={loading || status !== 'paused'}
          className={[
            'px-2 py-1 text-xs rounded font-medium transition-colors',
            loading || status !== 'paused'
              ? 'bg-[#3c3c3c] text-[#888] cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700',
          ].join(' ')}
        >
          {loading ? '⏳ Analyzing...' : '⚡ Explain Bug'}
        </button>
        {explanation && (
          <button
            onClick={() => navigator.clipboard.writeText(explanation)}
            className="px-2 py-1 text-xs rounded font-medium bg-[#3c3c3c] text-[#ccc] hover:bg-[#4a4a4a] transition-colors"
          >
            📋 Copy
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="text-[#888] text-xs animate-pulse">Analyzing with Groq AI...</div>}
        {error && <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded">⚠️ {error}</div>}
        {explanation && !loading && (
          <>
            {isBeginnerMode && (
              <div className="text-[10px] text-[#569cd6] mb-2 uppercase tracking-wide">Beginner explanation</div>
            )}
            <div className="text-[#e0e0e0] text-xs whitespace-pre-wrap break-words">{explanation}</div>
          </>
        )}
        {!explanation && !loading && !error && (
          <div className="text-[#555] text-xs">
            Hit a breakpoint, then click "Explain Bug" to analyze the current state with AI.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Fix Suggestion Panel — now renders structured diff ────────────────────────

interface FixResult {
  originalCode: string
  fixedCode: string
  explanation: string
}

function diffLines(original: string, fixed: string): Array<{ type: 'remove' | 'add' | 'same'; text: string }> {
  const origLines  = original.split('\n')
  const fixedLines = fixed.split('\n')
  const result: Array<{ type: 'remove' | 'add' | 'same'; text: string }> = []

  // Simple line-by-line diff
  const maxLen = Math.max(origLines.length, fixedLines.length)
  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i]
    const f = fixedLines[i]
    if (o === f) {
      if (o !== undefined) result.push({ type: 'same', text: o })
    } else {
      if (o !== undefined) result.push({ type: 'remove', text: o })
      if (f !== undefined) result.push({ type: 'add',    text: f })
    }
  }
  return result
}

function AIFixPanel() {
  const [fix, setFix]         = useState<FixResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [accepted, setAccepted] = useState(false)
  const status = useDebugStore((s) => s.status)

  const fetchFix = async () => {
    if (status !== 'paused') { setError('Pause execution first.'); return }
    setLoading(true); setError(''); setAccepted(false)
    try {
      const result = await globalThis.electronAPI.invoke(IPC.AI_FIX, {}) as any
      if (result.success && result.fix) {
        setFix(result.fix as FixResult)
      } else {
        setError(result.error || 'AI call failed')
      }
    } catch (e: any) {
      setError(e.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Listen for toolbar button
  useEffect(() => {
    const handler = () => fetchFix()
    window.addEventListener('lucid:ai-fix', handler)
    return () => window.removeEventListener('lucid:ai-fix', handler)
  }, [status])

  const diffResult = fix ? diffLines(fix.originalCode, fix.fixedCode) : []

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden">
      <div className="flex gap-2 mb-3 shrink-0">
        <button
          onClick={fetchFix}
          disabled={loading || status !== 'paused'}
          className={[
            'px-2 py-1 text-xs rounded font-medium transition-colors',
            loading || status !== 'paused'
              ? 'bg-[#3c3c3c] text-[#888] cursor-not-allowed'
              : 'bg-green-700 text-white hover:bg-green-600',
          ].join(' ')}
        >
          {loading ? '⏳ Generating...' : '🔧 Suggest Fix'}
        </button>
        {fix && !accepted && (
          <>
            <button
              onClick={() => {
                if (fix.fixedCode) navigator.clipboard.writeText(fix.fixedCode)
                setAccepted(true)
              }}
              className="px-2 py-1 text-xs rounded font-medium bg-green-800 text-white hover:bg-green-700 transition-colors"
            >
              ✓ Accept (copy)
            </button>
            <button
              onClick={() => { setFix(null); setError('') }}
              className="px-2 py-1 text-xs rounded font-medium bg-[#3c3c3c] text-[#ccc] hover:bg-[#4a4a4a] transition-colors"
            >
              ✗ Reject
            </button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <div className="text-[#888] text-xs animate-pulse">Generating fix...</div>}
        {error && <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded">⚠️ {error}</div>}

        {fix && !loading && (
          <>
            {/* Explanation */}
            {fix.explanation && (
              <div className="text-xs text-[#4ec9b0] mb-3 p-2 bg-[#2a2a2a] rounded">
                💡 {fix.explanation}
              </div>
            )}

            {accepted && (
              <div className="text-xs text-green-400 mb-2">✓ Fix copied to clipboard</div>
            )}

            {/* Diff view */}
            {diffResult.length > 0 && (
              <div className="font-mono text-xs rounded overflow-hidden border border-[#3c3c3c]">
                <div className="flex text-[10px] text-[#555] bg-[#1a1a1a] px-2 py-1 border-b border-[#3c3c3c]">
                  <span className="flex-1 text-red-400">− Original</span>
                  <span className="flex-1 text-green-400">+ Fixed</span>
                </div>
                {diffResult.map((line, i) => (
                  <div
                    key={i}
                    className={[
                      'px-3 py-0.5 whitespace-pre-wrap break-all',
                      line.type === 'remove' ? 'bg-red-950/50 text-red-300'    :
                      line.type === 'add'    ? 'bg-green-950/50 text-green-300' :
                      'text-[#888]',
                    ].join(' ')}
                  >
                    <span className="mr-2 select-none">
                      {line.type === 'remove' ? '−' : line.type === 'add' ? '+' : ' '}
                    </span>
                    {line.text}
                  </div>
                ))}
              </div>
            )}

            {/* Fixed code block (full) */}
            {fix.fixedCode && (
              <div className="mt-3">
                <div className="text-[10px] text-[#969696] mb-1 uppercase tracking-wide">Full fixed code</div>
                <pre className="text-xs text-[#e0e0e0] bg-[#2d2d2d] p-2 rounded overflow-x-auto">
                  {fix.fixedCode}
                </pre>
              </div>
            )}
          </>
        )}

        {!fix && !loading && !error && (
          <div className="text-[#555] text-xs">
            Hit a breakpoint, then click "Suggest Fix" to get an AI diff.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Object Graph stub (P3 will fill this in) ──────────────────────────────────

function ObjectGraphPanel() {
  const variables      = useDebugStore((s) => s.variables)
  const status         = useDebugStore((s) => s.status)
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)

  const objectVars = variables.filter(v => v.variablesReference > 0)

  if (status === 'idle' || status === 'terminated') {
    return <div className="flex-1 flex items-center justify-center text-[#555] text-xs">Launch a session to visualize objects</div>
  }

  if (objectVars.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#555] text-xs text-center px-4">
        No objects to visualize yet.<br />
        <span className="text-[#444] mt-1 block">Step to a frame with object variables.</span>
      </div>
    )
  }

  // Simple object tree until P3 wires vis-network / D3
  return (
    <div className="flex-1 flex flex-col overflow-hidden p-3">
      <div className="text-[10px] text-[#969696] uppercase tracking-wide mb-2 shrink-0">
        Objects ({objectVars.length}) — select one to visualize
      </div>
      <div className="flex-1 overflow-y-auto space-y-1">
        {objectVars.map((v) => (
          <div
            key={v.name}
            className="flex items-center gap-2 p-2 rounded bg-[#2a2a2a] hover:bg-[#333] cursor-pointer text-xs"
          >
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
      <div className="text-[10px] text-[#444] mt-2 shrink-0">
        Full D3 graph visualization coming from P3.
      </div>
    </div>
  )
}

// ── Root panel ────────────────────────────────────────────────────────────────

export default function RightPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('ai')

  // Switch to AI tab automatically when toolbar triggers explain
  useEffect(() => {
    const handler = () => setActiveTab('ai')
    window.addEventListener('lucid:ai-explain', handler)
    return () => window.removeEventListener('lucid:ai-explain', handler)
  }, [])

  useEffect(() => {
    const handler = () => setActiveTab('fix')
    window.addEventListener('lucid:ai-fix', handler)
    return () => window.removeEventListener('lucid:ai-fix', handler)
  }, [])

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e] border-l border-[#3c3c3c]">
      <TabBar active={activeTab} onChange={setActiveTab} />
      <AnomalyBanner />
      {activeTab === 'ai'    && <AIExplanationPanel autoTrigger={false} />}
      {activeTab === 'fix'   && <AIFixPanel />}
      {activeTab === 'asm'   && <AssemblyPanel />}
      {activeTab === 'graph' && <ObjectGraphPanel />}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { IPC } from '../../shared/ipc'
import type { AsmLine } from '../../shared/types'

// ── Shared types ──────────────────────────────────────────────────────────────

type Tab = 'ai' | 'fix' | 'asm'

const TABS: { id: Tab; label: string }[] = [
  { id: 'ai',  label: 'AI' },
  { id: 'fix', label: 'Fix' },
  { id: 'asm', label: 'Assembly' },
]

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex border-b border-[#3c3c3c] shrink-0">
      {TABS.map((t) => (
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

// ── Assembly Panel ────────────────────────────────────────────────────────────

function AssemblyPanel() {
  const assemblyLines = useDebugStore((s) => s.assemblyLines)
  const currentLine   = useDebugStore((s) => s.currentLine)
  const language      = useDebugStore((s) => s.language)
  const status        = useDebugStore((s) => s.status)
  const currentLineRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to current instruction when assembly updates
  useEffect(() => {
    currentLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [assemblyLines, currentLine])

  if (language !== 'c' && language !== 'cpp') {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-center">
        <div className="text-[#555] text-xs">
          Assembly view is available for C / C++ programs.
          <br />
          <span className="text-[#444] mt-1 block">Select C/C++ and launch a compiled binary.</span>
        </div>
      </div>
    )
  }

  if (status === 'idle' || status === 'terminated') {
    return (
      <div className="flex-1 flex items-center justify-center text-[#555] text-xs">
        Launch a debug session to see assembly
      </div>
    )
  }

  if (assemblyLines.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#555] text-xs">
        {status === 'paused' ? 'No disassembly available for this frame' : 'Step to a breakpoint to see assembly'}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-[#3c3c3c] shrink-0 flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-wide text-[#969696]">Disassembly</span>
        <span className="text-[10px] text-[#555]">{assemblyLines.length} instructions</span>
      </div>

      {/* Instructions list */}
      <div className="flex-1 overflow-y-auto font-mono text-[11px]">
        {assemblyLines.map((line, i) => {
          const isCurrentSrc = line.sourceLine === currentLine
          return (
            <div
              key={`${line.address}-${i}`}
              ref={isCurrentSrc ? currentLineRef : undefined}
              className={[
                'flex items-center gap-0 px-0 py-0.5 border-b border-[#1e1e1e]',
                isCurrentSrc
                  ? 'bg-[#094771] text-white'
                  : 'hover:bg-[#2a2d2e] text-[#cccccc]',
              ].join(' ')}
            >
              {/* Current instruction arrow */}
              <span className="w-4 shrink-0 text-center text-yellow-400">
                {isCurrentSrc ? '▶' : ' '}
              </span>

              {/* Address */}
              <span className={`w-[110px] shrink-0 px-2 ${isCurrentSrc ? 'text-yellow-300' : 'text-[#569cd6]'}`}>
                {line.address}
              </span>

              {/* Bytes (if available) */}
              {line.bytes && (
                <span className="w-[90px] shrink-0 text-[#4a4a4a] truncate px-1">
                  {line.bytes}
                </span>
              )}

              {/* Instruction */}
              <span className="flex-1 px-2 truncate">
                {highlightAsm(line.instruction)}
              </span>

              {/* Source line badge */}
              {line.sourceLine !== undefined && (
                <span className="shrink-0 pr-2 text-[10px] text-[#444]">
                  :{line.sourceLine}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1 border-t border-[#3c3c3c] shrink-0 text-[10px] text-[#444]">
        ▶ = current instruction  ·  :N = source line
      </div>
    </div>
  )
}

// Simple syntax coloring for assembly mnemonics
function highlightAsm(instruction: string): React.ReactNode {
  const parts = instruction.split(/\s+/)
  if (parts.length === 0) return instruction

  const mnemonic = parts[0]
  const rest = parts.slice(1).join(' ')

  const isJump = /^j/i.test(mnemonic)
  const isCall = /^call/i.test(mnemonic)
  const isRet  = /^ret/i.test(mnemonic)
  const isMov  = /^mov/i.test(mnemonic)

  const mnemonicColor =
    isJump ? 'text-[#c586c0]' :
    isCall ? 'text-[#dcdcaa]' :
    isRet  ? 'text-[#f48771]' :
    isMov  ? 'text-[#9cdcfe]' :
    'text-[#569cd6]'

  return (
    <>
      <span className={`${mnemonicColor} font-medium`}>{mnemonic}</span>
      {rest && <span className="text-[#cccccc]"> {rest}</span>}
    </>
  )
}

// ── AI Explanation Panel ──────────────────────────────────────────────────────

function AIExplanationPanel() {
  const [explanation, setExplanation] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const status = useDebugStore((s) => s.status)

  const fetchExplanation = async () => {
    if (status !== 'paused') {
      setError('Pause execution first to get an AI explanation.')
      return
    }
    setLoading(true)
    setError('')
    try {
      if (!globalThis.electronAPI) {
        setError('Electron API not available')
        return
      }
      const result = await globalThis.electronAPI.invoke(IPC.AI_EXPLAIN, {}) as any
      if (result.success && result.explanation) {
        setExplanation(result.explanation)
      } else {
        setError(result.error || 'Failed to get explanation')
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden">
      <div className="flex gap-2 mb-3 shrink-0">
        <button
          onClick={fetchExplanation}
          disabled={loading || status !== 'paused'}
          className={[
            'px-2 py-1 text-xs rounded font-medium transition-colors',
            loading || status !== 'paused'
              ? 'bg-[#3c3c3c] text-[#888] cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700',
          ].join(' ')}
        >
          {loading ? '⏳ Analyzing...' : '⚡ Explain Bug'}
        </button>
        {explanation && (
          <button
            onClick={() => navigator.clipboard.writeText(explanation)}
            className="px-2 py-1 text-xs rounded font-medium bg-[#3c3c3c] text-[#ccc] hover:bg-[#4a4a4a] transition-colors"
          >
            📋 Copy
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="text-[#888] text-xs animate-pulse">Analyzing with Groq AI...</div>
        )}
        {error && (
          <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded">⚠️ {error}</div>
        )}
        {explanation && !loading && (
          <div className="text-[#e0e0e0] text-xs whitespace-pre-wrap break-words">{explanation}</div>
        )}
        {!explanation && !loading && !error && (
          <div className="text-[#555] text-xs">
            Hit a breakpoint, then click "Explain Bug" to analyze the current state with AI.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Fix Suggestion Panel (Day 4 — wired) ─────────────────────────────────────

function AIFixPanel() {
  const [fix, setFix] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const status = useDebugStore((s) => s.status)

  const fetchFix = async () => {
    if (status !== 'paused') {
      setError('Pause execution first.')
      return
    }
    setLoading(true)
    setError('')
    try {
      if (!globalThis.electronAPI) {
        setError('Electron API not available')
        return
      }
      const result = await globalThis.electronAPI.invoke(IPC.AI_FIX, {}) as any
      if (result.success && result.fix) {
        setFix(result.fix)
      } else {
        setError(result.error || 'Failed to get fix suggestion')
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden">
      <div className="flex gap-2 mb-3 shrink-0">
        <button
          onClick={fetchFix}
          disabled={loading || status !== 'paused'}
          className={[
            'px-2 py-1 text-xs rounded font-medium transition-colors',
            loading || status !== 'paused'
              ? 'bg-[#3c3c3c] text-[#888] cursor-not-allowed'
              : 'bg-green-700 text-white hover:bg-green-600',
          ].join(' ')}
        >
          {loading ? '⏳ Generating...' : '🔧 Suggest Fix'}
        </button>
        {fix && (
          <button
            onClick={() => { setFix(''); setError('') }}
            className="px-2 py-1 text-xs rounded font-medium bg-[#3c3c3c] text-[#ccc] hover:bg-[#4a4a4a] transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="text-[#888] text-xs animate-pulse">Generating fix suggestion...</div>
        )}
        {error && (
          <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded">⚠️ {error}</div>
        )}
        {fix && !loading && (
          <div className="text-[#e0e0e0] text-xs whitespace-pre-wrap break-words font-mono bg-[#2d2d2d] p-2 rounded">
            {fix}
          </div>
        )}
        {!fix && !loading && !error && (
          <div className="text-[#555] text-xs">
            Hit a breakpoint, then click "Suggest Fix" to get an AI-generated code fix.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Root panel ────────────────────────────────────────────────────────────────

export default function RightPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('ai')

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e] border-l border-[#3c3c3c]">
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === 'ai'  && <AIExplanationPanel />}
      {activeTab === 'fix' && <AIFixPanel />}
      {activeTab === 'asm' && <AssemblyPanel />}
    </div>
  )
}