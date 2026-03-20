import { contextBridge, ipcRenderer } from 'electron'
import type { IPCChannel } from '../shared/ipc'

// Exposes window.electronAPI to the renderer process.
// contextIsolation: true — no direct Node.js access from React.
// NOTE: electron/main.ts loads the BUILT output (preload.mjs), compiled
// from this file by vite-plugin-electron. No changes needed in main.ts.

contextBridge.exposeInMainWorld('electronAPI', {

  invoke: (channel: IPCChannel, args?: unknown): Promise<unknown> =>
    ipcRenderer.invoke(channel, args),

  on: (channel: IPCChannel, callback: (data: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  once: (channel: IPCChannel, callback: (data: unknown) => void): void => {
    ipcRenderer.once(channel, (_event, data) => callback(data))
  },

  off: (channel: IPCChannel): void => {
    ipcRenderer.removeAllListeners(channel)
  },
})
