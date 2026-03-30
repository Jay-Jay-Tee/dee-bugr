// src/components/panels/subpanels/FileInputBar.tsx
// File path input with native file picker and Open/Go buttons.
// Extracted from ToolBar.tsx.

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
  const status   = useDebugStore((s) => s.status)
  const setState = useDebugStore((s) => s.setState)

  useEffect(() => { if (status !== 'idle') setLaunching(false) }, [status])

  useEffect(() => {
    const cleanup = (window as ElectronWindow).electronAPI?.on('app:fileSelected', (data: unknown) => {
      if (typeof data === 'string') setValue(data)
    })
    return () => { cleanup?.() }
  }, [])

  const handleOpen = useCallback(async () => {
    const filePath = value.trim()
    if (!filePath) return
    const content = await invoke(IPC.READ_FILE as AnyChannel, filePath)
    if (typeof content === 'string') {
      const prev = useDebugStore.getState()
      setState({ ...prev, currentFile: filePath, sourceLines: content.split('\n') })
    }
  }, [value, setState])

  const handleLaunch = useCallback(() => {
    if (!value.trim() || launching) return
    setLaunching(true)
    onLaunch(value.trim())
  }, [value, launching, onLaunch])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleOpen()
  }, [handleOpen])

  const handleBrowse = useCallback(async () => {
    const result = await invoke('app:openFileDialog') as { canceled: boolean; filePath: string | null } | undefined
    if (result && !result.canceled && result.filePath) setValue(result.filePath)
  }, [])

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      <button onClick={handleBrowse} title="Browse for file (Ctrl+O)"
        className="shrink-0 flex items-center justify-center w-7 h-7 rounded text-[#969696] hover:text-white hover:bg-[#3c3c3c] transition-colors">
        <FolderIcon />
      </button>
      <input type="text" value={value} onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown} placeholder={PLACEHOLDER[language] ?? 'Path to file…'}
        disabled={launching}
        className="flex-1 min-w-0 bg-[#3c3c3c] text-xs text-white placeholder:text-[#555] px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-blue-500 font-mono disabled:opacity-50" />
      <button onClick={handleOpen} disabled={!value.trim()}
        className="px-2 py-1.5 text-xs rounded font-medium bg-[#3c3c3c] text-white hover:bg-[#4a4a4a] transition-colors shrink-0">
        Open
      </button>
      <button onClick={handleLaunch} disabled={!value.trim() || launching}
        className="px-2 py-1.5 text-xs rounded font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
        {launching ? 'Launching…' : 'Go'}
      </button>
    </div>
  )
}
