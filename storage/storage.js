// Storage provider — detects Electron vs browser at runtime.
// All methods are async so the interface is identical when a DB is added.
// To swap in a DB: only the IPC handler bodies in index.js need to change.

const Storage = (() => {
  const isElectron = () =>
    typeof window !== 'undefined' &&
    typeof window.electronAPI !== 'undefined';

  // ── Electron provider (IPC → main process → file/DB) ─────────────────────
  const electronProvider = {
    notes: {
      getAll: ()      => window.electronAPI.notes.getAll(),
      save:   (notes) => window.electronAPI.notes.save(notes),
    },
    mood: {
      getAll: ()      => window.electronAPI.mood.getAll(),
      save:   (entry) => window.electronAPI.mood.save(entry),
    },
    sessions: {
      getAll: ()        => window.electronAPI.sessions.getAll(),
      add:    (session) => window.electronAPI.sessions.add(session),
    },
    access: {
      getAll:   ()  => window.electronAPI.access.getAll(),
      logToday: ()  => window.electronAPI.access.logToday(),
    },
  };

  // ── localStorage provider (GitHub Pages / browser fallback) ───────────────
  const localProvider = {
    notes: {
      getAll: () =>
        Promise.resolve(JSON.parse(localStorage.getItem('notes') || '[]')),
      save: (notes) => {
        localStorage.setItem('notes', JSON.stringify(notes));
        return Promise.resolve();
      },
    },
    mood: {
      getAll: () =>
        Promise.resolve(JSON.parse(localStorage.getItem('mood') || '[]')),
      save: (entry) => {
        const log = JSON.parse(localStorage.getItem('mood') || '[]');
        const idx = log.findIndex(e => e.date === entry.date);
        if (idx !== -1) {
          log[idx] = entry;
        } else {
          log.push(entry);
        }
        localStorage.setItem('mood', JSON.stringify(log));
        return Promise.resolve();
      },
    },
    sessions: {
      getAll: () =>
        Promise.resolve(JSON.parse(localStorage.getItem('sessions') || '[]')),
      add: (session) => {
        const sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
        sessions.push(session);
        localStorage.setItem('sessions', JSON.stringify(sessions));
        return Promise.resolve();
      },
    },
    access: {
      getAll: () =>
        Promise.resolve(JSON.parse(localStorage.getItem('access') || '[]')),
      logToday: () => {
        const today = new Date().toISOString().slice(0, 10);
        const log   = JSON.parse(localStorage.getItem('access') || '[]');
        if (!log.some(e => e.date === today)) {
          log.push({ date: today });
          localStorage.setItem('access', JSON.stringify(log));
        }
        return Promise.resolve();
      },
    },
  };

  return isElectron() ? electronProvider : localProvider;
})();
