// src/components/panels/AssemblyPanel.tsx
// Renders DAP disassembly lines from Zustand store.
// Highlights the instruction whose sourceLine matches currentLine.
// Beginner mode: hidden entirely (caller controls visibility).

import { useRef, useEffect } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import type { AsmLine } from '../../shared/types'

// ── Single instruction row ────────────────────────────────────────────────────

interface AsmRowProps {
  line: AsmLine
  isCurrent: boolean
}

function AsmRow({ line, isCurrent }: Readonly<AsmRowProps>) {
  return (
    <div className={[
      'flex items-center gap-3 px-3 py-0.5 font-mono text-[11px] border-b border-[#1a1a1a]',
      isCurrent ? 'bg-[#094771]' : 'hover:bg-[#2a2d2e]',
    ].join(' ')}>
      {isCurrent && (
        <span className="text-yellow-400 shrink-0 w-3">▶</span>
      )}
      {!isCurrent && (
        <span className="w-3 shrink-0" />
      )}
      <span className="text-[#569cd6] w-36 shrink-0 truncate">{line.address}</span>
      <span className={isCurrent ? 'text-white flex-1 truncate' : 'text-[#cccccc] flex-1 truncate'}>
        {line.instruction}
      </span>
      {line.sourceLine != null && (
        <span className="text-[#555] text-[10px] shrink-0 w-12 text-right">
          L{line.sourceLine}
        </span>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function AssemblyPanel() {
  const assemblyLines = useDebugStore((s) => s.assemblyLines)
  const currentLine   = useDebugStore((s) => s.currentLine)
  const status        = useDebugStore((s) => s.status)
  const currentRowRef = useRef<HTMLDivElement>(null)

  // Scroll current instruction into view on every stop
  useEffect(() => {
    currentRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [assemblyLines, currentLine])

  if (assemblyLines.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[#555] text-xs">
        {status === 'paused'
          ? 'No disassembly available for this frame'
          : 'Assembly appears when paused'}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      <div className="flex gap-3 px-3 py-1 text-[10px] uppercase tracking-wide text-[#969696] border-b border-[#3c3c3c] shrink-0">
        <span className="w-3 shrink-0" />
        <span className="w-36 shrink-0">Address</span>
        <span className="flex-1">Instruction</span>
        <span className="w-12 text-right">Line</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {assemblyLines.map((line, i) => {
          const isCurrent = line.sourceLine === currentLine
          return (
            <div key={i} ref={isCurrent ? currentRowRef : undefined}>
              <AsmRow line={line} isCurrent={isCurrent} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
