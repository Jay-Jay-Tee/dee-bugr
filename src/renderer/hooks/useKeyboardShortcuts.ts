// src/renderer/hooks/useKeyboardShortcuts.ts
// Standard debugger keyboard shortcuts — wired to IPC.
// Mount this once in App.tsx or MainLayout.tsx.
//
// F5        = Continue
// F9        = Toggle breakpoint at current cursor line (dispatched via custom event)
// F10       = Step Over
// F11       = Step Into
// Shift+F11 = Step Out
// Shift+F5  = Stop / Terminate

import { useEffect } from 'react'
import { useDebugStore } from '../store/debugStore'
import { IPC } from '../../shared/ipc'
import type { IPCChannel } from '../../shared/ipc'

function invoke(channel: IPCChannel, args?: unknown) {
  return globalThis.electronAPI?.invoke(channel, args)
    .catch((err: unknown) => console.error(`[Shortcut] ${channel} failed:`, err))
}

export function useKeyboardShortcuts() {
  const status = useDebugStore((s) => s.status)

  useEffect(() => {
    const isPaused  = status === 'paused'
    const isRunning = status === 'running' || status === 'launching'
    const isActive  = isPaused || isRunning

    function handler(e: KeyboardEvent) {
      // Don't fire shortcuts while user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

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
          // Dispatch a custom event — CodeEditor listens to it and toggles
          // the breakpoint at the current Monaco cursor position
          window.dispatchEvent(new CustomEvent('lucid:toggle-bp-at-cursor'))
          break

        case e.key === 'F10':
          e.preventDefault()
          if (isPaused) invoke(IPC.NEXT)
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
