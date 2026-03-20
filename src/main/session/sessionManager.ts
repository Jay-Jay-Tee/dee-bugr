import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import { DAPClient } from '../dap/DAPClient'
import { launchPythonAdapter } from '../dap/adapters/python'
import { launchJSAdapter } from '../dap/adapters/javascript'
import { IPC } from '../../shared/ipc'
import type { IPCChannel } from '../../shared/ipc'
import {
  DebugState,
  INITIAL_DEBUG_STATE,
  StackFrame,
  Variable,
  Scope,
  HistoryEntry,
  Language,
  Breakpoint,
} from '../../shared/types'
import { ChildProcess } from 'child_process'

// ── DAP response shape helpers ────────────────────────────────────────────────
// DAPClient.request() returns Promise<any> — we extract fields safely here
// rather than scattering casts throughout the session logic.

type DAPRecord = Record<string, unknown>

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' ? v : fallback
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function rec(v: unknown): DAPRecord {
  return (typeof v === 'object' && v !== null) ? v as DAPRecord : {}
}

function isVariable(v: unknown): v is Variable {
  if (typeof v !== 'object' || v === null) return false
  const r = v as DAPRecord
  return typeof r['name'] === 'string' && typeof r['value'] === 'string'
}

// ── SessionManager ────────────────────────────────────────────────────────────

export class SessionManager {
  private client: DAPClient = new DAPClient()
  private adapterProcess: ChildProcess | null = null
  private threadId = 1
  private frameId = 0
  private stepCount = 0
  private language: Language = 'python'
  private prevVarValues: Record<string, string> = {}
  private bpMap: Map<string, Set<number>> = new Map()
  private state: DebugState = { ...INITIAL_DEBUG_STATE }

  constructor() {
    this.wireClientEvents()
  }

  // ── Wire DAP events ───────────────────────────────────────

  private wireClientEvents() {
    this.client.on('event:stopped',    this.handleStopped.bind(this))
    this.client.on('event:continued',  this.handleContinued.bind(this))
    this.client.on('event:output',     this.handleOutput.bind(this))
    this.client.on('event:terminated', this.handleTerminated.bind(this))
    this.client.on('event:exited',     this.handleExited.bind(this))
  }

  private async handleStopped(body: DAPRecord) {
    console.log('[Session] Stopped:', body['reason'], '| thread:', body['threadId'])
    this.threadId = num(body['threadId'], 1)
    this.state.status = 'paused'
    this.state.errorMessage =
      body['reason'] === 'exception' ? str(body['text']) || undefined : undefined
    await this.refreshFullState()
    this.pushToRenderer(IPC.EVENT_STOPPED, this.state)
  }

  private handleContinued() {
    this.state.status = 'running'
    this.pushToRenderer(IPC.EVENT_CONTINUED, null)
  }

  private handleOutput(body: DAPRecord) {
    this.pushToRenderer(IPC.EVENT_OUTPUT, {
      text: str(body['output']),
      category: str(body['category'], 'stdout'),
    })
  }

  private handleTerminated() {
    console.log('[Session] Program terminated')
    this.state.status = 'terminated'
    this.pushToRenderer(IPC.EVENT_TERMINATED, null)
    this.adapterProcess?.kill()
  }

  private handleExited(body: DAPRecord) {
    console.log('[Session] Exited with code', body['exitCode'])
  }

  // ── Launch ────────────────────────────────────────────────

  async launch(language: Language, scriptPath: string, breakpointLines: number[] = []) {
    this.language = language
    this.stepCount = 0
    this.prevVarValues = {}
    this.bpMap = new Map()
    this.state = { ...INITIAL_DEBUG_STATE, language, status: 'launching' }

    console.log(`[Session] Launching ${language} → ${scriptPath}`)

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

    await this.sleep(1000)
    await this.client.connect('127.0.0.1', port)
    console.log('[Session] DAPClient connected')

    const initBody = await this.client.initialize()
    console.log('[Session] Initialize OK, capabilities:', Object.keys(initBody ?? {}))

    if (language === 'python') {
      await this.client.attach('127.0.0.1', port)
    } else if (language === 'javascript') {
      await this.client.launch({ program: scriptPath, stopOnEntry: false })
    }

    if (breakpointLines.length > 0) {
      await this.client.setBreakpoints(scriptPath, breakpointLines)
      this.bpMap.set(scriptPath, new Set(breakpointLines))
    }

    await this.client.configurationDone()
    console.log('[Session] ConfigurationDone sent — program running')
    this.state.status = 'running'
  }

