// electron/preload.ts
// Exposes a minimal, typed IPC bridge to the renderer via contextBridge.
//
// FIX: added `once` method (declared in global.d.ts but missing here —
//      any renderer code calling electronAPI.once() would throw at runtime).

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, args?: unknown) =>
    ipcRenderer.invoke(channel, args),

  on: (channel: string, callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(channel, handler)
    // Returns an unsubscribe function so callers can clean up in useEffect
    return () => ipcRenderer.removeListener(channel, handler)
  },

  once: (channel: string, callback: (data: unknown) => void) => {
    ipcRenderer.once(channel, (_event: Electron.IpcRendererEvent, data: unknown) => callback(data))
  },

  off: (channel: string) => ipcRenderer.removeAllListeners(channel),
})
