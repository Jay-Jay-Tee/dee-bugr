// src/components/MainLayout.tsx
// ─────────────────────────────────────────────────────────────────────────────
// 5-region resizable layout using CSS flex + custom drag handles.
// Dropped react-resizable-panels — the installed version (old API, no direction
// prop, Separator is passive) doesn't support drag out of the box at this age.
// This implementation is self-contained, zero-dependency, and works correctly.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useCallback } from 'react'
import EditorPanel from './EditorPanel'
import LeftPanel from './LeftPanel'
import RightPanel from './RightPanel'
import BottomPanel from './BottomPanel'

// ── Drag handle hooks ─────────────────────────────────────────────────────────

function useHDrag(onDelta: (dx: number) => void): React.MouseEventHandler<HTMLDivElement> {
  const lastX = useRef<number | null>(null)
  return useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    lastX.current = e.clientX
    const onMove = (ev: MouseEvent) => {
      if (lastX.current === null) return
      onDelta(ev.clientX - lastX.current)
      lastX.current = ev.clientX
    }
    const onUp = () => {
      lastX.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [onDelta])
}

function useVDrag(onDelta: (dy: number) => void): React.MouseEventHandler<HTMLDivElement> {
  const lastY = useRef<number | null>(null)
  return useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    lastY.current = e.clientY
    const onMove = (ev: MouseEvent) => {
      if (lastY.current === null) return
      onDelta(ev.clientY - lastY.current)
      lastY.current = ev.clientY
    }
    const onUp = () => {
      lastY.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [onDelta])
}

// ── Handle components ─────────────────────────────────────────────────────────

function HDivider({ onMouseDown }: { onMouseDown: React.MouseEventHandler<HTMLDivElement> }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="w-1 shrink-0 bg-[#3c3c3c] hover:bg-blue-500 active:bg-blue-400 transition-colors cursor-col-resize select-none z-10"
    />
  )
}

function VDivider({ onMouseDown }: { onMouseDown: React.MouseEventHandler<HTMLDivElement> }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="h-1 shrink-0 bg-[#3c3c3c] hover:bg-blue-500 active:bg-blue-400 transition-colors cursor-row-resize select-none z-10"
    />
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

export default function MainLayout() {
  const containerRef = useRef<HTMLDivElement>(null)
  const leftRef      = useRef<HTMLDivElement>(null)
  const rightRef     = useRef<HTMLDivElement>(null)
  const bottomRef    = useRef<HTMLDivElement>(null)

  const onDragLeft = useHDrag((dx) => {
    const el = leftRef.current
    const container = containerRef.current
    if (!el || !container) return
    const total = container.getBoundingClientRect().width
    el.style.width = `${clamp(el.getBoundingClientRect().width + dx, total * 0.12, total * 0.45)}px`
    el.style.flex = 'none'
  })

  const onDragRight = useHDrag((dx) => {
    const el = rightRef.current
    const container = containerRef.current
    if (!el || !container) return
    const total = container.getBoundingClientRect().width
    el.style.width = `${clamp(el.getBoundingClientRect().width - dx, total * 0.12, total * 0.45)}px`
    el.style.flex = 'none'
  })

  const onDragBottom = useVDrag((dy) => {
    const el = bottomRef.current
    const container = containerRef.current
    if (!el || !container) return
    const total = container.getBoundingClientRect().height
    el.style.height = `${clamp(el.getBoundingClientRect().height - dy, 80, total * 0.5)}px`
    el.style.flex = 'none'
  })

  return (
    <div ref={containerRef} className="flex flex-col flex-1 overflow-hidden">

      {/* Top row: Left | Center | Right */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        <div ref={leftRef} style={{ width: '24%' }} className="flex flex-col overflow-hidden shrink-0">
          <LeftPanel />
        </div>

        <HDivider onMouseDown={onDragLeft} />

        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <EditorPanel />
        </div>

        <HDivider onMouseDown={onDragRight} />

        <div ref={rightRef} style={{ width: '24%' }} className="flex flex-col overflow-hidden shrink-0">
          <RightPanel />
        </div>

      </div>

      <VDivider onMouseDown={onDragBottom} />

      {/* Bottom: Console */}
      <div ref={bottomRef} style={{ height: '42%' }} className="flex flex-col overflow-hidden shrink-0">
        <BottomPanel />
      </div>

    </div>
  )
}
