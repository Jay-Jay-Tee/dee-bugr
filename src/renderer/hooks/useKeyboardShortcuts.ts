// src/renderer/hooks/useKeyboardShortcuts.ts
// Standard debugger keyboard shortcuts wired to IPC.
// Mount once via App.tsx — replaces the inline useEffect that was there.
//
// F5              = Continue (when paused) / Launch (when idle)
// Shift+F5        = Terminate
// F9              = Toggle breakpoint at current line
// F10             = Step Over
// F11             = Step Into
// Shift+F11       = Step Out
// Ctrl+F10        = Run to Cursor (Day 5)

import { useEffect } from 'react'
import { useDebugStore } from '../store/debugStore'
import { IPC } from '../../shared/ipc'
import type { IPCChannel } from '../../shared/ipc'

type ElectronWindow = Window & {
  electronAPI?: { invoke: (ch: IPCChannel, args?: unknown) => Promise<unknown> }
}

function invoke(channel: IPCChannel, args?: unknown) {
  return (window as ElectronWindow).electronAPI?.invoke(channel, args)
    .catch((err: unknown) => console.error(`[Shortcut] ${channel} failed:`, err))
}

// Bug 5 fix: F9 reads fresh store state — no stale closure.
// Defined at module level, not inside a hook, to avoid invalid hook call.
function handleF9() {
  const { currentFile, currentLine, toggleBreakpoint } = useDebugStore.getState()
  if (currentFile && currentLine) toggleBreakpoint(currentFile, currentLine)
}

export function useKeyboardShortcuts() {
  const status = useDebugStore((s) => s.status)

  useEffect(() => {
    const isPaused  = status === 'paused'
    const isRunning = status === 'running' || status === 'launching'
    const isActive  = isPaused || isRunning

    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (true) {
        case e.key === 'F5' && !e.shiftKey:
          e.preventDefault()
          if (isPaused) invoke(IPC.CONTINUE)
          break

        case e.key === 'F5' && e.shiftKey:
          e.preventDefault()
          if (isActive) invoke(IPC.TERMINATE)
          break

        case e.key === 'F9':
          e.preventDefault()
          handleF9()
          break

        case e.key === 'F10' && !e.ctrlKey:
          e.preventDefault()
          if (isPaused) invoke(IPC.NEXT)
          break

        // Day 5: Ctrl+F10 = Run to Cursor
        case e.key === 'F10' && e.ctrlKey:
          e.preventDefault()
          if (isPaused) invoke(IPC.RUN_TO_CURSOR)
          break

        case e.key === 'F11' && !e.shiftKey:
          e.preventDefault()
          if (isPaused) invoke(IPC.STEP_IN)
          break

        case e.key === 'F11' && e.shiftKey:
          e.preventDefault()
          if (isPaused) invoke(IPC.STEP_OUT)
          break

        default:
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [status])
}