  // ── Breakpoint management ─────────────────────────────────
  // DAP setBreakpoints is a full replacement per file, never incremental.

  async setBreakpoint(file: string, line: number, condition?: string) {
    const lines = this.bpMap.get(file) ?? new Set<number>()
    lines.add(line)
    this.bpMap.set(file, lines)

    const conditions: Record<number, string> = condition ? { [line]: condition } : {}
    const body = await this.client.setBreakpoints(file, [...lines], conditions)
    const dapBps: DAPRecord[] = Array.isArray(body?.breakpoints) ? body.breakpoints : []

    const updated: Breakpoint[] = [...lines].map((l, i) => {
      const dap = rec(dapBps[i])
      const existing = this.state.breakpoints.find((b) => b.file === file && b.line === l)
      return {
        id:        existing?.id ?? `bp-${file}-${l}`,
        dapId:     typeof dap['id'] === 'number' ? dap['id'] : undefined,
        file,
        line:      l,
        verified:  bool(dap['verified']),
        condition: condition && l === line ? condition : existing?.condition,
      }
    })

    this.state.breakpoints = [
      ...updated,
      ...this.state.breakpoints.filter((b) => b.file !== file),
    ]
  }

  async removeBreakpoint(file: string, line: number) {
    const lines = this.bpMap.get(file) ?? new Set<number>()
    lines.delete(line)
    this.bpMap.set(file, lines)
    await this.client.setBreakpoints(file, [...lines])
    this.state.breakpoints = this.state.breakpoints.filter(
      (b) => !(b.file === file && b.line === line)
    )
  }

  // ── Refresh full state after every stop ───────────────────

  private async refreshFullState() {
    try {
      const stackBody = await this.client.stackTrace(this.threadId)
      const rawFrames: DAPRecord[] = Array.isArray(stackBody?.stackFrames) ? stackBody.stackFrames : []

      const frames: StackFrame[] = rawFrames.map((f) => {
        const src = rec(f['source'])
        return {
          id:            num(f['id']),
          name:          str(f['name']),
          file:          str(src['path']) || str(src['name']),
          line:          num(f['line']),
          column:        num(f['column']),
          variableCount: 0,
        }
      })
      this.state.stackFrames = frames

      if (frames.length > 0) {
        this.frameId = frames[0].id
        this.state.currentFile = frames[0].file
        this.state.currentLine = frames[0].line
      }

      const scopesBody = await this.client.scopes(this.frameId)
      const rawScopes: DAPRecord[] = Array.isArray(scopesBody?.scopes) ? scopesBody.scopes : []

      const scopes: Scope[] = rawScopes.map((s) => ({
        name:               str(s['name']),
        variablesReference: num(s['variablesReference']),
        expensive:          bool(s['expensive']),
      }))
      this.state.scopes = scopes

      const allVars: Variable[] = []
      for (const scope of scopes) {
        if (scope.expensive) continue
        allVars.push(...await this.fetchVariables(scope.variablesReference))
      }
      if (frames.length > 0) frames[0].variableCount = allVars.length
      this.state.variables = allVars

      const threadsBody = await this.client.threads()
      const rawThreads: DAPRecord[] = Array.isArray(threadsBody?.threads) ? threadsBody.threads : []
      this.state.threads = rawThreads.map((t) => ({
        id:     num(t['id']),
        name:   str(t['name']),
        status: num(t['id']) === this.threadId ? 'stopped' : 'running',
      }))

      try {
        this.state.sourceLines = fs.readFileSync(this.state.currentFile, 'utf8').split('\n')
      } catch {
        // file may not be accessible — renderer keeps last known content
      }

      this.stepCount++
      this.recordHistoryEntry(allVars)
      this.state.stepCount = this.stepCount

    } catch (err) {
      console.error('[Session] refreshFullState failed:', err)
    }
  }

  // ── Fetch variables ───────────────────────────────────────

