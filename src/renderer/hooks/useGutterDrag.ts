// src/renderer/hooks/useGutterDrag.ts
// Day 8 — Drag the execution arrow in the Monaco gutter to a new line
// to invoke jump-to-line (IPC.GOTO_LINE).
//
// How it works:
//   - On mousedown on the execution arrow glyph (lucid-exec-arrow),
//     we enter drag mode.
//   - A full-height overlay div captures all mouse events so the editor
//     doesn't interfere.
//   - On mouseup we compute the target line from the Y position using
//     editor.getTargetAtClientPoint, then call IPC.GOTO_LINE.
//
// Usage in CodeEditor:
//   const { isDragging, dragOverlay } = useGutterDrag(editorRef, monacoRef)
//   return <div style={{ position: 'relative' }}>{dragOverlay}{<MonacoEditor .../>}</div>

import { useState, useCallback, useRef } from 'react'
import type * as Monaco from 'monaco-editor'
import { IPC } from '../../shared/ipc'

type AnyIPC = typeof IPC[keyof typeof IPC]

function invoke(channel: AnyIPC, args?: unknown) {
  return (window as Window & {
    electronAPI?: { invoke: (ch: AnyIPC, args?: unknown) => Promise<unknown> }
  }).electronAPI?.invoke(channel, args)
    .catch((err: unknown) => console.error('[GutterDrag]', err))
}

interface UseGutterDragResult {
  isDragging:  boolean
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void
}

export function useGutterDrag(
  editorRef: React.RefObject<Monaco.editor.IStandaloneCodeEditor | null>,
  getFile:   () => string,
): UseGutterDragResult {
  const [isDragging, setIsDragging] = useState(false)
  const dragLineRef = useRef<number>(0)

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    // Only start drag if clicking the execution arrow glyph
    if (!target.classList.contains('lucid-exec-arrow') &&
        !target.closest?.('.lucid-exec-arrow')) return

    e.preventDefault()
    setIsDragging(true)

    const editor = editorRef.current
    if (!editor) return

    const onMouseMove = (mv: MouseEvent) => {
      const pos = editor.getTargetAtClientPoint(mv.clientX, mv.clientY)
      if (pos?.position) {
        dragLineRef.current = pos.position.lineNumber
      }
    }

    const onMouseUp = () => {
      setIsDragging(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',  onMouseUp)

      const line = dragLineRef.current
      const file = getFile()
      if (line > 0 && file) {
        invoke(IPC.GOTO_LINE, { file, line })
      }
      dragLineRef.current = 0
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
  }, [editorRef, getFile])

  return { isDragging, onMouseDown }
}
