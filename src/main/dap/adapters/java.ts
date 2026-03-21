// src/main/dap/adapters/java.ts
// ─────────────────────────────────────────────────────────────────────────────
// Java DAP adapter via microsoft/java-debug.
//
// SETUP (one-time):
//   git clone https://github.com/microsoft/java-debug.git
//   cd java-debug && mvn package -DskipTests
//   Set env: JAVA_DEBUG_JAR=/path/to/java-debug/com.microsoft.java.debug.plugin/target/com.microsoft.java.debug.plugin-*.jar
//
//   OR install the VS Code Java extension pack — it includes java-debug.
//   Set: JAVA_DEBUG_JAR=~/.vscode/extensions/vscjava.vscode-java-debug-*/server/com.microsoft.java.debug.plugin-*.jar
//
// Compile your Java program:
//   javac -g YourClass.java
//
// Run (java-debug attaches via JDWP):
//   java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=5005 YourClass
// ─────────────────────────────────────────────────────────────────────────────

import { spawn, ChildProcess, exec } from 'node:child_process'
import * as net from 'node:net'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export interface LaunchedAdapter {
  process: ChildProcess
  port: number
}

export interface JavaLaunchResult {
  javaProcess: ChildProcess
  adapterPort: number
}

function findJavaDebugJar(): string | null {
  if (process.env.JAVA_DEBUG_JAR) {
    const p = process.env.JAVA_DEBUG_JAR
    if (fs.existsSync(p)) return p
    // Glob-like: if it ends with *, do a manual scan
    const dir = path.dirname(p)
    const prefix = path.basename(p).replace('*', '')
    if (fs.existsSync(dir)) {
      const match = fs.readdirSync(dir).find(f => f.startsWith(prefix))
      if (match) return path.join(dir, match)
    }
    console.warn('[Java] JAVA_DEBUG_JAR set but not found:', p)
  }

  // VS Code extension install
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
  const extsDir = path.join(home, '.vscode', 'extensions')
  if (fs.existsSync(extsDir)) {
    const dirs = fs.readdirSync(extsDir).filter(d => d.startsWith('vscjava.vscode-java-debug-'))
    for (const dir of dirs.sort().reverse()) {
      const serverDir = path.join(extsDir, dir, 'server')
      if (!fs.existsSync(serverDir)) continue
      const jar = fs.readdirSync(serverDir).find(f => f.startsWith('com.microsoft.java.debug.plugin'))
      if (jar) return path.join(serverDir, jar)
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

// ── Launch a Java program with JDWP suspended ─────────────────────────────────
// Returns the child process AND the port to use for DAP attach.
export async function launchJavaProgram(
  classOrJar: string,      // e.g. "Main" or "/path/to/app.jar"
  classpath: string,       // e.g. "." or "/path/to/classes:/path/to/lib.jar"
  jdwpPort = 5005
): Promise<{ process: ChildProcess; port: number }> {
  const isJar = classOrJar.endsWith('.jar')

  const javaArgs = [
    `-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=127.0.0.1:${jdwpPort}`,
    ...(isJar ? ['-jar', classOrJar] : ['-cp', classpath, classOrJar]),
  ]

  console.log(`[Java] Launching: java ${javaArgs.join(' ')}`)

  const child = spawn('java', javaArgs, {
    cwd: path.dirname(isJar ? classOrJar : classpath),
  })

  child.stdout?.on('data', (d: Buffer) => console.log('[java stdout]', d.toString().trim()))
  child.stderr?.on('data', (d: Buffer) => {
    const msg = d.toString().trim()
    console.log('[java stderr]', msg)
  })
  child.on('error', (err) => console.error('[Java] Process error:', err))
  child.on('exit', (code) => console.log('[Java] Exited with code', code))

  // Wait briefly for JDWP to come up
  await new Promise<void>((resolve) => setTimeout(resolve, 1000))

  return { process: child, port: jdwpPort }
}

// ── Launch the java-debug DAP adapter server ──────────────────────────────────
// This starts a separate DAP adapter process that bridges from DAP to JDWP.
export async function launchJavaAdapter(): Promise<LaunchedAdapter> {
  const jar = findJavaDebugJar()
  if (!jar) {
    throw new Error(
      'java-debug JAR not found.\n' +
      'Clone and build: git clone https://github.com/microsoft/java-debug && cd java-debug && mvn package -DskipTests\n' +
      'Then set: JAVA_DEBUG_JAR=/path/to/com.microsoft.java.debug.plugin-*.jar'
    )
  }

  const port = await getFreePort()
  console.log(`[Java] Spawning java-debug adapter on port ${port}`)

  const child = spawn('java', [
    '-cp', jar,
    'com.microsoft.java.debug.core.DebugServer',  // entry point for server mode
    String(port),
  ])

  child.stdout?.on('data', (d: Buffer) => console.log('[java-debug stdout]', d.toString().trim()))
  child.stderr?.on('data', (d: Buffer) => console.log('[java-debug stderr]', d.toString().trim()))
  child.on('error', (err) => console.error('[Java-debug] Adapter error:', err))

  await new Promise<void>((resolve) => setTimeout(resolve, 1500))

  return { process: child, port }
}

// ── Build DAP launch args for a Java program ─────────────────────────────────
export function buildJavaLaunchArgs(opts: {
  mainClass: string
  classpath: string
  jdwpPort?: number
}) {
  return {
    type: 'java',
    request: 'launch',
    name: 'Lucid Java Debug',
    mainClass: opts.mainClass,
    classPaths: opts.classpath.split(':'),
    stopOnEntry: true,
    jdwpPort: opts.jdwpPort ?? 5005,
  }
}

// ── Build DAP attach args (for attaching to an already-running JDWP process) ─
export function buildJavaAttachArgs(jdwpPort = 5005) {
  return {
    type: 'java',
    request: 'attach',
    name: 'Lucid Java Attach',
    hostName: '127.0.0.1',
    port: jdwpPort,
  }
}