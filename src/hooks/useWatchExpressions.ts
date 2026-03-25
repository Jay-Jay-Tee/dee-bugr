// src/hooks/useWatchExpressions.ts
// ─────────────────────────────────────────────────────────────────────────────
// Manages the watch expression list entirely on the renderer side.
//
// - Expressions persist across steps (UI-local state, not in DebugState).
// - Results are re-evaluated via IPC.EVALUATE after every stopped event,
//   detected by watching stepCount from the store.
// - Returns stable action references so consumers can wrap in useCallback.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDebugStore } from '../renderer/store/debugStore'
import { IPC } from '../shared/ipc'
import type { IPCChannel } from '../shared/ipc'

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
  electronAPI?: { invoke: (ch: IPCChannel, payload?: unknown) => Promise<unknown> }
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
  // handlers.ts returns the raw string from session.evaluate()
  if (typeof raw === 'string') {
    const isError = raw.startsWith('Error:')
    return { result: raw, status: isError ? 'error' : 'ok' }
  }
  return { result: String(raw), status: 'ok' }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

let nextId = 1

export function useWatchExpressions() {
  const [entries, setEntries] = useState<WatchEntry[]>([])

  const stepCount = useDebugStore((s) => s.stepCount)
  const status    = useDebugStore((s) => s.status)

  // Keep a stable ref to entries so the re-evaluate effect doesn't need
  // entries in its dep array (which would cause infinite re-evaluation).
  const entriesRef = useRef(entries)
  useEffect(() => { entriesRef.current = entries }, [entries])

  // ── Evaluate a single expression ──────────────────────────────────────────

  const evaluateOne = useCallback(async (id: string, expression: string) => {
    setEntries((prev) =>
      prev.map((e) => e.id === id ? { ...e, status: 'pending' } : e)
    )
    const raw = await invoke(IPC.EVALUATE, { expr: expression })
    const { result, status: evalStatus } = extractResult(raw)
    setEntries((prev) =>
      prev.map((e) => e.id === id ? { ...e, result, status: evalStatus } : e)
    )
  }, [])

  // ── Re-evaluate all watches on every stop ─────────────────────────────────

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
    // Evaluate immediately if a session is paused
    if (status === 'paused') evaluateOne(id, trimmed)
  }, [status, evaluateOne])

  const removeExpression = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const updateExpression = useCallback((id: string, expression: string) => {
    const trimmed = expression.trim()
    if (!trimmed) return
    setEntries((prev) =>
      prev.map((e) => e.id === id ? { ...e, expression: trimmed, result: '—', status: 'idle' } : e)
    )
    if (status === 'paused') evaluateOne(id, trimmed)
  }, [status, evaluateOne])

  const clearAll = useCallback(() => setEntries([]), [])

  return { entries, addExpression, removeExpression, updateExpression, clearAll }
}