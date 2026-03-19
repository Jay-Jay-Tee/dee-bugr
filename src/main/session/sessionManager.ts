import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import { DAPClient } from '../dap/DAPClient'
import { launchPythonAdapter } from '../dap/adapters/python'
import { launchJSAdapter } from '../dap/adapters/javascript'
import { IPC } from '../../shared/ipc'
import {
  DebugState,
  INITIAL_DEBUG_STATE,
  StackFrame,
  Variable,
  Scope,
  HistoryEntry,
  Language
} from '../../shared/types'
import { ChildProcess } from 'child_process'

export class SessionManager {
  private client: DAPClient = new DAPClient()
  private adapterProcess: ChildProcess | null = null
  private threadId = 1
  private frameId = 0
  private stepCount = 0
  private language: Language = 'python'
  private prevVarValues: Record<string, string> = {}
  private breakpointMap: Map<string, { file: string; line: number; dapId?: number }> = new Map()  // ← ADD THIS

  // Full state — gets sent to renderer on every stop
  private state: DebugState = { ...INITIAL_DEBUG_STATE }

  constructor() {
    this.wireClientEvents()
  }

  // ── WIRE ALL DAP EVENTS ───────────────────────────────────
  private wireClientEvents() {

    // stopped — fires when hitting a breakpoint, step completes, exception, etc
    this.client.on('event:stopped', async (body: any) => {
      console.log('[Session] Stopped:', body.reason, '| thread:', body.threadId)

      this.threadId = body.threadId ?? 1
      this.state.status = 'paused'
      this.state.errorMessage = body.reason === 'exception'
        ? body.text
        : undefined

      // Fetch everything and push to renderer
      await this.refreshFullState()
      this.pushToRenderer(IPC.EVENT_STOPPED, this.state)
    })

    // continued — program is running again
    this.client.on('event:continued', () => {
      this.state.status = 'running'
      this.pushToRenderer(IPC.EVENT_CONTINUED, null)
    })

    // output — stdout/stderr from the program being debugged
    this.client.on('event:output', (body: any) => {
      this.pushToRenderer(IPC.EVENT_OUTPUT, {
        text: body.output,
        category: body.category ?? 'stdout'
      })
    })

    // terminated — program finished running
    this.client.on('event:terminated', () => {
      console.log('[Session] Program terminated')
      this.state.status = 'terminated'
      this.pushToRenderer(IPC.EVENT_TERMINATED, null)
      this.adapterProcess?.kill()
    })

    // exited — process exited with a code
    this.client.on('event:exited', (body: any) => {
      console.log('[Session] Exited with code', body.exitCode)
    })
  }

  // ── MAIN LAUNCH FUNCTION ──────────────────────────────────
  async launch(
    language: Language,
    scriptPath: string,
    breakpointLines: number[] = []
  ) {
    this.language = language
    this.stepCount = 0
    this.prevVarValues = {}
    this.state = { ...INITIAL_DEBUG_STATE, language, status: 'launching' }

    console.log(`[Session] Launching ${language} → ${scriptPath}`)

    // ── STEP 1: Start the adapter process ────────────────────
    let port: number
    if (language === 'python') {
      const adapter = await launchPythonAdapter(scriptPath)
      this.adapterProcess = adapter.process
      port = adapter.port
    } else if (language === 'javascript') {
      const adapter = await launchJSAdapter(scriptPath)
      this.adapterProcess = adapter.process
      port = adapter.port
    } else {
      throw new Error(`Language not yet supported: ${language}`)
    }

    // ── STEP 2: Wait 1 second for adapter to be ready ────────
    await this.sleep(1000)

    // ── STEP 3: Connect DAPClient TCP socket ─────────────────
    await this.client.connect('127.0.0.1', port)
    console.log('[Session] DAPClient connected')

    // ── STEP 4: Initialize ────────────────────────────────────
    const initBody = await this.client.initialize()
    console.log('[Session] Initialize OK, capabilities:', Object.keys(initBody ?? {}))

    // ── STEP 5: Launch or Attach ──────────────────────────────
    if (language === 'python') {
      // For python we ATTACH because debugpy is already running
      // (we spawned it with --listen --wait-for-client)
      this.client.attach('127.0.0.1', port)  // no await — debugpy holds response until configurationDone
      await this.sleep(200)
      console.log('[Session] Attach sent')
      console.log('[Session] Attach sent')
    } else if (language === 'javascript') {
      await this.client.launch({ program: scriptPath, stopOnEntry: false })
      console.log('[Session] Launch sent')
    }

    // ── STEP 6: Set breakpoints ───────────────────────────────
    if (breakpointLines.length > 0) {
      const bpBody = await this.client.setBreakpoints(scriptPath, breakpointLines)
      console.log('[Session] Breakpoints set:', bpBody?.breakpoints)
    }

    // ── STEP 7: Configuration done ────────────────────────────
    // This tells the adapter: "we are done configuring, start running"
    await this.client.configurationDone()
    console.log('[Session] ConfigurationDone sent — program is now running')

    this.state.status = 'running'

    // From here the adapter runs the program.
    // When it hits a breakpoint it fires a 'stopped' event.
    // wireClientEvents() handles that above.
  }

