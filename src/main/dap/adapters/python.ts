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
      srv.close(() => resolve(addr.port))
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
    let stderrLog = ''

    child.stdout?.on('data', (data: Buffer) => {
      console.log('[debugpy stdout]', data.toString().trim())
    })

    child.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      stderrLog += `${msg}\n`
      console.log('[debugpy stderr]', msg)

      // debugpy prints this when the socket is open and ready
      if (!resolved && (
        msg.includes('Waiting for client to connect') ||
        msg.includes('Listening on') ||
        msg.includes('waiting for client')
      )) {
        resolved = true
        setTimeout(() => resolve({ process: child, port }), 300)
      }

      // Catch port-in-use and other fatal errors immediately
      if (!resolved && (msg.includes('RuntimeError') || msg.includes('WinError'))) {
        resolved = true
        reject(new Error(`debugpy failed to start: ${msg}`))
      }
    })

    child.on('error', (err) => {
      console.error('[Python] Failed to spawn:', err)
      if (!resolved) { resolved = true; reject(err) }
    })

    child.on('exit', (code) => {
      console.log('[Python] Process exited with code', code)
      if (!resolved) {
        resolved = true
        if (stderrLog.includes('No module named debugpy')) {
          reject(new Error(
            'debugpy is not installed in the Python interpreter used by DEE-BUGR. ' +
            'Install it with: python -m pip install debugpy'
          ))
          return
        }
        reject(new Error(`debugpy exited with code ${code} before connecting`))
      }
    })

    // Fallback after 8 seconds
    setTimeout(() => {
      if (!resolved) {
        console.log('[Python] No ready message — connecting anyway')
        resolved = true
        resolve({ process: child, port })
      }
    }, 8000)
  })
}