import { useEffect, useRef } from 'react'
import {
  Chart,
  LineController,
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

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler)

const ACCENT      = '#7c6af7'
const ACCENT_CHANGED = '#f76a6a'
const ACCENT_DIM  = 'rgba(124,106,247,0.12)'
const GRID        = 'rgba(255,255,255,0.06)'
const TICK        = 'rgba(255,255,255,0.35)'

function toFiniteNumber(value: string): number | null {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

interface VariableChartProps {
  entries: FlatEntry[]
  variableName: string
}

export default function VariableChart({ entries, variableName }: VariableChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<Chart | null>(null)

  // Build chart options (pure, no side-effects)
  const buildOptions = (ents: FlatEntry[], varName: string): ChartOptions<'line'> => ({
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
            if (!items.length) return 'Step'
            const e = ents[items[0].dataIndex]
            return `Step ${e.step}  ·  Line ${e.line}`
          },
          label: (item: TooltipItem<'line'>) => {
            const e = ents[item.dataIndex]
            if (!e) return ''
            const changed = e.changed ? '  ← changed' : ''
            return ` ${varName} = ${e.value}  (${e.type})${changed}`
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
  })

  // Create chart once on mount; update it on data changes; destroy on unmount only.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Guard against HMR/StrictMode remount races: Chart.js tracks charts globally by canvas.
    // If a previous instance is still registered, destroy it before creating a new one.
    Chart.getChart(canvas)?.destroy()

    // Destroy any pre-existing chart on this canvas before creating (safety for StrictMode double-mount)
    chartRef.current?.destroy()
    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels:   entries.map((e) => `s${e.step}`),
        datasets: [{
          label:               variableName,
          data:                entries.map((e) => toFiniteNumber(e.value)),
          borderColor:         ACCENT,
          borderWidth:         2,
          pointBackgroundColor: entries.map((e) => e.changed ? ACCENT_CHANGED : ACCENT),
          pointRadius:         4,
          pointHoverRadius:    6,
          tension:             0.35,
          fill:                true,
          backgroundColor:     ACCENT_DIM,
        }],
      },
      options: buildOptions(entries, variableName),
    })
    return () => {
      chartRef.current?.destroy()
      Chart.getChart(canvas)?.destroy()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount/unmount only

  // Update chart data whenever entries or variableName changes (no recreate)
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const ds = chart.data.datasets[0]
    chart.data.labels          = entries.map((e) => `s${e.step}`)
    ds.data                    = entries.map((e) => toFiniteNumber(e.value))
    ds.label                   = variableName
    ;(ds as any).pointBackgroundColor = entries.map((e) => e.changed ? ACCENT_CHANGED : ACCENT)
    chart.options              = buildOptions(entries, variableName)
    chart.update('active')
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