// src/components/panels/RightPanel.tsx

import { useState } from 'react'
import DebugCinema from './DebugCinema'
import FixDiffPanel from './FixDiffPanel'

// Bug 9 fix: DebugCinema was written but never mounted anywhere.
// Day 4: Cinema tab added here. AI / Fix panels remain stubs until P4 delivers.

type Tab = 'ai' | 'fix' | 'cinema' | 'graph'

const TABS: { id: Tab; label: string }[] = [
  { id: 'ai',     label: 'AI'     },
  { id: 'fix',    label: 'Fix'    },
  { id: 'cinema', label: '🎬 Cinema' },
  { id: 'graph',  label: 'Graph'  },
]

function TabBar({ active, onChange }: { readonly active: Tab; readonly onChange: (t: Tab) => void }) {
  return (
    <div className="flex border-b border-[#3c3c3c] shrink-0">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={[
            'px-3 py-1.5 text-xs uppercase tracking-wide transition-colors',
            active === t.id
              ? 'text-white border-b-2 border-blue-500 -mb-px'
              : 'text-[#969696] hover:text-white',
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function Placeholder({ label }: {readonly label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-[#555] text-xs">
      {label}
    </div>
  )
}

export default function RightPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('ai')

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e] border-l border-[#3c3c3c]">
      <TabBar active={activeTab} onChange={setActiveTab} />
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'ai'     && <Placeholder label="AI explanation — P4 delivers component" />}
        {activeTab === 'fix'    && <FixDiffPanel />}
        {activeTab === 'graph'  && <Placeholder label="Object graph — P3 delivers component" />}
        {activeTab === 'cinema' && <DebugCinema />}
      </div>
    </div>
  )
}
