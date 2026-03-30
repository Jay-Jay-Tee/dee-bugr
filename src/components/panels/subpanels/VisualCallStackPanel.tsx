// src/components/panels/VisualCallStackPanel.tsx
//
// Physical call stack visualiser.
// Each frame is a div whose height scales with its local-variable count.
// Frame 0 (top of stack / current frame) is highlighted.
// Clicking any frame emits IPC.SWITCH_FRAME and highlights it.

import { useState, useCallback, useMemo } from 'react'
import { useDebugStore } from '../../../renderer/store/debugStore'
import { IPC } from '../../../shared/ipc'
import type { StackFrame } from '../../../shared/types'

// ── IPC shim ──────────────────────────────────────────────────────────────────

function invoke(channel: string, args?: unknown) {
  const api = (window as any).electronAPI
  return api?.invoke(channel, args)
    ?.catch((e: unknown) => console.warn('[VisualCallStack] IPC failed', e))
}

// ── Height model ──────────────────────────────────────────────────────────────
// Min height so even 0-variable frames are legible.
// Each extra variable adds BOX_PER_VAR px, capped at BOX_MAX.

const BOX_MIN     = 56   // px — enough for fn name + file:line
const BOX_PER_VAR = 10   // px per local variable
const BOX_MAX     = 160  // px — cap so deep frames don't dominate

function boxHeight(frame: StackFrame): number {
  const vars = frame.variableCount ?? 0
  return Math.min(BOX_MIN + vars * BOX_PER_VAR, BOX_MAX)
}

// ── Colour coding by depth ────────────────────────────────────────────────────
// Frames closer to the top of the stack (lower index) are brighter.

const DEPTH_COLORS = [
  { bg: '#1a2744', border: '#3b6fd4', glow: 'rgba(59,111,212,0.35)' },  // 0 — current
  { bg: '#1a2a1a', border: '#3b9a3b', glow: 'rgba(59,154,59,0.2)'  },  // 1
  { bg: '#2a221a', border: '#9a7a3b', glow: 'rgba(154,122,59,0.2)' },  // 2
  { bg: '#2a1a2a', border: '#9a3b9a', glow: 'rgba(154,59,154,0.2)' },  // 3
  { bg: '#1e1e1e', border: '#555',    glow: 'transparent'           },  // 4+ fallback
]

