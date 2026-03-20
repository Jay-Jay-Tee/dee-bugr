// src/components/Toolbar.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Top bar: language selector, debug lifecycle buttons, step controls,
// Beginner/Expert mode toggle, and AI action buttons.
//
// Buttons are visually complete today. IPC wiring happens on Day 3 when P1
// provides the live handlers. Disabled state clearly communicates this.
// ─────────────────────────────────────────────────────────────────────────────

import { useDebugStore } from '../../renderer/store/debugStore'
import type { Language } from '../../shared/types'

// ── Icon components (inline SVG — no icon library needed) ─────────────────────

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <polygon points="3,1 13,7 3,13" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="1" y="1" width="10" height="10" rx="1" />
    </svg>
  )
}

function StepOverIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 7 A4 4 0 0 1 11 7" />
      <polyline points="11,4 11,7 8,7" />
      <line x1="3" y1="10" x2="11" y2="10" />
    </svg>
  )
}

function StepInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="7" y1="2" x2="7" y2="9" />
      <polyline points="4,7 7,10 10,7" />
      <line x1="3" y1="12" x2="11" y2="12" />
    </svg>
  )
}

function StepOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="7" y1="12" x2="7" y2="5" />
      <polyline points="4,7 7,4 10,7" />
      <line x1="3" y1="2" x2="11" y2="2" />
    </svg>
  )
}

function ContinueIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="1" y="2" width="3" height="10" rx="1" />
      <polygon points="6,2 13,7 6,12" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="2" y="2" width="4" height="10" rx="1" />
      <rect x="8" y="2" width="4" height="10" rx="1" />
    </svg>
  )
}

// ── Toolbar button ─────────────────────────────────────────────────────────────

interface ToolbarBtnProps {
  onClick?: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
  variant?: 'default' | 'danger' | 'accent'
}

function ToolbarBtn({
  onClick,
  disabled,
  title,
  children,
  variant = 'default',
}: ToolbarBtnProps) {
  const base =
    'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

  const variants = {
    default: 'text-[#cccccc] hover:bg-[#3c3c3c] hover:text-white',
    danger: 'text-[#f48771] hover:bg-[#f48771]/10 hover:text-[#f48771]',
    accent: 'text-[#75beff] hover:bg-[#75beff]/10 hover:text-[#75beff]',
  }

  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]}`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-[#3c3c3c] mx-1" />
}

// ── Language selector ──────────────────────────────────────────────────────────

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C / C++' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java', label: 'Java' },
]

function LanguageSelector() {
  const language = useDebugStore((s: any) => s.language)

  return (
    <select
      value={language}
      onChange={() => {/* Day 3 */ }}
      className="bg-[#3c3c3c] text-xs text-[#cccccc] px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-blue-500 hover:bg-[#4a4a4a] transition-colors"
    >
      {LANGUAGES.map((l) => (
        <option key={l.value} value={l.value}>
          {l.label}
        </option>
      ))}
    </select>
  )
}

// ── Beginner / Expert toggle ───────────────────────────────────────────────────

function ModeToggle() {
  // Day 7: replace with useDebugStore(s => s.isBeginnerMode) once added to store
  const isBeginnerMode = false

  return (
    <div className="flex items-center gap-2 text-xs text-[#969696]">
      <span className={isBeginnerMode ? 'text-white' : ''}>Beginner</span>
      <button
        title="Toggle Beginner / Expert mode (Day 7)"
        disabled
        className={[
          'relative w-10 h-5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
          isBeginnerMode ? 'bg-blue-600' : 'bg-[#3c3c3c]',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
            isBeginnerMode ? 'translate-x-5' : 'translate-x-0.5',
          ].join(' ')}
        />
      </button>
      <span className={!isBeginnerMode ? 'text-white' : ''}>Expert</span>
    </div>
  )
}

// ── Toolbar ────────────────────────────────────────────────────────────────────

// ── Status indicator ──────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  running: 'bg-green-400 animate-pulse',
  launching: 'bg-blue-400 animate-pulse',
  paused: 'bg-yellow-400',
}

function StatusIndicator({ status }: { status: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-[#969696]">
      <div className={`w-2 h-2 rounded-full ${STATUS_DOT[status] ?? 'bg-[#3c3c3c]'}`} />
      <span className="capitalize">{status}</span>
    </div>
  )
}

// ── Launch / Stop button ──────────────────────────────────────────────────────

function LaunchStopBtn({
  isActive,
  onLaunch,
  onStop,
}: {
  isActive: boolean
  onLaunch: () => void
  onStop: () => void
}) {
  if (isActive) {
    return (
      <ToolbarBtn title="Stop (Shift+F5)" onClick={onStop} variant="danger">
        <StopIcon /><span>Stop</span>
      </ToolbarBtn>
    )
  }
  return (
    <ToolbarBtn title="Launch debugger (F5)" onClick={onLaunch} variant="accent">
      <PlayIcon /><span>Run</span>
    </ToolbarBtn>
  )
}

// ── Step controls ─────────────────────────────────────────────────────────────

function StepControls({
  isPaused,
  isRunning,
  onContinue,
  onPause,
  onNext,
  onStepIn,
  onStepOut,
}: {
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
      <ToolbarBtn title="Continue (F5)" onClick={onContinue} disabled={!isPaused}><ContinueIcon /></ToolbarBtn>
      <ToolbarBtn title="Pause" onClick={onPause} disabled={!isRunning}><PauseIcon /></ToolbarBtn>
      <ToolbarBtn title="Step Over (F10)" onClick={onNext} disabled={!isPaused}><StepOverIcon /></ToolbarBtn>
      <ToolbarBtn title="Step Into (F11)" onClick={onStepIn} disabled={!isPaused}><StepInIcon /></ToolbarBtn>
      <ToolbarBtn title="Step Out (Shift+F11)" onClick={onStepOut} disabled={!isPaused}><StepOutIcon /></ToolbarBtn>
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

// ── Toolbar ────────────────────────────────────────────────────────────────────

export default function Toolbar() {
  const status = useDebugStore((s) => s.status)
  const isRunning = status === 'running' || status === 'launching'
  const isPaused = status === 'paused'

  // Day 3: replace stubs with window.electronAPI.invoke(IPC.X)
  const handlers = {
    launch: () => { },
    stop: () => { },
    continue: () => { },
    pause: () => { },
    next: () => { },
    stepIn: () => { },
    stepOut: () => { },
  }

  return (
    <div className="h-11 bg-[#1e1e1e] border-b border-[#3c3c3c] flex items-center px-2 gap-1 shrink-0">
      <LanguageSelector />
      <Divider />
      <LaunchStopBtn isActive={isRunning || isPaused} onLaunch={handlers.launch} onStop={handlers.stop} />
      <Divider />
      <StepControls isPaused={isPaused} isRunning={isRunning} onContinue={handlers.continue} onPause={handlers.pause} onNext={handlers.next} onStepIn={handlers.stepIn} onStepOut={handlers.stepOut} />
      <Divider />
      <AIButtons />
      <div className="flex-1" />
      <ModeToggle />
      <div className="w-2" />
      <StatusIndicator status={status} />
    </div>
  )
}
