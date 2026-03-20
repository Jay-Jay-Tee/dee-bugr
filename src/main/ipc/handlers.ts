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

  ipcMain.handle(IPC.READ_MEMORY,  async (_, args: { memoryReference: string; count?: number }) =>
    session.readMemory(args.memoryReference, args.count))

  ipcMain.handle(IPC.DISASSEMBLE, async (_, args: { memoryReference: string; count?: number }) =>
    session.disassemble(args.memoryReference, args.count))

  ipcMain.handle(IPC.GET_DEBUG_CONTEXT, () => session.getDebugContext())

  // ── ADVANCED FLOW (stubs — Day 5+) ────────────────────────

  const notYet = (day: number) => async () => ({ success: false, error: `Not implemented until Day ${day}` })

  ipcMain.handle(IPC.SET_FIELD_WATCH, async (_, _args: {
    variablesReference: number
    name: string
  }) => {
    return { success: false, error: 'Not implemented until Day 6' }
  })

  ipcMain.handle(IPC.SET_EXCEPTION_BP, async (_, _args: {
    filters: string[]
    classFilter?: string
  }) => {
    return { success: false, error: 'Not implemented until Day 6' }
  })

  ipcMain.handle(IPC.TOGGLE_GROUP, async (_, _args: {
    groupId: string
    enabled: boolean
  }) => {
    return { success: false, error: 'Not implemented until Day 6' }
  })

  ipcMain.handle(IPC.READ_MEMORY, async (_, args: {
    memoryReference: string
    count?: number
    }) => {
    return session.readMemory(args.memoryReference, args.count)
    })

  ipcMain.handle(IPC.DISASSEMBLE, async (_, args: {
    memoryReference: string
    count?: number
    }) => {
    return session.disassemble(args.memoryReference, args.count)
    })

  ipcMain.handle(IPC.SET_BREAKPOINT, async (_, args: {
    file: string
    line: number
    condition?: string
    hitCount?: number
    label?: string
    groupId?: string
    dependsOn?: string
  }) => {
    try {
      const result = await session.setBreakpoint(args.file, args.line, args.condition)
      return { success: true, ...result }
    } catch (err: any) {
      console.error('[IPC] SET_BREAKPOINT failed:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.REMOVE_BREAKPOINT, async (_, args: { id: string }) => {
    try {
      await session.removeBreakpoint(args.id)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── AI CONTEXT (P4 uses this) ─────────────────────────────

  ipcMain.handle('dap:getDebugContext', () => {
    return session.getDebugContext()
  })

  // ── AI EXPLANATION HANDLERS (P4) ──────────────────────────

  ipcMain.handle(IPC.AI_EXPLAIN, async () => {
    try {
      const { explainBug } = require('../ai/groq')
      const explanation = await explainBug()
      return { success: true, explanation }
    } catch (err: any) {
      console.error('[IPC] AI_EXPLAIN failed:', err.message)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.AI_FIX, async () => {
    try {
      const { suggestFix } = require('../ai/groq')
      const fix = await suggestFix()
      return { success: true, fix }
    } catch (err: any) {
      console.error('[IPC] AI_FIX failed:', err.message)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.AI_EXPLAIN_VAR, async (_, args: { varName: string }) => {
    try {
      const { explainVariable } = require('../ai/groq')
      const explanation = await explainVariable(args.varName)
      return { success: true, explanation }
    } catch (err: any) {
      console.error('[IPC] AI_EXPLAIN_VAR failed:', err.message)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.AI_WATCHPOINT, async () => {
    try {
      const { generateWatch } = require('../ai/groq')
      const suggestions = await generateWatch()
      return { success: true, suggestions }
    } catch (err: any) {
      console.error('[IPC] AI_WATCHPOINT failed:', err.message)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.AI_SUGGEST_BPS, async (_, args: { sourceCode: string; language: Language }) => {
    try {
      const { suggestBreakpoints } = require('../ai/groq')
      const suggestions = await suggestBreakpoints(args.sourceCode, args.language)
      return { success: true, suggestions }
    } catch (err: any) {
      console.error('[IPC] AI_SUGGEST_BPS failed:', err.message)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.AI_NARRATIVE, async () => {
    try {
      const { sessionNarrative } = require('../ai/groq')
      const narrative = await sessionNarrative()
      return { success: true, narrative }
    } catch (err: any) {
      console.error('[IPC] AI_NARRATIVE failed:', err.message)
      return { success: false, error: err.message }
    }
  })

  console.log('[IPC] All handlers registered')
}
