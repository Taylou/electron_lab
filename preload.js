const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  notes: {
    getAll: ()      => ipcRenderer.invoke('notes:getAll'),
    save:   (notes) => ipcRenderer.invoke('notes:save', notes),
  },
  mood: {
    getAll: ()      => ipcRenderer.invoke('mood:getAll'),
    save:   (entry) => ipcRenderer.invoke('mood:save', entry),
  },
  pomodoro: {
    notify: (message) => ipcRenderer.send('pomodoro:notify', message),
  },
  sessions: {
    getAll: ()        => ipcRenderer.invoke('sessions:getAll'),
    add:    (session) => ipcRenderer.invoke('sessions:add', session),
  },
  access: {
    getAll:   ()  => ipcRenderer.invoke('access:getAll'),
    logToday: ()  => ipcRenderer.invoke('access:logToday'),
  },
});
