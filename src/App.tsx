// src/App.tsx
import { useEffect } from 'react'
import { initIPCListeners } from './renderer/store/debugStore'
import { useDebugStore } from './renderer/store/debugStore'
import { IPC } from './shared/ipc'
import type { IPCChannel } from './shared/ipc'
import Toolbar from './components/panels/Toolbar'
import MainLayout from './components/panels/MainLayout'

function invoke(channel: IPCChannel, args?: unknown) {
  return globalThis.electronAPI?.invoke(channel, args)
    .catch((err: unknown) => console.error(`[IPC] ${channel} failed:`, err))
}

export default function App() {
  useEffect(() => {
    initIPCListeners()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const shift = e.shiftKey
      switch (e.key) {
        case 'F5':  e.preventDefault(); shift ? invoke(IPC.TERMINATE) : invoke(IPC.CONTINUE);  break
        case 'F9':  e.preventDefault(); handleF9();                                             break
        case 'F10': e.preventDefault(); invoke(IPC.NEXT);                                       break
        case 'F11': e.preventDefault(); shift ? invoke(IPC.STEP_OUT) : invoke(IPC.STEP_IN);    break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#1e1e1e]">
      <Toolbar />
      <MainLayout />
    </div>
  )
}

function handleF9() {
  const { currentFile, currentLine, toggleBreakpoint } = useDebugStore.getState()
  if (currentFile && currentLine) toggleBreakpoint(currentFile, currentLine)
}