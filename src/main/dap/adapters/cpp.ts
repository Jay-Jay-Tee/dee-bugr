// src/main/dap/adapters/cpp.ts
// ─────────────────────────────────────────────────────────────────────────────
// C / C++ DAP adapter via cpptools (vscode-cpptools).
//
// SETUP (one-time, per machine):
//   1. Download the cpptools vsix from:
//      https://github.com/microsoft/vscode-cpptools/releases
//   2. Rename it to .zip and extract. The adapter binary is at:
//      extension/debugAdapters/bin/OpenDebugAD7
//      (Linux/macOS) or OpenDebugAD7.exe (Windows)
//   3. Set env var: CPPTOOLS_ADAPTER_PATH=/absolute/path/to/OpenDebugAD7
//      OR place the binary at project root: ./cpptools/OpenDebugAD7
//
// Compile your C/C++ program with debug symbols:
//   gcc -g -O0 -o program program.c
//   g++ -g -O0 -o program program.cpp
// ─────────────────────────────────────────────────────────────────────────────

import { spawn, ChildProcess } from 'node:child_process'
import * as net from 'node:net'
import * as path from 'node:path'
import * as fs from 'node:fs'

export interface LaunchedAdapter {
  process: ChildProcess
  port: number
}

function findCppToolsAdapter(): string | null {
  // 1. Explicit env override
  if (process.env.CPPTOOLS_ADAPTER_PATH) {
    const p = process.env.CPPTOOLS_ADAPTER_PATH
    if (fs.existsSync(p)) return p
    console.warn('[C++] CPPTOOLS_ADAPTER_PATH set but file not found:', p)
  }

  // 2. Next to project root
  const root = path.join(process.cwd(), 'cpptools', 'OpenDebugAD7')
  if (fs.existsSync(root)) return root

  // 3. Common VS Code extension installs
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
  const vscodeExts = path.join(home, '.vscode', 'extensions')
  if (fs.existsSync(vscodeExts)) {
    const dirs = fs.readdirSync(vscodeExts).filter(d => d.startsWith('ms-vscode.cpptools-'))
    if (dirs.length > 0) {
      dirs.sort().reverse() // newest version first
      const bin = path.join(vscodeExts, dirs[0], 'debugAdapters', 'bin', 'OpenDebugAD7')
      if (fs.existsSync(bin)) return bin
    }
  }

  return null
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

export async function launchCppAdapter(
  programPath: string
): Promise<LaunchedAdapter> {
  const adapterBin = findCppToolsAdapter()
  if (!adapterBin) {
    throw new Error(
      'cpptools adapter not found.\n' +
      'Download from https://github.com/microsoft/vscode-cpptools/releases\n' +
      'Extract and set CPPTOOLS_ADAPTER_PATH=/path/to/OpenDebugAD7'
    )
  }

  const port = await getFreePort()
  console.log(`[C++] Spawning cpptools adapter on port ${port}`)
  console.log(`[C++] Adapter binary: ${adapterBin}`)
  console.log(`[C++] Target program: ${programPath}`)

  // Make the binary executable (Linux/macOS)
  try { fs.chmodSync(adapterBin, 0o755) } catch { /* Windows or already executable */ }

  const child = spawn(adapterBin, ['--server=' + port], {
    cwd: path.dirname(programPath),
  })

  child.stdout?.on('data', (d: Buffer) => console.log('[cpptools stdout]', d.toString().trim()))
  child.stderr?.on('data', (d: Buffer) => console.log('[cpptools stderr]', d.toString().trim()))
  child.on('error', (err) => console.error('[C++] Adapter error:', err))
  child.on('exit', (code) => console.log('[C++] Adapter exited with code', code))

  // cpptools doesn't print a ready line — just wait 1.5s
  await new Promise<void>((resolve) => setTimeout(resolve, 1500))

  return { process: child, port }
}

// ── Launch args for a C/C++ program ──────────────────────────────────────────
//
// Call these after connecting the DAPClient and sending initialize:
//
//   await client.request('launch', buildCppLaunchArgs(programPath))
//   await client.setBreakpoints(sourceFile, lines)
//   await client.configurationDone()
//
export function buildCppLaunchArgs(programPath: string, sourceFile?: string) {
  return {
    type: 'cppdbg',
    request: 'launch',
    name: 'Lucid C++ Debug',
    program: programPath,
    args: [],
    stopAtEntry: true,           // stop at main() first
    cwd: path.dirname(programPath),
    environment: [],
    externalConsole: false,
    MIMode: 'gdb',               // or 'lldb' on macOS
    miDebuggerPath: 'gdb',       // must be on PATH
    setupCommands: [
      {
        description: 'Enable pretty-printing',
        text: '-enable-pretty-printing',
        ignoreFailures: true,
      },
    ],
    // Map source files if needed
    ...(sourceFile ? { sourceFileMap: { [path.dirname(sourceFile)]: path.dirname(programPath) } } : {}),
  }
}