import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { Network, DataSet, type Options } from 'vis-network/standalone'
import { useDebugStore } from '../../../../renderer/store/debugStore'
import { parseVariableToGraph } from './parseVariableToGraph'
import type { Variable } from '../../../../shared/types'

// ── vis-network options ───────────────────────────────────────────────────────
// Physics (forceAtlas2Based) is used instead of hierarchical layout so nodes
// auto-arrange organically and settle into a stable position.

const VIS_OPTIONS: Options = {
  nodes: {
    shape: 'box',
    borderWidth: 1.5,
    borderWidthSelected: 2.5,
    margin: { top: 8, right: 10, bottom: 8, left: 10 },
    font: {
      face: 'JetBrains Mono, ui-monospace, monospace',
      size: 11,
      color: '#e2dff5',
      multi: 'html',
    },
    shadow: { enabled: true, color: 'rgba(0,0,0,0.4)', size: 6, x: 2, y: 2 },
  },
  edges: {
    arrows: { to: { enabled: true, scaleFactor: 0.6 } },
    smooth: { enabled: true, type: 'cubicBezier', roundness: 0.35 },
    font: { size: 9, align: 'middle', color: '#6b6b8a', strokeWidth: 0 },
    color: { color: '#3d3870', highlight: '#7c6af7', hover: '#534AB7' },
    width: 1.2,
    selectionWidth: 2,
  },
  groups: {
    object: {
      color: { background: '#1e1c3a', border: '#534AB7', highlight: { background: '#2d2b4e', border: '#7c6af7' } },
      font: { color: '#b0adf5' },
    },
    array: {
      color: { background: '#0f2720', border: '#0F6E56', highlight: { background: '#1e3530', border: '#1aaf87' } },
      font: { color: '#6fcfb2' },
    },
    number: {
      color: { background: '#281e0e', border: '#854F0B', highlight: { background: '#3a2f1a', border: '#c47a1a' } },
      font: { color: '#d4a96a' },
    },
    string: {
      color: { background: '#0e1d2e', border: '#185FA5', highlight: { background: '#1a2b3a', border: '#3a8fd1' } },
      font: { color: '#6ab0e0' },
    },
    boolean: {
      color: { background: '#27101e', border: '#993556', highlight: { background: '#3a1e2f', border: '#c45077' } },
      font: { color: '#d47aab' },
    },
    null: {
      color: { background: '#1e1e1e', border: '#5F5E5A', highlight: { background: '#2a2a2a', border: '#888780' } },
      font: { color: '#888780' },
    },
  },
  physics: {
    enabled: true,
    solver: 'forceAtlas2Based',
    forceAtlas2Based: {
      gravitationalConstant: -42,
      centralGravity: 0.008,
      springLength: 120,
      springConstant: 0.06,
      damping: 0.6,
      avoidOverlap: 0.8,
    },
    stabilization: {
      enabled: true,
      iterations: 150,
      updateInterval: 25,
      fit: true,
    },
    minVelocity: 0.75,
    maxVelocity: 30,
  },
  interaction: {
    hover: true,
    tooltipDelay: 120,
    zoomView: true,
    dragView: true,
    dragNodes: true,
    multiselect: false,
    navigationButtons: false,
    keyboard: { enabled: false },
  },
  layout: {
    randomSeed: 42,           // deterministic start position
    improvedLayout: true,
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Bridge from the flat store Variable to the DAPVariable shape parseVariableToGraph expects. */
function variableToDAPInput(v: Variable) {
  return {
    name: v.name,
    value: v.value,
    type: v.type ?? 'unknown',
    variablesReference: v.variablesReference,
    children: [],     // DAP children aren't pre-fetched here; flat render only
  }
}

const LEGEND: { color: string; label: string }[] = [
  { color: '#534AB7', label: 'object' },
  { color: '#0F6E56', label: 'array' },
  { color: '#854F0B', label: 'number' },
  { color: '#185FA5', label: 'string' },
  { color: '#993556', label: 'boolean' },
  { color: '#5F5E5A', label: 'null' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function ObjectGraphPanel() {
  const variables = useDebugStore((s) => s.variables)
  const status = useDebugStore((s) => s.status)

  // The variable whose sub-graph is being visualised. Defaults to the first
  // complex variable (variablesReference > 0), or first variable if none.
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<Network | null>(null)
  const [stabilized, setStabilized] = useState(false)
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)

  // ── Auto-select a sensible default when variables change ──────────────────
  useEffect(() => {
    if (!variables || variables.length === 0) {
      setSelectedName(null)
      return
    }
    // Keep selection if the variable still exists
    if (selectedName && variables.some((v) => v.name === selectedName)) return

    // Prefer a complex (object/array) variable; fall back to first
    const complex = variables.find((v) => v.variablesReference > 0)
    setSelectedName((complex ?? variables[0]).name)
  }, [variables])                  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build graph data from the selected variable ───────────────────────────
  const graph = useMemo(() => {
    if (!selectedName || !variables || variables.length === 0)
      return { nodes: [], edges: [] }

    const target = variables.find((v) => v.name === selectedName)
    if (!target) return { nodes: [], edges: [] }

    return parseVariableToGraph(variableToDAPInput(target))
  }, [selectedName, variables])

  // ── Mount / update vis-network ────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    // Destroy old network before rebuilding
    if (networkRef.current) {
      networkRef.current.destroy()
      networkRef.current = null
    }

    if (graph.nodes.length === 0) {
      setStabilized(false)
      setNodeCount(0)
      setEdgeCount(0)
      return
    }

    setStabilized(false)
    setSelectedLabel(null)

    const nodes = new DataSet(graph.nodes)
    const edges = new DataSet(graph.edges)

    const net = new Network(containerRef.current, { nodes, edges }, VIS_OPTIONS)
    networkRef.current = net

    setNodeCount(graph.nodes.length)
    setEdgeCount(graph.edges.length)

    net.on('stabilizationIterationsDone', () => {
      net.setOptions({ physics: { enabled: false } })   // freeze after settle
      net.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } })
      setStabilized(true)
    })

    // Show node info on click
    net.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0] as string
        const node = graph.nodes.find((n) => n.id === nodeId)
        setSelectedLabel(node ? `${node.id}  ·  ${node.title ?? node.label}` : null)
      } else {
        setSelectedLabel(null)
      }
    })

    return () => {
      net.destroy()
      networkRef.current = null
    }
  }, [graph])

  // ── Fit-to-screen helper ──────────────────────────────────────────────────
  const handleFit = useCallback(() => {
    networkRef.current?.fit({
      animation: { duration: 400, easingFunction: 'easeInOutQuad' },
    })
  }, [])

  // ── Re-run physics on demand ──────────────────────────────────────────────
  const handleReLayout = useCallback(() => {
    if (!networkRef.current) return
    setStabilized(false)
    networkRef.current.setOptions({ physics: { enabled: true } })
    networkRef.current.stabilize(150)
  }, [])

  // ── Empty / idle states ───────────────────────────────────────────────────
  if (status === 'idle' || status === 'terminated') {
    return <EmptyState message="Launch a debug session to visualise objects." />
  }

  if (!variables || variables.length === 0) {
    return <EmptyState message={<>No variables in scope.<br />Step to a frame with local variables.</>} />
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#13121f]">

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#2a2a3e] shrink-0 bg-[#1a1929]">
        <span className="text-[10px] uppercase tracking-widest text-[#6b6b8a] shrink-0">Object Graph</span>

        {/* Variable picker */}
        <select
          value={selectedName ?? ''}
          onChange={(e) => setSelectedName(e.target.value)}
          className="ml-auto text-[11px] bg-[#252438] border border-[#3a3858] text-[#c8c5f0] rounded px-2 py-0.5
                     focus:outline-none focus:border-[#534AB7] cursor-pointer max-w-[160px] truncate"
        >
          {variables.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name}  ({v.type || '?'})
            </option>
          ))}
        </select>

        {/* Fit button */}
        <button
          onClick={handleFit}
          title="Fit to screen"
          className="ml-1 text-[#6b6b8a] hover:text-[#a09fcc] transition-colors"
        >
          <FitIcon />
        </button>

        {/* Re-layout button */}
        <button
          onClick={handleReLayout}
          title="Re-run physics layout"
          className="text-[#6b6b8a] hover:text-[#a09fcc] transition-colors"
        >
          <RelayoutIcon />
        </button>
      </div>

      {/* ── Canvas ──────────────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />

        {/* Stabilizing spinner */}
        {!stabilized && graph.nodes.length > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2
                          flex items-center gap-1.5 px-2.5 py-1 rounded-full
                          bg-[#1a1929]/90 border border-[#3a3858] text-[10px] text-[#6b6b8a]
                          pointer-events-none select-none">
            <span className="inline-block w-2 h-2 rounded-full bg-[#534AB7] animate-pulse" />
            Arranging…
          </div>
        )}

        {/* Selected node info strip */}
        {selectedLabel && (
          <div className="absolute bottom-3 left-3 right-3
                          px-2.5 py-1 rounded bg-[#1a1929]/95 border border-[#3a3858]
                          text-[10px] text-[#a09fcc] truncate pointer-events-none select-none">
            {selectedLabel}
          </div>
        )}

        {/* Empty graph (variable has no children / is primitive) */}
        {graph.nodes.length === 0 && selectedName && (
          <div className="absolute inset-0 flex items-center justify-center">
            <EmptyState message={
              <>
                <span className="font-mono text-[#534AB7]">{selectedName}</span>
                {' '}is a primitive — no edges to render.<br />
                Select a complex variable from the picker above.
              </>
            } />
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-1 border-t border-[#2a2a3e] shrink-0 bg-[#1a1929]">
        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {LEGEND.map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1 text-[10px] text-[#6b6b8a]">
              <span style={{ background: color }} className="inline-block w-2 h-2 rounded-sm shrink-0" />
              {label}
            </span>
          ))}
        </div>

        {/* Stats */}
        <span className="ml-auto text-[10px] text-[#3d3d5a] tabular-nums shrink-0">
          {nodeCount}n · {edgeCount}e
        </span>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState({ message }: {readonly message: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-[#444462] text-xs px-6 text-center">
      <GraphIcon />
      <span className="leading-relaxed">{message}</span>
    </div>
  )
}

// ── Icons (inline SVG, no dep) ─────────────────────────────────────────────

function GraphIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="2" />
      <circle cx="4" cy="20" r="2" />
      <circle cx="20" cy="20" r="2" />
      <circle cx="12" cy="14" r="2" />
      <line x1="12" y1="6" x2="12" y2="12" />
      <line x1="12" y1="16" x2="5" y2="19" />
      <line x1="12" y1="16" x2="19" y2="19" />
      <line x1="12" y1="6" x2="5" y2="18" />
      <line x1="12" y1="6" x2="19" y2="18" />
    </svg>
  )
}

function FitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}

function RelayoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}