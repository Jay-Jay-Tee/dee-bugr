// src/components/panels/AILogBreakpointsPanel.tsx
// Day 7: Ingest logs and suggest 3 likely breakpoints.

import { useCallback, useState } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { IPC } from '../../shared/ipc'
import type { IPCChannel } from '../../shared/ipc'

interface Suggestion {
  line: number
  reason: string
}

async function invoke(channel: IPCChannel, args?: unknown): Promise<unknown> {
  const api = (window as Window & {
    electronAPI?: { invoke: (ch: IPCChannel, payload?: unknown) => Promise<unknown> }
  }).electronAPI
  if (!api) return null
  try {
    return await api.invoke(channel, args)
  } catch (err: unknown) {
    console.error(`[IPC] ${channel} failed:`, err)
    return null
  }
}

export default function AILogBreakpointsPanel() {
  const currentFile = useDebugStore((s) => s.currentFile)
  const toggleBreakpoint = useDebugStore((s) => s.toggleBreakpoint)

  const [logFilePath, setLogFilePath] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  const analyzeLogs = useCallback(async () => {
    if (!logFilePath.trim()) {
      setError('Enter a log file path')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await invoke(IPC.AI_LOG_BREAKPOINTS, { logFilePath: logFilePath.trim() })
      if (!result || typeof result !== 'object') {
        setError('No response from AI service')
        return
      }

      const r = result as { success?: boolean; error?: string; suggestions?: Suggestion[] }
      if (!r.success) {
        setError(r.error ?? 'Log analysis failed')
        return
      }

      setSuggestions(Array.isArray(r.suggestions) ? r.suggestions : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [logFilePath])

  const applySuggestion = useCallback(async (line: number) => {
    if (!currentFile) {
      setError('No active source file in current frame')
      return
    }
    try {
      await toggleBreakpoint(currentFile, line)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [currentFile, toggleBreakpoint])

  return (
    <div className="mt-3 border border-[#3c3c3c] rounded p-2 bg-[#252526]">
      <div className="text-[10px] uppercase tracking-wide text-[#969696] mb-2">Log Ingestion Breakpoint AI</div>

      <div className="flex gap-2 mb-2">
        <input
          value={logFilePath}
          onChange={(e) => setLogFilePath(e.target.value)}
          placeholder="Path to log file"
          className="flex-1 bg-[#3c3c3c] text-xs text-[#cccccc] px-2 py-1 rounded outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={analyzeLogs}
          disabled={loading}
          className="px-2 py-1 text-xs rounded bg-[#0e639c] text-white hover:bg-[#1177bb] disabled:opacity-50"
        >
          {loading ? 'Analyzing...' : 'Suggest 3 BPs'}
        </button>
      </div>

      {error && <div className="text-xs text-red-400 mb-2">{error}</div>}

      {suggestions.length > 0 && (
        <div className="space-y-1">
          {suggestions.map((s, i) => (
            <button
              key={`${s.line}-${i}`}
              onClick={() => applySuggestion(s.line)}
              className="w-full text-left px-2 py-1 rounded bg-[#2a2d2e] hover:bg-[#333] text-xs"
            >
              <span className="text-[#75beff] mr-2">Line {s.line}</span>
              <span className="text-[#cccccc]">{s.reason}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
