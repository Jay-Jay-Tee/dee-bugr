// src/components/panels/LeftPanel.tsx
// Shell only — tab routing. All panel content lives in subpanels/.

import { useState } from 'react'
import PanelTabBar from './subpanels/PanelTabBar'
import VariablesPanel from './subpanels/VariablesPanel'
import BreakpointPanel from './subpanels/BreakpointPanel'
import WatchPanel from './subpanels/WatchPanel'
import VisualCallStackPanel from './subpanels/VisualCallStackPanel'

const TABS = [
  { id: 'variables',   label: 'Vars'  },
  { id: 'callstack',   label: 'Stack' },
  { id: 'breakpoints', label: 'BPs'   },
  { id: 'watch',       label: 'Watch' },
]

type Tab = 'variables' | 'callstack' | 'breakpoints' | 'watch'

export default function LeftPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('variables')

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] border-r border-[#3c3c3c]">
      <PanelTabBar tabs={TABS} active={activeTab} onChange={(id) => setActiveTab(id as Tab)} collapseAt={180} />
      <div className="flex-1 overflow-hidden">
        {activeTab === 'variables'   && <VariablesPanel />}
        {activeTab === 'callstack'   && <VisualCallStackPanel />}
        {activeTab === 'breakpoints' && <BreakpointPanel />}
        {activeTab === 'watch'       && <WatchPanel />}
      </div>
    </div>
  )
}