  // ── FETCH FULL STATE AFTER EVERY STOP ────────────────────
  private async refreshFullState() {
    try {
      // 1. Get call stack
      const stackBody = await this.client.stackTrace(this.threadId)
      const rawFrames = stackBody?.stackFrames ?? []

      const frames: StackFrame[] = rawFrames.map((f: any) => ({
        id: f.id,
        name: f.name,
        file: f.source?.path ?? f.source?.name ?? '',
        line: f.line,
        column: f.column,
        variableCount: 0  // filled in below
      }))

      this.state.stackFrames = frames

      if (frames.length > 0) {
        this.frameId = frames[0].id
        this.state.currentFile = frames[0].file
        this.state.currentLine = frames[0].line
      }

      // 2. Get scopes for top frame
      const scopesBody = await this.client.scopes(this.frameId)
      const rawScopes = scopesBody?.scopes ?? []

      const scopes: Scope[] = rawScopes.map((s: any) => ({
        name: s.name,
        variablesReference: s.variablesReference,
        expensive: s.expensive ?? false
      }))
      this.state.scopes = scopes

      // 3. Get variables from all non-expensive scopes
      const allVars: Variable[] = []
      for (const scope of scopes) {
        if (scope.expensive) continue  // skip registers, globals for now
        const vars = await this.fetchVariables(scope.variablesReference)
        allVars.push(...vars)
      }

      // Update frame variable counts
      if (frames.length > 0) {
        frames[0].variableCount = allVars.length
      }

      this.state.variables = allVars

      // 4. Get threads
      const threadsBody = await this.client.threads()
      this.state.threads = (threadsBody?.threads ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        status: t.id === this.threadId ? 'stopped' : 'running'
      }))

      // 5. Read source file
      try {
        const source = fs.readFileSync(this.state.currentFile, 'utf8')
        this.state.sourceLines = source.split('\n')
      } catch {
        // file might not be accessible
      }

      // 6. Record history entry
      this.stepCount++
      this.recordHistoryEntry(allVars)

