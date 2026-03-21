"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  invoke: (channel, args) => electron.ipcRenderer.invoke(channel, args),
  on: (channel, callback) => {
    const handler = (_event, data) => callback(data);
    electron.ipcRenderer.on(channel, handler);
    return () => electron.ipcRenderer.removeListener(channel, handler);
  },
  off: (channel) => electron.ipcRenderer.removeAllListeners(channel)
});
