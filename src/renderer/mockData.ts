// src/renderer/mockData.ts
// ─────────────────────────────────────────────────────────────────────────────
// Realistic fake debug state for Day 1–2 UI development.
// Import from here in every panel. Remove imports on Day 3 when P1's
// live Zustand data replaces these.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Variable,
  StackFrame,
  Thread,
  Breakpoint,
  AsmLine,
  HistoryEntry,
} from '../shared/types'

// ── Variables ─────────────────────────────────────────────────────────────────

export const MOCK_VARIABLES: Variable[] = [
  {
    name: 'node',
    value: '0x0000000000000000',
    type: 'TreeNode *',
    variablesReference: 0,
    memoryReference: '0x0',
  },
  {
    name: 'depth',
    value: '3',
    type: 'int',
    variablesReference: 0,
  },
  {
    name: 'parent_id',
    value: '"root"',
    type: 'char *',
    variablesReference: 0,
    memoryReference: '0x7ffd1234ab00',
  },
  {
    name: 'result',
    value: '[]',
    type: 'std::vector<TreeNode *>',
    variablesReference: 1001,  // has children — expandable
  },
  {
    name: 'config',
    value: '{...}',
    type: 'AppConfig',
    variablesReference: 1002,  // has children — expandable
  },
]

// Children for result (variablesReference: 1001)
export const MOCK_RESULT_CHILDREN: Variable[] = [
  { name: '[0]', value: '0x7ffd1234cc10', type: 'TreeNode *', variablesReference: 1010 },
  { name: '[1]', value: '0x7ffd1234cc40', type: 'TreeNode *', variablesReference: 1011 },
  { name: 'size()', value: '2', type: 'size_t', variablesReference: 0 },
]

// Children for config (variablesReference: 1002)
export const MOCK_CONFIG_CHILDREN: Variable[] = [
  { name: 'maxDepth', value: '10', type: 'int', variablesReference: 0 },
  { name: 'timeout', value: '5000', type: 'unsigned long', variablesReference: 0 },
  { name: 'debug', value: 'true', type: 'bool', variablesReference: 0 },
  { name: 'label', value: '"production"', type: 'char *', variablesReference: 0 },
]

// Inline map so panels can do mockChildrenMap[variablesReference]
export const MOCK_CHILDREN_MAP: Record<number, Variable[]> = {
  1001: MOCK_RESULT_CHILDREN,
  1002: MOCK_CONFIG_CHILDREN,
}

// ── Call Stack ────────────────────────────────────────────────────────────────

export const MOCK_STACK_FRAMES: StackFrame[] = [
  {
    id: 0,
    name: 'getChildren',
    file: '/home/user/project/src/tree.cpp',
    line: 88,
    column: 18,
    variableCount: 5,
  },
  {
    id: 1,
    name: 'renderTree',
    file: '/home/user/project/src/render.cpp',
    line: 42,
    column: 4,
    variableCount: 3,
  },
  {
    id: 2,
    name: 'processNode',
    file: '/home/user/project/src/render.cpp',
    line: 21,
    column: 12,
    variableCount: 2,
  },
  {
    id: 3,
    name: 'main',
    file: '/home/user/project/src/main.cpp',
    line: 15,
    column: 2,
    variableCount: 1,
  },
]

// ── Threads ───────────────────────────────────────────────────────────────────

export const MOCK_THREADS: Thread[] = [
  { id: 1, name: 'Main Thread', status: 'stopped' },
  { id: 2, name: 'Worker Thread', status: 'running' },
]

// ── Breakpoints ───────────────────────────────────────────────────────────────

export const MOCK_BREAKPOINTS: Breakpoint[] = [
  {
    id: 'bp-1',
    dapId: 1,
    file: '/home/user/project/src/tree.cpp',
    line: 88,
    verified: true,
  },
  {
    id: 'bp-2',
    dapId: 2,
    file: '/home/user/project/src/main.cpp',
    line: 15,
    verified: true,
    condition: 'depth > 2',
  },
]

// ── Assembly lines ────────────────────────────────────────────────────────────

