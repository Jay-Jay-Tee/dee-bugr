import type { Node, Edge } from 'vis-network/standalone'

export interface ObjectGraph {
  nodes: Node[]
  edges: Edge[]
}

export interface DAPVariable {
  name: string
  value: string
  type: string
  variablesReference: number
  children?: DAPVariable[]
}

let nodeCounter = 0

export interface GraphNode extends Node {
  variablesReference: number;
  isExpanded: boolean;
  rawData: { name: string; value: string; type: string };
}

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
  const group = inferGroup(type)
  if (group === 'object' || group === 'array') return `${name}\n(${type})`
  const truncated = value.length > 24 ? value.slice(0, 22) + '…' : value
  return `${name}: ${truncated}`
}

function traverse(
  variable: DAPVariable,
  parentId: string | null,
  edgeLabel: string,
  nodes: any[], 
  edges: Edge[],
  visited: Set<number>
): void {
  const id = makeId(variable.name)
  
  // Check if children are already present in this data snapshot
  const hasLoadedChildren = !!(variable.children && variable.children.length > 0);

  nodes.push({
    id,
    label: buildLabel(variable.name, variable.value, variable.type),
    // Standard vis-network tooltip (browser native style)
    title: `Type: ${variable.type}\nValue: ${variable.value}`, 
    group: inferGroup(variable.type),
    // Custom metadata for our Inspect panel
    variablesReference: variable.variablesReference,
    isExpanded: hasLoadedChildren,
    rawData: { 
      name: variable.name, 
      value: variable.value, 
      type: variable.type 
    }
  })

  if (parentId !== null) {
    edges.push({ from: parentId, to: id, label: edgeLabel })
  }

  if (
    variable.variablesReference > 0 &&
    !visited.has(variable.variablesReference) &&
    hasLoadedChildren
  ) {
    visited.add(variable.variablesReference)
    variable.children!.forEach((child) => {
      traverse(child, id, child.name, nodes, edges, visited)
    })
  }
}

export function parseVariableToGraph(variable: DAPVariable): ObjectGraph {
  nodeCounter = 0
  const nodes: Node[] = []
  const edges: Edge[] = []
  traverse(variable, null, '', nodes, edges, new Set())
  return { nodes, edges }
}