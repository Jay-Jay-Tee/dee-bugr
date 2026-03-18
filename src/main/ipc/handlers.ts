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

  // ── ADVANCED FLOW ─────────────────────────────────────────

  ipcMain.handle(IPC.GOTO_LINE, async (_, args: {
    source: string
    line: number
  }) => {
    await session.gotoLine(args.source, args.line)
    return { success: true }
  })

  // ── AI CONTEXT (P4 uses this) ─────────────────────────────

  ipcMain.handle('dap:getDebugContext', () => {
    return session.getDebugContext()
  })

  console.log('[IPC] All handlers registered')
}