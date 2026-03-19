import { create } from 'zustand'
import { DebugState, INITIAL_DEBUG_STATE } from '../../shared/types'
import { IPC } from '../../shared/ipc'

interface DebugStore extends DebugState {
  setState: (state: DebugState) => void
  setStatus: (status: DebugState['status']) => void
  appendOutput: (text: string, category: string) => void
  outputLog: { text: string; category: string }[]

  toggleBreakpoint: (file: string, line: number) => Promise<void>

}


export const useDebugStore = create<DebugStore>((set) => ({
  ...INITIAL_DEBUG_STATE,
  outputLog: [],

  setState: (newState) =>
    set((prev) => ({
      ...prev,
      ...newState,
    })),

  setStatus: (status) => set({ status }),

  appendOutput: (text, category) =>
    set((prev) => ({
      outputLog: [...prev.outputLog, { text, category }]
    })),

    toggleBreakpoint: async (file, line) => {
  try {
    await globalThis.electronAPI.invoke(
      IPC.SET_BREAKPOINT,
      { file, line }
    )
  } catch (error) {
    console.error('Failed to toggle breakpoint', error)
  }
}
}))

let listenersInitialized = false
const unsubscribers: Array<() => void> = []

function isDebugState(value: unknown): value is DebugState {
  return typeof value === 'object' && value !== null && 'status' in value
}

function isOutputData(value: unknown): value is { text: string; category: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).text === 'string' &&
    typeof (value as any).category === 'string'
  )
}

export function initIPCListeners() {
  if (listenersInitialized) return
  listenersInitialized = true

  if (!globalThis.electronAPI) {
    console.error('electronAPI not available — preload failed to load')
    return
  }
  try {
    const unsubscribe1 = globalThis.electronAPI.on(IPC.EVENT_STOPPED, (state: unknown) => {
      if (isDebugState(state)) {
        useDebugStore.getState().setState(state)
      } else {
        console.warn('Invalid state received in EVENT_STOPPED', state)
      }
    })
    unsubscribers.push(unsubscribe1)

    const unsubscribe2 = globalThis.electronAPI.on(IPC.EVENT_CONTINUED, () => {
      useDebugStore.getState().setStatus('running')
    })
    unsubscribers.push(unsubscribe2)

    const unsubscribe3 = globalThis.electronAPI.on(IPC.EVENT_TERMINATED, () => {
      useDebugStore.getState().setStatus('terminated')
    })
    unsubscribers.push(unsubscribe3)

    const unsubscribe4 = globalThis.electronAPI.on(IPC.EVENT_OUTPUT, (data: unknown) => {
      if (isOutputData(data)) {
        useDebugStore.getState().appendOutput(data.text, data.category)
      } else {
        console.warn('Invalid data received in EVENT_OUTPUT', data)
      }
    })
    unsubscribers.push(unsubscribe4)
  } catch (error) {
    console.error('Failed to initialize IPC listeners:', error)
    listenersInitialized = false
  }
}

export function cleanupIPCListeners() {
  unsubscribers.forEach((unsubscribe) => {
    try {
      unsubscribe()
    } catch (error) {
      console.error('Error unsubscribing from IPC listener:', error)
    }
  })
  unsubscribers.length = 0
  listenersInitialized = false
}