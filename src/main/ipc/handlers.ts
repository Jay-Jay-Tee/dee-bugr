// src/main/ipc/handlers.ts

import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc'
import { session } from '../session/sessionManager'
import type { Language } from '../../shared/types'

export function registerAllHandlers() {

  // ── LIFECYCLE ─────────────────────────────────────────────

  ipcMain.handle(IPC.LAUNCH, async (_, args: {
    language: Language
    target: string
    cwd?: string
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

  // ── STEPPING ──────────────────────────────────────────────

  ipcMain.handle(IPC.NEXT,     async () => { await session.stepOver();          return { success: true } })
  ipcMain.handle(IPC.STEP_IN,  async () => { await session.stepIn();            return { success: true } })
  ipcMain.handle(IPC.STEP_OUT, async () => { await session.stepOut();           return { success: true } })
  ipcMain.handle(IPC.CONTINUE, async () => { await session.continueExecution(); return { success: true } })
  ipcMain.handle(IPC.PAUSE,    async () => { await session.pause();             return { success: true } })

  // ── BREAKPOINTS ───────────────────────────────────────────

  ipcMain.handle(IPC.SET_BREAKPOINT, async (_, args: {
    file: string
    line: number
    condition?: string
  }) => {
    try {
      await session.setBreakpoint(args.file, args.line, args.condition)
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.REMOVE_BREAKPOINT, async (_, args: {
    file: string
    line: number
  }) => {
    try {
      await session.removeBreakpoint(args.file, args.line)
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  // ── INSPECTION ────────────────────────────────────────────

  ipcMain.handle(IPC.GET_VARIABLES, async (_, args: { variablesReference: number }) =>
    session.fetchVariables(args.variablesReference))

  ipcMain.handle(IPC.EVALUATE, async (_, args: { expr: string }) =>
    session.evaluate(args.expr))

  ipcMain.handle(IPC.SET_VARIABLE, async (_, args: {
    variablesReference: number
    name: string
    value: string
  }) => {
    await session.setVariable(args.variablesReference, args.name, args.value)
    return { success: true }
  })

  ipcMain.handle(IPC.SWITCH_FRAME, async (_, args: { frameId: number }) => {
    try {
      return await session.switchFrame(args.frameId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  // Bug 10 fix: SWITCH_THREAD was never registered
  ipcMain.handle(IPC.SWITCH_THREAD, async (_, args: { threadId: number }) => {
    try {
      return await session.switchThread(args.threadId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.READ_MEMORY, async (_, args: { memoryReference: string; count?: number }) =>
    session.readMemory(args.memoryReference, args.count))

  ipcMain.handle(IPC.DISASSEMBLE, async (_, args: { memoryReference: string; count?: number }) =>
    session.disassemble(args.memoryReference, args.count))

  ipcMain.handle(IPC.GET_DEBUG_CONTEXT, () => session.getDebugContext())

  // ── ADVANCED FLOW — Day 5 ─────────────────────────────────

  ipcMain.handle(IPC.GOTO_LINE, async (_, args: { file: string; line: number }) => {
    try {
      await session.gotoLine(args.file, args.line)
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.RUN_TO_CURSOR, async (_, args: { file: string; line: number }) => {
    try {
      await session.runToCursor(args.file, args.line)
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.RETURN_NOW, async (_, args?: { value?: string }) => {
    try {
      await session.returnNow(args?.value)
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.DROP_FRAME, async () => {
    try {
      await session.dropFrame()
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle(IPC.JUMP_TO_STEP, async (_, args: { step: number }) => {
    try {
      await session.jumpToHistoryStep(args.step)
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  })

  // ── BREAKPOINT VARIANTS (stubs — Day 6+) ─────────────────

  const notYet = (day: number) => async () =>
    ({ success: false, error: `Not implemented until Day ${day}` })

  ipcMain.handle(IPC.SET_METHOD_BP,    notYet(6))
  ipcMain.handle(IPC.SET_FIELD_WATCH,  notYet(6))
  ipcMain.handle(IPC.SET_EXCEPTION_BP, notYet(6))
  ipcMain.handle(IPC.TOGGLE_GROUP,     notYet(6))

  console.log('[IPC] All handlers registered')
}
