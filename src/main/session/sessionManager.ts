// src/main/session/sessionManager.ts
// ─────────────────────────────────────────────────────────────────────────────
// Combined v1 + v2 feature set through Day 4.
// Remaining stubs (Day 5-6 features) are clearly marked.
// ─────────────────────────────────────────────────────────────────────────────

import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import { DAPClient } from '../dap/DAPClient'
import { BreakpointManager } from '../dap/BreakpointManager'
import { launchPythonAdapter } from '../dap/adapters/python'
import { launchJSAdapter } from '../dap/adapters/javascript'
import { launchCppAdapter, buildCppLaunchArgs } from '../dap/adapters/cpp'
import { launchJavaProgram, launchJavaAdapter, buildJavaAttachArgs } from '../dap/adapters/java'
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
  AsmLine,
  Anomaly,
} from '../../shared/types'
import { ChildProcess } from 'child_process'

// ── Type helpers ──────────────────────────────────────────────────────────────

type DAPRecord = Record<string, unknown>

function str(v: unknown, fb = ''): string  { return typeof v === 'string'  ? v : fb }
function num(v: unknown, fb = 0): number   { return typeof v === 'number'  ? v : fb }
function bool(v: unknown, fb = false): boolean { return typeof v === 'boolean' ? v : fb }
function rec(v: unknown): DAPRecord        { return (typeof v === 'object' && v !== null) ? v as DAPRecord : {} }

function isVariable(v: unknown): v is Variable {
  if (typeof v !== 'object' || v === null) return false
  const r = v as DAPRecord
  return typeof r['name'] === 'string' && typeof r['value'] === 'string'
}

// ── Fast anomaly checks (no API call — runs on every step) ────────────────────
// v2 feature: emits debug:anomaly events that P4 renders in Monaco margin

function runFastAnomalyChecks(
  variables: Variable[],
  prevValues: Record<string, string>
): Anomaly[] {
  const anomalies: Anomaly[] = []

  for (const v of variables) {
    // Null pointer
    if (v.type?.includes('*') || v.type?.includes('ptr') || v.type === 'pointer') {
      if (v.value === '0x0' || v.value === '0' || v.value === 'null' || v.value === 'nullptr') {
        anomalies.push({
          variable: v.name,
          value:    v.value,
          type:     'null_pointer',
          severity: 'error',
          message:  `${v.name} is a null pointer — dereferencing will crash`,
        })
      }
    }

    // Integer overflow (jumped by more than 1 billion in one step)
    if (v.type?.includes('int') || v.type?.includes('long')) {
      const curr = parseInt(v.value)
      const prev = parseInt(prevValues[v.name] ?? '0')
      if (!isNaN(curr) && !isNaN(prev) && Math.abs(curr - prev) > 1_000_000_000) {
        anomalies.push({
          variable: v.name,
          value:    v.value,
          type:     'integer_overflow',
          severity: 'warning',
          message:  `${v.name} jumped by ${(curr - prev).toLocaleString()} — possible overflow`,
        })
      }
    }

    // Negative index/count
    if (v.name.toLowerCase().includes('index') || v.name.toLowerCase().includes('count') ||
        v.name.toLowerCase().includes('size')  || v.name.toLowerCase().includes('len')) {
      if (parseInt(v.value) < 0) {
        anomalies.push({
          variable: v.name,
          value:    v.value,
          type:     'bounds_exceeded',
          severity: 'warning',
          message:  `${v.name} is negative (${v.value}) — likely out-of-bounds`,
        })
      }
    }
  }

  return anomalies
}

// ── SessionManager ────────────────────────────────────────────────────────────

export class SessionManager {
  private client: DAPClient         = new DAPClient()
  private bpManager: BreakpointManager
  private adapterProcess: ChildProcess | null = null
  private javaAppProcess: ChildProcess | null = null
  private threadId    = 1
  private frameId     = 0
  private stepCount   = 0
  private language: Language = 'python'
  private prevVarValues: Record<string, string> = {}
  private state: DebugState = { ...INITIAL_DEBUG_STATE }
  // For run-to-cursor: track temp BPs set for that feature
  private runToCursorBP: { file: string; line: number } | null = null

  constructor() {
    this.bpManager = new BreakpointManager(this.client)
    this.wireClientEvents()
  }

