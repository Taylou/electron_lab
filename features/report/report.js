// ─── Report feature ───────────────────────────────────────────────────────────
//
// This file follows the same structure as notes.js and mood.js:
//   1. Pure helper functions  (no DOM, no network)
//   2. Rendering functions    (write to DOM, read nothing else)
//   3. initReport()           (wires everything together)
//
// Data comes from two new stores:
//   sessions — completed 25-min Pomodoro work sessions
//   access   — one entry per calendar day the app was opened

// ─── Ranking tiers ────────────────────────────────────────────────────────────

const RANK_TIERS = [
  { title: 'Beginner',    minHours: 0,   emoji: '🌱' },
  { title: 'Apprentice',  minHours: 5,   emoji: '⚡' },
  { title: 'Journeyman',  minHours: 15,  emoji: '🔥' },
  { title: 'Expert',      minHours: 30,  emoji: '💎' },
  { title: 'Master',      minHours: 60,  emoji: '🏆' },
  { title: 'Grandmaster', minHours: 100, emoji: '👑' },
];

// ─── Pure stat helpers ────────────────────────────────────────────────────────

function calcHoursFocused(sessions) {
  const totalMinutes = sessions
    .filter(s => s.type === 'work')
    .reduce((sum, s) => sum + (s.durationMinutes || 25), 0);
  return Math.round((totalMinutes / 60) * 10) / 10; // 1 decimal place
}

function calcDaysAccessed(accessLog) {
  return new Set(accessLog.map(e => e.date)).size;
}

function calcStreak(sessions) {
  // Build a Set of unique YYYY-MM-DD dates that have work sessions
  const sessionDates = new Set(
    sessions.filter(s => s.type === 'work').map(s => s.date)
  );

  if (sessionDates.size === 0) return 0;

  // Walk backward from today. If today has no session yet, start from yesterday
  // so partial days don't break an active streak.
  const todayStr = new Date().toISOString().slice(0, 10);
  const cursor   = new Date();
  if (!sessionDates.has(todayStr)) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (true) {
    const dateStr = cursor.toISOString().slice(0, 10);
    if (!sessionDates.has(dateStr)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Returns 7 { label, minutes } buckets for a given week.
 * offset 0 = current week (Mon–Sun), -1 = last week, etc.
 */
function getWeekBuckets(sessions, offset) {
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Find Monday of the target week
  const now    = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mon … 6=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + offset * 7);
  monday.setHours(0, 0, 0, 0);

  return DAY_LABELS.map((label, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dateStr = day.toISOString().slice(0, 10);

    const minutes = sessions
      .filter(s => s.type === 'work' && s.date === dateStr)
      .reduce((sum, s) => sum + (s.durationMinutes || 25), 0);

    return { label, minutes };
  });
}

/**
 * Returns weekly buckets for a given month.
 * offset 0 = current month, -1 = last month, etc.
 * Each bucket covers Mon–Sun and is labelled 'Wk1', 'Wk2', etc.
 */
function getMonthBuckets(sessions, offset) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year   = target.getFullYear();
  const month  = target.getMonth();

  // First and last day of the target month
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);

  // Find Monday on or before the first day
  const startMonday = new Date(firstDay);
  startMonday.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7));

  const buckets = [];
  let weekNum   = 1;
  let cursor    = new Date(startMonday);

  while (cursor <= lastDay) {
    const weekStart = new Date(cursor);
    const weekEnd   = new Date(cursor);
    weekEnd.setDate(cursor.getDate() + 6);

    let minutes = 0;
    for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      minutes += sessions
        .filter(s => s.type === 'work' && s.date === ds)
        .reduce((sum, s) => sum + (s.durationMinutes || 25), 0);
    }

    buckets.push({ label: `Wk${weekNum}`, minutes });
    weekNum++;
    cursor.setDate(cursor.getDate() + 7);
  }

  return buckets;
}

/**
 * Returns a human-readable label for the current chart period.
 * e.g. "Apr 14 – Apr 20"  or  "April 2026"
 */
