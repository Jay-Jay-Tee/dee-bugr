// src/components/panels/MemoryPanel.tsx
// Renders DAP readMemory response (base64 bytes) as a colour-coded hex grid.
// Beginner mode: hidden entirely (caller controls visibility via isBeginnerMode).
// Expert mode: full hex dump with ASCII sidebar.

import { useMemo } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'

const BYTES_PER_ROW = 16

// ── Base64 → Uint8Array ───────────────────────────────────────────────────────

function decodeBase64(b64: string): Uint8Array {
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return new Uint8Array(0)
  }
}

// ── Byte colour by value ──────────────────────────────────────────────────────

function byteClass(b: number): string {
  if (b === 0)          return 'text-[#555]'        // null bytes — dim
  if (b < 32)           return 'text-[#c586c0]'     // control chars — purple
  if (b >= 32 && b < 127) return 'text-[#9cdcfe]'   // printable ASCII — blue
  return 'text-[#ce9178]'                            // high bytes — orange
}

// ── ASCII sidebar char ────────────────────────────────────────────────────────

function toAscii(b: number): string {
  return b >= 32 && b < 127 ? String.fromCharCode(b) : '·'
}

// ── Single row ────────────────────────────────────────────────────────────────

interface RowProps {
  offset: number
  bytes:  Uint8Array
}

function HexRow({ offset, bytes }: Readonly<RowProps>) {
  const cells: React.ReactNode[] = []
  for (let i = 0; i < BYTES_PER_ROW; i++) {
    const b = bytes[offset + i]
    if (b === undefined) {
      cells.push(<span key={i} className="w-6 shrink-0 text-[#2a2a2a]">--</span>)
    } else {
      cells.push(
        <span key={i} className={`w-6 shrink-0 ${byteClass(b)}`}>
          {b.toString(16).padStart(2, '0')}
        </span>
      )
    }
  }

  const ascii = Array.from({ length: BYTES_PER_ROW }, (_, i) => {
    const b = bytes[offset + i]
    return b !== undefined ? toAscii(b) : ' '
  }).join('')

  return (
    <div className="flex items-center gap-1 px-3 py-0.5 font-mono text-[11px] hover:bg-[#2a2d2e] border-b border-[#1a1a1a]">
      <span className="text-[#569cd6] w-20 shrink-0">
        0x{offset.toString(16).padStart(8, '0')}
      </span>
      <div className="flex gap-0.5 flex-1">
        {cells}
      </div>
      <span className="text-[#555] w-20 shrink-0 text-right tracking-widest">{ascii}</span>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function MemoryPanel() {
  const memoryBytes   = useDebugStore((s) => s.memoryBytes)
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)
  const status         = useDebugStore((s) => s.status)

  const bytes = useMemo(
    () => memoryBytes ? decodeBase64(memoryBytes) : null,
    [memoryBytes]
  )

  if (isBeginnerMode) {
    return (
      <div className="h-full flex items-center justify-center text-[#555] text-xs">
        Memory view is hidden in Beginner mode
      </div>
    )
  }

  if (!bytes || bytes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[#555] text-xs">
        {status === 'paused'
          ? 'No memory snapshot — select a variable with a memory address'
          : 'Memory view appears when paused'}
      </div>
    )
  }

  const rowCount = Math.ceil(bytes.length / BYTES_PER_ROW)

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      <div className="flex gap-1 px-3 py-1 text-[10px] uppercase tracking-wide text-[#969696] border-b border-[#3c3c3c] shrink-0">
        <span className="w-20 shrink-0">Address</span>
        <span className="flex-1">Hex</span>
        <span className="w-20 text-right">ASCII</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {Array.from({ length: rowCount }, (_, i) => (
          <HexRow key={i} offset={i * BYTES_PER_ROW} bytes={bytes} />
        ))}
      </div>
    </div>
  )
}
