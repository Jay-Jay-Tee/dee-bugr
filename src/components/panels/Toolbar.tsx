// src/components/panels/Toolbar.tsx

import { useCallback } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { IPC } from '../../shared/ipc'
import type { IPCChannel } from '../../shared/ipc'
import type { Language } from '../../shared/types'

// ── IPC helper ────────────────────────────────────────────────────────────────

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
// Day 5: Run to Cursor icon — arrow pointing to a horizontal line
function RunToCursorIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="2" y1="11" x2="12" y2="11" /><line x1="7" y1="2" x2="7" y2="9" /><polyline points="4,7 7,10 10,7" /></svg>
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
  danger:  'text-[#f48771] hover:bg-[#f48771]/10',
  accent:  'text-[#75beff] hover:bg-[#75beff]/10',
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

// ── Beginner / Expert toggle ──────────────────────────────────────────────────

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
  onStop:   () => void
}) {
  return isActive
    ? <ToolbarBtn title="Stop (Shift+F5)"      onClick={onStop}   variant="danger"><StopIcon /><span>Stop</span></ToolbarBtn>
    : <ToolbarBtn title="Launch debugger (F5)" onClick={onLaunch} variant="accent"><PlayIcon /><span>Run</span></ToolbarBtn>
}

// ── Step controls ─────────────────────────────────────────────────────────────

interface StepControlsProps {
  isPaused:   boolean
  isRunning:  boolean
  onContinue:     () => void
  onPause:        () => void
  onNext:         () => void
  onStepIn:       () => void
  onStepOut:      () => void
  onRunToCursor:  () => void   // Day 5
}

function StepControls({
  isPaused, isRunning,
  onContinue, onPause, onNext, onStepIn, onStepOut, onRunToCursor,
}: Readonly<StepControlsProps>) {
  return (
    <>
      <ToolbarBtn title="Continue (F5)"              onClick={onContinue}    disabled={!isPaused}><ContinueIcon /></ToolbarBtn>
      <ToolbarBtn title="Pause"                      onClick={onPause}       disabled={!isRunning}><PauseIcon /></ToolbarBtn>
      <ToolbarBtn title="Step Over (F10)"            onClick={onNext}        disabled={!isPaused}><StepOverIcon /></ToolbarBtn>
      <ToolbarBtn title="Step Into (F11)"            onClick={onStepIn}      disabled={!isPaused}><StepInIcon /></ToolbarBtn>
      <ToolbarBtn title="Step Out (Shift+F11)"       onClick={onStepOut}     disabled={!isPaused}><StepOutIcon /></ToolbarBtn>
      <ToolbarBtn title="Run to Cursor (Ctrl+F10)"   onClick={onRunToCursor} disabled={!isPaused}><RunToCursorIcon /></ToolbarBtn>
    </>
  )
}

// ── AI buttons ────────────────────────────────────────────────────────────────

function AIButtons() {
  return (
    <>
      <ToolbarBtn title="Explain Bug (AI)" disabled variant="accent"><span>⚡ Explain</span></ToolbarBtn>
      <ToolbarBtn title="Suggest Fix (AI)" disabled variant="accent"><span>🔧 Fix</span></ToolbarBtn>
    </>
  )
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

export default function Toolbar() {
  const status      = useDebugStore((s) => s.status)
  const language    = useDebugStore((s) => s.language)
  const currentFile = useDebugStore((s) => s.currentFile)
  const currentLine = useDebugStore((s) => s.currentLine)
  const isRunning   = status === 'running' || status === 'launching'
  const isPaused    = status === 'paused'

  const handleLaunch = useCallback(() => {
    const target = currentFile || prompt('Path to script to debug:') || ''
    if (!target) return
    invoke(IPC.LAUNCH, { language, target })
  }, [language, currentFile])

  const handleStop         = useCallback(() => invoke(IPC.TERMINATE), [])
  const handleContinue     = useCallback(() => invoke(IPC.CONTINUE), [])
  const handlePause        = useCallback(() => invoke(IPC.PAUSE), [])
  const handleNext         = useCallback(() => invoke(IPC.NEXT), [])
  const handleStepIn       = useCallback(() => invoke(IPC.STEP_IN), [])
  const handleStepOut      = useCallback(() => invoke(IPC.STEP_OUT), [])

  // Day 5: Run to Cursor — uses current file + line from store
  const handleRunToCursor = useCallback(() => {
    if (!currentFile || !currentLine) return
    invoke(IPC.RUN_TO_CURSOR, { file: currentFile, line: currentLine })
  }, [currentFile, currentLine])

  return (
    <div className="h-11 bg-[#1e1e1e] border-b border-[#3c3c3c] flex items-center px-2 gap-1 shrink-0">
      <LanguageSelector />
      <Divider />
      <LaunchStopBtn isActive={isRunning || isPaused} onLaunch={handleLaunch} onStop={handleStop} />
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
      />
      <Divider />
      <AIButtons />
      <div className="flex-1" />
      <ModeToggle />
      <div className="w-2" />
      <StatusIndicator status={status} />
    </div>
  )
}
