// src/components/panels/SessionErrorBanner.tsx
// Day 8 — Shown when the debug adapter crashes or the session terminates
// unexpectedly. Displays the last error and offers Relaunch / Dismiss.
// Reads status from the store. If status is 'terminated' AND an errorMessage
// is present, the banner appears.

import { useState, useCallback } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { IPC } from '../../shared/ipc'

type AnyIPC = typeof IPC[keyof typeof IPC]

function invoke(channel: AnyIPC, args?: unknown) {
  return (window as Window & {
    electronAPI?: { invoke: (ch: AnyIPC, args?: unknown) => Promise<unknown> }
  }).electronAPI?.invoke(channel, args)
    .catch((err: unknown) => console.error('[SessionError]', err))
}

export default function SessionErrorBanner() {
  const status       = useDebugStore((s) => s.status)
  const errorMessage = useDebugStore((s) => s.errorMessage)
  const language     = useDebugStore((s) => s.language)
  const currentFile  = useDebugStore((s) => s.currentFile)
  const setStatus    = useDebugStore((s) => s.setStatus)

  const [dismissed, setDismissed] = useState(false)
  const [relaunching, setRelaunching] = useState(false)

  // Reset dismissed state whenever a new session starts
  const isTerminated = status === 'terminated'
  if (!isTerminated && dismissed) setDismissed(false)

  const handleRelaunch = useCallback(async () => {
    if (!currentFile) return
    setRelaunching(true)
    await invoke(IPC.LAUNCH, { language, target: currentFile })
    setRelaunching(false)
    setDismissed(true)
  }, [language, currentFile])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    setStatus('idle')
  }, [setStatus])

  if (!isTerminated || dismissed || !errorMessage) return null

  return (
    <div className="shrink-0 flex items-start gap-3 px-3 py-2 bg-red-950/60 border-b border-red-800/60">
      <span className="text-red-400 text-sm shrink-0 mt-0.5">⛔</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-red-300 font-medium mb-0.5">Session terminated</div>
        <div className="text-[11px] text-red-400/80 font-mono truncate" title={errorMessage}>
          {errorMessage}
        </div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        {currentFile && (
          <button
            onClick={handleRelaunch}
            disabled={relaunching}
            className="text-[11px] px-2.5 py-1 rounded bg-red-800 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {relaunching ? 'Launching…' : '↺ Relaunch'}
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="text-[11px] px-2 py-1 rounded text-red-400 hover:text-white hover:bg-red-900/50 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
