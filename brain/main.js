const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const BRAIN_URL = 'http://localhost:7777';
const HERE = __dirname;
let win = null;
let tray = null;
const children = [];

// SINGLE INSTANCE: a second launch focuses the existing brain instead of
// spawning a duplicate window + duplicate engine.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { win.show(); win.focus(); } else createWindow();
  });
}

function startHidden(cmd, args) {
  try {
    const p = spawn(cmd, args, { windowsHide: true, cwd: HERE, stdio: 'ignore' });
    p.on('error', () => {}); // e.g. ollama already serving - fine
    children.push(p);
  } catch (e) { /* keep going */ }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 720,
    minHeight: 540,
    title: 'Emberweave Brain',
    icon: path.join(HERE, 'brain.ico'),
    frame: false,                      // her own titlebar - styled to match the UI
    backgroundColor: '#12100e',
    webPreferences: { contextIsolation: true, preload: path.join(HERE, 'preload.js') }
  });
  win.loadURL(BRAIN_URL + '/?v=' + Date.now());   // cache-buster: window always loads the freshest UI
  win.on('close', (e) => {
    // hide to tray instead of dying - she keeps thinking in the background
    if (!app.isQuitting) { e.preventDefault(); win.hide(); }
  });
}

ipcMain.on('win:minimize', () => { if (win) win.minimize(); });
ipcMain.on('win:maximize', () => { if (win) { if (win.isMaximized()) win.unmaximize(); else win.maximize(); } });
ipcMain.on('win:close', () => { if (win) win.close(); });  // prevented -> hides to tray

function quitAll() {
  app.isQuitting = true;
  children.forEach(p => { try { p.kill(); } catch (e) {} });
  app.quit();
}

function engineAlive(cb) {
  const req = http.get(BRAIN_URL + '/api/status', { timeout: 1500 }, (res) => { cb(true); res.resume(); });
  req.on('error', () => cb(false));
  req.on('timeout', () => { req.destroy(); cb(false); });
}

app.whenReady().then(() => {
  if (!gotLock) return;   // duplicate launch: quit already requested, do nothing
  // 1. local model service (headless)
  startHidden('C:\\Users\\Home\\AppData\\Local\\Programs\\Ollama\\ollama.exe', ['serve']);
  // 2. brain engine (pythonw) - but never a second one
  engineAlive((alive) => {
    if (alive) return;
    startHidden('C:\\Users\\Home\\AppData\\Roaming\\kimi-desktop\\daimon-share\\daimon\\runtime\\python\\.venv\\Scripts\\pythonw.exe',
      [path.join(HERE, 'app.py')]);
  });

  // 3. system tray - she lives down by the clock
  tray = new Tray(path.join(HERE, 'icon16.png'));
  tray.setToolTip('Emberweave Brain');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Emberweave Brain', click: () => { if (win) { win.show(); win.focus(); } else createWindow(); } },
    { type: 'separator' },
    { label: 'Quit Brain (stops engine)', click: quitAll }
  ]));
  tray.on('double-click', () => { if (win) { win.show(); win.focus(); } else createWindow(); });

  // 4. give the engine a few seconds, then open her window
  setTimeout(createWindow, 9000);

  app.on('activate', () => { if (!win) createWindow(); else win.show(); });
});
