// ─── Pure helpers ─────────────────────────────────────────────────────────────

const MOOD_SCALE = [
  { emoji: '😞', label: 'Bad',     value: 1 },
  { emoji: '😐', label: 'Meh',     value: 2 },
  { emoji: '🙂', label: 'Okay',    value: 3 },
  { emoji: '😄', label: 'Good',    value: 4 },
  { emoji: '🚀', label: 'Amazing', value: 5 },
];

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function upsertEntry(log, entry) {
  const idx = log.findIndex(e => e.date === entry.date);
  if (idx !== -1) {
    const updated = [...log];
    updated[idx] = entry;
    return updated;
  }
  return [...log, entry];
}

function getEntryForDate(log, date) {
  return log.find(e => e.date === date);
}

function formatHistoryDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

// ─── DOM rendering ────────────────────────────────────────────────────────────

function renderHistory(log, historyEl) {
  historyEl.innerHTML = '';
  const recent = [...log]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  if (recent.length === 0) {
    historyEl.innerHTML = '<li class="mood-empty">No entries yet.</li>';
    return;
  }

  recent.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'mood-history-item';

    const left = document.createElement('span');
    left.className = 'mood-history-emoji';
    left.textContent = entry.emoji;

    const info = document.createElement('span');
    info.className = 'mood-history-info';

    const date = document.createElement('strong');
    date.textContent = formatHistoryDate(entry.date);

    const note = document.createElement('span');
    note.textContent = entry.note || '';

    info.append(date, note);
    li.append(left, info);
    historyEl.appendChild(li);
  });
}

// ─── Feature initialisation ──────────────────────────────────────────────────

function initMood() {
  const emojiButtons = document.querySelectorAll('.mood-emoji-btn');
  const noteInput    = document.getElementById('mood-note');
  const saveBtn      = document.getElementById('mood-save-btn');
  const historyEl    = document.getElementById('mood-history');
  const feedbackEl   = document.getElementById('mood-feedback');

  let selectedEmoji = null;

  // Build emoji picker buttons
  const pickerEl = document.getElementById('mood-picker');
  pickerEl.innerHTML = '';
  MOOD_SCALE.forEach(({ emoji, label }) => {
    const btn = document.createElement('button');
    btn.className = 'mood-emoji-btn';
    btn.dataset.emoji = emoji;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      pickerEl.querySelectorAll('.mood-emoji-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedEmoji = emoji;
    });
    pickerEl.appendChild(btn);
  });

  async function loadAndRender() {
    const log = await Storage.mood.getAll();
    renderHistory(log, historyEl);

    // Pre-fill today's entry if already logged
    const todayEntry = getEntryForDate(log, getTodayKey());
    if (todayEntry) {
      selectedEmoji = todayEntry.emoji;
      noteInput.value = todayEntry.note || '';
      pickerEl.querySelectorAll('.mood-emoji-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.emoji === todayEntry.emoji);
      });
    }
  }

  saveBtn.addEventListener('click', async () => {
    if (!selectedEmoji) {
      feedbackEl.textContent = 'Pick a mood first!';
      feedbackEl.className = 'mood-feedback mood-feedback--error';
      return;
    }
    const entry = {
      date:      getTodayKey(),
      emoji:     selectedEmoji,
      note:      noteInput.value.trim().slice(0, 140),
      timestamp: new Date().toISOString(),
    };
    await Storage.mood.save(entry);
    feedbackEl.textContent = 'Mood saved!';
    feedbackEl.className = 'mood-feedback mood-feedback--ok';
    await loadAndRender();
    setTimeout(() => { feedbackEl.textContent = ''; feedbackEl.className = 'mood-feedback'; }, 2000);
  });

  loadAndRender();
}
