const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

// ─── File-based store (swap body for DB calls later) ──────────────────────────

function getStorePath(name) {
  return path.join(app.getPath('userData'), `${name}.json`);
}

function readStore(name) {
  try {
    return JSON.parse(fs.readFileSync(getStorePath(name), 'utf8'));
  } catch {
    return [];
  }
}

function writeStore(name, data) {
  fs.writeFileSync(getStorePath(name), JSON.stringify(data, null, 2), 'utf8');
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('notes:getAll', () => readStore('notes'));
ipcMain.handle('notes:save',   (_, notes) => writeStore('notes', notes));

ipcMain.handle('mood:getAll', () => readStore('mood'));
ipcMain.handle('mood:save',   (_, entry) => {
  const log = readStore('mood');
  const idx = log.findIndex(e => e.date === entry.date);
  if (idx !== -1) {
    log[idx] = entry;
  } else {
    log.push(entry);
  }
  writeStore('mood', log);
});

ipcMain.handle('sessions:getAll', () => readStore('sessions'));
ipcMain.handle('sessions:add',    (_, session) => {
  const sessions = readStore('sessions');
  sessions.push(session);
  writeStore('sessions', sessions);
});

ipcMain.handle('access:getAll',   () => readStore('access'));
ipcMain.handle('access:logToday', () => {
  const today = new Date().toISOString().slice(0, 10);
  const log   = readStore('access');
  if (!log.some(e => e.date === today)) {
    log.push({ date: today });
    writeStore('access', log);
  }
});

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile('index.html');

  // Auto-open DevTools when running in development (not when packaged/distributed).
  // This lets you see console errors immediately — close it once everything works.
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  // Required on Windows: without this, Notification.show() silently does nothing.
  app.setAppUserModelId(app.name);

  // Pomodoro notification handler — registered after app is ready so
  // Notification.isSupported() is reliable.
  ipcMain.on('pomodoro:notify', (_, message) => {
    if (Notification.isSupported()) {
      new Notification({ title: 'Pomodoro Timer', body: message }).show();
    }
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
