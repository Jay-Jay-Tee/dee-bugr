import { app, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path__default from "node:path";
createRequire(import.meta.url);
const __dirname$1 = path__default.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path__default.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path__default.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path__default.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path__default.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path__default.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path__default.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path__default.join(RENDERER_DIST, "index.html"));
  }
}
app.whenReady().then(async () => {
  const { registerAllHandlers } = await import("./handlers-B0pvk-wM.js");
  registerAllHandlers();
  createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
