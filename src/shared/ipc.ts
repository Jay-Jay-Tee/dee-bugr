// src/shared/ipc.ts
// Everyone imports from here. Never hardcode channel strings.

export const IPC = {
  // ── LIFECYCLE ─────────────────────────────────────────────
  LAUNCH:           'dap:launch',        // { language, target, cwd, args? }
  TERMINATE:        'dap:terminate',
  RESTART:          'dap:restart',

  // ── STEPPING ──────────────────────────────────────────────
  CONTINUE:         'dap:continue',
  NEXT:             'dap:next',          // step over
  STEP_IN:          'dap:stepIn',
  STEP_OUT:         'dap:stepOut',
  PAUSE:            'dap:pause',

  // ── ADVANCED FLOW ─────────────────────────────────────────
  GOTO_LINE:        'dap:gotoLine',      // { source, line }
  RETURN_NOW:       'dap:returnNow',     // { frameId, value? }
  DROP_FRAME:       'dap:dropFrame',     // { frameId }

  // ── BREAKPOINTS ───────────────────────────────────────────
  SET_BREAKPOINT:   'dap:setBreakpoint', // { file, line, condition?, hitCount?, label?, groupId?, dependsOn? }
  REMOVE_BREAKPOINT:'dap:removeBreakpoint', // { id }
  SET_METHOD_BP:    'dap:setMethodBP',   // { name }
  SET_FIELD_WATCH:  'dap:setFieldWatch', // { variablesReference, name }
  SET_EXCEPTION_BP: 'dap:setExceptionBP',// { filters, classFilter? }
  TOGGLE_GROUP:     'dap:toggleGroup',   // { groupId, enabled }

  // ── INSPECTION ────────────────────────────────────────────
  GET_STACK:        'dap:stackTrace',
  GET_SCOPES:       'dap:scopes',        // { frameId }
  GET_VARIABLES:    'dap:variables',     // { variablesReference }
  EVALUATE:         'dap:evaluate',      // { expr, frameId, context }
  SET_VARIABLE:     'dap:setVariable',   // { variablesReference, name, value }
  DISASSEMBLE:      'dap:disassemble',   // { memoryRef, offset, count }
  READ_MEMORY:      'dap:readMemory',    // { memoryRef, count }

  // ── HISTORY ───────────────────────────────────────────────
  JUMP_TO_STEP:     'dap:jumpToHistoryStep', // { step }

  // ── AI (P4 registers these) ───────────────────────────────
  AI_EXPLAIN:       'ai:explainBug',
  AI_FIX:          'ai:suggestFix',
  AI_EXPLAIN_VAR:   'ai:explainVariable',
  AI_WATCHPOINT:    'ai:generateWatch',
  AI_SUGGEST_BPS:   'ai:suggestBreakpoints',
  AI_NARRATIVE:     'ai:sessionNarrative',

  // ── EVENTS PUSHED FROM MAIN TO RENDERER ───────────────────
  // These are NOT invoke/handle — they are send/on
  EVENT_STOPPED:    'debug:stopped',     // DebugState — full snapshot
  EVENT_CONTINUED:  'debug:continued',
  EVENT_TERMINATED: 'debug:terminated',
  EVENT_OUTPUT:     'debug:output',      // { text, category }
  EVENT_ANOMALY:    'debug:anomaly',     // Anomaly
  EVENT_RETURN_VAL: 'debug:returnValue', // ReturnValue
  EVENT_BP_HIT:     'debug:breakpointHit', // { breakpointId }
} as const;

export type IPCChannel = typeof IPC[keyof typeof IPC];