function getPeriodLabel(mode, offset) {
  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];
  const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                        'Jul','Aug','Sep','Oct','Nov','Dec'];

  if (mode === 'week') {
    const now       = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7;
    const monday    = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + offset * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fmt = d => `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
    return offset === 0
      ? `This Week (${fmt(monday)} – ${fmt(sunday)})`
      : `${fmt(monday)} – ${fmt(sunday)}`;
  } else {
    const now    = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return offset === 0
      ? `This Month (${MONTH_NAMES[target.getMonth()]} ${target.getFullYear()})`
      : `${MONTH_NAMES[target.getMonth()]} ${target.getFullYear()}`;
  }
}

function getRankTier(hoursFocused) {
  // Find the highest tier the user has reached
  let current = RANK_TIERS[0];
  for (const tier of RANK_TIERS) {
    if (hoursFocused >= tier.minHours) current = tier;
  }

  const currentIdx = RANK_TIERS.indexOf(current);
  const isMax      = currentIdx === RANK_TIERS.length - 1;
  const next       = isMax ? null : RANK_TIERS[currentIdx + 1];

  let progressPct  = 100;
  let hoursToNext  = 0;

  if (!isMax) {
    const range     = next.minHours - current.minHours;
    const earned    = hoursFocused  - current.minHours;
    progressPct     = Math.min(100, Math.round((earned / range) * 100));
    hoursToNext     = Math.ceil(next.minHours - hoursFocused);
  }

  return { current, next, progressPct, hoursToNext, isMax };
}

// ─── Rendering helpers ────────────────────────────────────────────────────────

function renderStatCards(hours, days, streak) {
  document.getElementById('report-hours').textContent  = hours;
  document.getElementById('report-days').textContent   = days;
  document.getElementById('report-streak').textContent = streak;
}

function renderDetailList(sessions) {
  const list = document.getElementById('report-session-list');
  list.innerHTML = '';

  const workSessions = sessions
    .filter(s => s.type === 'work')
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  if (workSessions.length === 0) {
    const li = document.createElement('li');
    li.className   = 'report-empty';
    li.textContent = 'No completed sessions yet. Finish a Pomodoro to see it here!';
    list.appendChild(li);
    return;
  }

  workSessions.forEach(s => {
    const start = new Date(s.startedAt);
    const end   = new Date(s.completedAt);

    const fmt = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateLabel = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

    const li = document.createElement('li');
    li.className = 'report-session-item';
    li.innerHTML = `
      <span class="report-session-date">${dateLabel}</span>
      <span class="report-session-time">${fmt(start)} → ${fmt(end)}</span>
      <span class="report-session-badge">${s.durationMinutes || 25} min</span>
    `;
    list.appendChild(li);
  });
}

function renderRanking(hoursFocused) {
  const container = document.getElementById('report-rank-container');
  const rank      = getRankTier(hoursFocused);

  container.innerHTML = `
    <div class="report-rank-badge">
      <span class="report-rank-emoji">${rank.current.emoji}</span>
      <span class="report-rank-title">${rank.current.title}</span>
      <span class="report-rank-hours">${hoursFocused} hours focused</span>
    </div>
    <div class="report-rank-progress-wrapper">
      <div class="report-rank-progress-bar-bg">
        <div class="report-rank-progress-bar-fill" style="width: ${rank.progressPct}%"></div>
      </div>
      <p class="report-rank-next">
        ${rank.isMax
          ? '🎉 Maximum rank achieved!'
          : `${rank.hoursToNext} more hour${rank.hoursToNext === 1 ? '' : 's'} to reach <strong>${rank.next.title}</strong>`}
      </p>
    </div>
  `;
}

// ─── Feature initialisation ──────────────────────────────────────────────────

async function initReport() {
  // ── Fetch data ─────────────────────────────────────────────────────────────
  const [sessions, accessLog] = await Promise.all([
    Storage.sessions.getAll(),
    Storage.access.getAll(),
  ]);

  // ── Compute stats ──────────────────────────────────────────────────────────
  const hours  = calcHoursFocused(sessions);
  const days   = calcDaysAccessed(accessLog);
  const streak = calcStreak(sessions);

  // ── Render stat cards (always visible, above sub-tabs) ────────────────────
  renderStatCards(hours, days, streak);

  // ── Sub-tab switching ──────────────────────────────────────────────────────
  document.querySelectorAll('.report-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.report-subtab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.report-subpanel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.subtab).classList.add('active');

      // If switching to Summary, redraw chart in case it was sized at 0px
      if (btn.dataset.subtab === 'report-summary') {
        requestAnimationFrame(redrawChart);
      }
    });
  });

  // ── Chart state + controls ─────────────────────────────────────────────────
  const chartState = { mode: 'week', offset: 0 };
  const canvas     = document.getElementById('report-chart');
  const labelEl    = document.getElementById('report-period-label');
  const prevBtn    = document.getElementById('report-prev');
  const nextBtn    = document.getElementById('report-next');

  function redrawChart() {
    const buckets = chartState.mode === 'week'
      ? getWeekBuckets(sessions, chartState.offset)
      : getMonthBuckets(sessions, chartState.offset);

    labelEl.textContent    = getPeriodLabel(chartState.mode, chartState.offset);
    nextBtn.disabled       = chartState.offset === 0;
    drawBarChart(canvas, buckets);
  }

  // Mode toggle (Week / Month)
  document.querySelectorAll('.report-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.report-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      chartState.mode   = btn.dataset.mode;
      chartState.offset = 0;
      redrawChart();
    });
  });

  // Previous / Next period
  prevBtn.addEventListener('click', () => {
    chartState.offset--;
    redrawChart();
  });
  nextBtn.addEventListener('click', () => {
    if (chartState.offset < 0) {
      chartState.offset++;
      redrawChart();
    }
  });

  // ── Render detail + ranking panels ────────────────────────────────────────
  renderDetailList(sessions);
  renderRanking(hours);

  // ── Redraw chart when the Report main tab becomes visible ─────────────────
  // The canvas reports clientWidth = 0 while its parent panel is hidden
  // (display: none).  We defer the first draw to when the tab is clicked.
  document.querySelector('[data-tab="report"]').addEventListener('click', () => {
    requestAnimationFrame(redrawChart);
  });

  // Initial draw (only paints if the report panel happens to be visible on load)
  requestAnimationFrame(redrawChart);
}
