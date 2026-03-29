import type { FlatEntry } from './index'

interface StatsRowProps {
  entries: FlatEntry[]
}

export default function StatsRow({ entries }: StatsRowProps) {
  const nums    = entries.map((e) => parseFloat(e.value)).filter((n) => !isNaN(n))
  const latest = entries[entries.length - 1]
  const min     = nums.length ? Math.min(...nums) : null
  const max     = nums.length ? Math.max(...nums) : null
  const delta   = nums.length >= 2 ? (nums[nums.length-1]! - nums[0]).toFixed(3) : '—'
  const changes = entries.filter((e) => e.changed).length

  return (
    <div className="vhp-stats">
      <Stat label="current" value={latest?.value ?? '—'} sub={latest?.type} />
      <Stat label="min"     value={min !== null ? String(min) : '—'} />
      <Stat label="max"     value={max !== null ? String(max) : '—'} />
      <Stat label="Δ total" value={delta} />
      <Stat label="changed" value={String(changes)} />
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="vhp-stat">
      <span className="vhp-stat-label">{label}</span>
      <span className="vhp-stat-value">{value}</span>
      {sub && <span className="vhp-stat-sub">{sub}</span>}
    </div>
  )
}