function depthColor(index: number) {
  return DEPTH_COLORS[Math.min(index, DEPTH_COLORS.length - 1)]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortFile(path: string): string {
  // Show last two path segments: dir/file.ext
  const parts = path.replace(/\\/g, '/').split('/')
  return parts.length > 1
    ? parts.slice(-2).join('/')
    : path
}

function shortFn(name: string): string {
  // Strip namespace/class prefix beyond one level, e.g. a::b::c → b::c
  const parts = name.split('::')
  return parts.length > 2 ? parts.slice(-2).join('::') : name
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface FrameBoxProps {
  frame:       StackFrame
  index:       number          // 0 = top of stack
  depth:       number          // total frames — used for shadow layering
  isActive:    boolean
  isSelected:  boolean
  onClick:     (frame: StackFrame) => void
}

function FrameBox({ frame, index, isActive, isSelected, onClick }: FrameBoxProps) {
  const h      = boxHeight(frame)
  const color  = depthColor(index)
  const vars   = frame.variableCount ?? 0
  const isCurrent = index === 0

  return (
    <div
      onClick={() => onClick(frame)}
      title={`${frame.name}  —  ${frame.file}:${frame.line}${vars ? `  (${vars} vars)` : ''}`}
      style={{
        height:          h,
        background:      color.bg,
        borderColor:     isSelected ? '#fff' : color.border,
        boxShadow:       isSelected
          ? `0 0 0 1.5px #fff, 0 4px 20px ${color.glow}`
          : `0 2px 12px ${color.glow}`,
        animationDelay:  `${index * 40}ms`,
      }}
      className="
        relative flex flex-col justify-between
        border rounded-sm px-3 py-2
        cursor-pointer select-none
        transition-all duration-150
        hover:brightness-125 hover:-translate-y-px
        animate-frame-in
        shrink-0
      "
    >
      {/* ── Stack depth rail (left edge) ─────────────────────────── */}
      <div
        style={{ background: color.border, opacity: isSelected ? 1 : 0.5 }}
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-sm"
      />

      {/* ── Top row: index badge + fn name ───────────────────────── */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          style={{
            background:  color.border,
            color:       isCurrent ? '#fff' : '#a0a0a0',
            fontVariantNumeric: 'tabular-nums',
          }}
          className="
            text-[9px] font-bold px-1.5 py-0.5 rounded-[3px]
            shrink-0 font-mono leading-none
          "
        >
          #{index}
        </span>

        <span
          style={{ color: isCurrent ? '#e8e4ff' : '#b0b0b0' }}
          className="text-[12px] font-mono font-medium truncate leading-tight"
        >
          {shortFn(frame.name)}
        </span>

        {isCurrent && (
          <span className="ml-auto shrink-0 text-[9px] font-bold tracking-widest text-blue-400 uppercase">
            ▶ here
          </span>
        )}
      </div>

      {/* ── Bottom row: file:line + variable bar ─────────────────── */}
      <div className="flex items-end justify-between gap-2 mt-1">
        <span className="text-[10px] font-mono text-[#606060] truncate leading-tight">
          {shortFile(frame.file)}
          <span className="text-[#808080]">:{frame.line}</span>
        </span>

        {vars > 0 && (
          <VarPill count={vars} color={color.border} max={BOX_MAX} height={h} />
        )}
      </div>
    </div>
  )
}

// Variable count pill + inline bar
function VarPill({
  count,
  color,
  max,
  height,
}: {
  count:  number
  color:  string
  max:    number
  height: number
}) {
  // bar fill = how much of the max height this frame occupies
  const fill = Math.min((height - BOX_MIN) / (max - BOX_MIN), 1)

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {/* mini fill bar */}
      <div className="relative w-14 h-[3px] rounded-full bg-white/10 overflow-hidden">
        <div
          style={{ width: `${fill * 100}%`, background: color }}
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
        />
      </div>
      <span style={{ color }} className="text-[9px] font-mono tabular-nums leading-none">
        {count}v
      </span>
    </div>
  )
}

// Stack depth ruler on the left side
function DepthRuler({ frames }: { frames: StackFrame[] }) {
  if (frames.length === 0) return null
  const total = frames.reduce((acc, f) => acc + boxHeight(f), 0)
                + (frames.length - 1) * 4  // gap

  return (
    <div
      style={{ height: total }}
      className="absolute left-0 top-0 w-[1px] bg-gradient-to-b from-blue-500/40 via-white/10 to-transparent"
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VisualCallStackPanel() {
  const frames  = useDebugStore((s) => s.stackFrames)
  const status  = useDebugStore((s) => s.status)
  const threads = useDebugStore((s) => s.threads)

  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Stats
  const totalVars = useMemo(
    () => frames.reduce((n, f) => n + (f.variableCount ?? 0), 0),
    [frames],
  )

  const handleFrameClick = useCallback((frame: StackFrame) => {
    setSelectedId(frame.id)
    invoke(IPC.SWITCH_FRAME, { frameId: frame.id })
  }, [])

  // ── Empty states ──────────────────────────────────────────────────────────

  if (status === 'idle') {
    return (
      <EmptyState
        icon={<StackIcon dim />}
        message="Launch a debug session to see the call stack."
      />
    )
  }

  if (status === 'running') {
    return (
      <EmptyState
        icon={<StackIcon dim />}
        message="Running…  Pause or hit a breakpoint to inspect frames."
      />
    )
  }

  if (frames.length === 0) {
    return (
      <EmptyState
        icon={<StackIcon dim />}
        message="No stack frames available."
      />
    )
  }

  // ── Stack view ────────────────────────────────────────────────────────────

  const activeId = selectedId ?? frames[0]?.id ?? null

  return (
    <div className="flex flex-col h-full bg-[#111118] overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <StackIcon />
          <span className="text-[10px] uppercase tracking-[0.12em] text-[#505070] font-mono">
            Call Stack
          </span>
        </div>
        <div className="flex items-center gap-3">
          {totalVars > 0 && (
            <span className="text-[10px] font-mono text-[#404060] tabular-nums">
              {totalVars} vars
            </span>
          )}
          <span className="text-[10px] font-mono text-[#404060] tabular-nums">
            {frames.length} frame{frames.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Thread strip (if multiple threads) */}
      {threads.length > 1 && (
        <div className="flex gap-1 px-3 py-1.5 border-b border-white/[0.06] shrink-0 overflow-x-auto">
          {threads.map((t) => (
            <span
              key={t.id}
              className={[
                'text-[9px] font-mono px-2 py-0.5 rounded-full shrink-0 border',
                t.status === 'stopped'
                  ? 'bg-yellow-950/40 border-yellow-700/50 text-yellow-400'
                  : 'bg-white/[0.03] border-white/10 text-[#555]',
              ].join(' ')}
            >
              T{t.id} {t.name}
            </span>
          ))}
        </div>
      )}

      {/* Stack grows downward — frame[0] = top of stack = topmost box */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">

        {/* Depth ruler */}
        <div className="relative">
          <DepthRuler frames={frames} />

          {/* Frames */}
          <div className="flex flex-col gap-[4px] pl-3">
            {frames.map((frame, index) => (
              <FrameBox
                key={frame.id}
                frame={frame}
                index={index}
                depth={frames.length}
                isActive={frame.id === frames[0]?.id}
                isSelected={frame.id === activeId}
                onClick={handleFrameClick}
              />
            ))}
          </div>

          {/* Stack bottom cap */}
          <div className="pl-3 mt-1">
            <div className="h-[2px] rounded-full bg-gradient-to-r from-white/10 to-transparent" />
            <span className="text-[9px] font-mono text-[#2a2a3a] mt-1 block">
              ▲ bottom of stack
            </span>
          </div>
        </div>

      </div>

      {/* Selected frame detail footer */}
      {activeId !== null && (() => {
        const f = frames.find((fr) => fr.id === activeId)
        if (!f) return null
        return (
          <div className="border-t border-white/[0.06] px-3 py-2 shrink-0 bg-[#0d0d14]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-mono text-[#404060] shrink-0">frame</span>
              <span className="text-[11px] font-mono text-[#a0a0c0] truncate">{f.name}</span>
            </div>
            <div className="text-[10px] font-mono text-[#404060] mt-0.5 truncate">
              {f.file}:{f.line}
              {(f.variableCount ?? 0) > 0 && (
                <span className="ml-2 text-[#505070]">· {f.variableCount} locals</span>
              )}
            </div>
          </div>
        )
      })()}

      {/* Keyframe styles injected once */}
      <style>{`
        @keyframes frame-in {
          from { opacity: 0; transform: translateY(-6px) scaleY(0.92); }
          to   { opacity: 1; transform: translateY(0)    scaleY(1);    }
        }
        .animate-frame-in {
          animation: frame-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function EmptyState({
  icon,
  message,
}: {
  icon:    React.ReactNode
  message: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 h-full px-6 text-center bg-[#111118]">
      {icon}
      <span className="text-[11px] font-mono text-[#35354a] leading-relaxed">{message}</span>
    </div>
  )
}

function StackIcon({ dim = false }: { dim?: boolean }) {
  return (
    <svg
      width="16" height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={dim ? 'opacity-20' : 'opacity-60'}
    >
      <rect x="2" y="2"  width="12" height="3.5" rx="1" fill="#3b6fd4" />
      <rect x="2" y="6.25"  width="12" height="3.5" rx="1" fill="#3b9a3b" opacity="0.8" />
      <rect x="2" y="10.5" width="12" height="3.5" rx="1" fill="#9a7a3b" opacity="0.6" />
    </svg>
  )
}