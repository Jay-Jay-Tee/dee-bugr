// src/components/panels/subpanels/NarrativePanel.tsx
// Narrative tab — AI session summary via Groq.
// FIX: stable event listener via useCallback; clear on new session.

import { useState, useEffect, useCallback } from 'react'
import { useDebugStore } from '../../../renderer/store/debugStore'
import { IPC } from '../../../shared/ipc'

export default function NarrativePanel() {
  const [narrative, setNarrative] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const status = useDebugStore((s) => s.status)

  // Clear on new session
  useEffect(() => {
    if (status === 'idle' || status === 'launching') {
      setNarrative(''); setError('')
    }
  }, [status])

  const fetchNarrative = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await (globalThis as any).electronAPI.invoke(IPC.AI_NARRATIVE, {}) as any
      if (result?.success) setNarrative(result.narrative)
      else setError(result?.error || 'AI call failed')
    } catch (e: any) { setError(e.message || 'Unknown error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const h = (e: Event) => setNarrative((e as CustomEvent<string>).detail)
    window.addEventListener('lucid:ai-narrative', h)
    return () => window.removeEventListener('lucid:ai-narrative', h)
  }, [])

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
        {narrative && (
          <button onClick={() => { setNarrative(''); setError('') }}
            className="px-2 py-1 text-xs rounded font-medium bg-[#3c3c3c] text-[#888] hover:bg-[#4a4a4a]">
            ✕ Clear
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="text-[#888] text-xs animate-pulse">Generating session narrative...</div>}
        {error    && <div className="text-red-400 text-xs p-2 bg-red-900/20 rounded">⚠️ {error}</div>}
        {narrative && !loading && (
          <div className="text-[#e0e0e0] text-xs whitespace-pre-wrap break-words leading-relaxed">{narrative}</div>
        )}
        {!narrative && !loading && !error && (
          <div className="text-[#555] text-xs">
            Click Generate Narrative to get an AI summary of your debug session.
            Works best after stepping through several lines.
          </div>
        )}
      </div>
    </div>
  )
}
