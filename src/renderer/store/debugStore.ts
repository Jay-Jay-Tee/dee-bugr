// src/renderer/store/debugStore.ts

import { create } from 'zustand'
import { DebugState, INITIAL_DEBUG_STATE, Breakpoint, Anomaly, ReturnValue } from '../../shared/types'
import { IPC } from '../../shared/ipc'
import type { IPCChannel } from '../../shared/ipc'

interface OutputLine {
  text: string
  category: string
}

interface DebugStore extends DebugState {
  outputLog: OutputLine[]
  isBeginnerMode: boolean

  setState: (state: DebugState) => void
  setStatus: (status: DebugState['status']) => void
  setLanguage: (language: DebugState['language']) => void
  appendOutput: (text: string, category: string) => void
  toggleBeginnerMode: () => void
  toggleBreakpoint: (file: string, line: number) => Promise<void>
  updateBreakpoint: (id: string, patch: Partial<Breakpoint>) => Promise<void>
  removeBreakpointById: (id: string) => Promise<void>
}

// Bug 6 fix: optional chaining — will not throw if electronAPI isn't ready yet
function invoke(channel: IPCChannel, args?: unknown): Promise<unknown> {
  return globalThis.electronAPI?.invoke(channel, args) ?? Promise.resolve(undefined)
}

export const useDebugStore = create<DebugStore>((set, get) => ({
  ...INITIAL_DEBUG_STATE,
  outputLog: [],
  isBeginnerMode: false,

  setState: (newState) =>
    set((prev) => ({ ...prev, ...newState })),

  setStatus: (status) => set({ status }),

  setLanguage: (language) => set({ language }),

  appendOutput: (text, category) =>
    set((prev) => ({ outputLog: [...prev.outputLog, { text, category }] })),

  toggleBeginnerMode: () =>
    set((prev) => ({ isBeginnerMode: !prev.isBeginnerMode })),

  toggleBreakpoint: async (file, line) => {
    const existing = get().breakpoints.find(
      (bp) => bp.file === file && bp.line === line
    )

    if (existing) {
      set((prev) => ({
        breakpoints: prev.breakpoints.filter((bp) => bp.id !== existing.id),
      }))
      try {
        await invoke(IPC.REMOVE_BREAKPOINT, { file, line })
      } catch (err) {
        set((prev) => ({ breakpoints: [...prev.breakpoints, existing] }))
        console.error('Failed to remove breakpoint', err)
      }
    } else {
      const optimistic: Breakpoint = {
        id:       `bp-${file}-${line}`,
        file,
        line,
        verified: false,
      }
      set((prev) => ({ breakpoints: [...prev.breakpoints, optimistic] }))
      try {
        await invoke(IPC.SET_BREAKPOINT, { file, line })
      } catch (err) {
        set((prev) => ({
          breakpoints: prev.breakpoints.filter((bp) => bp.id !== optimistic.id),
        }))
        console.error('Failed to set breakpoint', err)
      }
    }
  },

  updateBreakpoint: async (id, patch) => {
    set((prev) => ({
      breakpoints: prev.breakpoints.map((bp) =>
        bp.id === id ? { ...bp, ...patch } : bp
      ),
    }))
    const bp = get().breakpoints.find((b) => b.id === id)
    if (!bp) return
    try {
      await invoke(IPC.SET_BREAKPOINT, {
        file:      bp.file,
        line:      bp.line,
        condition: bp.condition,
        hitCount:  bp.hitCountRemaining,
        label:     bp.label,
        groupId:   bp.groupId,
        dependsOn: bp.dependsOn,
      })
    } catch (err) {
      console.error('Failed to update breakpoint', err)
    }
  },

  removeBreakpointById: async (id) => {
    const bp = get().breakpoints.find((b) => b.id === id)
    if (!bp) return
    set((prev) => ({ breakpoints: prev.breakpoints.filter((b) => b.id !== id) }))
    try {
      await invoke(IPC.REMOVE_BREAKPOINT, { file: bp.file, line: bp.line })
    } catch (err) {
      console.error('Failed to remove breakpoint', err)
    }
  },
}))

// ── IPC listeners ─────────────────────────────────────────────────────────────

let listenersInitialized = false
const unsubscribers: Array<() => void> = []

function isDebugState(value: unknown): value is DebugState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'currentLine' in value
  )
}

function isOutputLine(value: unknown): value is OutputLine {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v['text'] === 'string' && typeof v['category'] === 'string'
}

function isAnomaly(value: unknown): value is Anomaly {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v['message'] === 'string' && typeof v['variable'] === 'string'
}

function isReturnValue(value: unknown): value is ReturnValue {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v['fnName'] === 'string' && typeof v['value'] === 'string'
}

export function initIPCListeners() {
  if (listenersInitialized) return
  listenersInitialized = true

  if (!globalThis.electronAPI) {
    console.error('electronAPI not available — preload failed to load')
    return
  }

  try {
    unsubscribers.push(
      globalThis.electronAPI.on(IPC.EVENT_STOPPED, (state: unknown) => {
        if (isDebugState(state)) {
          useDebugStore.getState().setState(state)
        } else {
          console.warn('Invalid state in EVENT_STOPPED', state)
        }
      })
    )
    unsubscribers.push(
      globalThis.electronAPI.on(IPC.EVENT_CONTINUED, () => {
        useDebugStore.getState().setStatus('running')
      })
    )
    unsubscribers.push(
      globalThis.electronAPI.on(IPC.EVENT_TERMINATED, () => {
        useDebugStore.getState().setStatus('terminated')
      })
    )
    unsubscribers.push(
      globalThis.electronAPI.on(IPC.EVENT_OUTPUT, (data: unknown) => {
        if (isOutputLine(data)) {
          useDebugStore.getState().appendOutput(data.text, data.category)
        } else {
          console.warn('Invalid data in EVENT_OUTPUT', data)
        }
      })
    )

    // Bug 8 fix: restore anomaly listener
    unsubscribers.push(
      globalThis.electronAPI.on(IPC.EVENT_ANOMALY, (data: unknown) => {
        if (!isAnomaly(data)) return
        const store = useDebugStore.getState()
        const existing = store.anomalies ?? []
        if (!existing.some((a) => a.message === data.message)) {
          store.setState({ ...store, anomalies: [...existing, data] })
        }
      })
    )

    // Bug 8 fix: restore return-value listener
    unsubscribers.push(
      globalThis.electronAPI.on(IPC.EVENT_RETURN_VAL, (data: unknown) => {
        if (!isReturnValue(data)) return
        const store = useDebugStore.getState()
        store.setState({ ...store, lastReturnValue: data })
      })
    )

  } catch (error) {
    console.error('Failed to initialize IPC listeners:', error)
    listenersInitialized = false
  }
}

export function cleanupIPCListeners() {
  unsubscribers.forEach((unsub) => {
    try { unsub() } catch (e) { console.error('Unsubscribe error', e) }
  })
  unsubscribers.length = 0
  listenersInitialized = false
}
