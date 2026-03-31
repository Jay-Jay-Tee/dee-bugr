// src/main/setup/ensureDebugpy.ts
// Checks whether debugpy is importable in the user's Python, and runs
// `pip install debugpy` silently if it isn't.
// Call this once before launching the Python adapter.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

// Returns the python executable name to use.
// On Windows, 'py' (the Python Launcher) is preferred because it respects
// the user's default Python version. Falls back to 'python3' then 'python'.
function pythonExe(): string {
  return process.platform === 'win32' ? 'py' : 'python3'
}

// Check if debugpy can be imported.
async function isDebugpyInstalled(python: string): Promise<boolean> {
  try {
    await exec(python, ['-c', 'import debugpy'], { timeout: 8000 })
    return true
  } catch {
    return false
  }
}

// Install debugpy via pip, streaming stderr to the console so the user can
// see progress if they have the DevTools open.
async function installDebugpy(python: string): Promise<void> {
  console.log('[Setup] debugpy not found — installing via pip...')
  try {
    const { stdout, stderr } = await exec(
      python,
      ['-m', 'pip', 'install', '--quiet', 'debugpy'],
      { timeout: 60_000 }   // 60 s should be plenty even on slow connections
    )
    if (stdout) console.log('[pip]', stdout.trim())
    if (stderr) console.log('[pip]', stderr.trim())
    console.log('[Setup] debugpy installed successfully ✓')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Failed to install debugpy automatically.\n` +
      `Please run: ${python} -m pip install debugpy\n` +
      `Details: ${msg}`
    )
  }
}

let checked = false   // only run once per app session

export async function ensureDebugpy(): Promise<string> {
  const python = pythonExe()

  if (checked) return python
  checked = false   // reset so we re-check after an install attempt

  if (await isDebugpyInstalled(python)) {
    console.log('[Setup] debugpy already installed ✓')
    checked = true
    return python
  }

  await installDebugpy(python)

  // Verify the install actually worked
  if (!(await isDebugpyInstalled(python))) {
    throw new Error(
      `debugpy install appeared to succeed but import still fails.\n` +
      `Try running: ${python} -m pip install debugpy`
    )
  }

  checked = true
  return python
}
