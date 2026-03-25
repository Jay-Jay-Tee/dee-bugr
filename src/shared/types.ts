// src/shared/types.ts
// ─────────────────────────────────────────────────────────────
// SHARED BETWEEN MAIN AND RENDERER — DO NOT IMPORT ELECTRON HERE
// ─────────────────────────────────────────────────────────────

export type Language = 'python' | 'javascript' | 'java' | 'c' | 'cpp';
export type DebugStatus = 'idle' | 'launching' | 'running' | 'paused' | 'terminated';

export interface StackFrame {
  id: number;
  name: string;
  file: string;
  line: number;
  column: number;
  variableCount?: number;
}

export interface Variable {
  name: string;
  value: string;
  type: string;
  variablesReference: number;  // > 0 means it has children (objects/arrays)
  memoryReference?: string;    // hex address if available
  expensive?: boolean;         // true = only fetch on demand
}

export interface Scope {
  name: string;                // "Locals", "Globals", "Closure"
  variablesReference: number;
  expensive: boolean;
}

export interface AsmLine {
  address: string;             // "0x00007f8a1234"
  instruction: string;         // "mov rax, [rbp-0x8]"
  sourceLine?: number;         // maps back to source file line
  bytes?: string;              // "48 8b 45 f8"
}

export interface Breakpoint {
  id: string;                  // our internal ID
  dapId?: number;              // ID assigned by DAP adapter
  file: string;
  line: number;
  verified: boolean;
  enabled?: boolean;                // explicit toggle; undefined = true
  condition?: string;
  hitCount?: number;
  hitCountRemaining?: number;  // auto-disable after N hits
  logMessage?: string;         // logpoint message
  label?: string;              // user-assigned name
  groupId?: string;            // for group toggle
  dependsOn?: string;          // dependent breakpoint ID
  dependencyMet?: boolean;
}

export interface Thread {
  id: number;
  name: string;
  status: 'running' | 'stopped';
}

export interface HistoryEntry {
  step: number;
  file: string;
  line: number;
  variables: Record<string, {
    value: string;
    type: string;
    changed: boolean;          // true if different from previous step
  }>;
  timestamp: number;
  heapBytes?: number;          // for P3's heap tracker
}

export interface Anomaly {
  variable: string;
  value: string;
  type: 'null_pointer' | 'integer_overflow' | 'bounds_exceeded' | 'suspicious_jump' | 'ai_flagged';
  severity: 'warning' | 'error';
  message: string;
  line?: number;
}

export interface ReturnValue {
  fnName: string;
  value: string;
  type: string;
}

// The main state object — P1 populates, everyone else reads
export interface DebugState {
  status: DebugStatus;
  language: Language;
  currentFile: string;
  currentLine: number;
  sourceLines?: string[];      // full source file lines
  stackFrames: StackFrame[];
  scopes: Scope[];
  variables: Variable[];       // locals of current frame
  watchValues: Record<string, string>;
  assemblyLines: AsmLine[];
  memoryBytes?: string;        // base64 encoded
  threads: Thread[];
  breakpoints: Breakpoint[];
  executionHistory: HistoryEntry[];
  anomalies: Anomaly[];
  lastReturnValue?: ReturnValue;
  errorMessage?: string;
  stepCount: number;
}

export const INITIAL_DEBUG_STATE: DebugState = {
  status: 'idle',
  language: 'python',
  currentFile: '',
  currentLine: 0,
  stackFrames: [],
  scopes: [],
  variables: [],
  watchValues: {},
  assemblyLines: [],
  threads: [],
  breakpoints: [],
  executionHistory: [],
  anomalies: [],
  stepCount: 0,
};