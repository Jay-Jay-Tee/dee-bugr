import { parseVariableToGraph } from './parseVariableToGraph'

// ── Test 1: flat primitive ────────────────────────────────────────────────────
const primitive = {
  name: 'count',
  value: '42',
  type: 'int',
  variablesReference: 0,
}
const r1 = parseVariableToGraph(primitive)
console.assert(r1.nodes.length === 1,  'primitive: 1 node')
console.assert(r1.edges.length === 0,  'primitive: 0 edges')
console.assert(r1.nodes[0].group === 'number', 'primitive: group number')

// ── Test 2: shallow object ────────────────────────────────────────────────────
const shallowObj = {
  name: 'point',
  value: 'Point',
  type: 'object',
  variablesReference: 1,
  children: [
    { name: 'x', value: '10', type: 'int',   variablesReference: 0 },
    { name: 'y', value: '20', type: 'float', variablesReference: 0 },
  ],
}
const r2 = parseVariableToGraph(shallowObj)
console.assert(r2.nodes.length === 3, 'shallow: 3 nodes (root + 2 children)')
console.assert(r2.edges.length === 2, 'shallow: 2 edges')
console.assert(r2.edges[0].label === 'x', 'shallow: first edge label is x')
console.assert(r2.edges[1].label === 'y', 'shallow: second edge label is y')

// ── Test 3: nested object ─────────────────────────────────────────────────────
const nested = {
  name: 'user',
  value: 'User',
  type: 'object',
  variablesReference: 1,
  children: [
    { name: 'name', value: 'Alice', type: 'string', variablesReference: 0 },
    {
      name: 'address',
      value: 'Address',
      type: 'object',
      variablesReference: 2,
      children: [
        { name: 'city',    value: 'Berlin', type: 'string', variablesReference: 0 },
        { name: 'country', value: 'DE',     type: 'string', variablesReference: 0 },
      ],
    },
  ],
}
const r3 = parseVariableToGraph(nested)
console.assert(r3.nodes.length === 5, 'nested: 5 nodes')
console.assert(r3.edges.length === 4, 'nested: 4 edges')

// ── Test 4: array ─────────────────────────────────────────────────────────────
const arr = {
  name: 'items',
  value: '[1, 2, 3]',
  type: 'list',
  variablesReference: 3,
  children: [
    { name: '[0]', value: '1', type: 'int', variablesReference: 0 },
    { name: '[1]', value: '2', type: 'int', variablesReference: 0 },
    { name: '[2]', value: '3', type: 'int', variablesReference: 0 },
  ],
}
const r4 = parseVariableToGraph(arr)
console.assert(r4.nodes.length === 4, 'array: 4 nodes')
console.assert(r4.nodes[0].group === 'array', 'array: root group is array')

// ── Test 5: circular reference guard ─────────────────────────────────────────
const circular = {
  name: 'node',
  value: 'Node',
  type: 'object',
  variablesReference: 99,
  children: [
    {
      name: 'self',
      value: 'Node',
      type: 'object',
      variablesReference: 99,  // same ref — would loop forever without guard
      children: [],
    },
  ],
}
const r5 = parseVariableToGraph(circular)
console.assert(r5.nodes.length === 2, 'circular: guard stops infinite loop')

console.log('All tests passed ✓')