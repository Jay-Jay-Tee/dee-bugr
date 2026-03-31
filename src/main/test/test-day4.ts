/**
 * src/main/test/test-day4.ts
 *
 * Day 4 manual test: C/C++ + Java adapters + disassembly + readMemory.
 *
 * Run (from project root after installing deps):
 *   npx ts-node --esm src/main/test/test-day4.ts
 *
 * Prerequisites:
 *   - GDB installed: sudo apt install gdb  (Linux) / brew install gdb (mac)
 *   - cpptools adapter binary (see cpp.ts for setup)
 *   - Compile test C program: gcc -g -O0 -o /tmp/test_c /path/to/test_c.c
 */

import { DAPClient } from '../dap/DAPClient'
import { launchCppAdapter, buildCppLaunchArgs } from '../dap/adapters/cpp'

const TEST_C_BINARY = process.env.TEST_C_BINARY ?? '/tmp/test_lucid'

async function testCppAdapter() {
  console.log('\n=== Day 4: C/C++ Adapter Test ===')
  console.log('Binary:', TEST_C_BINARY)

  const client = new DAPClient()

  try {
    console.log('[1] Launching cpptools adapter...')
    const adapter = await launchCppAdapter(TEST_C_BINARY)
    console.log(`    ✓ Adapter running on port ${adapter.port}`)

    console.log('[2] Connecting DAPClient...')
    await client.connect('127.0.0.1', adapter.port)
    console.log('    ✓ Connected')

    console.log('[3] Initialize...')
    const initBody = await client.initialize()
    console.log('    ✓ Capabilities:', Object.keys(initBody ?? {}).join(', '))

    console.log('[4] Launch binary...')
    await client.request('launch', buildCppLaunchArgs(TEST_C_BINARY))
    console.log('    ✓ Launch sent')

    console.log('[5] ConfigurationDone...')
    await client.configurationDone()
    console.log('    ✓ Program should now be paused at entry')

    // Wait for stopped event
    await new Promise<void>((resolve) => {
      client.once('event:stopped', () => {
        console.log('    ✓ Stopped event received')
        resolve()
      })
      setTimeout(resolve, 3000) // fallback
    })

    console.log('[6] Stack trace...')
    const stack = await client.stackTrace(1)
    const frames = stack?.stackFrames ?? []
    console.log(`    ✓ ${frames.length} frames:`)
    frames.slice(0, 3).forEach((f: any) => {
      console.log(`      ${f.name}() at ${f.source?.path ?? f.source?.name}:${f.line}`)
    })

    if (frames.length > 0) {
      const frameId = frames[0].id
      console.log('[7] Scopes...')
      const scopes = await client.scopes(frameId)
      console.log(`    ✓ ${scopes?.scopes?.length ?? 0} scopes`)

      if (scopes?.scopes?.length > 0) {
        const scopeRef = scopes.scopes[0].variablesReference
        console.log('[8] Variables...')
        const vars = await client.variables(scopeRef)
        const varList = vars?.variables ?? []
        console.log(`    ✓ ${varList.length} variables`)
        varList.slice(0, 5).forEach((v: any) => {
          console.log(`      ${v.name}: ${v.value} (${v.type})`)
        })

        // Test disassembly — need a memory reference
        const withMem = varList.find((v: any) => v.memoryReference)
        if (withMem) {
          console.log('[9] Disassemble...')
          try {
            const asm = await client.disassemble(withMem.memoryReference, 10)
            const instrs = asm?.instructions ?? []
            console.log(`    ✓ ${instrs.length} instructions`)
            instrs.slice(0, 3).forEach((i: any) => {
              console.log(`      ${i.address}  ${i.instruction}`)
            })
          } catch (e: any) {
            console.log('    ⚠ Disassembly not supported:', e.message)
          }

          console.log('[10] Read memory...')
          try {
            const mem = await client.readMemory(withMem.memoryReference, 16)
            console.log(`    ✓ Memory bytes: ${mem?.data ?? '(none)'}`)
          } catch (e: any) {
            console.log('    ⚠ Read memory not supported:', e.message)
          }
        }
      }
    }

    console.log('\n✅ C/C++ adapter test PASSED')

  } catch (err: any) {
    console.error('\n❌ C/C++ adapter test FAILED:', err.message)
  } finally {
    try { await client.terminate() } catch {}
    client.disconnect()
  }
}

async function quickAdapterCheck() {
  console.log('\n=== Day 4 Quick Check: All 4 Languages ===')

  const checks = [
    { lang: 'Python (debugpy)',     check: () => import('../dap/adapters/python').then(() => { console.log('  python.ts: OK'); }) },
    { lang: 'JavaScript (js-debug)', check: () => import('../dap/adapters/javascript').then(() => { console.log('  javascript.ts: OK'); }) },
    { lang: 'C/C++ (cpptools)',     check: () => import('../dap/adapters/cpp').then(() => { console.log('  cpp.ts: OK'); }) },
    { lang: 'Java (java-debug)',    check: () => import('../dap/adapters/java').then(() => { console.log('  java.ts: OK'); }) },
  ]

  for (const { lang, check } of checks) {
    try {
      await check()
      console.log(`  ✓ ${lang}`)
    } catch (e: any) {
      console.error(`  ✗ ${lang}: ${e.message}`)
    }
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

;(async () => {
  await quickAdapterCheck()

  if (process.argv.includes('--cpp')) {
    await testCppAdapter()
  } else {
    console.log('\nTo test C/C++ adapter end-to-end, compile a test program and run:')
    console.log('  gcc -g -O0 -o /tmp/test_lucid tmp/test_subject.py   # (use a C file)')
    console.log('  TEST_C_BINARY=/tmp/test_lucid npx ts-node --esm src/main/test/test-day4.ts --cpp')
  }
})()