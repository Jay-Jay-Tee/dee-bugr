import { useEffect, useRef } from 'react'
import {
  Chart,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
  type ChartOptions,
  type TooltipItem,
} from 'chart.js'
import type { FlatEntry } from './index'

Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler)

const ACCENT      = '#7c6af7'
const ACCENT_CHANGED = '#f76a6a'
const ACCENT_DIM  = 'rgba(124,106,247,0.12)'
const GRID        = 'rgba(255,255,255,0.06)'
const TICK        = 'rgba(255,255,255,0.35)'

interface VariableChartProps {
  entries: FlatEntry[]
  variableName: string
}

export default function VariableChart({ entries, variableName }: VariableChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const labels = entries.map((e) => `s${e.step}`)
    const data   = entries.map((e) => parseFloat(e.value))

    // Points where the value changed get a different colour
    const pointColors = entries.map((e) =>
      e.changed ? ACCENT_CHANGED : ACCENT
    )

    const options: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350, easing: 'easeInOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e1b2e',
          borderColor: ACCENT,
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: TICK,
          padding: 10,
          callbacks: {
            title: (items: TooltipItem<'line'>[]) => {
              const e = entries[items[0].dataIndex]
              return `Step ${e.step}  ·  Line ${e.line}`
            },
            label: (item: TooltipItem<'line'>) => {
              const e = entries[item.dataIndex]
              const changed = e.changed ? '  ← changed' : ''
              return ` ${variableName} = ${e.value}  (${e.type})${changed}`
            },
          },
        },
      },
      scales: {
        x: {
          grid:   { color: GRID },
          ticks:  { color: TICK, font: { family: "'JetBrains Mono', monospace", size: 11 } },
          border: { color: 'transparent' },
        },
        y: {
          grid:   { color: GRID },
          ticks:  { color: TICK, font: { family: "'JetBrains Mono', monospace", size: 11 } },
          border: { color: 'transparent' },
        },
      },
    }

    if (chartRef.current) {
      const ds = chartRef.current.data.datasets[0]
      chartRef.current.data.labels   = labels
      ds.data                        = data
      ds.label                       = variableName
      ;(ds as any).pointBackgroundColor = pointColors
      chartRef.current.options       = options
      chartRef.current.update()
    } else {
      chartRef.current = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: variableName,
              data,
              borderColor: ACCENT,
              borderWidth: 2,
              pointBackgroundColor: pointColors,
              pointRadius: 4,
              pointHoverRadius: 6,
              tension: 0.35,
              fill: true,
              backgroundColor: ACCENT_DIM,
            },
          ],
        },
        options,
      })
    }

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [entries, variableName])

  return (
    <div className="vhp-chart-wrap">
      <canvas ref={canvasRef} />
      <div className="vhp-chart-legend">
        <span className="vhp-legend-dot" style={{ background: ACCENT }} /> unchanged
        <span className="vhp-legend-dot" style={{ background: ACCENT_CHANGED }} /> changed
      </div>
    </div>
  )
}