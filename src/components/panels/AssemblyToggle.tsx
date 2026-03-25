// src/components/panels/AssemblyToggle.tsx
// Day 6 — wraps the code editor with an optional assembly view below it.
// The toggle button lives in the editor header bar.
// P3's assembly panel slots in via the `assemblyPanel` prop.

import { useState, useRef, useCallback } from 'react'

interface Props {
  editorSlot:   React.ReactNode
  assemblySlot: React.ReactNode
  hideToggle?:  boolean
}

const MIN_ASM_HEIGHT = 100
const DEFAULT_ASM_HEIGHT = 220

function AsmIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <line x1="2" y1="3"  x2="7"  y2="3" />
      <line x1="2" y1="6"  x2="11" y2="6" />
      <line x1="2" y1="9"  x2="9"  y2="9" />
    </svg>
  )
}

export default function AssemblyToggle({ editorSlot, assemblySlot, hideToggle }: Readonly<Props>) {
  const [showAsm, setShowAsm] = useState(false)
  const [asmHeight, setAsmHeight] = useState(DEFAULT_ASM_HEIGHT)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastY = useRef<number | null>(null)

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    lastY.current = e.clientY
    const onMove = (ev: MouseEvent) => {
      if (lastY.current === null || !containerRef.current) return
      const delta = lastY.current - ev.clientY
      lastY.current = ev.clientY
      setAsmHeight((h) => {
        const total = containerRef.current!.getBoundingClientRect().height
        return Math.min(Math.max(h + delta, MIN_ASM_HEIGHT), total * 0.6)
      })
    }
    const onUp = () => {
      lastY.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden">

      {/* Editor header with toggle */}
      <div className="flex items-center justify-end px-2 py-0.5 bg-[#1e1e1e] border-b border-[#3c3c3c] shrink-0">
        <button
          style={{ visibility: hideToggle ? 'hidden' : 'visible' }}
          onClick={() => setShowAsm((v) => !v)}
          title="Toggle assembly view"
          className={[
            'flex items-center gap-1.5 text-[11px] px-2 py-1 rounded transition-colors',
            showAsm
              ? 'bg-blue-600/20 text-[#75beff]'
              : 'text-[#555] hover:text-[#969696] hover:bg-[#3c3c3c]',
          ].join(' ')}
        >
          <AsmIcon />
          <span>Assembly</span>
        </button>
      </div>

      {/* Editor — takes remaining space */}
      <div className="flex-1 overflow-hidden min-h-0">
        {editorSlot}
      </div>

      {/* Drag handle + assembly panel */}
      {showAsm && (
        <>
          <div
            onMouseDown={onDragStart}
            className="h-1 shrink-0 bg-[#3c3c3c] hover:bg-blue-500 active:bg-blue-400 transition-colors cursor-row-resize select-none"
          />
          <div style={{ height: asmHeight }} className="shrink-0 overflow-hidden">
            {assemblySlot}
          </div>
        </>
      )}
    </div>
  )
}
