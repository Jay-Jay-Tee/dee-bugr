// src/components/panels/LeftPanel.tsx

import { useState, useCallback } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { MOCK_CHILDREN_MAP } from '../../renderer/mockData'
import { IPC } from '../../shared/ipc'
import type { Variable, StackFrame } from '../../shared/types'
import BreakpointPanel from './BreakpointPanel'
import VariableTooltip from './VariableTooltip'
import AIWatchpointGenerator from './AIWatchpointGenerator'

// ── IPC helper ────────────────────────────────────────────────────────────────

function invoke(channel: typeof IPC[keyof typeof IPC], args?: unknown) {
  const api = (window as Window & {
    electronAPI?: { invoke: (ch: typeof IPC[keyof typeof IPC], payload?: unknown) => Promise<unknown> }
  }).electronAPI

  return api?.invoke(channel, args)
    ?.catch((err: unknown) => console.error(`[IPC] ${channel} failed:`, err))
}

// ── Type guard ────────────────────────────────────────────────────────────────

function isVariableArray(value: unknown): value is Variable[] {
  if (!Array.isArray(value)) return false
  return value.every(
    (v) =>
      typeof v === 'object' &&
      v !== null &&
      typeof (v as Record<string, unknown>)['name'] === 'string' &&
      typeof (v as Record<string, unknown>)['value'] === 'string'
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type Tab = 'variables' | 'callstack' | 'breakpoints'

const TABS: { id: Tab; label: string }[] = [
  { id: 'variables',   label: 'Variables' },
  { id: 'callstack',   label: 'Call Stack' },
  { id: 'breakpoints', label: 'Breakpoints' },
]

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex border-b border-[#3c3c3c] shrink-0">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={[
            'flex-1 px-2 py-1.5 text-[10px] uppercase tracking-wide transition-colors',
            active === t.id
              ? 'text-white border-b-2 border-blue-500 -mb-px'
              : 'text-[#969696] hover:text-white',
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Variables panel ───────────────────────────────────────────────────────────

function typeColor(type: string): string {
  if (/^(int|short|long|uint|size_t|unsigned)/.test(type)) return 'text-[#b5cea8]'
  if (/^(float|double)/.test(type))                        return 'text-[#dcdcaa]'
  if (/^(bool)/.test(type))                                return 'text-[#569cd6]'
  if (/^(char \*|std::string|string)/.test(type))          return 'text-[#ce9178]'
  if (/\*/.test(type))                                     return 'text-[#c586c0]'
  return 'text-[#9cdcfe]'
}

interface VariableRowProps {
  variable: Variable
  depth?: number
}

function VariableRow({ variable, depth = 0 }: Readonly<VariableRowProps>) {
  const [expanded,     setExpanded]     = useState(false)
  const [liveChildren, setLiveChildren] = useState<Variable[] | null>(null)
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)

  const hasChildren = variable.variablesReference > 0
  const children    = liveChildren ?? MOCK_CHILDREN_MAP[variable.variablesReference] ?? []
  const isNull      = variable.value === '0x0000000000000000' || variable.value === 'nullptr'

  const handleExpand = useCallback(async () => {
    if (!hasChildren) return
    if (!expanded && liveChildren === null) {
      const result = await invoke(IPC.GET_VARIABLES, { variablesReference: variable.variablesReference })
      if (isVariableArray(result)) setLiveChildren(result)
    }
    setExpanded((e) => !e)
  }, [hasChildren, expanded, liveChildren, variable.variablesReference])

  return (
    <>
      <div
        className={[
          'flex items-start gap-1 py-0.5 hover:bg-[#2a2d2e] cursor-default text-xs font-mono',
          isNull ? 'bg-red-950/20' : '',
        ].join(' ')}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleExpand}
      >
        <span className="w-3 shrink-0 text-[#969696]">
          {hasChildren ? (expanded ? '▾' : '▸') : ' '}
        </span>
        <span className="text-[#9cdcfe] w-28 shrink-0 truncate">
          {isBeginnerMode ? (
            <VariableTooltip varName={variable.name} varValue={variable.value} varType={variable.type} />
          ) : (
            variable.name
          )}
        </span>
        <span className={['flex-1 truncate', isNull ? 'text-red-400 font-medium' : typeColor(variable.type)].join(' ')}>
          {variable.value}
        </span>
        <span className="text-[#4ec9b0] w-28 shrink-0 truncate text-right pr-2">
          {variable.type}
        </span>
      </div>
      {expanded && children.map((child) => (
        <VariableRow key={child.name} variable={child} depth={depth + 1} />
      ))}
    </>
  )
}

function VariablesPanel() {
  const vars   = useDebugStore((s) => s.variables)
  const status = useDebugStore((s) => s.status)

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 px-2 py-1 text-[10px] uppercase tracking-wide text-[#969696] border-b border-[#3c3c3c] shrink-0">
        <span className="w-3 shrink-0" />
        <span className="w-28 shrink-0">Name</span>
        <span className="flex-1">Value</span>
        <span className="w-28 shrink-0 text-right pr-2">Type</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {vars.length === 0 ? (
          <div className="p-3 text-xs text-[#555]">
            {status === 'idle' ? 'Launch a debug session to see variables' : 'No variables in scope'}
          </div>
        ) : (
          vars.map((v) => <VariableRow key={v.name} variable={v} />)
        )}
      </div>
      <div className="border-t border-[#3c3c3c] p-2 shrink-0">
        <AIWatchpointGenerator />
      </div>
    </div>
  )
}

// ── Call stack panel ──────────────────────────────────────────────────────────

function shortFile(filePath: string): string {
  return filePath.split('/').slice(-2).join('/')
}

function CallStackPanel() {
  const frames  = useDebugStore((s) => s.stackFrames)
  const threads = useDebugStore((s) => s.threads)
  const status  = useDebugStore((s) => s.status)
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)
  const [activeFrame, setActiveFrame] = useState(0)

  const handleFrameClick = useCallback((frame: StackFrame) => {
    setActiveFrame(frame.id)
    invoke(IPC.SWITCH_FRAME, { frameId: frame.id })
  }, [])

  const handleThreadChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const threadId = Number(e.target.value)
    if (!isNaN(threadId)) {
      invoke('dap:switchThread' as any, { threadId })
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-1.5 border-b border-[#3c3c3c] shrink-0">
        <select
          onChange={handleThreadChange}
          className="w-full bg-[#3c3c3c] text-xs text-white px-2 py-1 rounded outline-none focus:ring-1 focus:ring-blue-500"
        >
          {threads.length === 0 ? (
            <option>No threads</option>
          ) : (
            threads.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — {t.status}</option>
            ))
          )}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto">
        {frames.length === 0 ? (
          <div className="p-3 text-xs text-[#555]">
            {status === 'idle' ? 'Launch a debug session to see call stack' : 'Call stack appears when paused'}
          </div>
        ) : (
          frames.map((frame) => (
            <div
              key={frame.id}
              onClick={() => handleFrameClick(frame)}
              className={[
                'px-3 py-2 cursor-pointer hover:bg-[#2a2d2e] border-b border-[#2d2d2d]',
                activeFrame === frame.id ? 'bg-[#094771]' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                {!isBeginnerMode && (
                  <span className="text-[#969696] text-[10px] w-4 shrink-0">#{frame.id}</span>
                )}
                <span className="text-[#dcdcaa] text-xs font-mono truncate">{frame.name}</span>
              </div>
              <div className="text-[#969696] text-[10px] font-mono mt-0.5 ml-6 truncate">
                {isBeginnerMode
                  ? `${frame.file.split('/').pop()}  line ${frame.line}`
                  : `${shortFile(frame.file)}:${frame.line}`
                }
              </div>
              {isBeginnerMode && frame.variableCount !== undefined && frame.variableCount > 0 && (
                <div className="text-[10px] text-[#569cd6] ml-6 mt-0.5">
                  {frame.variableCount} local {frame.variableCount === 1 ? 'variable' : 'variables'}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Left panel shell ──────────────────────────────────────────────────────────

export default function LeftPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('variables')

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] border-r border-[#3c3c3c]">
      <TabBar active={activeTab} onChange={setActiveTab} />
      <div className="flex-1 overflow-hidden">
        {activeTab === 'variables'   && <VariablesPanel />}
        {activeTab === 'callstack'   && <CallStackPanel />}
        {activeTab === 'breakpoints' && <BreakpointPanel />}
      </div>
    </div>
  )
}
