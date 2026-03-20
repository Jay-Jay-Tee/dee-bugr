import { app, BrowserWindow } from 'electron'
import * as path from 'node:path'
import { registerAllHandlers } from './ipc/handlers'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      // Point to your preload script
      preload: path.join(__dirname, '../preload/preload.js'),
      // SECURITY: never enable nodeIntegration in renderer
      nodeIntegration: false,
      contextIsolation: true,
    }
  })

  // In dev, load Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

await app.whenReady()
// Register all IPC handlers BEFORE creating the window
registerAllHandlers()
createWindow()

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})