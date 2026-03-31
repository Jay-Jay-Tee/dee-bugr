// src/components/panels/subpanels/FileInputBar.tsx
// File launcher bar with native file picker and Go button.
//
// FIXES:
//   1. Indentation bug in status useEffect
//   2. Folder selection updates target path
//   3. Launching state is correctly reset on status changes
//   4. "Go" launches the debugger session

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

interface Props {
  onLaunch: (target: string) => void
}

const PLACEHOLDER: Record<Language, string> = {
  python: 'Path to Python script (.py)',
  javascript: 'Path to JavaScript file (.js/.mjs/.cjs)',
  java: 'Path to Java file (.java)',
  c: 'Path to C file (.c)',
  cpp: 'Path to C/C++ file (.cpp/.cc/.cxx)',
}

function detectLanguageFromPath(filePath: string): Language | null {
  const p = filePath.toLowerCase()
  if (p.endsWith('.py')) return 'python'
  if (p.endsWith('.js') || p.endsWith('.mjs') || p.endsWith('.cjs')) return 'javascript'
  if (p.endsWith('.java')) return 'java'
  if (p.endsWith('.c')) return 'c'
  if (p.endsWith('.cc') || p.endsWith('.cp') || p.endsWith('.cxx') || p.endsWith('.cpp') || p.endsWith('.c++')) return 'cpp'
  return null
}

export default function FileInputBar({ onLaunch }: Readonly<Props>) {
  // Initialize from localStorage to persist selection across debug sessions
  const [value,     setValue]     = useState(() => {
    try {
      return sessionStorage.getItem('lastSelectedFile') || ''
    } catch {
      return ''
    }
  })
  const [launching, setLaunching] = useState(false)
  const status      = useDebugStore((s) => s.status)
  const language    = useDebugStore((s) => s.language)
  const setState    = useDebugStore((s) => s.setState)
  const setLanguage = useDebugStore((s) => s.setLanguage)
  const fileName = value.split(/[/\\]/).pop() || value

  const applyDetectedLanguage = useCallback((filePath: string) => {
    const detected = detectLanguageFromPath(filePath)
    if (detected && detected !== language) {
      setLanguage(detected)
    }
  }, [language, setLanguage])

  // Persist file selection to sessionStorage so it survives debug session restarts
  useEffect(() => {
    try {
      if (value) {
        sessionStorage.setItem('lastSelectedFile', value)
      }
    } catch {
      // sessionStorage might be unavailable in some contexts
    }
  }, [value])

  // FIX 1: correct indentation + reset launching when session ends/starts
  useEffect(() => {
    if (status === 'idle' || status === 'terminated') setLaunching(false)
  }, [status])

  // Listen for file selections coming from the native menu (Ctrl+O)
  useEffect(() => {
    const cleanup = (window as ElectronWindow).electronAPI?.on('app:fileSelected', (data: unknown) => {
      if (typeof data === 'string') {
        setValue(data)
        applyDetectedLanguage(data)
      }
    })
    return () => { cleanup?.() }
  }, [applyDetectedLanguage])

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

  // "Go" — write buffer to disk if scratch, then launch debugger
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

  const handleBrowse = useCallback(async () => {
    const result = await invoke('app:openFileDialog') as { canceled: boolean; filePath: string | null } | undefined
    if (result && !result.canceled && result.filePath) {
      setValue(result.filePath)
      applyDetectedLanguage(result.filePath)
    }
  }, [applyDetectedLanguage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void handleLaunch()
    }
  }, [handleLaunch])

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      <button onClick={handleBrowse} title="Browse for file (Ctrl+O)"
        className="shrink-0 flex items-center justify-center w-7 h-7 rounded text-[#969696] hover:text-white hover:bg-[#3c3c3c] transition-colors">
        <FolderIcon />
      </button>
      
      {/* Editable path input field */}
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={PLACEHOLDER[language]}
        title="Enter path to file or script"
        className="px-2 py-1.5 text-xs rounded bg-[#252526] text-[#cccccc] border border-[#3c3c3c] flex-1 min-w-0 hover:border-[#555555] focus:outline-none focus:border-[#0e639c] transition-colors"
      />
      
      {/* Filename display textbox */}
      <div
        title={value || 'No file selected'}
        className="px-3 py-1.5 text-xs font-semibold rounded bg-gradient-to-r from-[#2d5a7b] to-[#1e3a4d] text-[#61dafb] border-2 border-[#0e639c] shrink-0 w-40 text-ellipsis overflow-hidden whitespace-nowrap pointer-events-none shadow-lg shadow-[#0e639c]/20 hover:from-[#34648f] hover:to-[#25445a] transition-all"
      >
        {value ? fileName : 'No file'}
      </div>
      
      <button onClick={handleLaunch} disabled={!value.trim() || launching}
        title="Launch debug session"
        className="px-2 py-1.5 text-xs rounded font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
        {launching ? 'Launching…' : 'Go ▶'}
      </button>
    </div>
  )
}
