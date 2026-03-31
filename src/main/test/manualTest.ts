// Run with: npx ts-node src/main/test/manualTest.ts
import { launchPythonAdapter } from '../dap/adapters/python'
import { DAPClient } from '../dap/DAPClient'
import * as path from 'path'

async function test() {
  const scriptPath = path.resolve('./tmp//test_script.py')

  console.log('=== Step 1: Launch debugpy ===')
  const adapter = await launchPythonAdapter(scriptPath)
  console.log('Adapter ready on port', adapter.port)

  // Wait for debugpy to fully start
  await new Promise(r => setTimeout(r, 1000))

  console.log('=== Step 2: Connect DAPClient ===')
  const client = new DAPClient()
  await client.connect('127.0.0.1', adapter.port)
  console.log('Connected')

  // Set up the initialized flag BEFORE anything else to avoid race conditions.
  // The 'initialized' event can arrive during or right after 'initialize',
  // so we must be listening before we send any requests.
  let initializedReceived = false
  const initializedPromise = new Promise<void>(resolve => {
    client.once('event:initialized', () => {
      initializedReceived = true
      resolve()
    })
  })

  // Listen for ALL events
  client.on('event:stopped', async (body: any) => {
    console.log('\n=== STOPPED ===')
    console.log('Reason:', body.reason)
    console.log('Thread:', body.threadId)

    // Fetch stack
    const stack = await client.stackTrace(body.threadId)
    console.log('Stack frames:', stack.stackFrames?.map((f: any) => `${f.name} @ ${f.source?.path}:${f.line}`))

    const topFrame = stack.stackFrames?.[0]
    if (topFrame) {
      // Fetch scopes
      const scopes = await client.scopes(topFrame.id)
      console.log('Scopes:', scopes.scopes?.map((s: any) => s.name))

      // Fetch variables from first scope
      const firstScope = scopes.scopes?.[0]
      if (firstScope) {
        const vars = await client.variables(firstScope.variablesReference)
        console.log('Variables:')
        vars.variables?.forEach((v: any) => {
            console.log(`  ${v.name} = ${v.value} (${v.type}) memref=${v.memoryReference}`)
            })
      }
    }

    console.log('\nStepping over...')
    await client.next(body.threadId)
  })

  client.on('event:terminated', () => {
    console.log('\n=== TERMINATED ===')
    adapter.process.kill()
    process.exit(0)
  })

  client.on('event:output', (body: any) => {
    process.stdout.write(`[program] ${body.output}`)
  })

  console.log('=== Step 3: Initialize ===')
  await client.initialize()

  console.log('=== Step 4: Attach ===')
  // Do NOT await attach yet — debugpy holds the attach response until it
  // receives configurationDone, so awaiting here would cause a deadlock.
  const attachPromise = client.attach('127.0.0.1', adapter.port)

  // Wait for 'initialized' event if it hasn't arrived yet.
  // debugpy fires this after receiving attach, signalling it's ready for config.
  if (!initializedReceived) {
    await initializedPromise
  }

  console.log('=== Step 5: Set breakpoint on line 3 ===')
  const bpResult = await client.setBreakpoints(scriptPath, [3])
  console.log('BP result:', bpResult.breakpoints)

  // Add this between Step 5 and Step 6 in manualTest.ts
    console.log('=== Step 5b: Set exception breakpoints ===')
    await client.request('setExceptionBreakpoints', {
    filters: ['uncaught'],        // pause on unhandled exceptions
    // or 'raised' to pause on ALL exceptions including caught ones
    })

  console.log('=== Step 6: ConfigurationDone ===')
  await client.configurationDone()

  // NOW debugpy sends the attach response
  await attachPromise

  console.log('=== Program running — waiting for breakpoint hit ===')
}

test().catch(console.error)