  // ── Wire DAP events ───────────────────────────────────────────────────────

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

    // v2: Dependent BP / hit-count processing
    const hitIds: number[] = Array.isArray(body['hitBreakpointIds'])
      ? (body['hitBreakpointIds'] as unknown[]).map(n => num(n))
      : []

    if (hitIds.length > 0) {
      const { shouldContinue } = this.bpManager.onStopped(hitIds)
      if (shouldContinue) {
        // Dependency not met — transparent continue
        await this.continueExecution()
        return
      }
    }

    // v1 Day 4: run-to-cursor cleanup
    if (this.runToCursorBP) {
      const { file, line } = this.runToCursorBP
      this.runToCursorBP = null
      await this.bpManager.removeAt(file, line)
      // Update state BPs
      this.state.breakpoints = this.bpManager.getAll()
    }

    await this.refreshFullState()
    this.pushToRenderer(IPC.EVENT_STOPPED, this.state)
  }

  private handleContinued() {
    this.state.status = 'running'
    this.pushToRenderer(IPC.EVENT_CONTINUED, null)
  }

  private handleOutput(body: DAPRecord) {
    this.pushToRenderer(IPC.EVENT_OUTPUT, {
      text:     str(body['output']),
      category: str(body['category'], 'stdout'),
    })
  }

  private handleTerminated() {
    console.log('[Session] Program terminated')
    this.state.status = 'terminated'
    this.pushToRenderer(IPC.EVENT_TERMINATED, null)
    this.adapterProcess?.kill()
    this.javaAppProcess?.kill()
  }

  private handleExited(body: DAPRecord) {
    console.log('[Session] Exited with code', body['exitCode'])
  }

  // ── Launch ────────────────────────────────────────────────────────────────

  async launch(language: Language, scriptPath: string, breakpointLines: number[] = []) {
    this.language     = language
    this.stepCount    = 0
    this.prevVarValues = {}
    this.runToCursorBP = null
    this.bpManager.reset()
    this.state = { ...INITIAL_DEBUG_STATE, language, status: 'launching' }
    this.javaAppProcess = null

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

    } else if (language === 'c' || language === 'cpp') {
      const adapter = await launchCppAdapter(scriptPath)
      this.adapterProcess = adapter.process
      port = adapter.port

    } else if (language === 'java') {
      const jdwpPort = 5005
      const classpath = process.env.JAVA_CLASSPATH ?? '.'
      const javaApp = await launchJavaProgram(scriptPath, classpath, jdwpPort)
      this.javaAppProcess = javaApp.process
      const adapter = await launchJavaAdapter()
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
    } else if (language === 'c' || language === 'cpp') {
      await this.client.request('launch', buildCppLaunchArgs(scriptPath))
    } else if (language === 'java') {
      await this.client.request('attach', buildJavaAttachArgs(5005))
    }

    // Set initial breakpoints via BreakpointManager
    for (const line of breakpointLines) {
      await this.bpManager.set({ file: scriptPath, line })
    }
    this.state.breakpoints = this.bpManager.getAll()

    await this.client.configurationDone()
    console.log('[Session] ConfigurationDone sent — program running')
    this.state.status = 'running'
  }

  // ── Breakpoints (delegate to BreakpointManager) ───────────────────────────

  async setBreakpoint(file: string, line: number, opts?: {
    condition?: string
    hitCount?: number
    logMessage?: string
    label?: string
    groupId?: string
    dependsOn?: string
  }): Promise<void> {
    await this.bpManager.set({ file, line, ...opts })
    this.state.breakpoints = this.bpManager.getAll()
  }

  async removeBreakpoint(file: string, line: number): Promise<void> {
    await this.bpManager.removeAt(file, line)
    this.state.breakpoints = this.bpManager.getAll()
  }

  async toggleBreakpointGroup(groupId: string, enabled: boolean): Promise<void> {
    await this.bpManager.toggleGroup(groupId, enabled)
    this.state.breakpoints = this.bpManager.getAll()
  }

  async setMethodBreakpoint(name: string): Promise<void> {
    await this.bpManager.setMethodBreakpoint(name)
  }

  async setFieldWatch(variablesReference: number, name: string): Promise<void> {
    await this.bpManager.setFieldWatch({ variablesReference, name })
  }

  async setExceptionBreakpoints(filters: string[], classFilter?: string): Promise<void> {
    await this.bpManager.setExceptionBreakpoints({ filters, classFilter })
  }

  // ── v1 Day 4: Run-to-cursor ───────────────────────────────────────────────
  // Sets a temporary breakpoint at target line, continues, removes it on stop.

  async runToCursor(file: string, line: number): Promise<void> {
    this.runToCursorBP = { file, line }
    await this.bpManager.set({ file, line })
    this.state.breakpoints = this.bpManager.getAll()
    await this.continueExecution()
  }

  // ── Refresh full state after every stop ───────────────────────────────────

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
      } catch { /* file may not be accessible */ }

      // Auto-disassembly for C/C++ (Day 4)
      if ((this.language === 'c' || this.language === 'cpp') && allVars.length > 0) {
        const withMem = allVars.find(v => v.memoryReference)
        if (withMem?.memoryReference) {
          try {
            this.state.assemblyLines = await this.disassemble(withMem.memoryReference, 40)
          } catch { /* disassembly not supported */ }
        }
      }

      // v2: heap bytes for P3's heap tracker
      const heapBytes = await this.tryReadHeapBytes()

      this.stepCount++
      this.recordHistoryEntry(allVars, heapBytes)
      this.state.stepCount     = this.stepCount
      this.state.breakpoints   = this.bpManager.getAll()

      // v2: fast anomaly detection — emit to P4/P2
      const anomalies = runFastAnomalyChecks(allVars, this.prevVarValues)
      this.state.anomalies = anomalies
      if (anomalies.length > 0) {
        for (const a of anomalies) {
          this.pushToRenderer(IPC.EVENT_ANOMALY, a)
        }
      }

    } catch (err) {
      console.error('[Session] refreshFullState failed:', err)
    }
  }

  // ── Heap bytes (v2 — P3 heap tracker) ────────────────────────────────────

  private async tryReadHeapBytes(): Promise<number | undefined> {
    if (this.language === 'python') {
      try {
        const body = await this.client.evaluate(
          '__import__("tracemalloc").get_traced_memory()[0] if __import__("tracemalloc").is_tracing() else __import__("sys").getsizeof({})',
          this.frameId,
          'hover'
        )
        const val = parseInt(str(rec(body)['result']))
        if (!isNaN(val)) return val
      } catch { /* tracemalloc not available */ }
    }
    if (this.language === 'javascript') {
      try {
        const body = await this.client.evaluate('process.memoryUsage().heapUsed', this.frameId, 'hover')
        const val = parseInt(str(rec(body)['result']))
        if (!isNaN(val)) return val
      } catch { /* process not accessible */ }
    }
    return undefined
  }

  // ── Fetch variables ───────────────────────────────────────────────────────

  async fetchVariables(variablesReference: number): Promise<Variable[]> {
    if (variablesReference === 0) return []
    try {
      const body = await this.client.variables(variablesReference)
      const raw: unknown[] = Array.isArray(body?.variables) ? body.variables : []
      return raw.filter(isVariable).map((v): Variable => {
        const vr = v as unknown as DAPRecord
        const hint = rec(vr['presentationHint'])
        return {
          name:               str(vr['name']),
          value:              str(vr['value']),
          type:               str(vr['type'], 'unknown'),
          variablesReference: num(vr['variablesReference']),
          memoryReference:    typeof vr['memoryReference'] === 'string' ? str(vr['memoryReference']) : undefined,
          expensive:          bool(hint['lazy']),
        }
      })
    } catch (err) {
      console.error('[Session] fetchVariables failed for ref', variablesReference, err)
      return []
    }
  }

  // ── History ───────────────────────────────────────────────────────────────

  private recordHistoryEntry(vars: Variable[], heapBytes?: number) {
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
      heapBytes,
    })
  }

  // ── Step commands ─────────────────────────────────────────────────────────

  async stepOver()          { this.state.status = 'running'; await this.client.next(this.threadId) }
  async stepIn()            { this.state.status = 'running'; await this.client.stepIn(this.threadId) }
  async continueExecution() { this.state.status = 'running'; await this.client.continue(this.threadId) }

  async stepOut() {
    this.state.status = 'running'
    await this.client.stepOut(this.threadId)
    // v2: capture return value after stepOut
    await this.captureReturnValue()
  }

  async pause() {
    await this.client.request('pause', { threadId: this.threadId })
  }

  // v2: Return value capture after stepOut
  private async captureReturnValue(): Promise<void> {
    if (this.state.stackFrames.length === 0) return
    const fnName = this.state.stackFrames[0]?.name ?? 'unknown'
    try {
      const body = await this.client.evaluate('$__return__', this.frameId, 'hover')
      const value = str(rec(body)['result'])
      const type  = str(rec(body)['type'])
      if (value) {
        this.state.lastReturnValue = { fnName, value, type }
        this.pushToRenderer(IPC.EVENT_RETURN_VAL, { fnName, value, type })
      }
    } catch { /* not all adapters support $__return__ */ }
  }

  // ── Day 5+ stubs (clearly marked) ────────────────────────────────────────

  /** Day 5: Jump execution to any line in current file. */
  async gotoLine(file: string, line: number): Promise<void> {
    try {
      const targetsBody = await this.client.gotoTargets(file, line)
      const targets = (rec(targetsBody)['targets'] as DAPRecord[]) ?? []
      if (targets.length > 0) {
        await this.client.goto(num(targets[0]['id']), this.threadId)
      }
    } catch (err) {
      console.error('[Session] gotoLine failed (adapter may not support gotoTargets):', err)
      throw err
    }
  }

  /** Day 5: Drop (restart) current frame — re-enter the function from the top. */
  async dropFrame(frameId?: number): Promise<void> {
    await this.client.restartFrame(frameId ?? this.frameId)
  }

  /** Day 5: Return from current function immediately. */
  async returnNow(frameId?: number): Promise<void> {
    await this.client.restartFrame(frameId ?? this.frameId)
  }

  // ── Terminate ────────────────────────────────────────────────────────────

  async terminate() {
    try { await this.client.terminate() } catch { /* adapter may already be dead */ }
    this.adapterProcess?.kill()
    this.javaAppProcess?.kill()
    this.adapterProcess = null
    this.javaAppProcess = null
    this.client.disconnect()
    this.client       = new DAPClient()
    this.bpManager    = new BreakpointManager(this.client)
    this.wireClientEvents()
    this.state        = { ...INITIAL_DEBUG_STATE }
    this.state.status = 'terminated'
    this.threadId     = 1
    this.frameId      = 0
    this.stepCount    = 0
    this.prevVarValues = {}
    this.runToCursorBP = null
  }

  // ── Evaluate / set variable ───────────────────────────────────────────────

  async evaluate(expression: string): Promise<string> {
    try {
      const body = await this.client.evaluate(expression, this.frameId)
      return typeof rec(body)['result'] === 'string' ? str(rec(body)['result']) : String(body ?? '')
    } catch (err) {
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

  // ── Memory / disassembly ──────────────────────────────────────────────────

  async readMemory(memoryReference: string, count = 256) {
    return this.client.readMemory(memoryReference, count)
  }

  async disassemble(memoryReference: string, count = 50): Promise<AsmLine[]> {
    try {
      const body = await this.client.disassemble(memoryReference, count)
      const rawAsm: DAPRecord[] = Array.isArray((body as DAPRecord)?.['instructions'])
        ? (body as DAPRecord)['instructions'] as DAPRecord[]
        : []
      return rawAsm.map((a): AsmLine => ({
        address:     str(a['address']),
        instruction: str(a['instruction']),
        sourceLine:  typeof a['line'] === 'number' ? a['line'] : undefined,
        bytes:       str(a['instructionBytes']),
      }))
    } catch (err) {
      console.error('[Session] disassemble failed:', err)
      return []
    }
  }

  // ── AI context (P4) ───────────────────────────────────────────────────────

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

  // ── Getters ───────────────────────────────────────────────────────────────

  getState()           { return this.state }
  getClient()          { return this.client }
  getBPManager()       { return this.bpManager }
  getCurrentFrameId()  { return this.frameId }
  getCurrentThreadId() { return this.threadId }

  private sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

  private pushToRenderer(channel: IPCChannel, data: unknown) {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(channel, data)
    }
  }
}

export const session = new SessionManager()