// ─── Notification helpers ─────────────────────────────────────────────────────

// In Electron: routes through IPC → main process → native OS notification.
// In browser (GitHub Pages): falls back to the Web Notifications API.
function notify(title, body) {
  if ('electronAPI' in window && window['electronAPI'].pomodoro) {
    // Electron path — title is handled by the main process constant,
    // so we send the descriptive body as the message.
    window['electronAPI'].pomodoro.notify(body);
    return;
  }
  // Browser fallback (GitHub Pages)
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

function requestNotifyPermission() {
  // Only needed for the browser fallback — Electron handles permission natively.
  if (!('electronAPI' in window) && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const POMODORO_PHASES = { IDLE: 'idle', WORK: 'work', BREAK: 'break' };
const WORK_SECONDS  = 25 * 60;
const BREAK_SECONDS = 5  * 60;
const RING_RADIUS   = 90;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 565.5

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function getProgress(remaining, total) {
  return total === 0 ? 0 : remaining / total;
}

function getStrokeDashoffset(progress) {
  return RING_CIRCUMFERENCE * (1 - progress);
}

// ─── Feature initialisation ──────────────────────────────────────────────────

function initPomodoro() {
  const displayEl  = document.getElementById('pomodoro-time');
  const ringEl     = document.getElementById('pomodoro-ring');
  const phaseEl    = document.getElementById('pomodoro-phase');
  const startWorkBtn  = document.getElementById('pomodoro-start-work');
  const startBreakBtn = document.getElementById('pomodoro-start-break');
  const resetBtn      = document.getElementById('pomodoro-reset');

  // Set SVG ring geometry
  ringEl.setAttribute('r',  RING_RADIUS);
  ringEl.setAttribute('stroke-dasharray', RING_CIRCUMFERENCE);

  let state = {
    phase:      POMODORO_PHASES.IDLE,
    remaining:  WORK_SECONDS,
    total:      WORK_SECONDS,
    intervalId: null,
    startedAt:  null,   // ISO string set when a work phase begins
  };

  function render() {
    displayEl.textContent = formatTime(state.remaining);
    const progress = getProgress(state.remaining, state.total);
    ringEl.setAttribute('stroke-dashoffset', getStrokeDashoffset(progress));

    // Phase label + ring colour via CSS class
    const section = document.getElementById('pomodoro');
    section.dataset.phase = state.phase;

    const labels = {
      [POMODORO_PHASES.IDLE]:  'Ready',
      [POMODORO_PHASES.WORK]:  'Focus',
      [POMODORO_PHASES.BREAK]: 'Break',
    };
    phaseEl.textContent = labels[state.phase];

    startWorkBtn.disabled  = state.phase === POMODORO_PHASES.WORK;
    startBreakBtn.disabled = state.phase === POMODORO_PHASES.BREAK;
  }

  function clearTimer() {
    if (state.intervalId !== null) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
  }

  function startCountdown() {
    clearTimer();
    state.intervalId = setInterval(() => {
      state.remaining -= 1;

      // Notifications
      if (state.phase === POMODORO_PHASES.WORK && state.remaining === 0) {
        notify('Break time!', "You've earned it. Take 5 minutes.");
      }
      if (state.phase === POMODORO_PHASES.BREAK && state.remaining === 60) {
        notify('1 minute left', 'Break ends soon — start wrapping up.');
      }
      if (state.phase === POMODORO_PHASES.BREAK && state.remaining === 0) {
        notify('Break over!', 'Time to focus again.');
      }

      if (state.remaining <= 0) {
        state.remaining = 0;
        clearTimer();
        // Auto-switch phase
        if (state.phase === POMODORO_PHASES.WORK) {
          // Record the completed work session before switching phase
          Storage.sessions.add({
            id:              Date.now().toString(36) + Math.random().toString(36).slice(2),
            date:            new Date().toISOString().slice(0, 10),
            startedAt:       state.startedAt,
            completedAt:     new Date().toISOString(),
            durationMinutes: 25,
            type:            'work',
          }); // fire-and-forget — no await needed
          state.phase     = POMODORO_PHASES.BREAK;
          state.remaining = BREAK_SECONDS;
          state.total     = BREAK_SECONDS;
          startCountdown();
        } else {
          state.phase     = POMODORO_PHASES.IDLE;
          state.remaining = WORK_SECONDS;
          state.total     = WORK_SECONDS;
        }
      }
      render();
    }, 1000);
  }

  startWorkBtn.addEventListener('click', () => {
    requestNotifyPermission();
    clearTimer();
    state.phase     = POMODORO_PHASES.WORK;
    state.remaining = WORK_SECONDS;
    state.total     = WORK_SECONDS;
    state.startedAt = new Date().toISOString();
    startCountdown();
    render();
  });

  startBreakBtn.addEventListener('click', () => {
    clearTimer();
    state.phase     = POMODORO_PHASES.BREAK;
    state.remaining = BREAK_SECONDS;
    state.total     = BREAK_SECONDS;
    startCountdown();
    render();
  });

  resetBtn.addEventListener('click', () => {
    clearTimer();
    state.phase     = POMODORO_PHASES.IDLE;
    state.remaining = WORK_SECONDS;
    state.total     = WORK_SECONDS;
    render();
  });

  // Test button — fires a notification immediately so you can verify
  // the notification pipeline works without waiting 25 minutes.
  document.getElementById('pomodoro-test-notify').addEventListener('click', () => {
    requestNotifyPermission();
    notify('Pomodoro Timer', 'Notifications are working!');
  });

  render(); // initial paint
}
