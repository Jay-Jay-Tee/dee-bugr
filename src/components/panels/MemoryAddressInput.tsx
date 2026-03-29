// src/components/panels/MemoryAddressInput.tsx
// Day 7 — Address input bar for the memory view tab.
// User types a hex address (or variable name) → fires IPC.READ_MEMORY →
// main process fetches the bytes → store receives updated memoryBytes.
// Auto-scrolls to current stack pointer on each stop (handled via
// the address being pre-filled from the store's currentLine context).

import { useState, useCallback, useEffect } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { IPC } from '../../shared/ipc'

type AnyIPC = typeof IPC[keyof typeof IPC]

function invoke(channel: AnyIPC, args?: unknown) {
  return (window as Window & {
    electronAPI?: { invoke: (ch: AnyIPC, args?: unknown) => Promise<unknown> }
  }).electronAPI?.invoke(channel, args)
    .catch((err: unknown) => console.error('[MemAddr]', err))
}

const BYTE_COUNT_OPTIONS = [64, 128, 256, 512] as const
type ByteCount = typeof BYTE_COUNT_OPTIONS[number]

interface Props {
  onResult?: (success: boolean) => void
}

export default function MemoryAddressInput({ onResult }: Readonly<Props>) {
  const status    = useDebugStore((s) => s.status)
  const variables = useDebugStore((s) => s.variables)

  const [address,   setAddress]   = useState('')
  const [byteCount, setByteCount] = useState<ByteCount>(256)
  const [pending,   setPending]   = useState(false)
  const [error,     setError]     = useState('')

  // Auto-fill from first pointer variable when session stops
  useEffect(() => {
    if (status !== 'paused') return
    const ptr = variables.find(
      (v) => v.memoryReference && v.value !== '0x0' && v.value !== '0x0000000000000000'
    )
    if (ptr?.memoryReference && !address) {
      setAddress(ptr.memoryReference)
    }
  }, [status, variables]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRead = useCallback(async () => {
    const trimmed = address.trim()
    if (!trimmed) return
    setPending(true)
    setError('')
    const result = await invoke(IPC.READ_MEMORY, {
      memoryReference: trimmed,
      count: byteCount,
    }) as { success?: boolean; error?: string } | undefined
    setPending(false)
    if (result?.success === false) {
      setError(result.error ?? 'Read failed')
      onResult?.(false)
    } else {
      onResult?.(true)
    }
  }, [address, byteCount, onResult])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleRead()
  }, [handleRead])

  const disabled = status !== 'paused' || pending

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-[#3c3c3c] shrink-0 bg-[#1a1a1a]">
      <span className="text-[10px] text-[#555] shrink-0">addr:</span>
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="0x7fff... or variable address"
        disabled={disabled}
        className="flex-1 min-w-0 bg-transparent text-[11px] font-mono text-[#9cdcfe] placeholder:text-[#3a3a3a] outline-none disabled:opacity-40"
      />
      <select
        value={byteCount}
        onChange={(e) => setByteCount(Number(e.target.value) as ByteCount)}
        disabled={disabled}
        className="bg-[#2d2d2d] text-[10px] text-[#969696] px-1 py-0.5 rounded border border-[#3c3c3c] outline-none disabled:opacity-40"
      >
        {BYTE_COUNT_OPTIONS.map((n) => (
          <option key={n} value={n}>{n}B</option>
        ))}
      </select>
      <button
        onClick={handleRead}
        disabled={disabled || !address.trim()}
        className="text-[10px] px-2 py-0.5 rounded bg-[#3c3c3c] text-[#969696] hover:text-white hover:bg-[#4a4a4a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
      >
        {pending ? '…' : 'Read'}
      </button>
      {error && (
        <span className="text-[10px] text-[#f48771] truncate max-w-[120px]" title={error}>
          {error}
        </span>
      )}
    </div>
  )
}
