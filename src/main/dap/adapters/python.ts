import { spawn, ChildProcess } from 'node:child_process'
import * as net from 'node:net'
import * as path from 'node:path'

export interface LaunchedAdapter {
  process: ChildProcess
  port: number
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as net.AddressInfo
      const port = addr.port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

export async function launchPythonAdapter(
  scriptPath: string
): Promise<LaunchedAdapter> {
  const port = await getFreePort()
  return new Promise((resolve, reject) => {
    console.log(`[Python] Spawning debugpy for ${scriptPath} on port ${port}`)

    const child = spawn('python', [
      '-m', 'debugpy',
      '--listen', `127.0.0.1:${port}`,
      '--wait-for-client',
      scriptPath
    ], {
      cwd: path.dirname(scriptPath)
    })

    let resolved = false

    child.stdout?.on('data', (data: Buffer) => {
      console.log('[debugpy stdout]', data.toString().trim())
    })

    child.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      console.log('[debugpy stderr]', msg)

      // debugpy prints this exact line when ready to accept connections
      if (!resolved && msg.includes('Waiting for client to connect')) {
        resolved = true
        resolve({ process: child, port })
      }
    })

    child.on('error', (err) => {
      console.error('[Python] Failed to spawn:', err)
      reject(err)
    })

    child.on('exit', (code) => {
      console.log('[Python] Process exited with code', code)
    })

    // Fallback — if we never see the ready message, try connecting after 4 seconds anyway
    setTimeout(() => {
      if (!resolved) {
        console.log('[Python] No ready message seen — connecting anyway')
        resolved = true
        resolve({ process: child, port })
      }
    }, 4000)
  })
}