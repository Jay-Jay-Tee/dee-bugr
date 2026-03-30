// src/components/panels/DebugCinema.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Debug Cinema — v2 Day 7 feature.
// Replays the execution history as an animation:
//   - Scrub bar to pick any recorded step
//   - Play / Pause at selectable speed
//   - Shows variable values animating as each step replays
//   - "Jump to step" emits an IPC call so the editor cursor follows along
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useDebugStore } from '../../../renderer/store/debugStore'
import { IPC } from '../../../shared/ipc'
import type { HistoryEntry } from '../../../shared/types'

const SPEEDS = [0.5, 1, 2, 4] // seconds per step

function invoke(channel: typeof IPC[keyof typeof IPC], args?: unknown) {
  return globalThis.electronAPI?.invoke(channel, args)
    .catch((err: unknown) => console.error('[Cinema]', err))
}

interface CinemaStep {
  step: number
  file: string
  line: number
  changed: string[] // variable names that changed at this step
  vars: { name: string; value: string; changed: boolean }[]
}

function toSteps(history: HistoryEntry[]): CinemaStep[] {
  return history.map((entry) => ({
    step:    entry.step,
    file:    entry.file,
    line:    entry.line,
    changed: Object.entries(entry.variables)
      .filter(([, v]) => v.changed)
      .map(([name]) => name),
    vars: Object.entries(entry.variables).map(([name, v]) => ({
      name,
      value:   v.value,
      changed: v.changed,
    })),
  }))
}

export default function DebugCinema() {
  const history = useDebugStore((s) => s.executionHistory)
  const steps   = useMemo(() => toSteps(history), [history])

  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speedIdx, setSpeedIdx] = useState(1) // default 1s
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const totalSteps = steps.length

  const goToStep = useCallback(
    async (idx: number) => {
      if (idx < 0 || idx >= totalSteps) return
      setCurrent(idx)
      const step = steps[idx]
      // Inform main process — editor cursor will jump there
      await invoke(IPC.JUMP_TO_STEP, { step: step.step })
      // Also dispatch event for CodeEditor to highlight the line
      globalThis.dispatchEvent(
        new CustomEvent('lucid:cinema-step', {
          detail: { file: step.file, line: step.line },
        })
      )
    },
    [steps, totalSteps]
  )

  // Play / pause logic
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!playing) return

    const ms = SPEEDS[speedIdx] * 1000
    timerRef.current = setInterval(() => {
      setCurrent((prev) => {
        const next = prev + 1
        if (next >= totalSteps) {
          setPlaying(false)
          return prev
        }
        const step = steps[next]
        // fire-and-forget jump
        invoke(IPC.JUMP_TO_STEP, { step: step.step })
        globalThis.dispatchEvent(
          new CustomEvent('lucid:cinema-step', {
            detail: { file: step.file, line: step.line },
          })
        )
        return next
      })
    }, ms)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [playing, speedIdx, totalSteps, steps])

  if (totalSteps === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#555] text-xs p-4 text-center">
        No execution history recorded yet.
        <br />Launch a session and step through code to record it.
      </div>
    )
  }

  const currentStep = steps[current]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-[#3c3c3c] shrink-0 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-[#969696]">Debug Cinema</span>
        <span className="text-[10px] text-[#555]">
          Step {currentStep.step} / {steps[totalSteps - 1].step}
        </span>
      </div>

      {/* Scrubber */}
      <div className="px-3 py-2 shrink-0">
        <input
          type="range"
          min={0}
          max={totalSteps - 1}
          value={current}
          onChange={(e) => goToStep(Number(e.target.value))}
          className="w-full accent-blue-500 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-[#555] mt-0.5">
          <span>Step {steps[0].step}</span>
          <span>Step {steps[totalSteps - 1].step}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="px-3 py-1 shrink-0 flex items-center gap-2">
        <button
          onClick={() => goToStep(0)}
          className="text-[#969696] hover:text-white text-xs px-1.5 py-1 rounded hover:bg-[#3c3c3c]"
          title="Go to first step"
        >
          ⏮
        </button>
        <button
          onClick={() => goToStep(current - 1)}
          disabled={current === 0}
          className="text-[#969696] hover:text-white text-xs px-1.5 py-1 rounded hover:bg-[#3c3c3c] disabled:opacity-30"
        >
          ◀
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="px-2.5 py-1 text-xs rounded font-medium bg-blue-600 text-white hover:bg-blue-700"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          onClick={() => goToStep(current + 1)}
          disabled={current >= totalSteps - 1}
          className="text-[#969696] hover:text-white text-xs px-1.5 py-1 rounded hover:bg-[#3c3c3c] disabled:opacity-30"
        >
          ▶
        </button>
        <button
          onClick={() => goToStep(totalSteps - 1)}
          className="text-[#969696] hover:text-white text-xs px-1.5 py-1 rounded hover:bg-[#3c3c3c]"
          title="Go to last step"
        >
          ⏭
        </button>
        {/* Speed selector */}
        <div className="ml-auto flex items-center gap-1 text-[10px] text-[#969696]">
          <span>Speed:</span>
          {SPEEDS.map((s, i) => (
            <button
              key={s}
              onClick={() => setSpeedIdx(i)}
              className={[
                'px-1.5 py-0.5 rounded',
                speedIdx === i ? 'bg-blue-600 text-white' : 'hover:bg-[#3c3c3c] text-[#969696]',
              ].join(' ')}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Current step info */}
      <div className="px-3 py-1 shrink-0 border-t border-[#3c3c3c] text-[10px] text-[#555]">
        {currentStep.file.split('/').pop()}:{currentStep.line}
        {currentStep.changed.length > 0 && (
          <span className="ml-2 text-amber-400">
            ↑ {currentStep.changed.join(', ')}
          </span>
        )}
      </div>

      {/* Variable snapshot */}
      <div className="flex-1 overflow-y-auto">
        {currentStep.vars.length === 0 && (
          <div className="text-[#555] text-xs p-3">No variables at this step.</div>
        )}
        {currentStep.vars.map((v) => (
          <div
            key={v.name}
            className={[
              'flex items-center gap-2 px-3 py-0.5 text-xs font-mono',
              v.changed ? 'bg-amber-900/30' : '',
            ].join(' ')}
          >
            <span className="w-4 text-amber-400 shrink-0">{v.changed ? '↑' : ' '}</span>
            <span className="text-[#9cdcfe] w-28 shrink-0 truncate">{v.name}</span>
            <span className="flex-1 text-[#cccccc] truncate">{v.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
