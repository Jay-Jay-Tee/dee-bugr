// src/components/panels/AIFixPanel.tsx
// Day 4: Display AI-suggested code fixes with side-by-side diff

import { useCallback, useState } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { IPC } from '../../shared/ipc'
import type { IPCChannel } from '../../shared/ipc'

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

interface AIFixPanelProps {
  isCollapsed?: boolean
}

export default function AIFixPanel({ isCollapsed = false }: Readonly<AIFixPanelProps>) {
  const { aiFixDiff, setAiFixDiff } = useDebugStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSuggestFix = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await invoke(IPC.AI_FIX)
      if (result && typeof result === 'object' && 'fix' in result) {
        const { fix } = result as any
        if (fix && typeof fix === 'object') {
          setAiFixDiff({
            originalCode:  fix.originalCode || '',
            fixedCode:     fix.fixedCode || '',
            explanation:   fix.explanation || '',
          })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [setAiFixDiff])

  const handleClear = useCallback(() => {
    setAiFixDiff(null)
    setError(null)
  }, [setAiFixDiff])

  if (isCollapsed) return null

  return (
    <div className="flex flex-col h-full bg-[#252526] border-t border-[#3c3c3c] p-3 gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[#cccccc] uppercase tracking-wide">AI Fix Suggestion</h3>
        <button
          onClick={handleSuggestFix}
          disabled={loading}
          className="px-2 py-1 text-xs bg-[#0e639c] text-white rounded hover:bg-[#1177bb] disabled:opacity-50 transition-colors"
        >
          {loading ? 'Thinking...' : 'Suggest Fix'}
        </button>
      </div>

      {error && (
        <div className="bg-[#5d2d2d] text-[#f48771] text-xs p-2 rounded border border-[#f48771]/30">
          Error: {error}
        </div>
      )}

      {aiFixDiff && (
        <div className="flex flex-col gap-2 text-xs overflow-auto flex-1">
          {/* Explanation */}
          <div className="bg-[#3c3c3c] p-2 rounded border-l-2 border-[#75beff]">
            <div className="text-[#75beff] font-medium mb-1">Why</div>
            <div className="text-[#cccccc]">{aiFixDiff.explanation}</div>
          </div>

          {/* Original Code */}
          <div className="bg-[#3c3c3c] p-2 rounded border-l-2 border-[#f48771]">
            <div className="text-[#f48771] font-medium mb-1">Original (buggy)</div>
            <pre className="text-[#ce9178] overflow-x-auto whitespace-pre-wrap break-words font-mono">
              {aiFixDiff.originalCode}
            </pre>
          </div>

          {/* Fixed Code */}
          <div className="bg-[#3c3c3c] p-2 rounded border-l-2 border-[#4ec9b0]">
            <div className="text-[#4ec9b0] font-medium mb-1">Fixed</div>
            <pre className="text-[#b5cea8] overflow-x-auto whitespace-pre-wrap break-words font-mono">
              {aiFixDiff.fixedCode}
            </pre>
          </div>

          <button
            onClick={handleClear}
            className="px-2 py-1 text-xs bg-[#3c3c3c] text-[#969696] rounded hover:bg-[#4a4a4a] hover:text-white transition-colors self-start"
          >
            Clear
          </button>
        </div>
      )}

      {!aiFixDiff && !error && (
        <div className="text-xs text-[#969696] italic text-center py-4">
          Click "Suggest Fix" to generate an AI fix for the current bug
        </div>
      )}
    </div>
  )
}
