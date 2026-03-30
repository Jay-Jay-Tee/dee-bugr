// src/main/ipc/handlers.ts
// All IPC channels — v1 + v2 combined, all bugs fixed.
//
// FIXES vs original:
//   1. Replaced all require('../ai/groq') with static ES imports (ESM-safe)
//   2. Fixed hardcoded 'dap:switchThread' → IPC.SWITCH_THREAD
//   3. Fixed hardcoded 'dap:runToCursor' → IPC.RUN_TO_CURSOR

import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc'
import { session } from '../session/sessionManager'
import type { Language } from '../../shared/types'

// ── Static AI imports (ESM-safe — no require()) ───────────────────────────────
import {
  explainBug,
  suggestFix,
  explainVariable,
  generateWatch,
  suggestBreakpoints,
  sessionNarrative,
} from '../ai/groq'

export function registerAllHandlers() {

  // ── LIFECYCLE ──────────────────────────────────────────────────────────────

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
    const args = session.getLastLaunchArgs()
    await session.terminate()
    if (args) {
      try {
        await session.launch(args.language, args.target, args.breakpoints)
        return { success: true }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[IPC] RESTART re-launch failed:', msg)
        return { success: false, error: msg }
      }
    }
    return { success: true }
  })

  // ── STEPPING ───────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.NEXT,     async () => { await session.stepOver();          return { success: true } })
  ipcMain.handle(IPC.STEP_IN,  async () => { await session.stepIn();            return { success: true } })
  ipcMain.handle(IPC.STEP_OUT, async () => { await session.stepOut();           return { success: true } })
  ipcMain.handle(IPC.CONTINUE, async () => { await session.continueExecution(); return { success: true } })
  ipcMain.handle(IPC.PAUSE,    async () => { await session.pause();             return { success: true } })

  // ── ADVANCED FLOW ──────────────────────────────────────────────────────────

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

  // FIX: use IPC.RUN_TO_CURSOR instead of hardcoded string
  ipcMain.handle(IPC.RUN_TO_CURSOR, async (_, args: { file: string; line: number }) => {
    try {
      await session.runToCursor(args.file, args.line)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── BREAKPOINTS ────────────────────────────────────────────────────────────

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

  ipcMain.handle(IPC.SET_METHOD_BP, async (_, args: { name: string }) => {
    try {
      await session.setMethodBreakpoint(args.name)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

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

  ipcMain.handle(IPC.TOGGLE_GROUP, async (_, args: { groupId: string; enabled: boolean }) => {
    try {
      await session.toggleBreakpointGroup(args.groupId, args.enabled)
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ── INSPECTION ─────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.GET_VARIABLES, async (_, args: { variablesReference: number }) =>
    session.fetchVariables(args.variablesReference))

  // Missing handlers for GET_STACK and GET_SCOPES — renderer can call these directly
  ipcMain.handle(IPC.GET_STACK, async () => session.getState().stackFrames)
  ipcMain.handle(IPC.GET_SCOPES, async () => session.getState().scopes)

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

  // FIX: was hardcoded 'dap:switchThread' — now uses IPC.SWITCH_THREAD
  ipcMain.handle(IPC.SWITCH_THREAD, async (_, args: { threadId: number }) => {
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

  // ── HISTORY ────────────────────────────────────────────────────────────────

  ipcMain.handle(IPC.JUMP_TO_STEP, async (_, args: { step: number }) => {
    const state = session.getState()
    const entry = state.executionHistory.find(h => h.step === args.step)
    if (!entry) return { success: false, error: 'Step not found in history' }
    return { success: true, entry }
  })

  // ── AI HANDLERS (static imports — no require()) ────────────────────────────

  ipcMain.handle(IPC.AI_EXPLAIN, async () => {
    try {
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
      const fix = await suggestFix()
      return { success: true, fix }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[IPC] AI_FIX failed:', msg)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.AI_EXPLAIN_VAR, async (_, args: { varName: string }) => {
    try {
      const explanation = await explainVariable(args.varName)
      return { success: true, explanation }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.AI_WATCHPOINT, async () => {
    try {
      const suggestions = await generateWatch()
      return { success: true, suggestions }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.AI_SUGGEST_BPS, async (_, args: { sourceCode: string; language: Language }) => {
    try {
      const suggestions = await suggestBreakpoints(args.sourceCode, args.language)
      return { success: true, suggestions }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.AI_NARRATIVE, async () => {
    try {
      const narrative = await sessionNarrative()
      return { success: true, narrative }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  console.log('[IPC] All handlers registered')
}
ipcMain.handle(IPC.READ_FILE, async (_, path: string) => {
  const fs = await import('node:fs/promises')
  return fs.readFile(path, 'utf-8')
})