import type { FlatEntry } from './index'

interface HistoryTableProps {
  readonly entries: FlatEntry[]
}

export default function HistoryTable( { entries }: HistoryTableProps) {
  if (entries.length === 0) {
    return (
      <div className="vhp-empty">No history for this variable yet.</div>
    )
  }

  return (
    <div className="vhp-table-wrap">
      <table>
        <thead>
          <tr>
            <th>step</th>
            <th>line</th>
            <th>type</th>
            <th>value</th>
            <th>changed</th>
          </tr>
        </thead>
        <tbody>
          {[...entries].reverse().map((e, i) => (
            <tr
              key={i}
              className={[
                i === 0    ? 'vhp-row-latest'  : '',
                e.changed  ? 'vhp-row-changed' : '',
              ].join(' ')}
            >
              <td className="mono">{e.step}</td>
              <td className="mono dim">{e.line}</td>
              <td><span className="vhp-tag">{e.type}</span></td>
              <td className="mono accent">{e.value}</td>
              <td>
                {e.changed
                  ? <span className="vhp-badge-changed">yes</span>
                  : <span className="vhp-badge-same">—</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}