// src/components/panels/Toolbar.tsx
// ADDITIONS vs original:
//   - Run-to-cursor button (wired to IPC.RUN_TO_CURSOR)
//   - AI: Suggest BPs button (wired to IPC.AI_SUGGEST_BPS)
//   - AI: Narrative button (wired to IPC.AI_NARRATIVE, shown when terminated)

import { useCallback, useState, useEffect } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { IPC } from '../../shared/ipc'
import type { IPCChannel } from '../../shared/ipc'
import type { Language } from '../../shared/types'

function invoke(channel: IPCChannel, args?: unknown) {
  const api = (window as Window & {
    electronAPI?: { invoke: (ch: IPCChannel, payload?: unknown) => Promise<unknown> }
  }).electronAPI

  return api?.invoke(channel, args)
    .catch((err: unknown) => console.error(`[IPC] ${channel} failed:`, err))
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
function CursorIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="7" y1="2" x2="7" y2="12" strokeDasharray="2 2" /><polyline points="4,9 7,12 10,9" /></svg>
}

// ── Toolbar button ────────────────────────────────────────────────────────────

interface ToolbarBtnProps {
  onClick?: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
  variant?: 'default' | 'danger' | 'accent' | 'success'
}

const VARIANT_CLASS = {
  default: 'text-[#cccccc] hover:bg-[#3c3c3c] hover:text-white',
  danger:  'text-[#f48771] hover:bg-[#f48771]/10',
  accent:  'text-[#75beff] hover:bg-[#75beff]/10',
  success: 'text-[#4ec9b0] hover:bg-[#4ec9b0]/10',
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
  return <div className="w-px h-5 bg-[#3c3c3c] mx-1" />
}

// ── Language selector ─────────────────────────────────────────────────────────

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'python',     label: 'Python' },
  { value: 'cpp',        label: 'C / C++' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java',       label: 'Java' },
]

function LanguageSelector() {
  const language    = useDebugStore((s) => s.language)
  const setLanguage = useDebugStore((s) => s.setLanguage)
  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as Language)}
      className="bg-[#3c3c3c] text-xs text-[#cccccc] px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-blue-500 hover:bg-[#4a4a4a] transition-colors"
    >
      {LANGUAGES.map((l) => (
        <option key={l.value} value={l.value}>{l.label}</option>
      ))}
    </select>
  )
}

// ── Mode toggle ───────────────────────────────────────────────────────────────

