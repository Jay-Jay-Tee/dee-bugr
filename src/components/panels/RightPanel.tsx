// src/components/RightPanel.tsx
// Placeholder shell — Day 4 P4 delivers AI explanation panel to slot in here.

import { useState } from 'react'

type Tab = 'ai' | 'fix' | 'graph'

const TABS: { id: Tab; label: string }[] = [
  { id: 'ai',    label: 'AI' },
  { id: 'fix',   label: 'Fix' },
  { id: 'graph', label: 'Graph' },
]

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
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

function Placeholder({ label }: { label: string }) {
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
      {activeTab === 'ai'    && <Placeholder label="AI explanation — wired Day 4" />}
      {activeTab === 'fix'   && <Placeholder label="Fix diff — wired Day 5" />}
      {activeTab === 'graph' && <Placeholder label="Object graph — wired Day 6" />}
    </div>
  )
}
