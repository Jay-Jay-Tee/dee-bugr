// src/components/panels/RightPanel.tsx
// Day 4: AI panel + Assembly panel synced to source + Fix suggestion

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