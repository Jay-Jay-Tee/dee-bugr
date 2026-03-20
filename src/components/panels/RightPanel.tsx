// src/components/panels/RightPanel.tsx
// AI explanation and fix panel — P4 Day 4

import { useState, useEffect } from 'react'
import { IPC } from '../../shared/ipc'

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

interface AIExplanationPanelProps {
  onExplain?: () => void
  onFix?: () => void
}

function AIExplanationPanel({ onExplain, onFix }: AIExplanationPanelProps) {
  const [explanation, setExplanation] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    // Auto-fetch explanation when component mounts
    fetchExplanation()
  }, [])

  const fetchExplanation = async () => {
    setLoading(true)
    setError('')
    try {
      if (!globalThis.electronAPI) {
        setError('Electron API not available')
        setLoading(false)
        return
      }

      const result = await globalThis.electronAPI.invoke(IPC.AI_EXPLAIN, {}) as any
      if (result.success && result.explanation) {
        setExplanation(result.explanation)
      } else {
        setError(result.error || 'Failed to get explanation')
      }
    } catch (err: any) {
      console.error('[RightPanel] AI_EXPLAIN failed:', err)
      setError(err.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(explanation)
  }

  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e] p-3 overflow-hidden">
      {/* Header with buttons */}
      <div className="flex gap-2 mb-3 shrink-0">
        <button
          onClick={fetchExplanation}
          disabled={loading}
          className={[
            'px-2 py-1 text-xs rounded font-medium transition-colors',
            loading
              ? 'bg-[#3c3c3c] text-[#888] cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700',
          ].join(' ')}
        >
          {loading ? '⏳ Explaining...' : '🔄 Regenerate'}
        </button>
        {explanation && (
          <button
            onClick={handleCopy}
            className="px-2 py-1 text-xs rounded font-medium bg-[#3c3c3c] text-[#ccc] hover:bg-[#4a4a4a] transition-colors"
          >
            📋 Copy
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="text-[#888] text-xs">
            <div className="animate-pulse">Analyzing with Groq AI...</div>
          </div>
        )}
        {error && (
          <div className="text-red-400 text-xs p-2 bg-red-900 bg-opacity-20 rounded">
            ⚠️ {error}
          </div>
        )}
        {explanation && !loading && (
          <div className="text-[#e0e0e0] text-xs whitespace-pre-wrap break-words">
            {explanation}
          </div>
        )}
        {!explanation && !loading && !error && (
          <div className="text-[#555] text-xs">
            No explanation yet. Hit a breakpoint and click "Regenerate".
          </div>
        )}
      </div>
    </div>
  )
}

function AIFixPanel() {
  return (
    <div className="flex-1 flex items-center justify-center text-[#555] text-xs">
      Fix suggestions — wired Day 5
    </div>
  )
}

export default function RightPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('ai')

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e] border-l border-[#3c3c3c]">
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === 'ai'    && <AIExplanationPanel />}
      {activeTab === 'fix'   && <AIFixPanel />}
      {activeTab === 'graph' && <Placeholder label="Object graph — wired Day 6" />}
    </div>
  )
}
