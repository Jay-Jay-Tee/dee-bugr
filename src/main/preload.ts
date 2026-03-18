import { contextBridge, ipcRenderer } from 'electron'

// Everything exposed here appears as window.electronAPI in React
contextBridge.exposeInMainWorld('electronAPI', {

  // ── INVOKE (request → response) ───────────────────────────
  // Renderer calls these like: await window.electronAPI.invoke(IPC.NEXT)
  invoke: (channel: string, args?: any) => {
    return ipcRenderer.invoke(channel, args)
  },

  // ── ON (listen for events pushed from main) ───────────────
  // Renderer calls: window.electronAPI.on(IPC.EVENT_STOPPED, cb)
  on: (channel: string, callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on(channel, handler)

    // Return a cleanup function so React can call it in useEffect cleanup
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  },

  // ── REMOVE LISTENER ───────────────────────────────────────
  off: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
})

// Type declaration so TypeScript knows about window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, args?: any) => Promise<any>
      on: (channel: string, callback: (data: any) => void) => () => void
      off: (channel: string) => void
    }
  }
}