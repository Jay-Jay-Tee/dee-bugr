import { create } from 'zustand'
import { DebugState, INITIAL_DEBUG_STATE } from '../../shared/types'
import { IPC } from '../../shared/ipc'

// ── Store interface ───────────────────────────────────────────────────────────
// Extends DebugState (P1-owned) with UI-only fields that never travel over IPC.
// isBeginnerMode is added here so all panels can read it from Day 3 onward.

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
    try {
      const channel = existing ? IPC.REMOVE_BREAKPOINT : IPC.SET_BREAKPOINT
      await globalThis.electronAPI.invoke(channel, { file, line })
    } catch (error) {
      console.error('Failed to toggle breakpoint', error)
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
  } catch (error) {
    console.error('Failed to initialize IPC listeners:', error)
    listenersInitialized = false
  }
}

export function cleanupIPCListeners() {
  unsubscribers.forEach((unsub) => {
    try {
      unsub()
    } catch (e) {
      console.error('Unsubscribe error', e)
    }
  })
  unsubscribers.length = 0
  listenersInitialized = false
}
