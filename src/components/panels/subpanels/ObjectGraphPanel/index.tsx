// src/components/panels/ObjectGraphPanel/index.tsx
//
// Enhancements over the previous version:
//   • Click a node  → React tooltip overlay showing raw variable data
//   • Expand button → appears on nodes whose variablesReference > 0 and whose
//                     children haven't been fetched yet; calls IPC.GET_VARIABLES,
//                     injects new nodes+edges into the live DataSet (no full re-render)
//   • Node metadata  → stored in a ref Map keyed by vis node ID
//   • Tooltip + Expand are React overlays positioned via network.canvasToDOM()

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Network, DataSet, type Node, type Edge } from 'vis-network/standalone'
import { useDebugStore } from '../../../../renderer/store/debugStore'
import { IPC } from '../../../../shared/ipc'
import { parseVariableToGraph, type GraphNode } from './parseVariableToGraph'
import type { Variable } from '../../../../shared/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NodeMeta {
  name:               string
  value:              string
  type:               string
  group:              string
  isLeaf:             boolean
  variablesReference: number
  childrenLoaded:     boolean
}

interface OverlayState {
  nodeId: string
  domX:   number
  domY:   number
}

// ── IPC ───────────────────────────────────────────────────────────────────────

async function fetchChildren(varRef: number): Promise<Variable[]> {
  try {
    const r = await (globalThis as any).electronAPI?.invoke(
      IPC.GET_VARIABLES, { variablesReference: varRef },
    )
    if (Array.isArray(r))            return r as Variable[]
    if (Array.isArray(r?.variables)) return r.variables as Variable[]
    return []
  } catch (e) {
    console.warn('[ObjectGraphPanel] fetchChildren failed', e)
    return []
  }
}

// ── vis-network options ───────────────────────────────────────────────────────

