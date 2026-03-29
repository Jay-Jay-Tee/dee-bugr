interface VariableSelectorProps {
  variables: string[]
  selected: string
  onChange: (variable: string) => void
}

export default function VariableSelector({
  variables,
  selected,
  onChange,
}: VariableSelectorProps) {
  return (
    <div className="vhp-header">
      <span className="vhp-title">Variable History</span>
      <select
        className="vhp-select"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        {variables.length === 0 && (
          <option value="">— no variables —</option>
        )}
        {variables.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </div>
  )
}