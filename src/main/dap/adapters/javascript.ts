import { spawn, ChildProcess } from 'child_process'

export interface LaunchedAdapter {
  process: ChildProcess
  port: number
}

export function launchJSAdapter(
  scriptPath: string,
  port = 4712
): Promise<LaunchedAdapter> {
  return new Promise((resolve, reject) => {
    console.log(`[JS] Spawning js-debug for ${scriptPath} on port ${port}`)

    // Find the js-debug DAP server entry point
    let jsDebugEntry: string
    try {
      jsDebugEntry = require.resolve(
        '@vscode/js-debug/dist/src/dapDebugServer.js'
      )
    } catch {
      reject(new Error(
        'Could not find @vscode/js-debug. Run: npm install @vscode/js-debug'
      ))
      return
    }

    const child = spawn('node', [jsDebugEntry, String(port)])

    let resolved = false

    child.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      console.log('[js-debug stdout]', msg)

      // js-debug prints this when ready
      if (!resolved && msg.includes('Debug server listening')) {
        resolved = true
        resolve({ process: child, port })
      }
    })

    child.stderr?.on('data', (data: Buffer) => {
      console.error('[js-debug stderr]', data.toString().trim())
    })

    child.on('error', (err) => {
      console.error('[JS] Failed to spawn:', err)
      reject(err)
    })

    child.on('exit', (code) => {
      console.log('[JS] Process exited with code', code)
    })

    // Fallback
    setTimeout(() => {
      if (!resolved) {
        console.log('[JS] No ready message — connecting anyway')
        resolved = true
        resolve({ process: child, port })
      }
    }, 4000)
  })
}