const VIS_OPTIONS = {
  nodes: {
    shape: 'box',
    borderWidth: 1.5,
    borderWidthSelected: 2.5,
    margin: { top: 8, right: 10, bottom: 8, left: 10 },
    font: {
      face: 'JetBrains Mono, ui-monospace, monospace',
      size: 11,
      color: '#e2dff5',
    },
    shadow: { enabled: true, color: 'rgba(0,0,0,0.4)', size: 6, x: 2, y: 2 },
  },
  edges: {
    arrows: { to: { enabled: true, scaleFactor: 0.6 } },
    smooth: { enabled: true, type: 'cubicBezier', roundness: 0.35 },
    font: { size: 9, align: 'middle', color: '#6b6b8a', strokeWidth: 0 },
    color: { color: '#3d3870', highlight: '#7c6af7', hover: '#534AB7' },
    width: 1.2,
  },
  groups: {
    object:  { color: { background: '#1e1c3a', border: '#534AB7', highlight: { background: '#2d2b4e', border: '#7c6af7' } }, font: { color: '#b0adf5' } },
    array:   { color: { background: '#0f2720', border: '#0F6E56', highlight: { background: '#1e3530', border: '#1aaf87' } }, font: { color: '#6fcfb2' } },
    number:  { color: { background: '#281e0e', border: '#854F0B', highlight: { background: '#3a2f1a', border: '#c47a1a' } }, font: { color: '#d4a96a' } },
    string:  { color: { background: '#0e1d2e', border: '#185FA5', highlight: { background: '#1a2b3a', border: '#3a8fd1' } }, font: { color: '#6ab0e0' } },
    boolean: { color: { background: '#27101e', border: '#993556', highlight: { background: '#3a1e2f', border: '#c45077' } }, font: { color: '#d47aab' } },
    null:    { color: { background: '#1e1e1e', border: '#5F5E5A', highlight: { background: '#2a2a2a', border: '#888780' } }, font: { color: '#888780' } },
  },
  layout: {
    hierarchical: {
      enabled: true, direction: 'UD',
      sortMethod: 'directed', levelSeparation: 80, nodeSpacing: 120,
    },
  },
  physics: { enabled: false },
  interaction: {
    hover: true,
    tooltipDelay: 9999,   // suppress vis's own tooltip — we render ours
    zoomView: true, dragView: true, dragNodes: true, multiselect: false,
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferGroup(type: string): string {
  const t = (type ?? '').toLowerCase()
  if (t.includes('int') || t.includes('float') || t.includes('double') || t.includes('number')) return 'number'
  if (t.includes('str') || t.includes('char'))                          return 'string'
  if (t.includes('bool'))                                               return 'boolean'
  if (t.includes('null') || t.includes('none') || t.includes('undefined')) return 'null'
  if (t.includes('list') || t.includes('array') || t.includes('[]'))   return 'array'
  return 'object'
}

function buildLabel(name: string, value: string, type: string): string {
  const group = inferGroup(type)
  if (group === 'object' || group === 'array') return `${name}\n(${type})`
  const v = value.length > 24 ? value.slice(0, 22) + '…' : value
  return `${name}: ${v}`
}

let _nodeCounter = 0
function freshId(name: string) { return `${name}_${_nodeCounter++}` }

// ── NodeTooltip overlay ───────────────────────────────────────────────────────

interface TooltipProps {
  meta:        NodeMeta
  x:           number
  y:           number
  cw:          number   // container width  (for flip)
  ch:          number   // container height (for flip)
  expanding:   boolean
  onExpand:    () => void
  onClose:     () => void
  onCopy:      () => void
  copied:      boolean
}

function NodeTooltip({ meta, x, y, cw, ch, expanding, onExpand, onClose, onCopy, copied }: TooltipProps) {
  const W = 230
  // Flip horizontally / vertically to stay in bounds
  const left = x + W + 16 > cw ? x - W - 8 : x + 12
  const top  = y + 200    > ch ? Math.max(0, ch - 210) : y + 4

  const canExpand = meta.variablesReference > 0 && !meta.childrenLoaded

  return (
    <div
      className="absolute z-30 pointer-events-auto"
      style={{ left, top, width: W }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="rounded-lg border border-[#3a3858] bg-[#14122a]/96 backdrop-blur-sm
                      shadow-2xl shadow-black/70 overflow-hidden text-[11px] font-mono">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-2.5 py-2
                        bg-[#1e1c3a] border-b border-[#2e2c4e]">
          <span className="text-[#c8c5f0] font-semibold truncate">{meta.name}</span>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              onClick={onCopy}
              title="Copy name / type / value"
              className="text-[#555] hover:text-[#999] transition-colors leading-none"
            >
              {copied ? <span className="text-[#4ec9b0]">✓</span> : '⎘'}
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="text-[#555] hover:text-[#999] transition-colors leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Variable fields ───────────────────────────────────────── */}
        <div className="px-2.5 py-2 space-y-1.5">
          <TRow label="type"  val={meta.type  || '?'}         col="text-[#4ec9b0]" />
          <TRow label="value" val={meta.value || '""'}        col="text-[#e2dff5]" />
          <TRow label="group" val={meta.group}                col="text-[#7c6af7]" />
          <TRow label="leaf"  val={String(meta.isLeaf)}       col={meta.isLeaf ? 'text-[#555]' : 'text-[#dcdcaa]'} />
          {meta.variablesReference > 0 && (
            <TRow label="varRef" val={String(meta.variablesReference)} col="text-[#ce9178]" />
          )}
        </div>

        {/* ── Expand button ─────────────────────────────────────────── */}
        {canExpand && (
          <div className="px-2.5 pb-2.5 pt-0.5">
            <button
              onClick={onExpand}
              disabled={expanding}
              className="w-full py-1.5 rounded text-[10px] font-bold tracking-wider
                         border border-[#534AB7]/50 bg-[#1a1838]
                         text-[#7c6af7] hover:bg-[#252248] hover:border-[#7c6af7]
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all duration-150"
            >
              {expanding ? '⏳  fetching children…' : '⊕  Expand children'}
            </button>
          </div>
        )}

        {/* Already expanded indicator */}
        {!canExpand && meta.variablesReference > 0 && (
          <div className="px-2.5 pb-2 text-[9px] text-[#2e2e4a] tracking-wider uppercase">
            ✓ children loaded
          </div>
        )}
      </div>
    </div>
  )
}

function TRow({ label, val, col }: { label: string; val: string; col: string }) {
  return (
    <div className="flex gap-2 items-start leading-tight">
      <span className="text-[#35354a] w-10 shrink-0 uppercase text-[9px] tracking-wider pt-[1px]">
        {label}
      </span>
      <span className={`${col} break-all`}>{val}</span>
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

const LEGEND = [
  { color: '#534AB7', label: 'object'  },
  { color: '#0F6E56', label: 'array'   },
  { color: '#854F0B', label: 'number'  },
  { color: '#185FA5', label: 'string'  },
  { color: '#993556', label: 'boolean' },
  { color: '#5F5E5A', label: 'null' },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function ObjectGraphPanel() {
  const variables = useDebugStore((s) => s.variables)
  const status = useDebugStore((s) => s.status)

  const containerRef = useRef<HTMLDivElement>(null)
  const wrapRef      = useRef<HTMLDivElement>(null)   // for measuring overlay bounds
  const networkRef   = useRef<Network | null>(null)
  const nodesDS      = useRef<DataSet<Node> | null>(null)
  const edgesDS      = useRef<DataSet<Edge> | null>(null)
  const metaMap      = useRef<Map<string, NodeMeta>>(new Map())

  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [overlay,      setOverlay]      = useState<OverlayState | null>(null)
  const [expanding,    setExpanding]    = useState(false)
  const [copied,       setCopied]       = useState(false)
  const [containerSz,  setContainerSz]  = useState({ w: 400, h: 300 })

  // ── Auto-select default variable ────────────────────────────────────
  useEffect(() => {
    if (!variables?.length) { setSelectedName(null); return }
    if (selectedName && variables.some((v) => v.name === selectedName)) return
    setSelectedName((variables.find((v) => v.variablesReference > 0) ?? variables[0]).name)
  }, [variables])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build initial graph ──────────────────────────────────────────────
  const initialGraph = useMemo(() => {
    if (!selectedName || !variables?.length) return null
    const target = variables.find((v) => v.name === selectedName)
    if (!target) return null
    _nodeCounter = 0
    return parseVariableToGraph({
      name: target.name, value: target.value,
      type: target.type ?? 'unknown',
      variablesReference: target.variablesReference,
      children: [],
    })
  }, [selectedName, variables])

  // ── Mount / rebuild network ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !wrapRef.current) return

    const { width: w, height: h } = wrapRef.current.getBoundingClientRect()
    setContainerSz({ w, h })

    networkRef.current?.destroy()
    networkRef.current = null
    nodesDS.current    = null
    edgesDS.current    = null
    metaMap.current.clear()
    setOverlay(null)

    if (!initialGraph?.nodes.length) return

    const rootVar = variables?.find((v) => v.name === selectedName)

    const visNodes: Node[] = initialGraph.nodes.map((gn: GraphNode, idx) => {
      const isRoot = idx === 0
      const varRef = isRoot ? (rootVar?.variablesReference ?? 0) : 0
      metaMap.current.set(gn.id, {
        name:               gn.id.replace(/_\d+$/, ''),
        value:              gn.value,
        type:               gn.type,
        group:              gn.group ?? inferGroup(gn.type),
        isLeaf:             gn.isLeaf,
        variablesReference: varRef,
        childrenLoaded:     false,
      })
      return {
        id:    gn.id,
        label: gn.label,
        group: gn.group,
        title: undefined,
        ...(varRef > 0 ? { borderDashes: [4, 2] } : {}),
      } as Node
    })

    nodesDS.current = new DataSet<Node>(visNodes)
    edgesDS.current = new DataSet<Edge>(initialGraph.edges as Edge[])

    const net = new Network(
      containerRef.current,
      { nodes: nodesDS.current, edges: edgesDS.current },
      VIS_OPTIONS,
    )
    networkRef.current = net

    // Click → open / close overlay
    net.on('click', (params) => {
      if (params.nodes.length === 0) { setOverlay(null); return }
      const nodeId = params.nodes[0] as string
      setOverlay((prev) => {
        if (prev?.nodeId === nodeId) return null   // toggle off
        const pos = net.canvasToDOM(net.getPosition(nodeId))
        return { nodeId, domX: pos.x, domY: pos.y }
      })
      setCopied(false)
    })

    // Keep overlay attached after drag
    net.on('dragEnd', () => {
      setOverlay((prev) => {
        if (!prev) return null
        const pos = net.canvasToDOM(net.getPosition(prev.nodeId))
        return { ...prev, domX: pos.x, domY: pos.y }
      })
    })

    // Re-measure on zoom/pan so flip logic stays accurate
    net.on('zoom',        () => setContainerSz(({ w, h }) => ({ w, h })))
    net.on('afterDrawing', () => {
      if (!wrapRef.current) return
      const r = wrapRef.current.getBoundingClientRect()
      setContainerSz({ w: r.width, h: r.height })
    })

    return () => { net.destroy(); networkRef.current = null }
  }, [initialGraph])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Expand ───────────────────────────────────────────────────────────
  const handleExpand = useCallback(async () => {
    if (!overlay) return
    const meta = metaMap.current.get(overlay.nodeId)
    if (!meta || !meta.variablesReference || meta.childrenLoaded) return

    setExpanding(true)
    try {
      const children = await fetchChildren(meta.variablesReference)
      if (!children.length) return

      const base = nodesDS.current?.length ?? 0
      let c = base

      const newNodes: Node[] = []
      const newEdges: Edge[] = []

      children.forEach((child) => {
        const id    = `${child.name}_${c++}`
        const group = inferGroup(child.type ?? '')
        metaMap.current.set(id, {
          name:               child.name,
          value:              child.value,
          type:               child.type ?? 'unknown',
          group,
          isLeaf:             child.variablesReference === 0,
          variablesReference: child.variablesReference,
          childrenLoaded:     false,
        })
        newNodes.push({
          id, label: buildLabel(child.name, child.value, child.type ?? ''),
          group, title: undefined,
          ...(child.variablesReference > 0 ? { borderDashes: [4, 2] } : {}),
        } as Node)
        newEdges.push({ from: overlay.nodeId, to: id, label: child.name } as Edge)
      })

      nodesDS.current?.add(newNodes)
      edgesDS.current?.add(newEdges)

      // Solid border = expanded
      nodesDS.current?.update([{ id: overlay.nodeId, borderDashes: false }] as Node[])
      meta.childrenLoaded = true

      // Force tooltip re-render so "Expand" button disappears
      setOverlay((o) => o ? { ...o } : null)

      networkRef.current?.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } })
    } finally {
      setExpanding(false)
    }
  }, [overlay])

  // ── Copy ─────────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    if (!overlay) return
    const m = metaMap.current.get(overlay.nodeId)
    if (!m) return
    navigator.clipboard.writeText(`name: ${m.name}\ntype: ${m.type}\nvalue: ${m.value}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }, [overlay])

  // ── Fit ──────────────────────────────────────────────────────────────
  const handleFit = useCallback(() =>
    networkRef.current?.fit({ animation: { duration: 350, easingFunction: 'easeInOutQuad' } }),
  [])

  // ── Empty states ─────────────────────────────────────────────────────
  if (status === 'idle' || status === 'terminated')
    return <EmptyState message="Launch a session to visualise objects." />
  if (!variables?.length)
    return <EmptyState message={<>No variables in scope.<br />Pause at a breakpoint.</>} />

  const overlayMeta = overlay ? (metaMap.current.get(overlay.nodeId) ?? null) : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#13121f]">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#2a2a3e] shrink-0 bg-[#1a1929]">
        <span className="text-[10px] uppercase tracking-widest text-[#6b6b8a] shrink-0">
          Object Graph
        </span>
        <select
          value={selectedName ?? ''}
          onChange={(e) => { setSelectedName(e.target.value); setOverlay(null) }}
          className="ml-auto text-[11px] bg-[#252438] border border-[#3a3858] text-[#c8c5f0]
                     rounded px-2 py-0.5 focus:outline-none focus:border-[#534AB7]
                     cursor-pointer max-w-[160px] truncate"
        >
          {variables.map((v) => (
            <option key={v.name} value={v.name}>{v.name}  ({v.type || '?'})</option>
          ))}
        </select>
        <button onClick={handleFit} title="Fit to screen"
          className="text-[#6b6b8a] hover:text-[#a09fcc] transition-colors ml-1 shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        </button>
      </div>

      {/* Canvas + React overlay */}
      <div
        ref={wrapRef}
        className="relative flex-1 overflow-hidden"
        onClick={() => setOverlay(null)}
      >
        <div ref={containerRef} className="absolute inset-0" style={{ background: '#1a1a2e' }} />

        {overlay && overlayMeta && (
          <NodeTooltip
            meta={overlayMeta}
            x={overlay.domX} y={overlay.domY}
            cw={containerSz.w} ch={containerSz.h}
            expanding={expanding}
            onExpand={handleExpand}
            onClose={() => setOverlay(null)}
            onCopy={handleCopy}
            copied={copied}
          />
        )}

        {initialGraph?.nodes.length === 0 && selectedName && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[11px] font-mono text-[#3a3a5a] text-center px-4">
              <span className="text-[#534AB7]">{selectedName}</span> is a primitive —
              no edges to render.
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 px-3 py-1 border-t border-[#2a2a3e] shrink-0 bg-[#1a1929]">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {LEGEND.map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1 text-[10px] text-[#6b6b8a]">
              <span style={{ background: color }} className="inline-block w-2 h-2 rounded-sm shrink-0" />
              {label}
            </span>
          ))}
        </div>
        <span className="ml-auto text-[10px] font-mono text-[#3d3d5a] tabular-nums shrink-0">
          {(nodesDS.current?.length ?? initialGraph?.nodes.length ?? 0)} nodes
          {' · '}click to inspect
        </span>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState({ message }: {readonly message: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2.5
                    text-[#444462] text-xs px-6 text-center bg-[#13121f]">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <circle cx="12" cy="4" r="2"/><circle cx="4" cy="20" r="2"/>
        <circle cx="20" cy="20" r="2"/><circle cx="12" cy="14" r="2"/>
        <line x1="12" y1="6" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="5" y2="19"/>
        <line x1="12" y1="16" x2="19" y2="19"/>
        <line x1="12" y1="6" x2="5" y2="18"/>
        <line x1="12" y1="6" x2="19" y2="18"/>
      </svg>
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