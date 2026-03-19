import { useEffect } from 'react'
import { initIPCListeners } from './renderer/store/debugStore'
import Toolbar from './components/panels/Toolbar'
import MainLayout from './components/panels/MainLayout'

export default function App() {
  useEffect(() => {
    initIPCListeners()
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#1e1e1e]">
      <Toolbar />
      <MainLayout />
    </div>
  )
}
