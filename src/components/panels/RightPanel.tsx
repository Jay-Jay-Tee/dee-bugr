// src/components/panels/RightPanel.tsx
// Shell only — tab routing + anomaly banner. All panel content lives in subpanels/.

import { useState, useEffect } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import type { Anomaly } from '../../shared/types'
import PanelTabBar from './subpanels/PanelTabBar'
import AIExplanationPanel from './subpanels/AIExplanationPanel'
import AIFixPanel from './subpanels/AIFixPanel'
import NarrativePanel from './subpanels/NarrativePanel'
import AssemblyPanel from './subpanels/AssemblyPanel'
import ObjectGraphPanel from './subpanels/ObjectGraphPanel/index'

const TABS = [
  { id: 'ai',        label: 'AI'       },
  { id: 'fix',       label: 'Fix'      },
  { id: 'asm',       label: 'Assembly' },
  { id: 'graph',     label: 'Graph'    },
  { id: 'narrative', label: 'Narrative'},
]

type Tab = 'ai' | 'fix' | 'asm' | 'graph' | 'narrative'

function AnomalyBanner() {
  const anomalies = useDebugStore((s) => s.anomalies)
  if (!anomalies || anomalies.length === 0) return null
  return (
    <div className="shrink-0 border-b border-amber-800/50 bg-amber-950/40 px-3 py-1.5">
      {anomalies.map((a: Anomaly, i: number) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <span className={a.severity === 'error' ? 'text-red-400' : 'text-amber-400'}>
            {a.severity === 'error' ? '⛔' : '⚠️'}
          </span>
          <span className="text-amber-200">{a.message}</span>
          {a.line && <span className="text-amber-500 ml-auto shrink-0">line {a.line}</span>}
        </div>
      ))}
    </div>
  )
}

export default function RightPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('ai')

  useEffect(() => {
    const toAI  = () => setActiveTab('ai')
    const toFix = () => setActiveTab('fix')
    const toNar = () => setActiveTab('narrative')
    window.addEventListener('lucid:ai-explain',   toAI)
    window.addEventListener('lucid:ai-fix',       toFix)
    window.addEventListener('lucid:ai-narrative', toNar)
    return () => {
      window.removeEventListener('lucid:ai-explain',   toAI)
      window.removeEventListener('lucid:ai-fix',       toFix)
      window.removeEventListener('lucid:ai-narrative', toNar)
    }
  }, [])

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e] border-l border-[#3c3c3c]">
      <PanelTabBar tabs={TABS} active={activeTab} onChange={(id) => setActiveTab(id as Tab)} collapseAt={250} />
      <AnomalyBanner />
      {activeTab === 'ai'        && <AIExplanationPanel />}
      {activeTab === 'fix'       && <AIFixPanel />}
      {activeTab === 'asm'       && <AssemblyPanel />}
      {activeTab === 'graph'     && <ObjectGraphPanel />}
      {activeTab === 'narrative' && <NarrativePanel />}
    </div>
  )
}
