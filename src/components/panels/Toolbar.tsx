// src/components/panels/Toolbar.tsx

import { useCallback, useState, useEffect } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { IPC } from '../../shared/ipc'
import type { IPCChannel } from '../../shared/ipc'
import type { Language } from '../../shared/types'
// ── IPC helper ────────────────────────────────────────────────────────────────

type ElectronWindow = Window & {
  electronAPI?: { invoke: (ch: IPCChannel | 'app:openFileDialog', payload?: unknown) => Promise<unknown> }
}

function invoke(channel: IPCChannel | 'app:openFileDialog', args?: unknown) {
  return (window as ElectronWindow).electronAPI?.invoke(channel, args)
    .catch((err: unknown) => console.error(`[IPC] ${String(channel)} failed:`, err))
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><polygon points="3,1 13,7 3,13" /></svg>
}
function StopIcon() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="1" width="10" height="10" rx="1" /></svg>
}
function StepOverIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 7 A4 4 0 0 1 11 7" /><polyline points="11,4 11,7 8,7" /><line x1="3" y1="10" x2="11" y2="10" /></svg>
}
function StepInIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="7" y1="2" x2="7" y2="9" /><polyline points="4,7 7,10 10,7" /><line x1="3" y1="12" x2="11" y2="12" /></svg>
}
function StepOutIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="7" y1="12" x2="7" y2="5" /><polyline points="4,7 7,4 10,7" /><line x1="3" y1="2" x2="11" y2="2" /></svg>
}
function ContinueIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="1" y="2" width="3" height="10" rx="1" /><polygon points="6,2 13,7 6,12" /></svg>
}
function PauseIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="2" width="4" height="10" rx="1" /><rect x="8" y="2" width="4" height="10" rx="1" /></svg>
}
function RunToCursorIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="2" y1="11" x2="12" y2="11" /><line x1="7" y1="2" x2="7" y2="9" /><polyline points="4,7 7,10 10,7" /></svg>
}
function JumpToLineIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="2" y1="7" x2="10" y2="7" /><polyline points="7,4 10,7 7,10" /><line x1="12" y1="2" x2="12" y2="12" /></svg>
}
function ReturnNowIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="4,4 2,7 4,10" /><path d="M2 7 h7 a3 3 0 0 0 0-6 h-1" /></svg>
}
// Folder/browse icon for the file picker button
function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 3.5 A1 1 0 0 1 2 2.5 h3.5 l1 1.5 H12 A1 1 0 0 1 13 5 v6 A1 1 0 0 1 12 12 H2 A1 1 0 0 1 1 11 Z" />
    </svg>
  )
}

// ── Toolbar button ────────────────────────────────────────────────────────────

interface ToolbarBtnProps {
  onClick?: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
  variant?: 'default' | 'danger' | 'accent'
}

const VARIANT_CLASS = {
  default: 'text-[#cccccc] hover:bg-[#3c3c3c] hover:text-white',
  danger: 'text-[#f48771] hover:bg-[#f48771]/10',
  accent: 'text-[#75beff] hover:bg-[#75beff]/10',
} as const

