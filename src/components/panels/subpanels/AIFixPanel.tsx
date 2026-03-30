// src/components/panels/subpanels/AIFixPanel.tsx
// Fix tab in the right panel — generates a code fix via Groq.
// Extracted from RightPanel.tsx.

import { useState, useEffect } from 'react'
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
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

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
        {error   && <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded">⚠️ {error}</div>}
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
