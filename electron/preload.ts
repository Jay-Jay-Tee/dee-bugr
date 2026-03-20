import { contextBridge, ipcRenderer } from 'electron'
import type { IPCChannel } from '../src/shared/ipc'

// Exposes window.electronAPI to the renderer.
// Vite builds this file → dist-electron/preload.mjs, loaded by electron/main.ts.
// contextIsolation: true — renderer has no direct Node access.

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
