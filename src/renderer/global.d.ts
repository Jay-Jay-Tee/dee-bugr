import type { IPCChannel } from '../shared/ipc'

export {}

declare global {
  interface globalThis {
    electronAPI: ElectronAPI
  }

  interface Window {
    electronAPI: ElectronAPI
  }

  // Also available as globalThis.electronAPI (used in debugStore.ts)
  var electronAPI: ElectronAPI
}

export interface ElectronAPI {
  invoke: (channel: IPCChannel, args?: unknown) => Promise<unknown>
  on: (channel: IPCChannel, callback: (data: unknown) => void) => () => void
  once: (channel: IPCChannel, callback: (data: unknown) => void) => void
  off: (channel: IPCChannel) => void
}
