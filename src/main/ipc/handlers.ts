// src/main/ipc/handlers.ts
// All IPC channels registered here â€” v1 + v2 combined through Day 4.
// Day 5-6 features that need UI from P2 are registered but delegate to
// fully-implemented session methods.

import { ipcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { IPC } from '../../shared/ipc'
import { session } from '../session/sessionManager'
import type { Language } from '../../shared/types'

export function registerAllHandlers() {

  // â”€â”€ LIFECYCLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  ipcMain.handle(IPC.LAUNCH, async (_, args: {
    language: Language
    target:   string
    cwd?:     string
    breakpoints?: number[]
  }) => {
    try {
      await session.launch(args.language, args.target, args.breakpoints ?? [])
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[IPC] Launch failed:', msg)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.TERMINATE, async () => {
    await session.terminate()
    return { success: true }
  })

  ipcMain.handle(IPC.RESTART, async () => {
    await session.terminate()
    return { success: true }
  })

  // â”€â”€ STEPPING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  ipcMain.handle(IPC.NEXT,     async () => { await session.stepOver();          return { success: true } })
  ipcMain.handle(IPC.STEP_IN,  async () => { await session.stepIn();            return { success: true } })
  ipcMain.handle(IPC.STEP_OUT, async () => { await session.stepOut();           return { success: true } })
  ipcMain.handle(IPC.CONTINUE, async () => { await session.continueExecution(); return { success: true } })
  ipcMain.handle(IPC.PAUSE,    async () => { await session.pause();             return { success: true } })

  // â”€â”€ ADVANCED FLOW (v1 Day 8 / v2 Day 5) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  ipcMain.handle(IPC.GOTO_LINE, async (_, args: { file: string; line: number }) => {
    try {
      await session.gotoLine(args.file, args.line)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.RETURN_NOW, async (_, args: { frameId?: number }) => {
    try {
      await session.returnNow(args?.frameId)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.DROP_FRAME, async (_, args: { frameId?: number }) => {
    try {
      await session.dropFrame(args?.frameId)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // v1 Day 4: run-to-cursor
  ipcMain.handle('dap:runToCursor', async (_, args: { file: string; line: number }) => {
    try {
      await session.runToCursor(args.file, args.line)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // â”€â”€ BREAKPOINTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  ipcMain.handle(IPC.SET_BREAKPOINT, async (_, args: {
    file:       string
    line:       number
    condition?: string
    hitCount?:  number
    logMessage?: string
    label?:     string
    groupId?:   string
    dependsOn?: string
  }) => {
    try {
      await session.setBreakpoint(args.file, args.line, {
        condition:  args.condition,
        hitCount:   args.hitCount,
        logMessage: args.logMessage,
        label:      args.label,
        groupId:    args.groupId,
        dependsOn:  args.dependsOn,
      })
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.REMOVE_BREAKPOINT, async (_, args: { file: string; line: number }) => {
    try {
      await session.removeBreakpoint(args.file, args.line)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // v2: Method / function breakpoints
  ipcMain.handle(IPC.SET_METHOD_BP, async (_, args: { name: string }) => {
    try {
      await session.setMethodBreakpoint(args.name)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // v2: Data / field watchpoints
  ipcMain.handle(IPC.SET_FIELD_WATCH, async (_, args: {
    variablesReference: number
    name: string
  }) => {
    try {
      await session.setFieldWatch(args.variablesReference, args.name)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // v2: Exception breakpoints with filters
  ipcMain.handle(IPC.SET_EXCEPTION_BP, async (_, args: {
    filters:      string[]
    classFilter?: string
  }) => {
    try {
      await session.setExceptionBreakpoints(args.filters, args.classFilter)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // v2: Group toggle
  ipcMain.handle(IPC.TOGGLE_GROUP, async (_, args: { groupId: string; enabled: boolean }) => {
    try {
      await session.toggleBreakpointGroup(args.groupId, args.enabled)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // â”€â”€ INSPECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  ipcMain.handle(IPC.GET_VARIABLES, async (_, args: { variablesReference: number }) =>
    session.fetchVariables(args.variablesReference))

  ipcMain.handle(IPC.EVALUATE, async (_, args: { expr: string }) =>
    session.evaluate(args.expr))

  ipcMain.handle(IPC.SET_VARIABLE, async (_, args: {
    variablesReference: number
    name:  string
    value: string
  }) => {
    await session.setVariable(args.variablesReference, args.name, args.value)
    return { success: true }
  })

  ipcMain.handle(IPC.SWITCH_FRAME, async (_, args: { frameId: number }) => {
    try {
      return await session.switchFrame(args.frameId)
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('dap:switchThread', async (_, args: { threadId: number }) => {
    try {
      await session.switchThread(args.threadId)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.READ_MEMORY, async (_, args: { memoryReference: string; count?: number }) =>
    session.readMemory(args.memoryReference, args.count))

  ipcMain.handle(IPC.DISASSEMBLE, async (_, args: { memoryReference: string; count?: number }) =>
    session.disassemble(args.memoryReference, args.count))

  ipcMain.handle(IPC.GET_DEBUG_CONTEXT, () => session.getDebugContext())

  // â”€â”€ HISTORY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // JUMP_TO_STEP: renderer asks to restore state at a given step index
  // This is used by P3's click-to-step on the history chart
  // For now: returns the history entry â€” P2/P3 restore the Monaco cursor
  ipcMain.handle(IPC.JUMP_TO_STEP, async (_, args: { step: number }) => {
    const state = session.getState()
    const entry = state.executionHistory.find(h => h.step === args.step)
    if (!entry) return { success: false, error: 'Step not found in history' }
    return { success: true, entry }
  })

  // â”€â”€ AI HANDLERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  ipcMain.handle(IPC.AI_EXPLAIN, async () => {
    try {
      const { explainBug } = require('../ai/groq')
      const explanation = await explainBug()
      return { success: true, explanation }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[IPC] AI_EXPLAIN failed:', msg)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.AI_FIX, async () => {
    try {
      const { suggestFix } = require('../ai/groq')
      const fix = await suggestFix() // now returns { originalCode, fixedCode, explanation }
      return { success: true, fix }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[IPC] AI_FIX failed:', msg)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.AI_EXPLAIN_VAR, async (_, args: { varName: string }) => {
    try {
      const { explainVariable } = require('../ai/groq')
      const explanation = await explainVariable(args.varName)
      return { success: true, explanation }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.AI_VAR_TOOLTIP, async (_, args: { varName: string; varValue: string; varType?: string }) => {
    try {
      const { explainVariableTooltip } = require('../ai/groq')
      const tooltip = await explainVariableTooltip(args.varName, args.varValue, args.varType)
      return { success: true, tooltip }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.AI_GENERATE_WATCHPOINT, async (_, args: { description: string; language: Language; availableVariables: string[] }) => {
    try {
      const { generateWatchpointExpression } = require('../ai/groq')
      const expression = await generateWatchpointExpression(args.description, args.language, args.availableVariables)
      return { success: true, expression }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.AI_WATCHPOINT, async () => {
    try {
      const { generateWatch } = require('../ai/groq')
      const suggestions = await generateWatch()
      return { success: true, suggestions }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.AI_LOG_BREAKPOINTS, async (_, args: { logFilePath: string }) => {
    try {
      const logText = await readFile(args.logFilePath, 'utf-8')
      const lines = logText.split(/\r?\n/)
      const tail = lines.slice(-100).join('\n')

      const state = session.getState()
      const language = state.language
      const sourceLines = state.sourceLines ?? []
      const sourceCodeWithLines = sourceLines
        .map((line, idx) => `${idx + 1}: ${line}`)
        .join('\n')

      const { suggestBreakpointsFromLogs } = require('../ai/groq')
      const suggestions = await suggestBreakpointsFromLogs(tail, language, sourceCodeWithLines)
      return { success: true, suggestions }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.AI_SUGGEST_BPS, async (_, args: { sourceCode: string; language: Language }) => {
    try {
      const { suggestBreakpoints } = require('../ai/groq')
      const suggestions = await suggestBreakpoints(args.sourceCode, args.language)
      return { success: true, suggestions }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.AI_NARRATIVE, async () => {
    try {
      const { sessionNarrative } = require('../ai/groq')
      const narrative = await sessionNarrative()
      return { success: true, narrative }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  console.log('[IPC] All handlers registered')
}

