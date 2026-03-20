import { ipcMain } from 'electron'
import { IPC } from '../../shared/ipc'
import { session } from '../session/sessionManager'
import { Language } from '../../shared/types'

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
    } catch (err: any) {
      console.error('[IPC] Launch failed:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.TERMINATE, async () => {
    await session.terminate()
    return { success: true }
  })

  // ── STEPPING ──────────────────────────────────────────────

  ipcMain.handle(IPC.NEXT, async () => {
    await session.stepOver()
    return { success: true }
  })

  ipcMain.handle(IPC.STEP_IN, async () => {
    await session.stepIn()
    return { success: true }
  })

  ipcMain.handle(IPC.STEP_OUT, async () => {
    await session.stepOut()
    return { success: true }
  })

  ipcMain.handle(IPC.CONTINUE, async () => {
    await session.continueExecution()
    return { success: true }
  })

  // ── INSPECTION ────────────────────────────────────────────

  ipcMain.handle(IPC.GET_VARIABLES, async (_, args: {
    variablesReference: number
  }) => {
    const vars = await session.fetchVariables(args.variablesReference)
    return vars
  })

  ipcMain.handle(IPC.EVALUATE, async (_, args: {
    expr: string
  }) => {
    const result = await session.evaluate(args.expr)
    return result
  })

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
    const vars = await session.switchFrame(args.frameId)
    return vars
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

  // ── ADVANCED FLOW ─────────────────────────────────────────

  ipcMain.handle(IPC.GOTO_LINE, async (_, _args: {
    source: string
    line: number
  }) => {
    // Real implementation Day 5
    return { success: false, error: 'Not implemented until Day 5' }
  })

  ipcMain.handle(IPC.RETURN_NOW, async (_, _args: {
    frameId: number
    value?: string
  }) => {
    return { success: false, error: 'Not implemented until Day 5' }
  })

  ipcMain.handle(IPC.DROP_FRAME, async (_, _args: {
    frameId: number
  }) => {
    return { success: false, error: 'Not implemented until Day 5' }
  })

  ipcMain.handle(IPC.JUMP_TO_STEP, async (_, _args: {
    step: number
  }) => {
    return { success: false, error: 'Not implemented until Day 5' }
  })

  // ── BREAKPOINT STUBS (implement Day 6) ────────────────────

  ipcMain.handle(IPC.SET_METHOD_BP, async (_, _args: {
    name: string
  }) => {
    return { success: false, error: 'Not implemented until Day 6' }
  })

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