// src/hooks/useWatchExpressions.ts
// ─────────────────────────────────────────────────────────────────────────────
// Manages watch expressions entirely on the renderer side.
//
// - Expressions persist across steps (UI-local state, not in DebugState).
// - Re-evaluated via IPC.EVALUATE after every stop, detected by stepCount.
// - entriesRef avoids including entries in the re-eval effect dep array,
//   which would otherwise cause infinite re-evaluation loops.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDebugStore } from '../store/debugStore'
import { IPC } from '../../shared/ipc'
import type { IPCChannel } from '../../shared/ipc'

// ── Types ─────────────────────────────────────────────────────────────────────

export type WatchStatus = 'idle' | 'pending' | 'ok' | 'error'

export interface WatchEntry {
  id:         string
  expression: string
  result:     string
  status:     WatchStatus
}

// ── IPC helper ────────────────────────────────────────────────────────────────

type ElectronWindow = Window & {
  electronAPI?: { invoke: (ch: IPCChannel, args?: unknown) => Promise<unknown> }
}

function invoke(channel: IPCChannel, args?: unknown): Promise<unknown> {
  return (window as ElectronWindow).electronAPI?.invoke(channel, args)
    ?? Promise.resolve(undefined)
}

// ── Result extraction ─────────────────────────────────────────────────────────

function extractResult(raw: unknown): { result: string; status: WatchStatus } {
  if (raw === undefined || raw === null) {
    return { result: 'not available', status: 'idle' }
  }
  if (typeof raw === 'string') {
    return { result: raw, status: raw.startsWith('Error:') ? 'error' : 'ok' }
  }
  return { result: String(raw), status: 'ok' }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

let nextId = 1

export function useWatchExpressions() {
  const [entries, setEntries] = useState<WatchEntry[]>([])

  const stepCount = useDebugStore((s) => s.stepCount)
  const status    = useDebugStore((s) => s.status)

  const entriesRef = useRef(entries)
  useEffect(() => { entriesRef.current = entries }, [entries])

  // ── Evaluate a single entry ───────────────────────────────────────────────

  const evaluateOne = useCallback(async (id: string, expression: string) => {
    setEntries((prev) =>
      prev.map((e) => e.id === id ? { ...e, status: 'pending' as WatchStatus } : e)
    )
    const raw = await invoke(IPC.EVALUATE, { expr: expression })
    const { result, status: evalStatus } = extractResult(raw)
    setEntries((prev) =>
      prev.map((e) => e.id === id ? { ...e, result, status: evalStatus } : e)
    )
  }, [])

  // ── Re-evaluate all on every stop ─────────────────────────────────────────

  useEffect(() => {
    if (status !== 'paused') return
    const current = entriesRef.current
    if (current.length === 0) return
    for (const entry of current) {
      evaluateOne(entry.id, entry.expression)
    }
  }, [stepCount, status, evaluateOne])

  // ── Actions ───────────────────────────────────────────────────────────────

  const addExpression = useCallback((expression: string) => {
    const trimmed = expression.trim()
    if (!trimmed) return
    const id = `watch-${nextId++}`
    const entry: WatchEntry = { id, expression: trimmed, result: '—', status: 'idle' }
    setEntries((prev) => [...prev, entry])
    if (status === 'paused') evaluateOne(id, trimmed)
  }, [status, evaluateOne])

  const removeExpression = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const updateExpression = useCallback((id: string, expression: string) => {
    const trimmed = expression.trim()
    if (!trimmed) return
    setEntries((prev) =>
      prev.map((e) => e.id === id ? { ...e, expression: trimmed, result: '—', status: 'idle' as WatchStatus } : e)
    )
    if (status === 'paused') evaluateOne(id, trimmed)
  }, [status, evaluateOne])

  const clearAll = useCallback(() => setEntries([]), [])

  return { entries, addExpression, removeExpression, updateExpression, clearAll }
}
