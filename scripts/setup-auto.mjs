import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const args = new Set(process.argv.slice(2))
const checkOnly = args.has('--check')
const isWin = process.platform === 'win32'

function log(msg) {
  console.log(`[setup:auto] ${msg}`)
}

function run(cmd, cmdArgs, options = {}) {
  return spawnSync(cmd, cmdArgs, {
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
    shell: false,
    ...options,
  })
}

function commandExists(cmd) {
  const probe = isWin ? run('where', [cmd]) : run('which', [cmd])
  return probe.status === 0
}

function findPythonRunner() {
  const candidates = isWin
    ? [
        { cmd: 'py', args: ['-3'] },
        { cmd: 'python', args: [] },
      ]
    : [
        { cmd: 'python3', args: [] },
        { cmd: 'python', args: [] },
      ]

  for (const c of candidates) {
    const probe = run(c.cmd, [...c.args, '--version'])
    if (probe.status === 0) return c
  }
  return null
}

function ensureEnvFile(repoRoot) {
  const envPath = path.join(repoRoot, '.env')
  const envExamplePath = path.join(repoRoot, '.env.example')

  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath)
      log('Created .env from .env.example')
    } else {
      fs.writeFileSync(envPath, 'DEE_BUGR_GROQ_KEY=\nDEE_BUGR_AI_MODE=groq\n', 'utf8')
      log('Created .env with minimal defaults')
    }
  }

  return envPath
}

function ensureEnvVar(envPath, key, value) {
  const content = fs.readFileSync(envPath, 'utf8')
  const hasKey = new RegExp(`^\\s*${key}=`, 'm').test(content)
  if (hasKey) return false
  const next = content.endsWith('\n') ? content : content + '\n'
  fs.writeFileSync(envPath, `${next}${key}=${value}\n`, 'utf8')
  return true
}

function findLatestMatchingDir(root, prefix) {
  if (!fs.existsSync(root)) return null
  const dirs = fs.readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith(prefix))
    .map((d) => d.name)
    .sort()
    .reverse()
  return dirs.length ? path.join(root, dirs[0]) : null
}

function autoDetectCppToolsAdapter() {
  const home = os.homedir()
  const roots = [
    path.join(home, '.vscode', 'extensions'),
    path.join(home, '.vscode-insiders', 'extensions'),
  ]
  const bins = isWin ? ['OpenDebugAD7.exe', 'OpenDebugAD7'] : ['OpenDebugAD7']

  for (const root of roots) {
    const extDir = findLatestMatchingDir(root, 'ms-vscode.cpptools-')
    if (!extDir) continue
    for (const bin of bins) {
      const candidate = path.join(extDir, 'debugAdapters', 'bin', bin)
      if (fs.existsSync(candidate)) return candidate
    }
  }

  return null
}

function autoDetectJavaDebugJar() {
  const home = os.homedir()
  const roots = [
    path.join(home, '.vscode', 'extensions'),
    path.join(home, '.vscode-insiders', 'extensions'),
  ]

  for (const root of roots) {
    const extDir = findLatestMatchingDir(root, 'vscjava.vscode-java-debug-')
    if (!extDir) continue
    const serverDir = path.join(extDir, 'server')
    if (!fs.existsSync(serverDir)) continue
    const jar = fs.readdirSync(serverDir)
      .find((f) => f.startsWith('com.microsoft.java.debug.plugin-') && f.endsWith('.jar'))
    if (jar) return path.join(serverDir, jar)
  }

  return null
}

function installDebugpy(pythonRunner) {
  const pipArgs = [...pythonRunner.args, '-m', 'pip', 'install', '--upgrade', 'debugpy']
  const result = run(pythonRunner.cmd, pipArgs, { stdio: 'inherit' })
  return result.status === 0
}

function checkToolchain() {
  const gcc = commandExists('gcc')
  const gpp = commandExists('g++')
  const gdb = commandExists('gdb')
  return { gcc, gpp, gdb }
}

function printToolchainHelp(missing) {
  if (missing.length === 0) return
  log(`Missing tools: ${missing.join(', ')}`)
  if (isWin) {
    log('Windows install suggestions:')
    log('  - Install MinGW-w64/MSYS2 for gcc/g++')
    log('  - Install GDB and ensure gdb.exe is on PATH')
  } else if (process.platform === 'darwin') {
    log('macOS install suggestion: brew install gcc gdb')
  } else {
    log('Linux install suggestion: sudo apt install build-essential gdb')
  }
}

function main() {
  const repoRoot = process.cwd()
  log(`Running in ${repoRoot}`)

  const envPath = ensureEnvFile(repoRoot)

  const cppAdapter = autoDetectCppToolsAdapter()
  if (cppAdapter) {
    if (ensureEnvVar(envPath, 'CPPTOOLS_ADAPTER_PATH', cppAdapter)) {
      log('Detected cpptools adapter and added CPPTOOLS_ADAPTER_PATH to .env')
    } else {
      log('CPPTOOLS_ADAPTER_PATH already set in .env')
    }
  } else {
    log('cpptools adapter not auto-detected (C/C++ still works if adapter path is discoverable at runtime)')
  }

  const javaJar = autoDetectJavaDebugJar()
  if (javaJar) {
    if (ensureEnvVar(envPath, 'JAVA_DEBUG_JAR', javaJar)) {
      log('Detected Java debug JAR and added JAVA_DEBUG_JAR to .env')
    } else {
      log('JAVA_DEBUG_JAR already set in .env')
    }
  } else {
    log('Java debug JAR not auto-detected (only needed for Java debugging)')
  }

  const pythonRunner = findPythonRunner()
  if (!pythonRunner) {
    log('Python not found in PATH')
  } else if (checkOnly) {
    log('Check mode: skipping debugpy installation')
  } else {
    log(`Installing/upgrading debugpy via: ${pythonRunner.cmd} ${pythonRunner.args.join(' ')} -m pip ...`)
    const ok = installDebugpy(pythonRunner)
    if (!ok) {
      log('debugpy installation failed')
      process.exitCode = 1
    } else {
      log('debugpy is ready')
    }
  }

  const toolchain = checkToolchain()
  const missing = []
  if (!toolchain.gcc) missing.push('gcc')
  if (!toolchain.gpp) missing.push('g++')
  if (!toolchain.gdb) missing.push('gdb')

  if (missing.length === 0) {
    log('C/C++ toolchain check passed (gcc, g++, gdb found)')
  } else {
    printToolchainHelp(missing)
  }

  log('Done. If this is first run, restart the app after setup.')
}

main()
