import { useState, useMemo } from 'react'
import { useDebugStore } from '../../../renderer/store/debugStore'
import type { HistoryEntry } from '../../../shared/types'
import VariableSelector from './VariableSelector'
import VariableChart from './VariableChart'
import StatsRow from './StatsRow'
import HistoryTable from './HistoryTable'
import './VariableHistoryPanel.css'

// Flattened shape used internally by chart/table/stats — derived from HistoryEntry
export interface FlatEntry {
  step: number
  line: number
  value: string
  type: string
  changed: boolean
}

export default function VariableHistoryPanel() {
  const executionHistory = useDebugStore((s) => s.executionHistory)

  // Collect all variable names that appear across all steps
  const variables = useMemo(() => {
    const names = new Set<string>()
    executionHistory.forEach((h: HistoryEntry) => {
      Object.keys(h.variables).forEach((name: string) => names.add(name))
    })
    return Array.from(names).sort()
  }, [executionHistory])

  const [selected, setSelected] = useState<string>(variables[0] ?? '')

  // Extract the selected variable's value at each step it appears
  const entries: FlatEntry[] = useMemo(() => {
    if (!selected) return []
    return executionHistory
      .filter((h: HistoryEntry) => selected in h.variables)
      .map((h: HistoryEntry) => ({
        step:    h.step,
        line:    h.line,
        value:   h.variables[selected].value,
        type:    h.variables[selected].type,
        changed: h.variables[selected].changed,
      }))
  }, [executionHistory, selected])

  // Keep selected in sync if variables list changes (e.g. on new debug session)
  useState(() => {
    if (!selected && variables.length > 0) setSelected(variables[0])
  })

  if (executionHistory.length === 0) {
    return (
      <div className="vhp-panel">
        <div className="vhp-empty-state">
          No execution history yet. Start a debug session and step through your code.
        </div>
      </div>
    )
  }

  return (
    <div className="vhp-panel">
      <VariableSelector
        variables={variables}
        selected={selected}
        onChange={setSelected}
      />
      <StatsRow entries={entries} />
      <VariableChart entries={entries} variableName={selected} />
      <HistoryTable entries={entries} />
    </div>
  )
}