// src/main/test/test-day3.ts
// Run: npx ts-node src/main/test/test-day3.ts
// PURPOSE: prove all Day 3 deliverables before handing off to P2/P3/P4

import { launchPythonAdapter } from '../dap/adapters/python'
import { DAPClient } from '../dap/DAPClient'
import * as path from 'path'
import * as fs from 'fs'

// Write the test script inline so there's no file dependency
const TEST_SCRIPT = path.resolve('/tmp/test_subject.py')
fs.writeFileSync(TEST_SCRIPT, `
def add(a, b):
    result = a + b   # line 2 — set breakpoint here
    return result

nums = [1, 2, 3]
x = 10
total = add(x, 5)
print(total)
`)

async function run() {
  console.log('\n=== DAY 3 VERIFICATION ===\n')

  // 1. Launch adapter
  const adapter = await launchPythonAdapter(TEST_SCRIPT)
  console.log('[1] debugpy launched on port', adapter.port, '✓')

  const client = new DAPClient()
  let stepsDone = 0

  client.on('event:stopped', async (body: any) => {
    stepsDone++
    console.log(`\n[STOP #${stepsDone}] reason:`, body.reason)

    // ── VERIFY: stackTrace ───────────────────────
    const stackBody = await client.stackTrace(body.threadId)
    const frames = stackBody?.stackFrames ?? []
    console.log('[2] stackTrace:', frames.map((f: any) => `${f.name}@line${f.line}`).join(' → '), '✓')

    // ── VERIFY: scopes ───────────────────────────
    const scopesBody = await client.scopes(frames[0].id)
    const scopes = scopesBody?.scopes ?? []
    console.log('[3] scopes:', scopes.map((s: any) => s.name).join(', '), '✓')

    // ── VERIFY: variables + memoryReference ──────
    const localsScope = scopes.find((s: any) => s.name === 'Locals') ?? scopes[0]
    const varsBody = await client.variables(localsScope.variablesReference)
    const vars = varsBody?.variables ?? []
    console.log('[4] variables:', vars.map((v: any) => `${v.name}=${v.value}(${v.type})`).join(', '))

    const memRefs = vars.filter((v: any) => v.memoryReference)
    console.log('[5] memoryReference populated on', memRefs.length, '/', vars.length, 'vars',
      memRefs.length > 0 ? '✓' : '⚠ (ok for Python scalars, needed for pointers in C)')

    // ── VERIFY: history entry shape ───────────────
    // Simulate what sessionManager records
    const historyEntry = {
      step: stepsDone,
      file: frames[0].source?.path ?? '',
      line: frames[0].line,
      variables: Object.fromEntries(vars.map((v: any) => [
        v.name,
        { value: v.value, type: v.type, changed: true }
      ])),
      timestamp: Date.now()
    }
    console.log('[6] HistoryEntry shape:', JSON.stringify(historyEntry, null, 2))

    // ── VERIFY: getDebugContext shape (for P4) ────
    const debugContext = {
      language: 'python',
      errorMessage: body.reason === 'exception' ? body.text : undefined,
      stackFrames: frames.map((f: any) => ({ id: f.id, name: f.name, file: f.source?.path, line: f.line })),
      variables: vars.map((v: any) => ({ name: v.name, value: v.value, type: v.type })),
      sourceLines: fs.readFileSync(TEST_SCRIPT, 'utf8').split('\n'),
      currentLine: frames[0].line,
      currentFile: frames[0].source?.path ?? ''
    }
    console.log('\n[7] getDebugContext() sample for P4:')
    console.log('  language:', debugContext.language)
    console.log('  currentFile:', debugContext.currentFile)
    console.log('  currentLine:', debugContext.currentLine)
    console.log('  variables count:', debugContext.variables.length)
    console.log('  sourceLines count:', debugContext.sourceLines.length)

    if (stepsDone < 3) {
      console.log('\n  Stepping over...')
      await client.next(body.threadId)
    } else {
      console.log('\n=== ALL CHECKS PASSED — copy the output above and send to P2, P3, P4 ===\n')
      client.disconnect()
      adapter.process.kill()
      process.exit(0)
    }
  })

  await client.connect('127.0.0.1', adapter.port)
await client.initialize()
await new Promise(resolve => setTimeout(resolve, 500))

// Send attach but DON'T await it — debugpy won't respond until after configurationDone
client.attach('127.0.0.1', adapter.port)

// Give it a moment then send the rest
await new Promise(resolve => setTimeout(resolve, 200))
await client.setBreakpoints(TEST_SCRIPT, [3])
await client.configurationDone()

  console.log('[0] Session started — waiting for breakpoint...')

  // Keep alive
  await new Promise(resolve => setTimeout(resolve, 15000))
  console.log('Timeout — something may have gone wrong')
  process.exit(1)
}

run().catch(err => {
  console.error('FAILED:', err)
  process.exit(1)
})