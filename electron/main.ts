// electron/main.ts

import 'dotenv/config'

import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST     = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null

function isRecoverableTransportError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /ECONNRESET|EPIPE|socket hang up/i.test(msg)
}

process.on('uncaughtException', (err) => {
  if (isRecoverableTransportError(err)) {
    console.warn('[Main] Suppressed recoverable transport error:', err instanceof Error ? err.message : String(err))
    return
  }
  console.error('[Main] Uncaught exception:', err)
})

process.on('unhandledRejection', (reason) => {
  if (isRecoverableTransportError(reason)) {
    console.warn('[Main] Suppressed recoverable transport rejection:', reason instanceof Error ? reason.message : String(reason))
    return
  }
  console.error('[Main] Unhandled rejection:', reason)
})

// ── Window factory ────────────────────────────────────────────────────────────

function createWindow(filePath?: string) {
  const w = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC!, 'electron-vite.svg'),
    title: 'Lucid — The Debugger That Explains Itself',
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      additionalArguments: filePath ? [`--initial-file=${filePath}`] : [],
    },
  })

  if (VITE_DEV_SERVER_URL) {
    w.loadURL(VITE_DEV_SERVER_URL)
  } else {
    w.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  return w
}

// ── Native application menu ───────────────────────────────────────────────────
// Adds "Open File" and "Open File in New Window" to the File menu.
// These trigger the native OS file picker and either populate the path bar
// in the current window, or spawn a fresh Lucid window with that file ready.

function buildMenu() {
  const isMac = process.platform === 'darwin'

  // Helper: show the OS file picker relative to a given BrowserWindow
  async function pickFile(targetWin: BrowserWindow): Promise<string | null> {
    const { canceled, filePaths } = await dialog.showOpenDialog(targetWin, {
      title:      'Open file to debug',
      properties: ['openFile'],
      filters: [
        { name: 'Debuggable files', extensions: ['py', 'js', 'ts', 'java', 'c', 'cpp', 'out', 'exe', ''] },
        { name: 'All files',        extensions: ['*'] },
      ],
    })
    return canceled || filePaths.length === 0 ? null : filePaths[0]
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    // ── File ──────────────────────────────────────────────────────────────────
    {
      label: 'File',
      submenu: [
        {
          label:       'Open File…',
          accelerator: isMac ? 'Cmd+O' : 'Ctrl+O',
          click: async (_item, focusedWindow) => {
            const target = (focusedWindow as BrowserWindow | undefined) ?? win
            if (!target) return
            const filePath = await pickFile(target)
            if (filePath) {
              // Send chosen path to the renderer so it populates the file bar
              target.webContents.send('app:fileSelected', filePath)
            }
          },
        },
        {
          label:       'Open File in New Window…',
          accelerator: isMac ? 'Cmd+Shift+O' : 'Ctrl+Shift+O',
          click: async (_item, focusedWindow) => {
            const source = (focusedWindow as BrowserWindow | undefined) ?? win
            if (!source) return
            const filePath = await pickFile(source)
            if (filePath) {
              createWindow(filePath)
            }
          },
        },
        { type: 'separator' },
        isMac
          ? { role: 'close' as const }
          : { label: 'Exit', role: 'quit' as const },
      ],
    },

    // ── Edit ──────────────────────────────────────────────────────────────────
    {
      label: 'Edit',
      submenu: [
        { role: 'undo'  as const },
        { role: 'redo'  as const },
        { type: 'separator' },
        { role: 'cut'   as const },
        { role: 'copy'  as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },

    // ── View ──────────────────────────────────────────────────────────────────
    {
      label: 'View',
      submenu: [
        { role: 'reload'         as const },
        { role: 'forceReload'    as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' },
        { role: 'togglefullscreen' as const },
      ],
    },

    // ── Window ────────────────────────────────────────────────────────────────
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom'     as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front'      as const },
        ] : []),
      ],
    },
  ]

  // macOS: prepend the app menu
  if (isMac) {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about'     as const },
        { type: 'separator' },
        { role: 'services'  as const },
        { type: 'separator' },
        { role: 'hide'      as const },
        { role: 'hideOthers' as const },
        { role: 'unhide'    as const },
        { type: 'separator' },
        { role: 'quit'      as const },
      ],
    })
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── IPC: file dialog (invoked by the renderer's folder-icon button) ───────────
// Returns the chosen path string, or null if cancelled.

function registerFileDialogHandler() {
  ipcMain.handle('app:relaunch', async () => {
    app.relaunch()
    app.exit(0)
    return { success: true }
  })

  ipcMain.handle('app:openFileDialog', async (event, args?: { openInNewWindow?: boolean }) => {
    const senderWin = BrowserWindow.fromWebContents(event.sender)
    if (!senderWin) return { canceled: true, filePath: null }

    const { canceled, filePaths } = await dialog.showOpenDialog(senderWin, {
      title:      'Open file to debug',
      properties: ['openFile'],
      filters: [
        { name: 'Debuggable files', extensions: ['py', 'js', 'ts', 'java', 'c', 'cpp', 'out', 'exe', ''] },
        { name: 'All files',        extensions: ['*'] },
      ],
    })

    if (canceled || filePaths.length === 0) return { canceled: true, filePath: null }

    const filePath = filePaths[0]

    if (args?.openInNewWindow) {
      createWindow(filePath)
      return { canceled: false, filePath, openedInNewWindow: true }
    }

    return { canceled: false, filePath }
  })
}

// ── Boot ──────────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (!process.env.DEE_BUGR_GROQ_KEY) {
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.warn('⚠  WARNING: DEE_BUGR_GROQ_KEY is not set.')
    console.warn('   AI features (Explain Bug, Suggest Fix, tooltips) will fail.')
    console.warn('   Get a free key at https://console.groq.com')
    console.warn('   Then add to your .env file:  DEE_BUGR_GROQ_KEY=gsk_...')
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } else {
    console.log('[Main] Groq API key found ✓')
  }

  buildMenu()
  registerFileDialogHandler()

  const { registerAllHandlers } = await import('../src/main/ipc/handlers')
  registerAllHandlers()

  win = createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) win = createWindow()
})