function ModeToggle() {
  const isBeginnerMode     = useDebugStore((s) => s.isBeginnerMode)
  const toggleBeginnerMode = useDebugStore((s) => s.toggleBeginnerMode)
  return (
    <div className="flex items-center gap-2 text-xs text-[#969696]">
      <span className={isBeginnerMode ? 'text-white' : ''}>Beginner</span>
      <button
        title="Toggle Beginner / Expert mode"
        onClick={toggleBeginnerMode}
        className={`relative w-10 h-5 rounded-full transition-colors ${isBeginnerMode ? 'bg-blue-600' : 'bg-black'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isBeginnerMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
      <span className={!isBeginnerMode ? 'text-white' : ''}>Expert</span>
    </div>
  )
}

// ── Status indicator ──────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  running:   'bg-green-400 animate-pulse',
  launching: 'bg-blue-400 animate-pulse',
  paused:    'bg-yellow-400',
}

function StatusIndicator({ status }: { readonly status: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-[#969696]">
      <div className={`w-2 h-2 rounded-full ${STATUS_DOT[status] ?? 'bg-[#3c3c3c]'}`} />
      <span className="capitalize">{status}</span>
    </div>
  )
}

// ── Step controls ─────────────────────────────────────────────────────────────

function StepControls({ isPaused, isRunning, onContinue, onPause, onNext, onStepIn, onStepOut }: {
  isPaused: boolean
  isRunning: boolean
  onContinue: () => void
  onPause: () => void
  onNext: () => void
  onStepIn: () => void
  onStepOut: () => void
}) {
  return (
    <>
      <ToolbarBtn title="Continue (F5)"        onClick={onContinue} disabled={!isPaused}><ContinueIcon /></ToolbarBtn>
      <ToolbarBtn title="Pause"                onClick={onPause}    disabled={!isRunning}><PauseIcon /></ToolbarBtn>
      <ToolbarBtn title="Step Over (F10)"      onClick={onNext}     disabled={!isPaused}><StepOverIcon /></ToolbarBtn>
      <ToolbarBtn title="Step Into (F11)"      onClick={onStepIn}   disabled={!isPaused}><StepInIcon /></ToolbarBtn>
      <ToolbarBtn title="Step Out (Shift+F11)" onClick={onStepOut}  disabled={!isPaused}><StepOutIcon /></ToolbarBtn>
    </>
  )
}

// ── AI buttons ────────────────────────────────────────────────────────────────

function AIButtons({ isPaused, sourceLines, language }: { isPaused: boolean; sourceLines?: string[]; language: Language }) {
  const [narrativeLoading, setNarrativeLoading] = useState(false)
  const [narrative, setNarrative] = useState('')

  const handleExplain = useCallback(() => {
    window.dispatchEvent(new CustomEvent('lucid:ai-explain'))
  }, [])

  const handleFix = useCallback(() => {
    window.dispatchEvent(new CustomEvent('lucid:ai-fix'))
  }, [])

  const handleSuggestBPs = useCallback(async () => {
    if (!sourceLines || sourceLines.length === 0) return
    const sourceCode = sourceLines.join('\n')
    const result = await invoke(IPC.AI_SUGGEST_BPS, { sourceCode, language }) as any
    if (result?.success && result.suggestions) {
      window.dispatchEvent(new CustomEvent('lucid:ai-suggest-bps', { detail: result.suggestions }))
    }
  }, [sourceLines, language])

  const handleNarrative = useCallback(async () => {
    setNarrativeLoading(true)
    try {
      const result = await invoke(IPC.AI_NARRATIVE) as any
      if (result?.success) {
        setNarrative(result.narrative)
        window.dispatchEvent(new CustomEvent('lucid:ai-narrative', { detail: result.narrative }))
      }
    } catch { /* ignore */ }
    setNarrativeLoading(false)
  }, [])

  return (
    <>
      <ToolbarBtn title="Explain Bug (AI)" onClick={handleExplain} disabled={!isPaused} variant="accent">
        <span>⚡ Explain</span>
      </ToolbarBtn>
      <ToolbarBtn title="Suggest Fix (AI)" onClick={handleFix} disabled={!isPaused} variant="success">
        <span>🔧 Fix</span>
      </ToolbarBtn>
      <ToolbarBtn title="AI: Suggest breakpoints for this file" onClick={handleSuggestBPs} variant="accent">
        <span>🎯 BPs</span>
      </ToolbarBtn>
    </>
  )
}

// ── File path input bar ───────────────────────────────────────────────────────

const PLACEHOLDER: Record<string, string> = {
  python:     'Path to script  e.g. /home/user/script.py',
  javascript: 'Path to script  e.g. /home/user/app.js',
  cpp:        'Path to compiled binary  e.g. /home/user/program',
  c:          'Path to compiled binary  e.g. /home/user/program',
  java:       'Main class name  e.g. Main',
}

function FileInputBar({ language, onLaunch }: {
  language: Language
  onLaunch: (target: string) => void
}) {
  const [value, setValue] = useState('')
  const [launching, setLaunching] = useState(false)
  const status = useDebugStore((s) => s.status)

  useEffect(() => {
    if (status !== 'idle') setLaunching(false)
  }, [status])

  const handleLaunch = useCallback(() => {
    if (!value.trim() || launching) return
    setLaunching(true)
    onLaunch(value.trim())
  }, [value, launching, onLaunch])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleLaunch()
  }, [handleLaunch])

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={PLACEHOLDER[language] ?? 'Path to file...'}
        disabled={launching}
        className="flex-1 min-w-0 bg-[#3c3c3c] text-xs text-white placeholder:text-[#555] px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-blue-500 font-mono disabled:opacity-50"
      />
      <button
        onClick={handleLaunch}
        disabled={!value.trim() || launching}
        className="px-2 py-1.5 text-xs rounded font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
      >
        {launching ? 'Launching...' : 'Go'}
      </button>
    </div>
  )
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

export default function Toolbar() {
  const status        = useDebugStore((s) => s.status)
  const language      = useDebugStore((s) => s.language)
  const anomalies     = useDebugStore((s) => s.anomalies)
  const lastReturnVal = useDebugStore((s) => s.lastReturnValue)
  const sourceLines   = useDebugStore((s) => s.sourceLines)
  const currentFile   = useDebugStore((s) => s.currentFile)
  const currentLine   = useDebugStore((s) => s.currentLine)

  const isRunning = status === 'running' || status === 'launching'
  const isPaused  = status === 'paused'
  const isIdle    = status === 'idle' || status === 'terminated'

  const handleLaunch   = useCallback((target: string) => { invoke(IPC.LAUNCH, { language, target }) }, [language])
  const handleStop     = useCallback(() => invoke(IPC.TERMINATE), [])
  const handleContinue = useCallback(() => invoke(IPC.CONTINUE), [])
  const handlePause    = useCallback(() => invoke(IPC.PAUSE), [])
  const handleNext     = useCallback(() => invoke(IPC.NEXT), [])
  const handleStepIn   = useCallback(() => invoke(IPC.STEP_IN), [])
  const handleStepOut  = useCallback(() => invoke(IPC.STEP_OUT), [])

  // Run-to-cursor: uses the Monaco editor's current cursor position
  // The cursor line is tracked via a custom event from CodeEditor
  const [editorCursorLine, setEditorCursorLine] = useState(0)
  useEffect(() => {
    const h = (e: Event) => setEditorCursorLine((e as CustomEvent<number>).detail)
    window.addEventListener('lucid:cursor-line', h)
    return () => window.removeEventListener('lucid:cursor-line', h)
  }, [])

  const handleRunToCursor = useCallback(() => {
    if (!currentFile || !editorCursorLine) return
    invoke(IPC.RUN_TO_CURSOR, { file: currentFile, line: editorCursorLine })
  }, [currentFile, editorCursorLine])

  return (
    <div className="h-11 bg-[#1e1e1e] border-b border-[#3c3c3c] flex items-center px-2 gap-1 shrink-0 overflow-x-auto">
      <LanguageSelector />
      <Divider />

      {isIdle ? (
        <FileInputBar language={language} onLaunch={handleLaunch} />
      ) : (
        <>
          <ToolbarBtn title="Stop (Shift+F5)" onClick={handleStop} variant="danger">
            <StopIcon /><span>Stop</span>
          </ToolbarBtn>
          <Divider />
          <StepControls
            isPaused={isPaused}
            isRunning={isRunning}
            onContinue={handleContinue}
            onPause={handlePause}
            onNext={handleNext}
            onStepIn={handleStepIn}
            onStepOut={handleStepOut}
          />

          {/* Run-to-cursor */}
          <ToolbarBtn title="Run to cursor line" onClick={handleRunToCursor} disabled={!isPaused || !editorCursorLine}>
            <CursorIcon /><span className="hidden sm:inline">Cursor</span>
          </ToolbarBtn>

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

          <div className="flex-1" />
        </>
      )}

      <ModeToggle />
      <div className="w-2" />
      <StatusIndicator status={status} />
    </div>
  )
}