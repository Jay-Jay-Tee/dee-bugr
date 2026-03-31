// src/components/panels/ToolBar.tsx
// Shell only — layout + handlers. Heavy subcomponents are in subpanels/.

import { useCallback } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { IPC } from '../../shared/ipc'
import type { IPCChannel } from '../../shared/ipc'
import FileInputBar from './subpanels/FileInputBar'

type ElectronWindow = Window & {
  electronAPI?: { invoke: (ch: IPCChannel, p?: unknown) => Promise<unknown> }
}

function invoke(ch: IPCChannel, args?: unknown) {
  return (window as ElectronWindow).electronAPI?.invoke(ch, args)
    .catch((err: unknown) => console.error(`[IPC] ${String(ch)} failed:`, err))
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function StopIcon()        { return <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="1" width="10" height="10" rx="1" /></svg> }
function ContinueIcon()    { return <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="1" y="2" width="3" height="10" rx="1" /><polygon points="6,2 13,7 6,12" /></svg> }
function PauseIcon()       { return <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="2" width="4" height="10" rx="1" /><rect x="8" y="2" width="4" height="10" rx="1" /></svg> }
function StepOverIcon()    { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 7 A4 4 0 0 1 11 7" /><polyline points="11,4 11,7 8,7" /><line x1="3" y1="10" x2="11" y2="10" /></svg> }
function StepInIcon()      { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="7" y1="2" x2="7" y2="9" /><polyline points="4,7 7,10 10,7" /><line x1="3" y1="12" x2="11" y2="12" /></svg> }
function StepOutIcon()     { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="7" y1="12" x2="7" y2="5" /><polyline points="4,7 7,4 10,7" /><line x1="3" y1="2" x2="11" y2="2" /></svg> }
function RunToCursorIcon() { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,3 2,11 10,11" /><polyline points="7,8 10,11 7,14" /></svg> }
function JumpToLineIcon()  { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="2" y1="7" x2="10" y2="7" /><polyline points="7,4 10,7 7,10" /><line x1="12" y1="2" x2="12" y2="12" /></svg> }
function ReturnNowIcon()   { return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="4,4 2,7 4,10" /><path d="M2 7 h7 a3 3 0 0 0 0-6 h-1" /></svg> }

// ── Shared primitives ─────────────────────────────────────────────────────────

const VARIANT_CLASS = {
  default: 'text-[#cccccc] hover:bg-[#3c3c3c] hover:text-white',
  danger:  'text-[#f48771] hover:bg-[#f48771]/10',
  accent:  'text-[#75beff] hover:bg-[#75beff]/10',
} as const

function Btn({ onClick, disabled, title, children, variant = 'default' }: {
  onClick?: () => void; disabled?: boolean; title: string
  children: React.ReactNode; variant?: keyof typeof VARIANT_CLASS
}) {
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${VARIANT_CLASS[variant]}`}>
      {children}
    </button>
  )
}

function Divider() { return <div className="w-px h-5 bg-[#3c3c3c] mx-1 shrink-0" /> }

// ── Language selector ─────────────────────────────────────────────────────────

const LANGUAGES = [
  { value: 'python',     label: 'Python'     },
  { value: 'c',          label: 'C'          },
  { value: 'cpp',        label: 'C / C++'    },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java',       label: 'Java'       },
] as const

const SYNTHETIC_TARGET_BY_LANGUAGE = {
  python: '/tmp/lucid_scratch.py',
  cpp: '/tmp/lucid_scratch.cpp',
  c: '/tmp/lucid_scratch.c',
  javascript: '/tmp/lucid_scratch.js',
  java: '/tmp/LucidScratch.java',
} as const

function LanguageSelector() {
  const language    = useDebugStore((s) => s.language)
  const setLanguage = useDebugStore((s) => s.setLanguage)
  return (
    <select value={language} onChange={(e) => setLanguage(e.target.value as typeof language)}
      className="bg-[#3c3c3c] text-xs text-[#cccccc] px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-blue-500 hover:bg-[#4a4a4a] transition-colors shrink-0">
      {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
    </select>
  )
}

// ── Mode toggle ───────────────────────────────────────────────────────────────

function ModeToggle() {
  const isBeginnerMode     = useDebugStore((s) => s.isBeginnerMode)
  const toggleBeginnerMode = useDebugStore((s) => s.toggleBeginnerMode)
  return (
    <div className="flex items-center gap-2 text-xs shrink-0">
      <span className={`transition-colors ${!isBeginnerMode ? 'text-white' : 'text-[#555]'}`}>Expert</span>
      <button
        title={isBeginnerMode ? 'Switch to Expert mode' : 'Switch to Beginner mode'}
        onClick={toggleBeginnerMode}
        role="switch" aria-checked={isBeginnerMode}
        className="relative w-11 h-5 rounded-full transition-all duration-200 focus:outline-none shrink-0 border border-[#3c3c3c] !bg-[#1a1a1c] shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]"
      >
        <span className={['absolute top-[3px] w-3 h-3 rounded-full transition-transform duration-200 shadow-md',
          isBeginnerMode ? 'bg-[#33cc33] translate-x-6' : 'bg-[#cc3333] translate-x-1'].join(' ')} />
      </button>
      <span className={`transition-colors ${isBeginnerMode ? 'text-white' : 'text-[#555]'}`}>Beginner</span>
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
    <div className="flex items-center gap-1.5 text-xs text-[#969696] shrink-0 mr-2">
      <div className={`w-2 h-2 rounded-full ${STATUS_DOT[status] ?? 'bg-[#3c3c3c]'}`} />
      <span className="capitalize">{status}</span>
    </div>
  )
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

export default function Toolbar() {
  const status       = useDebugStore((s) => s.status)
  const language     = useDebugStore((s) => s.language)
  const anomalies    = useDebugStore((s) => s.anomalies)
  const lastReturn   = useDebugStore((s) => s.lastReturnValue)
  const sourceLines  = useDebugStore((s) => s.sourceLines)
  const currentFile  = useDebugStore((s) => s.currentFile)
  const currentLine  = useDebugStore((s) => s.currentLine)
  const setState     = useDebugStore((s) => s.setState)
  const appendOutput = useDebugStore((s) => s.appendOutput)

  const isRunning = status === 'running' || status === 'launching'
  const isPaused  = status === 'paused'

  // In Toolbar, handleLaunch:
  const handleLaunch = useCallback((target: string) => {
    const bps = useDebugStore.getState().breakpoints
    invoke(IPC.LAUNCH, {
      language,
      target,
      breakpoints: bps.map(bp => bp.line),  // ← pass pre-set breakpoints
    })
  }, [language])
  const handleStop        = useCallback(() => invoke(IPC.TERMINATE), [])
  const handleContinue    = useCallback(() => invoke(IPC.CONTINUE), [])
  const handlePause       = useCallback(() => invoke(IPC.PAUSE), [])
  const handleNext        = useCallback(() => invoke(IPC.NEXT), [])
  const handleStepIn      = useCallback(() => invoke(IPC.STEP_IN), [])
  const handleStepOut     = useCallback(() => invoke(IPC.STEP_OUT), [])
  const handleRunToCursor = useCallback(() => { if (currentFile && currentLine) invoke(IPC.RUN_TO_CURSOR, { file: currentFile, line: currentLine }) }, [currentFile, currentLine])
  const handleJumpToLine  = useCallback(() => { if (currentFile && currentLine) invoke(IPC.GOTO_LINE, { file: currentFile, line: currentLine }) }, [currentFile, currentLine])
  const handleReturnNow   = useCallback(() => invoke(IPC.RETURN_NOW), [])
  const handleExplain     = useCallback(() => window.dispatchEvent(new CustomEvent('lucid:ai-explain')), [])
  const handleFix         = useCallback(() => window.dispatchEvent(new CustomEvent('lucid:ai-fix')), [])
  const handleSuggestBPs  = useCallback(async () => {
    if (!sourceLines?.length) {
      appendOutput('AI BP suggestions skipped: no source loaded.', 'ai')
      return
    }
    const result = await invoke(IPC.AI_SUGGEST_BPS, { sourceCode: sourceLines.join('\n'), language }) as { success?: boolean; suggestions?: unknown }
    const suggestions = Array.isArray(result?.suggestions)
      ? result.suggestions.filter((s): s is { line: number; reason: string } => {
        const candidate = s as { line?: unknown; reason?: unknown }
        return typeof candidate.line === 'number' && Number.isFinite(candidate.line) && candidate.line > 0
      })
      : []

    if (!result?.success || suggestions.length === 0) {
      appendOutput('AI BP suggestions returned no lines.', 'ai')
      return
    }

    window.dispatchEvent(new CustomEvent('lucid:ai-suggest-bps', { detail: suggestions }))

    const store = useDebugStore.getState()
    const targetFile = store.currentFile || SYNTHETIC_TARGET_BY_LANGUAGE[language]
    if (!targetFile) return

    const existingLines = new Set(store.breakpoints.filter((bp) => bp.file === targetFile).map((bp) => bp.line))
    const toAdd = suggestions
      .map((s) => s.line)
      .filter((line) => !existingLines.has(line))
      .map((line) => ({
        id: `bp-${targetFile}-${line}`,
        file: targetFile,
        line,
        verified: false,
      }))

    if (toAdd.length > 0) {
      setState({ ...store, breakpoints: [...store.breakpoints, ...toAdd] })
    }

    appendOutput(`AI suggested ${suggestions.length} BP(s); added ${toAdd.length}.`, 'ai')
  }, [sourceLines, language, setState, appendOutput])

  return (
    <div className="h-11 bg-[#1e1e1e] border-b border-[#3c3c3c] flex items-center px-2 gap-1 shrink-0 overflow-x-auto">
      <div className="w-2 shrink-0" />
      <LanguageSelector />
      <Divider />

      {(isRunning || isPaused)
        ? <Btn title="Stop (Shift+F5)" onClick={handleStop} variant="danger"><StopIcon /><span>Stop</span></Btn>
        : <FileInputBar onLaunch={handleLaunch} />
      }

      <Divider />

      <Btn title="Continue (F5)"            onClick={handleContinue}   disabled={!isPaused}> <ContinueIcon /></Btn>
      <Btn title="Pause"                    onClick={handlePause}      disabled={!isRunning}><PauseIcon /></Btn>
      <Btn title="Step Over (F10)"          onClick={handleNext}       disabled={!isPaused}> <StepOverIcon /></Btn>
      <Btn title="Step Into (F11)"          onClick={handleStepIn}     disabled={!isPaused}> <StepInIcon /></Btn>
      <Btn title="Step Out (Shift+F11)"     onClick={handleStepOut}    disabled={!isPaused}> <StepOutIcon /></Btn>
      <Btn title="Run to Cursor (Ctrl+F10)" onClick={handleRunToCursor} disabled={!isPaused}><RunToCursorIcon /></Btn>
      <Btn title="Jump to Line"             onClick={handleJumpToLine} disabled={!isPaused}> <JumpToLineIcon /></Btn>
      <Btn title="Return Now"               onClick={handleReturnNow}  disabled={!isPaused}> <ReturnNowIcon /></Btn>

      <Divider />

      <Btn title="Explain Bug (AI)" onClick={handleExplain}   disabled={!isPaused} variant="accent"><span>⚡ Explain</span></Btn>
      <Btn title="Suggest Fix (AI)" onClick={handleFix}       disabled={!isPaused} variant="accent"><span>🔧 Fix</span></Btn>
      <Btn title="Suggest BPs (AI)" onClick={handleSuggestBPs}                     variant="accent"><span>🎯 BPs</span></Btn>

      {lastReturn && isPaused && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#2d2d2d] text-xs ml-1 shrink-0">
          <span className="text-[#969696]">↩ {lastReturn.fnName}:</span>
          <span className="text-[#4ec9b0] font-mono">{lastReturn.value}</span>
        </div>
      )}
      {anomalies.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-900/40 text-xs ml-1 text-amber-300 shrink-0">
          ⚠ {anomalies.length} {anomalies.length === 1 ? 'anomaly' : 'anomalies'}
        </div>
      )}

      <div className="flex-1 min-w-2" />
      <ModeToggle />
      <Divider />
      <StatusIndicator status={status} />
      <div className="w-4 shrink-0" />
      {/* The above div is just to push the idle to the left a bit */}
    </div>
  )
}
