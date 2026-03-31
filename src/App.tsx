// src/App.tsx
//
// FIX: removed the inline keyboard shortcut handler that duplicated
//      useKeyboardShortcuts and didn't guard by session status.
//      Now uses the dedicated hook from renderer/hooks/useKeyboardShortcuts.ts.

import { useEffect } from 'react'
import { initIPCListeners, cleanupIPCListeners } from './renderer/store/debugStore'
import { useKeyboardShortcuts } from './renderer/hooks/useKeyboardShortcuts'
import Toolbar from './components/panels/ToolBar'
import MainLayout from './components/panels/MainLayout'
import SessionErrorBanner from './components/panels/SessionErrorBanner'

export default function App() {
  // Boot IPC listener bridge once
  useEffect(() => {
    initIPCListeners()
    return () => cleanupIPCListeners()
  }, [])

  // All keyboard shortcuts — F5/F9/F10/F11/Shift variants, guarded by status
  useKeyboardShortcuts()

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#1e1e1e]">
      <SessionErrorBanner />
      <Toolbar />
      <MainLayout />
    </div>
  )
}