  async fetchVariables(variablesReference: number): Promise<Variable[]> {
    if (variablesReference === 0) return []
    try {
      const body = await this.client.variables(variablesReference)
      const raw: unknown[] = Array.isArray(body?.variables) ? body.variables : []
      return raw.filter(isVariable).map((v): Variable => {
        const hint = rec((v as DAPRecord)['presentationHint'])
        return {
          name:               str((v as DAPRecord)['name']),
          value:              str((v as DAPRecord)['value']),
          type:               str((v as DAPRecord)['type'], 'unknown'),
          variablesReference: num((v as DAPRecord)['variablesReference']),
          memoryReference:    typeof (v as DAPRecord)['memoryReference'] === 'string'
                                ? str((v as DAPRecord)['memoryReference'])
                                : undefined,
          expensive:          bool(hint['lazy']),
        }
      })
    } catch (err) {
      console.error('[Session] fetchVariables failed for ref', variablesReference, err)
      return []
    }
  }

  // ── History ───────────────────────────────────────────────

  private recordHistoryEntry(vars: Variable[]) {
    const varSnapshot: HistoryEntry['variables'] = {}
    for (const v of vars) {
      varSnapshot[v.name] = {
        value:   v.value,
        type:    v.type,
        changed: this.prevVarValues[v.name] !== v.value,
      }
      this.prevVarValues[v.name] = v.value
    }
    this.state.executionHistory.push({
      step:      this.stepCount,
      file:      this.state.currentFile,
      line:      this.state.currentLine,
      variables: varSnapshot,
      timestamp: Date.now(),
    })
  }

  // ── Step commands ─────────────────────────────────────────

  async stepOver()          { this.state.status = 'running'; await this.client.next(this.threadId) }
  async stepIn()            { this.state.status = 'running'; await this.client.stepIn(this.threadId) }
  async stepOut()           { this.state.status = 'running'; await this.client.stepOut(this.threadId) }
  async continueExecution() { this.state.status = 'running'; await this.client.continue(this.threadId) }

  async pause() {
    // DAPClient.request() is public — no cast needed.
    // Returns Promise<any> because DAP responses are untyped at the library level.
    await this.client.request('pause', { threadId: this.threadId })
  }

  async terminate() {
    try { await this.client.terminate() } catch { /* adapter may already be dead */ }
    this.adapterProcess?.kill()
    this.adapterProcess = null
    this.client.disconnect()
    this.client = new DAPClient()
    this.wireClientEvents()
    this.state         = { ...INITIAL_DEBUG_STATE }
    this.state.status  = 'terminated'
    this.threadId      = 1
    this.frameId       = 0
    this.stepCount     = 0
    this.prevVarValues = {}
    this.bpMap         = new Map()
  }

  // ── Evaluate / set variable ───────────────────────────────

  async evaluate(expression: string): Promise<string> {
    try {
      const body = await this.client.evaluate(expression, this.frameId)
      // body is any (DAPClient returns Promise<any>) — coerce safely
      return body != null && typeof body['result'] === 'string'
        ? body['result']
        : String(body?.['result'] ?? '')
    } catch (err: unknown) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  async setVariable(variablesReference: number, name: string, value: string) {
    return this.client.setVariable(variablesReference, name, value)
  }

  async switchFrame(frameId: number): Promise<Variable[]> {
    this.frameId = frameId
    const scopesBody = await this.client.scopes(frameId)
    const rawScopes: DAPRecord[] = Array.isArray(scopesBody?.scopes) ? scopesBody.scopes : []
    const allVars: Variable[] = []
    for (const scope of rawScopes) {
      if (bool(scope['expensive'])) continue
      allVars.push(...await this.fetchVariables(num(scope['variablesReference'])))
    }
    return allVars
  }

  // ── Memory / disassembly ──────────────────────────────────

  async readMemory(memoryReference: string, count = 256) {
    return this.client.readMemory(memoryReference, count)
  }

  async disassemble(memoryReference: string, count = 50) {
    return this.client.disassemble(memoryReference, count)
  }

  // ── AI context (P4) ───────────────────────────────────────

  getDebugContext() {
    return {
      language:     this.language,
      errorMessage: this.state.errorMessage,
      stackFrames:  this.state.stackFrames,
      variables:    this.state.variables,
      sourceLines:  this.state.sourceLines ?? [],
      currentLine:  this.state.currentLine,
      currentFile:  this.state.currentFile,
    }
  }

  // ── Getters ───────────────────────────────────────────────

  getState()           { return this.state }
  getClient()          { return this.client }
  getCurrentFrameId()  { return this.frameId }
  getCurrentThreadId() { return this.threadId }

  // ── Helpers ───────────────────────────────────────────────

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms))
  }

  private pushToRenderer(channel: IPCChannel, data: unknown) {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(channel, data)
    }
  }
}

export const session = new SessionManager()
