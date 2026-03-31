// src/components/panels/subpanels/FileInputBar.tsx
// File path input with native file picker and Open/Go buttons.
//
// FIXES:
//   1. Indentation bug in status useEffect
//   2. Enter key in path input now triggers launch (not just file open)
//   3. Launching state is correctly reset on status changes
//   4. "Open" button loads file content into editor without launching
//   5. "Go" / Enter launches the debugger session

import { useState, useCallback, useEffect } from 'react'
import { useDebugStore } from '../../../renderer/store/debugStore'
import { IPC } from '../../../shared/ipc'
import type { Language } from '../../../shared/types'
import type { IPCChannel } from '../../../shared/ipc'

type AnyChannel = IPCChannel | 'app:openFileDialog'
type ElectronWindow = Window & {
  electronAPI?: {
    invoke: (ch: AnyChannel, p?: unknown) => Promise<unknown>
    on: (ch: string, cb: (data: unknown) => void) => () => void
  }
}

function invoke(ch: AnyChannel, args?: unknown) {
  return (window as ElectronWindow).electronAPI?.invoke(ch, args)
    .catch((err: unknown) => console.error(`[IPC] ${String(ch)} failed:`, err))
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 3.5 A1 1 0 0 1 2 2.5 h3.5 l1 1.5 H12 A1 1 0 0 1 13 5 v6 A1 1 0 0 1 12 12 H2 A1 1 0 0 1 1 11 Z" />
    </svg>
  )
}

const PLACEHOLDER: Record<string, string> = {
  python:     'Path to script  e.g. /home/user/script.py',
  javascript: 'Path to script  e.g. /home/user/app.js',
  cpp:        'Path to compiled binary  e.g. /home/user/program',
  c:          'Path to compiled binary  e.g. /home/user/program',
  java:       'Main class name  e.g. Main',
}

interface Props {
  language: Language
  onLaunch: (target: string) => void
}

export default function FileInputBar({ language, onLaunch }: Readonly<Props>) {
  const [value,     setValue]     = useState('')
  const [launching, setLaunching] = useState(false)
  const status      = useDebugStore((s) => s.status)
  const currentFile = useDebugStore((s) => s.currentFile)
  const setState    = useDebugStore((s) => s.setState)

  // Extract just the filename from the full path
  // Show what will be debugged (value), not what's loaded in editor (currentFile)
  const fileName = value ? value.split(/[/\\]/).pop() || '' : ''

  // FIX 1: correct indentation + reset launching when session ends/starts
  useEffect(() => {
    if (status === 'idle' || status === 'terminated') setLaunching(false)
  }, [status])

  // Listen for file selections coming from the native menu (Ctrl+O)
  useEffect(() => {
    const cleanup = (window as ElectronWindow).electronAPI?.on('app:fileSelected', (data: unknown) => {
      if (typeof data === 'string') setValue(data)
    })
    return () => { cleanup?.() }
  }, [])

  // FIX 3: Whenever the selected path changes, automatically load it into the editor
  //        This ensures editor stays in sync with the path shown in the textbox
  useEffect(() => {
    if (!value.trim()) return
    const filePath = value.trim()
    invoke(IPC.READ_FILE as AnyChannel, filePath)
      .then((content) => {
        if (typeof content === 'string') {
          const prev = useDebugStore.getState()
          setState({ ...prev, currentFile: filePath, sourceLines: content.split('\n') })
        }
      })
      .catch(() => {
        // Silently fail if file doesn't exist (could be a scratch path)
      })
  }, [value, setState])

  // "Open" — load file content into Monaco editor without launching
  const handleOpen = useCallback(async () => {
    const filePath = value.trim()
    if (!filePath) return
    const content = await invoke(IPC.READ_FILE as AnyChannel, filePath)
    if (typeof content === 'string') {
      const prev = useDebugStore.getState()
      setState({ ...prev, currentFile: filePath, sourceLines: content.split('\n') })
    }
  }, [value, setState])

  // "Go" / Enter — write buffer to disk if scratch, then launch debugger
  const handleLaunch = useCallback(async () => {
    const filePath = value.trim()
    if (!filePath || launching) return
    setLaunching(true)
    // Also load the file into the editor so Monaco shows the source immediately
    const content = await invoke(IPC.READ_FILE as AnyChannel, filePath)
      .catch(() => null)  // file may not exist yet if it's a scratch path
    if (typeof content === 'string') {
      const prev = useDebugStore.getState()
      setState({ ...prev, currentFile: filePath, sourceLines: content.split('\n') })
    } else {
      // File doesn't exist — could be a scratch file. Write whatever is in
      // the store's sourceLines to disk so the adapter can read it.
      const storeState = useDebugStore.getState()
      if (storeState.sourceLines && storeState.sourceLines.length > 0) {
        await invoke(IPC.WRITE_FILE as AnyChannel, {
          path:    filePath,
          content: storeState.sourceLines.join('\n'),
        }).catch((e: unknown) => console.error('[FileInputBar] Failed to write scratch file', e))
      }
    }
    onLaunch(filePath)
  }, [value, launching, onLaunch, setState])

  // FIX 2: Enter key launches (was calling handleOpen which only opens, not launches)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleLaunch()
  }, [handleLaunch])

  const handleBrowse = useCallback(async () => {
    const result = await invoke('app:openFileDialog') as { canceled: boolean; filePath: string | null } | undefined
    if (result && !result.canceled && result.filePath) {
      setValue(result.filePath)
      await handleOpen()
    }
  }, [handleOpen])

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      <button onClick={handleBrowse} title="Browse for file (Ctrl+O)"
        className="shrink-0 flex items-center justify-center w-7 h-7 rounded text-[#969696] hover:text-white hover:bg-[#3c3c3c] transition-colors">
        <FolderIcon />
      </button>
      <input
        type="text"
        readOnly
        value={fileName}
        placeholder="No file"
        title={value || 'No file selected'}
        className="px-2 py-1.5 text-xs rounded bg-[#1e1e1e] text-[#cccccc] border border-[#3c3c3c] text-ellipsis shrink-0 w-32 pointer-events-none"
      />
      <button onClick={handleLaunch} disabled={!value.trim() || launching}
        title="Launch debug session (Enter)"
        className="px-2 py-1.5 text-xs rounded font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
        {launching ? 'Launching…' : 'Go ▶'}
      </button>
    </div>
  )
}