export const MOCK_ASM_LINES: AsmLine[] = [
  { address: '0x00007f8a1234a0', instruction: 'push   rbp',                  sourceLine: 82 },
  { address: '0x00007f8a1234a1', instruction: 'mov    rbp, rsp',              sourceLine: 82 },
  { address: '0x00007f8a1234a4', instruction: 'sub    rsp, 0x30',             sourceLine: 82 },
  { address: '0x00007f8a1234a8', instruction: 'mov    QWORD PTR [rbp-0x8], rdi', sourceLine: 83 },
  { address: '0x00007f8a1234ac', instruction: 'mov    eax, DWORD PTR [rbp-0x10]', sourceLine: 84 },
  { address: '0x00007f8a1234b0', instruction: 'test   eax, eax',             sourceLine: 84 },
  { address: '0x00007f8a1234b2', instruction: 'jne    0x7f8a1234c0',         sourceLine: 84 },
  { address: '0x00007f8a1234b4', instruction: 'mov    rax, QWORD PTR [rbp-0x8]', sourceLine: 85 },  // ← current
  { address: '0x00007f8a1234b8', instruction: 'mov    rax, QWORD PTR [rax]', sourceLine: 85 },
  { address: '0x00007f8a1234bc', instruction: 'call   0x7f8a1235f0',         sourceLine: 86 },
]

// ── Variable history ──────────────────────────────────────────────────────────

export const MOCK_HISTORY: HistoryEntry[] = Array.from({ length: 14 }, (_, i) => ({
  step: i,
  file: '/home/user/project/src/tree.cpp',
  line: 80 + i,
  timestamp: Date.now() - (14 - i) * 1000,
  variables: {
    depth: {
      value: String(3 - Math.floor(i / 4)),
      type: 'int',
      changed: i % 4 === 0,
    },
    node: {
      value: i < 12 ? `0x7ffd1234${(i * 16).toString(16).padStart(4, '0')}` : '0x0000000000000000',
      type: 'TreeNode *',
      changed: true,
    },
  },
}))

// ── Source code (used by Monaco until real file loading is wired) ─────────────

export const MOCK_SOURCE_LINES = `#include <iostream>
#include <vector>
#include <string>

struct TreeNode {
  int val;
  TreeNode* left;
  TreeNode* right;
  TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};

struct AppConfig {
  int maxDepth = 10;
  unsigned long timeout = 5000;
  bool debug = true;
  const char* label = "production";
};

std::vector<TreeNode*> getChildren(TreeNode* node, int depth, const char* parent_id) {
  std::vector<TreeNode*> result;

  if (depth == 0) return result;

  AppConfig config;

  for (auto child : node->children) {  // <-- execution stopped here (line 88)
    result.push_back(child);
  }

  return result;
}

int main() {
  AppConfig cfg;
  TreeNode* root = nullptr; // bug: never initialized
  auto children = getChildren(root, 3, "root");
  return 0;
}
`

// ── Convenience: a full mock DebugState snapshot ─────────────────────────────

export const MOCK_DEBUG_STATE = {
  status: 'paused' as const,
  language: 'cpp' as const,
  currentFile: '/home/user/project/src/tree.cpp',
  currentLine: 88,
  sourceLines: MOCK_SOURCE_LINES.split('\n'),
  stackFrames: MOCK_STACK_FRAMES,
  scopes: [
    { name: 'Locals', variablesReference: 100, expensive: false },
    { name: 'Globals', variablesReference: 101, expensive: true },
  ],
  variables: MOCK_VARIABLES,
  watchValues: {},
  assemblyLines: MOCK_ASM_LINES,
  threads: MOCK_THREADS,
  breakpoints: MOCK_BREAKPOINTS,
  executionHistory: MOCK_HISTORY,
  anomalies: [
    {
      variable: 'node',
      value: '0x0',
      type: 'null_pointer' as const,
      severity: 'error' as const,
      message: 'node is null — dereferencing on line 88 will crash',
      line: 88,
    },
  ],
  stepCount: 13,
  errorMessage: "AttributeError: 'NoneType' object has no attribute 'children'",
}
