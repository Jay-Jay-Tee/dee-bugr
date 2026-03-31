// src/components/panels/subpanels/AIFixPanel.tsx
// Fix tab — generates a code fix via Groq, shown as inline diff.
// FIX: stable event listener via useCallback + statusRef (same pattern as AIExplanationPanel)

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDebugStore } from '../../../renderer/store/debugStore'
import { IPC } from '../../../shared/ipc'

interface FixResult { originalCode: string; fixedCode: string; explanation: string }

function diffLines(original: string, fixed: string) {
  const oL = original.split('\n'), fL = fixed.split('\n')
  const out: { type: 'remove' | 'add' | 'same'; text: string }[] = []
  const max = Math.max(oL.length, fL.length)
  for (let i = 0; i < max; i++) {
    const o = oL[i], f = fL[i]
    if (o === f) { if (o !== undefined) out.push({ type: 'same', text: o }) }
    else {
      if (o !== undefined) out.push({ type: 'remove', text: o })
      if (f !== undefined) out.push({ type: 'add',    text: f })
    }
  }
  return out
}

export default function AIFixPanel() {
  const [fix,      setFix]      = useState<FixResult | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [accepted, setAccepted] = useState(false)
  const status = useDebugStore((s) => s.status)

  const statusRef = useRef(status)
  useEffect(() => { statusRef.current = status }, [status])

  // Clear on new session
  useEffect(() => {
    if (status === 'idle' || status === 'launching') {
      setFix(null); setError(''); setAccepted(false)
    }
  }, [status])

  const fetchFix = useCallback(async () => {
    if (statusRef.current !== 'paused') { setError('Pause execution first.'); return }
    setLoading(true); setError(''); setAccepted(false)
    try {
      const result = await (globalThis as any).electronAPI.invoke(IPC.AI_FIX, {})
      if ((result as any).success && (result as any).fix) setFix((result as any).fix as FixResult)
      else setError((result as any).error || 'AI call failed')
    } catch (e: any) { setError(e.message || 'Unknown error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    window.addEventListener('lucid:ai-fix', fetchFix)
    return () => window.removeEventListener('lucid:ai-fix', fetchFix)
  }, [fetchFix])

  const dr = fix ? diffLines(fix.originalCode, fix.fixedCode) : []

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden">
      <div className="flex gap-2 mb-3 shrink-0 flex-wrap">
        <button onClick={fetchFix} disabled={loading || status !== 'paused'}
          className={['px-2 py-1 text-xs rounded font-medium transition-colors',
            loading || status !== 'paused' ? 'bg-[#3c3c3c] text-[#888] cursor-not-allowed' : 'bg-green-700 text-white hover:bg-green-600'].join(' ')}>
          {loading ? '⏳ Generating...' : '🔧 Suggest Fix'}
        </button>
        {fix && !accepted && (
          <button
            onClick={() => {
              if (fix) {
                navigator.clipboard.writeText(fix.fixedCode)
                setAccepted(true)
              }
            }}
            className="px-2 py-1 text-xs rounded font-medium bg-green-900 text-green-300 hover:bg-green-800">
            ✅ Copy Fixed Code
          </button>
        )}
        {fix && (
          <button onClick={() => { setFix(null); setAccepted(false) }}
            className="px-2 py-1 text-xs rounded font-medium bg-[#3c3c3c] text-[#888] hover:bg-[#4a4a4a]">
            ✕ Clear
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="text-[#888] text-xs animate-pulse">Generating fix with Groq AI...</div>}
        {error    && <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded">⚠️ {error}</div>}
        {accepted && <div className="text-green-400 text-xs p-2 bg-green-900/20 rounded mb-2">✅ Fixed code copied to clipboard!</div>}
        {fix && !loading && (
          <>
            <div className="text-[#888] text-xs mb-2 leading-relaxed">{fix.explanation}</div>
            <div className="font-mono text-[11px] bg-[#1a1a1a] rounded border border-[#3c3c3c] overflow-auto">
              {dr.map((line, i) => (
                <div key={i} className={[
                  'px-3 py-0.5 whitespace-pre leading-5',
                  line.type === 'remove' ? 'bg-red-900/30 text-red-300' :
                  line.type === 'add'    ? 'bg-green-900/30 text-green-300' :
                                           'text-[#999]',
                ].join(' ')}>
                  <span className="select-none mr-2 text-[#555]">
                    {line.type === 'remove' ? '−' : line.type === 'add' ? '+' : ' '}
                  </span>
                  {line.text}
                </div>
              ))}
            </div>
          </>
        )}
        {!fix && !loading && !error && (
          <div className="text-[#555] text-xs">Hit a breakpoint then click Suggest Fix.</div>
        )}
      </div>
    </div>
  )
}
