// src/components/panels/subpanels/AIExplanationPanel.tsx
// AI tab in the right panel — explains the current bug via Groq.
// Extracted from RightPanel.tsx.
//
// FIX: use a ref for the latest fetchExplanation so the event-listener never
//      captures a stale closure — previously re-registering on every `status`
//      change caused missed events and double-fires.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDebugStore } from '../../../renderer/store/debugStore'
import { IPC } from '../../../shared/ipc'

export default function AIExplanationPanel() {
  const [explanation, setExplanation] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const status         = useDebugStore((s) => s.status)
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)

  // Keep a ref to the latest status so the stable event handler can read it
  const statusRef = useRef(status)
  useEffect(() => { statusRef.current = status }, [status])

  // Clear stale explanation when a new session starts
  useEffect(() => {
    if (status === 'idle' || status === 'launching') {
      setExplanation('')
      setError('')
    }
  }, [status])

  const fetchExplanation = useCallback(async () => {
    if (statusRef.current !== 'paused') { setError('Pause execution first.'); return }
    setLoading(true); setError('')
    try {
      const result = await (globalThis as any).electronAPI.invoke(IPC.AI_EXPLAIN, {})
      if ((result as any).success) setExplanation((result as any).explanation)
      else setError((result as any).error || 'AI call failed')
    } catch (e: any) { setError(e.message || 'Unknown error') }
    finally { setLoading(false) }
  }, [])

  // Register event listener once — fetchExplanation is stable via useCallback
  useEffect(() => {
    window.addEventListener('lucid:ai-explain', fetchExplanation)
    return () => window.removeEventListener('lucid:ai-explain', fetchExplanation)
  }, [fetchExplanation])

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
        {explanation && (
          <button onClick={() => { setExplanation(''); setError('') }}
            className="px-2 py-1 text-xs rounded font-medium bg-[#3c3c3c] text-[#888] hover:bg-[#4a4a4a]">
            ✕ Clear
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="text-[#888] text-xs animate-pulse">Analyzing with Groq AI...</div>}
        {error    && <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded">⚠️ {error}</div>}
        {explanation && !loading && (
          <>
            {isBeginnerMode && <div className="text-[10px] text-[#569cd6] mb-2 uppercase tracking-wide">Beginner explanation</div>}
            <div className="text-[#e0e0e0] text-xs whitespace-pre-wrap break-words leading-relaxed">{explanation}</div>
          </>
        )}
        {!explanation && !loading && !error && (
          <div className="text-[#555] text-xs">Hit a breakpoint then click Explain Bug.</div>
        )}
      </div>
    </div>
  )
}
