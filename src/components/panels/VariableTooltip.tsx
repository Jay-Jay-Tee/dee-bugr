// src/components/panels/VariableTooltip.tsx
// Day 5: Hover tooltip showing AI-powered variable explanation

import { useCallback, useState } from 'react'
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

interface VariableTooltipProps {
  varName: string
  varValue: string
  varType?: string
  enabled?: boolean
}

export function VariableTooltip({ varName, varValue, varType, enabled = true }: Readonly<VariableTooltipProps>) {
  const [tooltip, setTooltip] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  const handleMouseEnter = useCallback(async () => {
    if (!enabled || tooltip) {
      setShowTooltip(true)
      return
    }
    setLoading(true)
    try {
      const result = await invoke(IPC.AI_VAR_TOOLTIP, { varName, varValue, varType })
      if (result && typeof result === 'object' && 'tooltip' in result) {
        setTooltip((result as any).tooltip)
      }
    } catch (err) {
      console.error('Failed to get tooltip:', err)
    } finally {
      setLoading(false)
      setShowTooltip(true)
    }
  }, [enabled, tooltip, varName, varValue, varType])

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false)
  }, [])

  return (
    <div className="relative inline-block">
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`cursor-default border-b border-dotted ${enabled ? 'border-[#75beff] hover:bg-[#75beff]/10' : 'border-transparent'} transition-colors px-0.5`}
      >
        {varName}
      </span>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#3c3c3c] border border-[#75beff] rounded text-xs text-[#cccccc] whitespace-nowrap z-50 shadow-lg pointer-events-none">
          {loading ? (
            <span className="text-[#888]">Loading...</span>
          ) : tooltip ? (
            <div className="max-w-xs">{tooltip}</div>
          ) : (
            <span className="text-[#888]">{varValue}</span>
          )}
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#75beff]" />
        </div>
      )}
    </div>
  )
}

export default VariableTooltip
