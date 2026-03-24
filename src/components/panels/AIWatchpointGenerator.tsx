// src/components/panels/AIWatchpointGenerator.tsx
// Day 5: Generate watchpoint expressions from English descriptions

import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
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

interface AIWatchpointGeneratorProps {
  onExpressionsGenerated?: (expressions: Array<{ expression: string; description: string; }>) => void
}

export default function AIWatchpointGenerator({ onExpressionsGenerated }: Readonly<AIWatchpointGeneratorProps>) {
  const { language, variables, currentFile, currentLine } = useDebugStore()
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedExpressions, setGeneratedExpressions] = useState<Array<{ expression: string; description: string; }>>([])

  const availableVarNames = variables
    .map((v: { name: string }) => v.name)
    .filter((name: string) => name && typeof name === 'string')

  const handleGenerate = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!description.trim()) return

    setLoading(true)
    setError(null)

    try {
      const result = await invoke(IPC.AI_GENERATE_WATCHPOINT, {
        description: description.trim(),
        language,
        availableVariables: availableVarNames,
      })

      if (result && typeof result === 'object' && 'expression' in result) {
        const expr = (result as any).expression
        if (expr && typeof expr === 'string') {
          const newExpr = { expression: expr, description: description.trim() }
          setGeneratedExpressions((prev: Array<{ expression: string; description: string }>) => [newExpr, ...prev])
          onExpressionsGenerated?.([newExpr])
          setDescription('')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [description, language, availableVarNames, onExpressionsGenerated])

  const handleSetWatchpoint = useCallback(async (expression: string) => {
    try {
      if (!currentFile || !currentLine) {
        setError('Pause at a source line to set a conditional watchpoint')
        return
      }

      const result = await invoke(IPC.SET_BREAKPOINT, {
        file: currentFile,
        line: currentLine,
        condition: expression,
        label: `AI: ${expression}`,
      })

      if (result && typeof result === 'object' && 'success' in result && !(result as { success: boolean }).success) {
        const r = result as { error?: string }
        setError(r.error ?? 'Failed to set watchpoint')
        return
      }

      await navigator.clipboard.writeText(expression)
      setError(null)
    } catch (err) {
      console.error('Failed to set watchpoint:', err)
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [currentFile, currentLine])

  const handleClear = useCallback(() => {
    setGeneratedExpressions([])
    setDescription('')
    setError(null)
  }, [])

  return (
    <div className="flex flex-col gap-3 p-3 bg-[#252526] rounded border border-[#3c3c3c]">
      <h4 className="text-xs font-semibold text-[#cccccc] uppercase tracking-wide">AI Watchpoint Generator (Day 5)</h4>

      <form onSubmit={handleGenerate} className="flex flex-col gap-2">
        <input
          type="text"
          value={description}
          onChange={(e: { target: { value: string } }) => setDescription(e.target.value)}
          placeholder="e.g., 'stop when balance goes negative'"
          disabled={loading}
          className="px-2 py-1.5 text-xs bg-[#3c3c3c] text-[#cccccc] border border-[#555] rounded focus:border-[#75beff] focus:outline-none disabled:opacity-50"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !description.trim()}
            className="px-3 py-1 text-xs bg-[#0e639c] text-white rounded hover:bg-[#1177bb] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Generating...' : 'Generate Expression'}
          </button>
          {generatedExpressions.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="px-2 py-1 text-xs bg-[#3c3c3c] text-[#969696] rounded hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="bg-[#5d2d2d] text-[#f48771] text-xs p-2 rounded border border-[#f48771]/30">
          {error}
        </div>
      )}

      {generatedExpressions.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-[#969696]">Generated watchpoints:</div>
          {generatedExpressions.map((item: { expression: string; description: string }, idx: number) => (
            <div key={idx} className="bg-[#3c3c3c] p-2 rounded border-l-2 border-[#4ec9b0]">
              <div className="text-[#ce9178] font-mono text-xs mb-1">{item.expression}</div>
              <div className="text-[#b5cea8] text-xs mb-1">"{item.description}"</div>
              <button
                onClick={() => handleSetWatchpoint(item.expression)}
                className="px-2 py-0.5 text-xs bg-[#4ec9b0]/20 text-[#4ec9b0] rounded hover:bg-[#4ec9b0]/30 transition-colors"
              >
                Copy & Set Watchpoint
              </button>
            </div>
          ))}
        </div>
      )}

      {availableVarNames.length > 0 && (
        <div className="text-[10px] text-[#555]">
          Available variables: {availableVarNames.slice(0, 5).join(', ')}{availableVarNames.length > 5 ? '...' : ''}
        </div>
      )}
    </div>
  )
}
