// src/App.tsx

import { useEffect } from 'react'
import { initIPCListeners } from './renderer/store/debugStore'
import { useKeyboardShortcuts } from './renderer/hooks/useKeyboardShortcuts'
import Toolbar from './components/panels/Toolbar'
import MainLayout from './components/panels/MainLayout'

// Bug 5 fix: removed inline keyboard shortcut useEffect — that code is now
// in useKeyboardShortcuts (status-guarded, F9 uses getState(), no duplication).

export default function App() {
  useEffect(() => {
    initIPCListeners()
  }, [])

  useKeyboardShortcuts()

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#1e1e1e]">
      <Toolbar />
      <MainLayout />
    </div>
  )
}