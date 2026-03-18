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
  GOTO_LINE:        'dap:gotoLine',
  RETURN_NOW:       'dap:returnNow',     // { frameId, value? }
  DROP_FRAME:       'dap:dropFrame',

  // ── BREAKPOINTS ───────────────────────────────────────────
  SET_BREAKPOINT:   'dap:setBreakpoint', // { file, line, condition?, hitCount?, label?, groupId?, dependsOn? }
  REMOVE_BREAKPOINT:'dap:removeBreakpoint',
  SET_METHOD_BP:    'dap:setMethodBP',
  SET_FIELD_WATCH:  'dap:setFieldWatch',
  SET_EXCEPTION_BP: 'dap:setExceptionBP',// { filters, classFilter? }
  TOGGLE_GROUP:     'dap:toggleGroup',
  SWITCH_FRAME: 'dap:switchFrame',   // { frameId }
  // ── INSPECTION ────────────────────────────────────────────
  GET_STACK:        'dap:stackTrace',
  GET_SCOPES:       'dap:scopes',
  GET_VARIABLES:    'dap:variables',
  EVALUATE:         'dap:evaluate',
  SET_VARIABLE:     'dap:setVariable',
  DISASSEMBLE:      'dap:disassemble',
  READ_MEMORY:      'dap:readMemory',


  // ── HISTORY ───────────────────────────────────────────────
  JUMP_TO_STEP:     'dap:jumpToHistoryStep',

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
  EVENT_OUTPUT:     'debug:output',
  EVENT_ANOMALY:    'debug:anomaly',     // Anomaly
  EVENT_RETURN_VAL: 'debug:returnValue', // ReturnValue
  EVENT_BP_HIT:     'debug:breakpointHit',
} as const;

export type IPCChannel = typeof IPC[keyof typeof IPC];