      // 7. Update step count
      this.state.stepCount = this.stepCount

    } catch (err) {
      console.error('[Session] refreshFullState failed:', err)
    }
  }

  // ── FETCH VARIABLES FOR A SCOPE ───────────────────────────
 // Replace your existing fetchVariables with this recursive version
  async fetchVariables(variablesReference: number, depth = 0): Promise<Variable[]> {
    if (variablesReference === 0) return []
    if (depth > 3) return []  // max 3 levels deep — from v1 spec

    try {
      const body = await this.client.variables(variablesReference)
      const raw = body?.variables ?? []

      const result: Variable[] = []

      for (const v of raw) {
        const variable: Variable = {
          name: v.name,
          value: v.value ?? '',
          type: v.type ?? 'unknown',
          variablesReference: v.variablesReference ?? 0,
          memoryReference: v.memoryReference,
          expensive: v.presentationHint?.lazy ?? false,
        }

        result.push(variable)

        // If this variable has children (it's an object/array), go deeper
        // Skip expensive ones — those are things like global scope, registers
        if (v.variablesReference > 0 && !variable.expensive) {
          const children = await this.fetchVariables(v.variablesReference, depth + 1)
          result.push(...children)
        }
      }

      return result
    } catch (err) {
      console.error('[Session] fetchVariables failed for ref', variablesReference, err)
      return []
    }
  }

  // ── RECORD HISTORY ENTRY ──────────────────────────────────
  // Called after every stop so P3 can build the timeline chart
  private recordHistoryEntry(vars: Variable[]) {
    const varSnapshot: HistoryEntry['variables'] = {}

    for (const v of vars) {
      const changed = this.prevVarValues[v.name] !== v.value
      varSnapshot[v.name] = {
        value: v.value,
        type: v.type,
        changed
      }
      this.prevVarValues[v.name] = v.value
    }

    const entry: HistoryEntry = {
      step: this.stepCount,
      file: this.state.currentFile,
      line: this.state.currentLine,
      variables: varSnapshot,
      timestamp: Date.now()
    }

    this.state.executionHistory.push(entry)
  }

  // ── STEP COMMANDS (called by IPC handlers) ────────────────
  async stepOver() {
    this.state.status = 'running'
    await this.client.next(this.threadId)
  }

  async stepIn() {
    this.state.status = 'running'
    await this.client.stepIn(this.threadId)
  }

  async stepOut() {
    this.state.status = 'running'
    await this.client.stepOut(this.threadId)
  }

  async continueExecution() {
    this.state.status = 'running'
    await this.client.continue(this.threadId)
  }

  async terminate() {
  try {
    await this.client.terminate()
  } catch {
    // adapter may already be dead
  }
  this.adapterProcess?.kill()
  this.adapterProcess = null
  this.client.disconnect()
  this.client = new DAPClient()
  this.wireClientEvents()
  this.state = { ...INITIAL_DEBUG_STATE }
  this.state.status = 'terminated'
  this.threadId = 1
  this.frameId = 0
  this.stepCount = 0
  this.prevVarValues = {}
}

  // ── EVALUATE (REPL) ───────────────────────────────────────
  async evaluate(expression: string): Promise<string> {
    try {
      const body = await this.client.evaluate(expression, this.frameId)
      return body?.result ?? ''
    } catch (err: any) {
      return `Error: ${err.message}`
    }
  }

  // ── SET VARIABLE VALUE ────────────────────────────────────
  async setVariable(variablesReference: number, name: string, value: string) {
    return this.client.setVariable(variablesReference, name, value)
  }

  
  // ── SWITCH STACK FRAME ───────────────────────────────────

  async switchFrame(frameId: number): Promise<Variable[]> {
    this.frameId = frameId
    const scopesBody = await this.client.scopes(frameId)
    const rawScopes = scopesBody?.scopes ?? []
    const allVars: Variable[] = []
    for (const scope of rawScopes) {
        if (scope.expensive) continue
        const vars = await this.fetchVariables(scope.variablesReference)
        allVars.push(...vars.filter(v => v.name !== 'special variables' && v.name !== 'function variables'))
    }
    return allVars
    }

  // ── JUMP TO LINE ──────────────────────────────────────────
  async gotoLine(file: string, line: number) {
    const targetsBody = await this.client.gotoTargets(file, line)
    const targets = targetsBody?.targets ?? []
    if (targets.length > 0) {
      await this.client.goto(targets[0].id, this.threadId)
    }
  }

  // ── GET CONTEXT FOR AI (P4 calls this) ───────────────────
  getDebugContext() {
    return {
      language: this.language,
      errorMessage: this.state.errorMessage,
      stackFrames: this.state.stackFrames,
      variables: this.state.variables,
      sourceLines: this.state.sourceLines ?? [],
      currentLine: this.state.currentLine,
      currentFile: this.state.currentFile
    }
  }

  async readMemory(memoryReference: string, count = 256) {
    return this.client.readMemory(memoryReference, count)
    }

  async disassemble(memoryReference: string, count = 50) {
    return this.client.disassemble(memoryReference, count)
    }

  // ── GETTERS ───────────────────────────────────────────────
  getState() { return this.state }
  getClient() { return this.client }
  getCurrentFrameId() { return this.frameId }
  getCurrentThreadId() { return this.threadId }

  // ── HELPERS ───────────────────────────────────────────────
  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Push an event to the renderer process
  private pushToRenderer(channel: string, data: any) {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send(channel, data)
    }

  }
  async setBreakpoint(
  file: string,
  line: number,
  condition?: string
): Promise<{ id: string; verified: boolean; dapId?: number }> {
  const id = `bp-${file}-${line}-${Date.now()}`

  // Collect ALL lines for this file (existing + new)
  const existingLines = Array.from(this.breakpointMap.values())
    .filter(bp => bp.file === file)
    .map(bp => bp.line)

  const allLines = [...existingLines, line]

  // DAP requires you to send ALL breakpoints for a file at once
  // Sending a new setBreakpoints replaces the previous ones
  const conditions: Record<number, string> = {}
  if (condition) conditions[line] = condition

  const result = await this.client.setBreakpoints(file, allLines, conditions)
  const dapBPs = result?.breakpoints ?? []

  // Find the DAP BP that corresponds to our new line
  const newDapBP = dapBPs.find((bp: any) => bp.line === line)

  this.breakpointMap.set(id, { file, line, dapId: newDapBP?.id })

  // Update state so renderer knows about it
  this.state.breakpoints.push({
    id,
    dapId: newDapBP?.id,
    file,
    line,
    verified: newDapBP?.verified ?? false,
    condition,
  })

  return { id, verified: newDapBP?.verified ?? false, dapId: newDapBP?.id }
}

async removeBreakpoint(id: string): Promise<void> {
  const bp = this.breakpointMap.get(id)
  if (!bp) return

  this.breakpointMap.delete(id)

  // Remove from state
  this.state.breakpoints = this.state.breakpoints.filter(b => b.id !== id)

  // Re-send all remaining breakpoints for that file to DAP
  const remainingLines = Array.from(this.breakpointMap.values())
    .filter(b => b.file === bp.file)
    .map(b => b.line)

  await this.client.setBreakpoints(bp.file, remainingLines)
}
}

// Export a singleton so all IPC handlers share the same session
export const session = new SessionManager()