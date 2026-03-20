// src/shared/ipc.ts
// Everyone imports from here. Never hardcode channel strings.

export const IPC = {
  // ── LIFECYCLE ─────────────────────────────────────────────
  LAUNCH:             'dap:launch',
  TERMINATE:          'dap:terminate',
  RESTART:            'dap:restart',

  // ── STEPPING ──────────────────────────────────────────────
  CONTINUE:           'dap:continue',
  NEXT:               'dap:next',
  STEP_IN:            'dap:stepIn',
  STEP_OUT:           'dap:stepOut',
  PAUSE:              'dap:pause',

  // ── ADVANCED FLOW ─────────────────────────────────────────
  GOTO_LINE:          'dap:gotoLine',
  RETURN_NOW:         'dap:returnNow',
  DROP_FRAME:         'dap:dropFrame',

  // ── BREAKPOINTS ───────────────────────────────────────────
  SET_BREAKPOINT:     'dap:setBreakpoint',
  REMOVE_BREAKPOINT:  'dap:removeBreakpoint',
  SET_METHOD_BP:      'dap:setMethodBP',
  SET_FIELD_WATCH:    'dap:setFieldWatch',
  SET_EXCEPTION_BP:   'dap:setExceptionBP',
  TOGGLE_GROUP:       'dap:toggleGroup',
  SWITCH_FRAME:       'dap:switchFrame',

  // ── INSPECTION ────────────────────────────────────────────
  GET_STACK:          'dap:stackTrace',
  GET_SCOPES:         'dap:scopes',
  GET_VARIABLES:      'dap:variables',
  EVALUATE:           'dap:evaluate',
  SET_VARIABLE:       'dap:setVariable',
  DISASSEMBLE:        'dap:disassemble',
  READ_MEMORY:        'dap:readMemory',
  GET_DEBUG_CONTEXT:  'dap:getDebugContext',

  // ── HISTORY ───────────────────────────────────────────────
  JUMP_TO_STEP:       'dap:jumpToHistoryStep',

  // ── AI (P4 registers these) ───────────────────────────────
  AI_EXPLAIN:         'ai:explainBug',
  AI_FIX:             'ai:suggestFix',
  AI_EXPLAIN_VAR:     'ai:explainVariable',
  AI_WATCHPOINT:      'ai:generateWatch',
  AI_SUGGEST_BPS:     'ai:suggestBreakpoints',
  AI_NARRATIVE:       'ai:sessionNarrative',

  // ── EVENTS PUSHED FROM MAIN TO RENDERER ───────────────────
  EVENT_STOPPED:      'debug:stopped',
  EVENT_CONTINUED:    'debug:continued',
  EVENT_TERMINATED:   'debug:terminated',
  EVENT_OUTPUT:       'debug:output',
  EVENT_ANOMALY:      'debug:anomaly',
  EVENT_RETURN_VAL:   'debug:returnValue',
  EVENT_BP_HIT:       'debug:breakpointHit',
} as const

export type IPCChannel = typeof IPC[keyof typeof IPC]