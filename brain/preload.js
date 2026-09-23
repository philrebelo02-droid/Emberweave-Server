// Emberweave Brain - preload bridge.
// Exposes window controls to the UI (contextIsolation stays ON).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ewbControls', {
  isElectron: true,
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close:    () => ipcRenderer.send('win:close'),
});