function ToolbarBtn({ onClick, disabled, title, children, variant = 'default' }: Readonly<ToolbarBtnProps>) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${VARIANT_CLASS[variant]}`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-[#3c3c3c] mx-1 shrink-0" />
}

// ── Language selector ─────────────────────────────────────────────────────────

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C / C++' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java', label: 'Java' },
]

function LanguageSelector() {
  const language = useDebugStore((s) => s.language)
  const setLanguage = useDebugStore((s) => s.setLanguage)
  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as Language)}
      className="bg-[#3c3c3c] text-xs text-[#cccccc] px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-blue-500 hover:bg-[#4a4a4a] transition-colors shrink-0"
    >
      {LANGUAGES.map((l) => (
        <option key={l.value} value={l.value}>{l.label}</option>
      ))}
    </select>
  )
}

// ── Beginner / Expert toggle ──────────────────────────────────────────────────
// Fixed: the track background was 'bg-black' which is invisible on the dark
// toolbar. Changed to 'bg-[#555]' so the oval is always visible. The thumb
// (white circle) now sits inside a clearly visible pill shape in both states.

function ModeToggle() {
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)
  const toggleBeginnerMode = useDebugStore((s) => s.toggleBeginnerMode)

  return (
    <div className="flex items-center gap-2 text-xs shrink-0">
      <span className={`transition-colors ${!isBeginnerMode ? 'text-white' : 'text-[#555]'}`}>
        Expert
      </span>

      <button

        title={isBeginnerMode ? 'Switch to Expert mode' : 'Switch to Beginner mode'}
        onClick={toggleBeginnerMode}
        className={[
          'relative w-11 h-5 rounded-full transition-all duration-200 focus:outline-none shrink-0',
          // 1. Added a dark border so it's visible against #1e1e1e
          'border border-[#3c3c3c]',
          '!bg-[#1a1a1c]',
          // 3. Simple inner shadow for depth
          'shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]'
        ].join(' ')}
        role="switch"
        aria-checked={isBeginnerMode}
      >
        {/* Thumb */}
        <span
          className={[
            // Center the thumb vertically (top-[3px] for a h-5 button)
            'absolute top-[3px] w-3 h-3 rounded-full transition-transform duration-200 shadow-md',
            // 4. Thumb color changes to stay high-contrast
            isBeginnerMode ? 'bg-[#33cc33] translate-x-6' : 'bg-[#cc3333] translate-x-1',
          ].join(' ')}
        />
      </button>

      <span className={`transition-colors ${isBeginnerMode ? 'text-white' : 'text-[#555]'}`}>
        Beginner
      </span>
    </div>
  )
}

// ── Status indicator ──────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  running: 'bg-green-400 animate-pulse',
  launching: 'bg-blue-400 animate-pulse',
  paused: 'bg-yellow-400',
}

function StatusIndicator({ status }: { readonly status: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-[#969696] shrink-0 pr-4">
      <div className={`w-2 h-2 rounded-full ${STATUS_DOT[status] ?? 'bg-[#3c3c3c]'}`} />
      <span className="capitalize">{status}</span>
    </div>
  )
}

// ── Step controls ─────────────────────────────────────────────────────────────

interface StepControlsProps {
  isPaused: boolean
  isRunning: boolean
  onContinue: () => void
  onPause: () => void
  onNext: () => void
  onStepIn: () => void
  onStepOut: () => void
  onRunToCursor: () => void
  onJumpToLine: () => void
  onReturnNow: () => void
}

function StepControls({
  isPaused, isRunning,
  onContinue, onPause, onNext, onStepIn, onStepOut, onRunToCursor, onJumpToLine, onReturnNow,
}: Readonly<StepControlsProps>) {
  return (
    <>
      <ToolbarBtn title="Continue (F5)" onClick={onContinue} disabled={!isPaused}><ContinueIcon /></ToolbarBtn>
      <ToolbarBtn title="Pause" onClick={onPause} disabled={!isRunning}><PauseIcon /></ToolbarBtn>
      <ToolbarBtn title="Step Over (F10)" onClick={onNext} disabled={!isPaused}><StepOverIcon /></ToolbarBtn>
      <ToolbarBtn title="Step Into (F11)" onClick={onStepIn} disabled={!isPaused}><StepInIcon /></ToolbarBtn>
      <ToolbarBtn title="Step Out (Shift+F11)" onClick={onStepOut} disabled={!isPaused}><StepOutIcon /></ToolbarBtn>
      <ToolbarBtn title="Run to Cursor (Ctrl+F10)" onClick={onRunToCursor} disabled={!isPaused}><RunToCursorIcon /></ToolbarBtn>
      <ToolbarBtn title="Jump to Line" onClick={onJumpToLine} disabled={!isPaused}><JumpToLineIcon /></ToolbarBtn>
      <ToolbarBtn title="Return Now" onClick={onReturnNow} disabled={!isPaused}><ReturnNowIcon /></ToolbarBtn>
    </>
  )
}

// ── AI buttons ────────────────────────────────────────────────────────────────

function AIButtons({ isPaused, sourceLines, language }: {
  isPaused: boolean
  sourceLines?: string[]
  language: Language
}) {
  const handleExplain = useCallback(() => {
    globalThis.dispatchEvent(new CustomEvent('lucid:ai-explain'))
  }, [])

  const handleFix = useCallback(() => {
    globalThis.dispatchEvent(new CustomEvent('lucid:ai-fix'))
  }, [])

  const handleSuggestBPs = useCallback(async () => {
    if (!sourceLines || sourceLines.length === 0) return
    const sourceCode = sourceLines.join('\n')
    const result = await invoke(IPC.AI_SUGGEST_BPS, { sourceCode, language }) as { success?: boolean; suggestions?: unknown }
    if (result?.success && result.suggestions) {
      window.dispatchEvent(new CustomEvent('lucid:ai-suggest-bps', { detail: result.suggestions }))
    }
  }, [sourceLines, language])

  return (
    <>
      <ToolbarBtn title="Explain Bug (AI)" onClick={handleExplain} disabled={!isPaused} variant="accent">
        <span>⚡ Explain</span>
      </ToolbarBtn>
      <ToolbarBtn title="Suggest Fix (AI)" onClick={handleFix} disabled={!isPaused} variant="accent">
        <span>🔧 Fix</span>
      </ToolbarBtn>
      <ToolbarBtn title="AI: Suggest breakpoints for this file" onClick={handleSuggestBPs} variant="accent">
        <span>🎯 BPs</span>
      </ToolbarBtn>
    </>
  )
}

// ── File input bar ────────────────────────────────────────────────────────────
// The folder button opens the native OS file picker via IPC.
// The menu item "Open File" also fires 'app:fileSelected' which populates
// the input the same way — both paths converge on setValue().

const PLACEHOLDER: Record<string, string> = {
  python: 'Path to script  e.g. /home/user/script.py',
  javascript: 'Path to script  e.g. /home/user/app.js',
  cpp: 'Path to compiled binary  e.g. /home/user/program',
  c: 'Path to compiled binary  e.g. /home/user/program',
  java: 'Main class name  e.g. Main',
}

function FileInputBar({ language, onLaunch }: {
  readonly language: Language
  readonly onLaunch: (target: string) => void
}) {
  const [value, setValue] = useState('')
  const [launching, setLaunching] = useState(false)
  const status = useDebugStore((s) => s.status)

  useEffect(() => {
    if (status !== 'idle') setLaunching(false)
  }, [status])

  // Listen for the path chosen via the native menu (Open File menu item)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      if (typeof detail === 'string') setValue(detail)
    }
    // The main process sends 'app:fileSelected' via webContents.send().
    // The preload exposes it through electronAPI.on().
    const api = (window as ElectronWindow & {
      electronAPI?: {
        invoke: (ch: string, p?: unknown) => Promise<unknown>
        on: (ch: string, cb: (data: unknown) => void) => () => void
      }
    }).electronAPI
    const cleanup = api?.on('app:fileSelected', (data: unknown) => {
      if (typeof data === 'string') setValue(data)
    })
    return () => { cleanup?.() }
  }, [])


  const setState = useDebugStore((s) => s.setState)

  const handleOpen = useCallback(async () => {
    if (!value.trim()) return

    const filePath = value.trim()

    const content = await invoke(IPC.READ_FILE, filePath)

    if (typeof content === 'string') {
      const prev = useDebugStore.getState()

      setState({
        ...prev,
        currentFile: filePath,
        sourceLines: content.split('\n'),
      })
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

  // Open native file picker, then put the result in the input
  const handleBrowse = useCallback(async () => {
    const result = await invoke('app:openFileDialog') as { canceled: boolean; filePath: string | null } | undefined
    if (result && !result.canceled && result.filePath) {
      setValue(result.filePath)
    }
  }, [])

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      {/* Folder / browse button */}
      <button
        onClick={handleBrowse}
        title="Browse for file (Ctrl+O)"
        className="shrink-0 flex items-center justify-center w-7 h-7 rounded text-[#969696] hover:text-white hover:bg-[#3c3c3c] transition-colors"
      >
        <FolderIcon />
      </button>

      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={PLACEHOLDER[language] ?? 'Path to file…'}
        disabled={launching}
        className="flex-1 min-w-0 bg-[#3c3c3c] text-xs text-white placeholder:text-[#555] px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-blue-500 font-mono disabled:opacity-50"
      />

      <button
        onClick={handleOpen}
        disabled={!value.trim()}
        className="px-2 py-1.5 text-xs rounded font-medium bg-[#3c3c3c] text-white hover:bg-[#4a4a4a] transition-colors shrink-0"
      >
        Open
      </button>

      <button
        onClick={handleLaunch}
        disabled={!value.trim() || launching}
        className="px-2 py-1.5 text-xs rounded font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
      >
        {launching ? 'Launching…' : 'Go'}
      </button>
    </div>
  )
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

export default function Toolbar() {
  const status = useDebugStore((s) => s.status)
  const language = useDebugStore((s) => s.language)
  const anomalies = useDebugStore((s) => s.anomalies)
  const lastReturnVal = useDebugStore((s) => s.lastReturnValue)
  const sourceLines = useDebugStore((s) => s.sourceLines)
  const currentFile = useDebugStore((s) => s.currentFile)
  const currentLine = useDebugStore((s) => s.currentLine)

  const isRunning = status === 'running' || status === 'launching'
  const isPaused = status === 'paused'

  const handleLaunch = useCallback((target: string) => { invoke(IPC.LAUNCH, { language, target }) }, [language])
  const handleStop = useCallback(() => invoke(IPC.TERMINATE), [])
  const handleContinue = useCallback(() => invoke(IPC.CONTINUE), [])
  const handlePause = useCallback(() => invoke(IPC.PAUSE), [])
  const handleNext = useCallback(() => invoke(IPC.NEXT), [])
  const handleStepIn = useCallback(() => invoke(IPC.STEP_IN), [])
  const handleStepOut = useCallback(() => invoke(IPC.STEP_OUT), [])
  const handleRunToCursor = useCallback(() => {
    if (currentFile && currentLine) invoke(IPC.RUN_TO_CURSOR, { file: currentFile, line: currentLine })
  }, [currentFile, currentLine])
  const handleJumpToLine = useCallback(() => {
    if (currentFile && currentLine) invoke(IPC.GOTO_LINE, { file: currentFile, line: currentLine })
  }, [currentFile, currentLine])
  const handleReturnNow = useCallback(() => invoke(IPC.RETURN_NOW), [])

  return (
    <div className="h-11 bg-[#1e1e1e] border-b border-[#3c3c3c] flex items-center px-2 gap-1 shrink-0 overflow-x-auto">
      <div className="w-2 shrink-0" />
      <LanguageSelector />
      <Divider />

      {(isRunning || isPaused)
        ? <ToolbarBtn title="Stop (Shift+F5)" onClick={handleStop} variant="danger"><StopIcon /><span>Stop</span></ToolbarBtn>
        : <FileInputBar language={language} onLaunch={handleLaunch} />
      }

      <Divider />

      <StepControls
        isPaused={isPaused}
        isRunning={isRunning}
        onContinue={handleContinue}
        onPause={handlePause}
        onNext={handleNext}
        onStepIn={handleStepIn}
        onStepOut={handleStepOut}
        onRunToCursor={handleRunToCursor}
        onJumpToLine={handleJumpToLine}
        onReturnNow={handleReturnNow}
      />

      <Divider />

      <AIButtons isPaused={isPaused} sourceLines={sourceLines} language={language} />

      {/* Return value badge */}
      {lastReturnVal && isPaused && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#2d2d2d] text-xs ml-1 shrink-0">
          <span className="text-[#969696]">↩ {lastReturnVal.fnName}:</span>
          <span className="text-[#4ec9b0] font-mono">{lastReturnVal.value}</span>
        </div>
      )}

      {/* Anomaly badge */}
      {anomalies.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-900/40 text-xs ml-1 text-amber-300 shrink-0">
          ⚠ {anomalies.length} {anomalies.length === 1 ? 'anomaly' : 'anomalies'}
        </div>
      )}

      <div className="flex-1 min-w-2" />
      <ModeToggle />
      <Divider />
      <div className="w-2 shrink-0" />
      <StatusIndicator status={status} />
      <div className="w-1" />
    </div>
  )
}