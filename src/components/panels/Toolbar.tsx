// src/components/panels/Toolbar.tsx
// Day 4: AI buttons wired, file picker for C/C++ binary target

import { useCallback, useState } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { IPC } from '../../shared/ipc'
import type { IPCChannel } from '../../shared/ipc'
import type { Language } from '../../shared/types'

function invoke(channel: IPCChannel, args?: unknown) {
  return globalThis.electronAPI?.invoke(channel, args)
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

// ── Launch / Stop ─────────────────────────────────────────────────────────────

function LaunchStopBtn({ isActive, onLaunch, onStop }: {
  isActive: boolean
  onLaunch: () => void
  onStop: () => void
}) {
  return isActive
    ? <ToolbarBtn title="Stop (Shift+F5)"      onClick={onStop}   variant="danger"><StopIcon /><span>Stop</span></ToolbarBtn>
    : <ToolbarBtn title="Launch debugger (F5)" onClick={onLaunch} variant="accent"><PlayIcon /><span>Run</span></ToolbarBtn>
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
// Day 4: wired to RightPanel via tab switching — the buttons open the right panel tab

function AIButtons({ isPaused }: { isPaused: boolean }) {
  const handleExplain = useCallback(() => {
    // Dispatch a custom event that RightPanel listens for (or just invoke IPC directly)
    window.dispatchEvent(new CustomEvent('lucid:ai-explain'))
  }, [])

  const handleFix = useCallback(() => {
    window.dispatchEvent(new CustomEvent('lucid:ai-fix'))
  }, [])

  return (
    <>
      <ToolbarBtn title="Explain Bug (AI) — paused required" onClick={handleExplain} disabled={!isPaused} variant="accent">
        <span>⚡ Explain</span>
      </ToolbarBtn>
      <ToolbarBtn title="Suggest Fix (AI) — paused required" onClick={handleFix} disabled={!isPaused} variant="success">
        <span>🔧 Fix</span>
      </ToolbarBtn>
    </>
  )
}

// ── File path input bar ───────────────────────────────────────────────────────

const PLACEHOLDER: Record<string, string> = {
  python:     'Path to script  e.g. C:\\Users\\you\\script.py',
  javascript: 'Path to script  e.g. C:\\Users\\you\\app.js',
  cpp:        'Path to compiled binary  e.g. C:\\Temp\\program.exe',
  c:          'Path to compiled binary  e.g. C:\\Temp\\program.exe',
  java:       'Main class name  e.g. Main',
}

function FileInputBar({ language, onLaunch }: {
  language: Language
  onLaunch: (target: string) => void
}) {
  const [value, setValue] = useState('')

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      onLaunch(value.trim())
    }
  }, [value, onLaunch])

  const handleGo = useCallback(() => {
    if (value.trim()) onLaunch(value.trim())
  }, [value, onLaunch])

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={PLACEHOLDER[language] ?? 'Path to file...'}
        className="flex-1 min-w-0 bg-[#3c3c3c] text-xs text-white placeholder:text-[#555] px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-blue-500 font-mono"
      />
      <button
        onClick={handleGo}
        disabled={!value.trim()}
        className="px-2 py-1.5 text-xs rounded font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
      >
        Go
      </button>
    </div>
  )
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

export default function Toolbar() {
  const status      = useDebugStore((s) => s.status)
  const language    = useDebugStore((s) => s.language)
  const currentFile = useDebugStore((s) => s.currentFile)
  const isRunning   = status === 'running' || status === 'launching'
  const isPaused    = status === 'paused'
  const isIdle      = status === 'idle' || status === 'terminated'

  const handleLaunch = useCallback((target: string) => {
    invoke(IPC.LAUNCH, { language, target })
  }, [language])

  const handleStop     = useCallback(() => invoke(IPC.TERMINATE), [])
  const handleContinue = useCallback(() => invoke(IPC.CONTINUE), [])
  const handlePause    = useCallback(() => invoke(IPC.PAUSE), [])
  const handleNext     = useCallback(() => invoke(IPC.NEXT), [])
  const handleStepIn   = useCallback(() => invoke(IPC.STEP_IN), [])
  const handleStepOut  = useCallback(() => invoke(IPC.STEP_OUT), [])

  return (
    <div className="h-11 bg-[#1e1e1e] border-b border-[#3c3c3c] flex items-center px-2 gap-1 shrink-0">
      <LanguageSelector />
      <Divider />

      {isIdle ? (
        /* Idle: show file path input + Go button */
        <FileInputBar language={language} onLaunch={handleLaunch} />
      ) : (
        /* Active: show stop + step controls */
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
          <Divider />
          <AIButtons isPaused={isPaused} />
          <div className="flex-1" />
        </>
      )}

      <ModeToggle />
      <div className="w-2" />
      <StatusIndicator status={status} />
    </div>
  )
}