// ── Output types for vis-network ─────────────────────────────────────────────

export interface GraphNode {
  id: string
  label: string        // shown inside the node
  title?: string       // tooltip on hover
  type: string         // "object" | "array" | "string" | "int" etc.
  value: string        // raw DAP value string
  isLeaf: boolean      // true = no children (primitive)
  group?: string       // used by vis-network for coloring by type
}

export interface GraphEdge {
  from: string
  to: string
  label: string        // the field name / array index
}

export interface ObjectGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ── Internal recursive helper ─────────────────────────────────────────────────

interface DAPVariable {
  name: string
  value: string
  type: string
  variablesReference: number   // > 0 means it has children
  children?: DAPVariable[]     // pre-fetched children (see note below)
}

let nodeCounter = 0

function makeId(name: string): string {
  return `${name}_${nodeCounter++}`
}

function inferGroup(type: string): string {
  const t = type.toLowerCase()
  if (t.includes('int') || t.includes('float') || t.includes('double') || t.includes('number')) return 'number'
  if (t.includes('str') || t.includes('char')) return 'string'
  if (t.includes('bool')) return 'boolean'
  if (t.includes('null') || t.includes('none') || t.includes('undefined')) return 'null'
  if (t.includes('list') || t.includes('array') || t.includes('[]')) return 'array'
  return 'object'
}

function buildLabel(name: string, value: string, type: string): string {
  // For primitives: show  name: value
  // For objects:    show  name (type)
  const group = inferGroup(type)
  if (group === 'object' || group === 'array') {
    return `${name}\n(${type})`
  }
  // Truncate long values so they don't blow up the node
  const truncated = value.length > 24 ? value.slice(0, 22) + '…' : value
  return `${name}: ${truncated}`
}

function traverse(
  variable: DAPVariable,
  parentId: string | null,
  edgeLabel: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  visited: Set<number>
): void {
  const id = makeId(variable.name)
  const isLeaf = !variable.children || variable.children.length === 0

  nodes.push({
    id,
    label: buildLabel(variable.name, variable.value, variable.type),
    title: `${variable.name}: ${variable.value} (${variable.type})`,
    type:  variable.type,
    value: variable.value,
    isLeaf,
    group: inferGroup(variable.type),
  })

  if (parentId !== null) {
    edges.push({ from: parentId, to: id, label: edgeLabel })
  }

  // Guard against circular references via variablesReference cycles
  if (
    variable.variablesReference > 0 &&
    !visited.has(variable.variablesReference) &&
    variable.children &&
    variable.children.length > 0
  ) {
    visited.add(variable.variablesReference)
    variable.children.forEach((child) => {
      traverse(child, id, child.name, nodes, edges, visited)
    })
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Converts a DAP variable (with pre-fetched nested children) into
 * a vis-network compatible { nodes, edges } graph.
 *
 * NOTE: DAP children must be pre-fetched before calling this function.
 * The DAP protocol requires a separate `variables` request for each
 * variablesReference > 0. Fetch children recursively first, attach them
 * as variable.children[], then call parseVariableToGraph().
 *
 * @example
 * const graph = parseVariableToGraph({
 *   name: "user",
 *   value: "User",
 *   type: "object",
 *   variablesReference: 1,
 *   children: [
 *     { name: "name", value: "Alice", type: "string", variablesReference: 0 },
 *     { name: "age",  value: "30",    type: "int",    variablesReference: 0 },
 *   ]
 * })
 * // → { nodes: [...], edges: [...] }
 */
export function parseVariableToGraph(variable: DAPVariable): ObjectGraph {
  nodeCounter = 0   // reset so IDs are stable per call
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const visited = new Set<number>()

  traverse(variable, null, '', nodes, edges, visited)

  return { nodes, edges }
}

// ── vis-network options to pair with this graph ───────────────────────────────
// Import and pass to new vis.Network(container, graph, VIS_OPTIONS)

export const VIS_OPTIONS = {
  nodes: {
    shape: 'box',
    borderWidth: 1.5,
    margin: 10,
    font: { face: 'JetBrains Mono, monospace', size: 12 },
  },
  edges: {
    arrows: 'to',
    smooth: { type: 'cubicBezier', roundness: 0.4 },
    font: { size: 10, align: 'middle' },
    color: { color: '#534AB7', highlight: '#7c6af7' },
  },
  groups: {
    object:  { color: { background: '#EEEDFE', border: '#534AB7' }, font: { color: '#3C3489' } },
    array:   { color: { background: '#E1F5EE', border: '#0F6E56' }, font: { color: '#085041' } },
    number:  { color: { background: '#FAEEDA', border: '#854F0B' }, font: { color: '#633806' } },
    string:  { color: { background: '#E6F1FB', border: '#185FA5' }, font: { color: '#0C447C' } },
    boolean: { color: { background: '#FBEAF0', border: '#993556' }, font: { color: '#72243E' } },
    null:    { color: { background: '#F1EFE8', border: '#5F5E5A' }, font: { color: '#444441' } },
  },
  layout: {
    hierarchical: {
      enabled: true,
      direction: 'UD',        // top-down tree
      sortMethod: 'directed',
      levelSeparation: 80,
      nodeSpacing: 120,
    },
  },
  physics: { enabled: false },  // hierarchical layout doesn't need physics
  interaction: { hover: true, tooltipDelay: 100 },
}