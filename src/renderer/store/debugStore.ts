import { create } from 'zustand'
import { DebugState, INITIAL_DEBUG_STATE } from '../../shared/types'
import { IPC } from '../../shared/ipc'

interface DebugStore extends DebugState {
  // Actions — only called by the IPC listener below
  setState: (state: DebugState) => void
  setStatus: (status: DebugState['status']) => void
  appendOutput: (text: string, category: string) => void
  outputLog: { text: string; category: string }[]
}

export const useDebugStore = create<DebugStore>((set) => ({
  ...INITIAL_DEBUG_STATE,
  outputLog: [],

  setState: (newState) => set(newState),

  setStatus: (status) => set({ status }),

  appendOutput: (text, category) =>
    set((prev) => ({
      outputLog: [...prev.outputLog, { text, category }]
    }))
}))

// ── WIRE IPC EVENTS TO STORE ──────────────────────────────
// Call this once in your App.tsx
export function initIPCListeners() {
  const store = useDebugStore.getState()

  // Full state update — fires on every breakpoint/step
  window.electronAPI.on(IPC.EVENT_STOPPED, (state: DebugState) => {
    console.log('[Store] Stopped at', state.currentFile, ':', state.currentLine)
    store.setState(state)
  })

  // Program continued running
  window.electronAPI.on(IPC.EVENT_CONTINUED, () => {
    store.setStatus('running')
  })

  // Program finished
  window.electronAPI.on(IPC.EVENT_TERMINATED, () => {
    store.setStatus('terminated')
  })

  // Console output from the program
  window.electronAPI.on(IPC.EVENT_OUTPUT, (data: { text: string; category: string }) => {
    store.appendOutput(data.text, data.category)
  })
}