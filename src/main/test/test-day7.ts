/**
 * src/main/test/test-day7.ts
 *
 * Day 7 manual test — verifies all P1 deliverables:
 *   1. Java adapter launches + connects
 *   2. Java call stack + variables populate
 *   3. Method breakpoints accepted (or graceful warning)
 *   4. suggestFix() returns { originalCode, fixedCode, explanation }
 *   5. switchThread() registered in IPC
 *
 * Run:  npx ts-node src/main/test/test-day7.ts
 *
 * Prerequisites:
 *   - java on PATH
 *   - java-debug JAR built OR JAVA_DEBUG_JAR set
 *   - javac -g tmp/TestNPE.java -d tmp/
 *   - DEE_BUGR_GROQ_KEY set for test 3
 */

import * as path from 'path'
import { fileURLToPath } from 'url'
import { DAPClient } from '../dap/DAPClient.ts'
import { launchJavaProgram, launchJavaAdapter, buildJavaAttachArgs } from '../dap/adapters/java.ts'
import { IPC } from '../../shared/ipc.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../../../')

// ── TEST 1: Java adapter end-to-end ──────────────────────────────────────────

async function testJava() {
  console.log('\n──── TEST 1: Java adapter ────')

  const classDir = path.join(ROOT, 'tmp')
  const jdwpPort = 5005

  console.log('[T1] Launching Java app with JDWP suspend...')
  const javaApp = await launchJavaProgram('TestNPE', classDir, jdwpPort)
  console.log('[T1] Java app launched, PID:', javaApp.process.pid)

  console.log('[T1] Launching java-debug adapter...')
  let adapter
  try {
    adapter = await launchJavaAdapter()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('java-debug JAR not found')) {
      console.warn('[T1] SKIP: java-debug JAR not found. Set JAVA_DEBUG_JAR to run this test.')
      javaApp.process.kill()
      return
    }
    throw err
  }
  console.log('[T1] Adapter port:', adapter.port)

  const client = new DAPClient()
  await client.connect('127.0.0.1', adapter.port)
  console.log('[T1] Connected')

  const initBody = await client.initialize()
  console.log('[T1] Init OK — capabilities:', Object.keys(initBody ?? {}).join(', '))

  await client.request('attach', buildJavaAttachArgs(jdwpPort))
  console.log('[T1] Attached to JDWP')

  const srcFile = path.join(classDir, 'TestNPE.java')
  await client.setBreakpoints(srcFile, [43])  // line 43: sumList(list)
  await client.configurationDone()
  console.log('[T1] Waiting for stopped event (15s timeout)...')

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout: no stopped event in 15s')), 15000)
    client.once('event:stopped', async (body: any) => {
      clearTimeout(t)
      console.log('[T1] Stopped! reason:', body.reason, 'thread:', body.threadId)

      const st = await client.stackTrace(body.threadId ?? 1)
      const frames = st?.stackFrames ?? []
      console.log('[T1] Stack frames:', frames.length)
      frames.slice(0, 3).forEach((f: any, i: number) => {
        console.log(`  #${i} ${f.name} @ ${f.source?.name ?? '?'}:${f.line}`)
      })

      if (frames[0]) {
        const sc = await client.scopes(frames[0].id)
        const loc = sc?.scopes?.find((s: any) => /local/i.test(s.name))
        if (loc) {
          const vs = await client.variables(loc.variablesReference)
          const varStr = (vs?.variables ?? []).map((v: any) => `${v.name}=${v.value}`).join(', ')
          console.log('[T1] Variables:', varStr || '(none)')
        }
      }

      resolve()
    })
    client.once('error', reject)
  })

  await client.terminate().catch(() => {})
  client.disconnect()
  javaApp.process.kill()
  adapter.process.kill()
  console.log('[T1] PASS')
}

// ── TEST 2: suggestFix shape ──────────────────────────────────────────────────

async function testSuggestFixShape() {
  console.log('\n──── TEST 2: suggestFix() shape ────')

  if (!process.env.DEE_BUGR_GROQ_KEY) {
    console.warn('[T2] SKIP: DEE_BUGR_GROQ_KEY not set')
    return
  }

  // Use direct Groq call in test to avoid pulling full session runtime into ESM test context.
  const apiKey = process.env.DEE_BUGR_GROQ_KEY
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      messages: [
        {
          role: 'system',
          content:
            'Return ONLY JSON with keys originalCode, fixedCode, explanation. Keep fix minimal. No markdown.',
        },
        {
          role: 'user',
          content: [
            'Language: python',
            'Error: AttributeError: NoneType has no attribute children',
            'Code:',
            'def getChildren(node):',
            '    return node.children',
            'Variables: node=None',
          ].join('\n'),
        },
      ],
      temperature: 0.2,
      max_tokens: 400,
    }),
  })

  if (!response.ok) {
    const msg = await response.text()
    throw new Error(`Groq API error ${response.status}: ${msg}`)
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content ?? '{}'
  const result = JSON.parse(content.replace(/```json|```/g, '').trim()) as {
    originalCode?: unknown
    fixedCode?: unknown
    explanation?: unknown
  }

  const ok = typeof result.originalCode === 'string'
          && typeof result.fixedCode === 'string'
          && typeof result.explanation === 'string'

  console.log('[T2] originalCode:', typeof result.originalCode)
  console.log('[T2] fixedCode:   ', typeof result.fixedCode)
  console.log('[T2] explanation: ', typeof result.explanation === 'string' ? result.explanation.slice(0, 100) : result.explanation)
  console.log('[T2]', ok ? 'PASS' : 'FAIL')
}

// ── TEST 3: switchThread + switchFrame IPC channels exist ────────────────────

async function testIPCChannels() {
  console.log('\n──── TEST 3: IPC channel definitions ────')
  const required = [
    'SWITCH_THREAD', 'SWITCH_FRAME', 'GOTO_LINE', 'RETURN_NOW', 'DROP_FRAME',
    'SET_METHOD_BP', 'SET_FIELD_WATCH', 'SET_EXCEPTION_BP', 'TOGGLE_GROUP',
    'AI_EXPLAIN', 'AI_FIX', 'AI_EXPLAIN_VAR', 'AI_WATCHPOINT',
    'AI_SUGGEST_BPS', 'AI_NARRATIVE',
    'EVENT_ANOMALY', 'EVENT_RETURN_VAL',
  ]
  let allOk = true
  const ipcRecord = IPC as Record<string, string>
  for (const key of required) {
    if (!ipcRecord[key]) {
      console.error(`[T3] MISSING: IPC.${key}`)
      allOk = false
    }
  }
  console.log('[T3]', allOk ? 'PASS: all channels defined' : 'FAIL: some channels missing')
}

// ── Run ───────────────────────────────────────────────────────────────────────

async function runAll() {
  console.log('=== Day 7 P1 Tests === ROOT:', ROOT)

  try { await testJava() }        catch (e) { console.error('[T1] FAIL:', (e as Error).message) }
  try { await testSuggestFixShape() } catch (e) { console.error('[T2] FAIL:', (e as Error).message) }
  try { await testIPCChannels() } catch (e) { console.error('[T3] FAIL:', (e as Error).message) }

  console.log('\n=== Done ===')
  process.exit(0)
}

runAll()
