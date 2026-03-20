"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  invoke: (channel, args) => electron.ipcRenderer.invoke(channel, args),
  on: (channel, callback) => {
    const handler = (_event, data) => callback(data);
    electron.ipcRenderer.on(channel, handler);
    return () => electron.ipcRenderer.removeListener(channel, handler);
  },
  once: (channel, callback) => {
    electron.ipcRenderer.once(channel, (_event, data) => callback(data));
  },
  off: (channel) => {
    electron.ipcRenderer.removeAllListeners(channel);
  }
});
