// src/components/panels/FixDiffPanel.tsx
// Day 5 — shows the AI fix suggestion as a Monaco DiffEditor.
// Receives the diff string from P4 via the aiFixDiff field in debugStore.
// Accept button applies the fix; Reject clears it.

import { useRef, useCallback } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import type { DiffOnMount } from '@monaco-editor/react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { IPC } from '../../shared/ipc'

function invoke(channel: typeof IPC[keyof typeof IPC], args?: unknown) {
  return globalThis.electronAPI?.invoke(channel, args)
    .catch((err: unknown) => console.error('[FixDiff]', err))
}

const DIFF_OPTIONS = {
  fontSize: 12,
  readOnly: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  renderSideBySide: true,
  automaticLayout: true,
} as const

export default function FixDiffPanel() {
  const aiFixDiff      = useDebugStore((s) => s.aiFixDiff)
  const sourceLines    = useDebugStore((s) => s.sourceLines)
  const setState       = useDebugStore((s) => s.setState)
  const storeSnapshot  = useDebugStore((s) => s)

  const editorRef = useRef<Parameters<DiffOnMount>[0] | null>(null)

  const handleMount: DiffOnMount = useCallback((editor) => {
    editorRef.current = editor
  }, [])

  const handleReject = useCallback(() => {
    setState({ ...storeSnapshot, aiFixDiff: '' })
  }, [setState, storeSnapshot])

  const handleAccept = useCallback(async () => {
    const modified = editorRef.current?.getModifiedEditor().getValue()
    if (!modified) return
    await invoke(IPC.AI_FIX, { accepted: true, content: modified })
    setState({ ...storeSnapshot, aiFixDiff: '' })
  }, [setState, storeSnapshot])

  if (!aiFixDiff) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[#555] text-xs px-4 text-center">
        <span>No fix suggestion yet.</span>
        <span className="text-[10px]">Click "Fix" in the toolbar while paused at an error.</span>
      </div>
    )
  }

  const originalSource = sourceLines?.join('\n') ?? ''

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-1.5 border-b border-[#3c3c3c] shrink-0 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-[#969696]">Suggested fix</span>
        <div className="flex gap-1.5">
          <button
            onClick={handleReject}
            className="text-[11px] px-2.5 py-1 rounded border border-[#3c3c3c] text-[#f48771] hover:bg-[#f48771]/10 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={handleAccept}
            className="text-[11px] px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <DiffEditor
          height="100%"
          theme="vs-dark"
          original={originalSource}
          modified={aiFixDiff}
          options={DIFF_OPTIONS}
          onMount={handleMount}
        />
      </div>
    </div>
  )
}
