╔══════════════════════════════════════════════════════════════╗
║        PRODUCTIVITY DASHBOARD 2.0                ║
║        Part 2: Report Tab, Packaging & Distribution          ║
╚══════════════════════════════════════════════════════════════╝

This guide continues from where the original ReadMe_First.md left off.
Each step explains WHAT was changed, WHERE it lives in the code,
and WHY we made that specific decision.  Read every step in order
the first time — each one builds on the one before it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### STEP 12 — WHAT DATA DOES A "SESSION" HOLD?
──────────────────────────────────────────

Before writing any code, we need to decide what information to
save whenever the user finishes a 25-minute Pomodoro.

We settled on this shape (stored as a JSON object):

  {
    "id":              "lc2kxq4r7f2",   ← unique identifier
    "date":            "2026-04-16",     ← YYYY-MM-DD (for grouping)
    "startedAt":       "2026-04-16T09:00:00.000Z",
    "completedAt":     "2026-04-16T09:25:00.000Z",
    "durationMinutes": 25,
    "type":            "work"
  }

Why each field?

  id            Every record needs a unique key so we can tell
                records apart.  We build it from the current
                timestamp + a random number, converted to
                base-36 (A–Z, 0–9).  This is smaller than a
                full UUID but still unique enough for a local app.

  date          Storing "2026-04-16" separately from the full
                timestamps lets us group sessions by day without
                any date-math at query time.

  startedAt /   ISO 8601 strings.  We capture both so we can
  completedAt   display the "9:00 AM → 9:25 AM" range in the
                Detail view.

  durationMinutes  Always 25 for a work session.  Kept as a
                   field (not hard-coded in queries) so the app
                   can support custom durations in the future.

  type          "work" vs "break".  Right now we only save
                completed work sessions, but keeping the field
                means we could log breaks later without changing
                the data shape.

Where does the data live?
  File: sessions.json  inside  app.getPath('userData')
  e.g. C:\Users\YourName\AppData\Roaming\productivity-dashboard\

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### STEP 13 — RECORDING SESSIONS INSIDE POMODORO.JS
────────────────────────────────────────────────

File: features/pomodoro/pomodoro.js

Three small changes were made:

  1. Added startedAt to the timer state object

     let state = {
       phase:      ...,
       remaining:  ...,
       total:      ...,
       intervalId: null,
       startedAt:  null,   ← NEW
     };

     "startedAt" is null until the user clicks "Start Focus".
     It gets set to the current ISO timestamp at that moment.

  2. Set startedAt when the work phase begins

     startWorkBtn.addEventListener('click', () => {
       ...
       state.startedAt = new Date().toISOString();  ← NEW
       startCountdown();
     });

  3. Save the session when the countdown reaches zero

     Inside startCountdown(), when remaining hits 0 and the
     current phase is WORK:

       Storage.sessions.add({
         id:              Date.now().toString(36) + Math.random()...,
         date:            new Date().toISOString().slice(0, 10),
         startedAt:       state.startedAt,
         completedAt:     new Date().toISOString(),
         durationMinutes: 25,
         type:            'work',
       });

Key design decision — "fire and forget"
  Notice there is NO "await" before Storage.sessions.add().
  This is intentional.  Saving to disk is async (takes a few
  milliseconds).  We do not want the timer to pause or stutter
  while waiting for the file write.  The save happens in the
  background; if it fails the user loses one session record —
  not catastrophic.

Key design decision — only COMPLETED sessions count
  We save inside the "if remaining === 0 and phase === WORK"
  block.  Clicking Reset or manually starting a Break does NOT
  save.  This keeps the data honest: a session only counts if
  the student actually sat through the full 25 minutes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### STEP 14 — TRACKING WHICH DAYS THE APP WAS OPENED
──────────────────────────────────────────────────

File: storage/access.json  (new)
File: renderer.js           (one new line)
File: index.js              (two new IPC handlers)

"Days accessed" in the Report tab shows how many unique calendar
days the student has opened the app — even if they didn't start
any sessions that day.

The access log is a simple array of date strings:
  [ { "date": "2026-04-14" },
    { "date": "2026-04-15" },
    { "date": "2026-04-16" } ]

Idempotency — why it's safe to call logToday() many times
  "Idempotent" means: calling the function once produces the
  same result as calling it ten times.  Our logToday() handler
  checks whether today's date is already in the array before
  adding it:

    if (!log.some(e => e.date === today)) {
      log.push({ date: today });
      writeStore('access', log);
    }

  This means even if the student closes and reopens the app
  five times on the same day, the log still only gains one
  entry.

Where is logToday() called?
  In renderer.js, after all the feature inits:

    Storage.access.logToday();

  Why the renderer and not main process (index.js)?
  The renderer represents the user's session — it runs once
  per window load.  Triggering the log from here naturally
  means "the user has opened and is looking at the app".
  The main process would fire even during background rebuilds.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### STEP 15 — EXTENDING THE STORAGE PROVIDER PATTERN
──────────────────────────────────────────────────

Files: index.js, preload.js, storage/storage.js

The app already had a "provider pattern" for notes and mood.
The pattern works like a power adapter: the same interface
(getAll, save) works whether you plug into Electron's file
system or a browser's localStorage.

We added two new stores (sessions + access) by repeating the
same three-step extension in each layer:

  Layer 1 — index.js (main process)
    Add ipcMain.handle() calls for the four new channels:
      sessions:getAll, sessions:add,
      access:getAll,   access:logToday

  Layer 2 — preload.js (security bridge)
    Add two new namespaces to contextBridge.exposeInMainWorld():
      sessions: { getAll, add }
      access:   { getAll, logToday }

  Layer 3 — storage/storage.js (provider abstraction)
    Add sessions + access to BOTH providers:
      • electronProvider  →  calls window.electronAPI.*
      • localProvider     →  reads/writes localStorage

Why must BOTH providers be updated?
  The app works in two environments:
    1. Electron desktop app (uses IPC + JSON files)
    2. Browser / GitHub Pages (uses localStorage)
  If we only updated the Electron provider, the app would
  crash silently when opened in a browser — Storage.sessions
  would be undefined.  Both providers must always stay in sync.

All four new IPC channel names follow the existing convention:
  "feature:action"  e.g.  "sessions:add"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### STEP 16 — THE REPORT TAB HTML STRUCTURE
────────────────────────────────────────

File: index.html

Two levels of tabs
  The app already has a main tab bar (Notes / Mood / Pomodoro).
  The Report tab adds a SECOND level of tabs inside it:
  Summary / Detail / Ranking.

  Main tabs use:   data-tab="report"
  Sub-tabs use:    data-subtab="report-summary"

  This naming makes it easy to handle both tab systems with
  separate JavaScript without them interfering with each other.

The three sub-panels are plain <div> elements:
  <div id="report-summary" class="report-subpanel active">
  <div id="report-detail"  class="report-subpanel">
  <div id="report-ranking" class="report-subpanel">

CSS controls visibility:
  .report-subpanel        { display: none; }
  .report-subpanel.active { display: flex; }

Toggling is done by JavaScript:
  - Remove "active" class from all panels
  - Add "active" to the one matching the clicked button's
    data-subtab attribute

Script load order matters
  chart.js must load before report.js (report.js calls
  drawBarChart which is defined in chart.js).  Both must load
  before renderer.js (which calls initReport()).

  Correct order at the bottom of index.html:
    storage.js → notes.js → mood.js → pomodoro.js
    → chart.js → report.js → renderer.js

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### STEP 17 — PURE STAT FUNCTIONS (HOW THE NUMBERS ARE COMPUTED)
──────────────────────────────────────────────────────────────

File: features/report/report.js

A "pure function" has no side effects: it reads its arguments
and returns a value, touching nothing else.  This makes them
easy to test and reason about.

  calcHoursFocused(sessions)
    Filter for type === 'work', sum durationMinutes, divide
    by 60, round to one decimal.
    e.g. 3 sessions × 25 min = 75 min = 1.3 hours

  calcDaysAccessed(accessLog)
    Count unique date strings using JavaScript's Set:
      new Set(accessLog.map(e => e.date)).size

  calcStreak(sessions) — the trickiest one
    Goal: how many consecutive days (ending today) had at
    least one completed work session?

    Algorithm:
      1. Build a Set of unique session dates
      2. Start the cursor at today
      3. If today has no session, move cursor to yesterday
         (allows a streak to remain alive while the student
         hasn't finished a session yet today)
      4. While the cursor date is in the Set:
           streak++
           move cursor back one day
      5. Return streak

    Example (today = Apr 16):
      Sessions on: Apr 14, Apr 15  →  streak = 2
      Sessions on: Apr 14 only     →  streak = 0 (gap on Apr 15)

  getWeekBuckets(sessions, offset)
    offset=0 → current week (Mon–Sun)
    offset=-1 → last week, etc.

    Steps:
      1. Find this week's Monday using JS Date arithmetic
      2. For each of the 7 days, filter sessions by date and
         sum their durationMinutes
      3. Return 7 { label: 'Mon', minutes: N } objects

  getMonthBuckets(sessions, offset)
    Groups sessions into calendar weeks (Wk1, Wk2, …) within
    the target month.  Partial weeks at month boundaries are
    included so no sessions are lost.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### STEP 18 — THE CANVAS BAR CHART
────────────────────────────────

File: features/report/chart.js

Why Canvas instead of a charting library like Chart.js?
  The Content-Security-Policy (CSP) in index.html contains:
    script-src 'self'
  This blocks any script that does not come from the app's own
  files — including CDN-hosted libraries.
  The HTML <canvas> element with its built-in 2D drawing API
  is available in every browser with no external dependency.

The Canvas coordinate system
  Unlike maths, the Y axis points DOWNWARD.
    (0, 0) is the top-left corner.
    Increasing Y moves DOWN the screen.
  To draw a bar that reaches from the X axis UP to a height H:
    barY = paddingTop + chartHeight - barHeight

The devicePixelRatio fix
  On a Retina or HiDPI display the browser maps 2 (or more)
  physical pixels to every CSS pixel.  If we set canvas.width
  to the CSS width, each "pixel" we draw maps to a 2×2 physical
  pixel block, making the chart look blurry.
  Fix:
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = canvas.clientWidth  * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);  // now draw using CSS coordinates

Redrawing when the tab becomes visible
  While a panel has display:none its canvas.clientWidth is 0.
  Drawing into a zero-width canvas produces nothing.
  Solution: listen for the Report tab button click and defer
  the first draw by one animation frame:

    document.querySelector('[data-tab="report"]')
      .addEventListener('click', () => {
        requestAnimationFrame(redrawChart);
      });

  requestAnimationFrame() waits until the browser has applied
  the display:flex CSS before our code runs.

Bar width formula
  slotW  = chartWidth / buckets.length   ← space per bucket
  barW   = slotW * 0.55                  ← bar takes 55%
  gap    = (slotW - barW) / 2            ← centre the bar
  barX   = paddingLeft + i * slotW + gap

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### STEP 19 — THE RANKING SYSTEM
──────────────────────────────

File: features/report/report.js

Seeing "🔥 Journeyman — 8 hours to Expert" is more
motivating than "you have 22 hours focused".

The six tiers (stored as a constant array):

  🌱 Beginner      —   0 hours  (starting point)
  ⚡ Apprentice    —   5 hours
  🔥 Journeyman    —  15 hours
  💎 Expert        —  30 hours
  🏆 Master        —  60 hours
  👑 Grandmaster   — 100 hours

getRankTier(hoursFocused) algorithm:
  1. Start with the lowest tier (Beginner)
  2. Walk through the array; if hoursFocused >= tier.minHours,
     update "current" to that tier
  3. After the loop, "current" is the highest tier reached
  4. The next tier is the one immediately above in the array

Progress percentage formula:
  If the student is between Journeyman (15h) and Expert (30h):
    range   = 30 - 15 = 15 hours
    earned  = hoursFocused - 15
    pct     = (earned / range) * 100

  A student at 22 hours: (22-15)/15 * 100 = 46%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### STEP 20 — PACKAGING: MAKING AN INSTALLABLE APP
────────────────────────────────────────────────

File: package.json
Tool: electron-builder  (npm install --save-dev electron-builder)

What does "packaging" mean?
  When you run "npm start" Electron needs Node.js and all the
  source files on the machine.  "Packaging" bundles Electron,
  your code, and a mini Node.js runtime into a single installer
  that anyone can run without installing anything first.

The "build" section in package.json tells electron-builder:

  appId       A globally unique reverse-domain identifier.
              com.productivity.dashboard follows the convention
              used by macOS and Android.  It must be unique
              across all apps on a user's computer.

  productName The name shown in the title bar, Start Menu,
              and macOS Dock.

  files       The list of source files to bundle.  node_modules
              are NOT listed — electron-builder handles them
              automatically (only production deps are bundled).
              Since this app has no production dependencies,
              only the source files are included, keeping the
              installer small.

  win → target: "nsis"
              NSIS = Nullsoft Scriptable Install System.
              This creates a Windows Setup.exe installer that
              puts the app in Program Files and creates a
              Start Menu shortcut.

  mac → target: "dmg"
              DMG = Disk Image.  macOS users drag the app icon
              into their Applications folder.

  nsis → oneClick: false
              If true, the installer silently installs with no
              windows.  false means the user sees the standard
              "Next / Install" wizard — better for users who
              want to choose the install location.

How to build

  On Windows (produces a .exe installer):
    npm install          ← installs electron-builder first
    npm run dist:win

  On macOS (produces a .dmg):
    npm install
    npm run dist:mac

  The output appears in the  dist/  folder.

  Note: you can only build for the operating system you are
  currently on.  Windows cannot produce a .dmg without extra
  tools, and macOS cannot produce a .exe.  For cross-platform
  builds, CI services like GitHub Actions are commonly used.

Adding custom icons (optional)
  Without icons, electron-builder uses the default Electron
  rocket icon.  To use your own:
    1. Create a 1024×1024 PNG of your logo
    2. Convert to .ico  (Windows) using cloudconvert.com
    3. Convert to .icns (macOS)  using cloudconvert.com
    4. Save as  assets/icon.ico  and  assets/icon.icns
    5. Add to package.json build section:
         "win": { "target": "nsis", "icon": "assets/icon.ico" }
         "mac": { "target": "dmg",  "icon": "assets/icon.icns" }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### STEP 21 — COMPLETE CHANGE TABLE
─────────────────────────────────

File                              What changed          Why
──────────────────────────────────────────────────────────────
index.js                  4 new IPC handlers       Expose sessions
                          (sessions:getAll/add,    and access data
                           access:getAll/logToday) to the renderer

preload.js                2 new namespaces          Bridge the new
                          (sessions, access)        IPC channels
                                                    securely

storage/storage.js        sessions + access added   Keep provider
                          to both Electron and      pattern in sync
                          localStorage providers    for both envs

features/pomodoro/        startedAt field added     Know when session
pomodoro.js               Save session on           started; record
                          completion                completion data

renderer.js               initReport() call         Wire up the new
                          Storage.access.logToday() feature; log daily
                                                    access

features/report/          NEW FILE                  Canvas bar chart
chart.js                  drawBarChart()            (CSP-safe, no CDN)

features/report/          NEW FILE                  All Report tab
report.js                 initReport() +            logic and stat
                          stat helpers +            calculations
                          render functions

index.html                Report tab button         Show the tab in
                          Report panel HTML         the UI
                          script tags for
                          chart.js + report.js

style.css                 All .report-* styles      Visual design for
                          (stat cards, chart,       the Report tab
                           session list, ranking)

package.json              name renamed              Avoid npm reserved
                          electron-builder added    name; enable
                          build config added        installer creation
                          dist scripts added

STUDENT-GUIDE.txt         NEW FILE                  This document

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### TESTING CHECKLIST
──────────────────

  □ npm start — app opens without errors in the DevTools console
  □ Click Report tab — stat cards appear (all 0 on first run)
  □ Days Accessed = 1 after the first launch
  □ Start Focus on Pomodoro tab — timer counts down
  □ (Shortcut for testing) Open DevTools console and run:
      Storage.sessions.add({
        id: 'test1', date: new Date().toISOString().slice(0,10),
        startedAt: new Date(Date.now()-1500000).toISOString(),
        completedAt: new Date().toISOString(),
        durationMinutes: 25, type: 'work'
      })
    Then click the Report tab — stats should update on refresh
  □ Week chart shows a bar for today
  □ Click "< " (previous) — chart navigates to last week
  □ Click Month — chart switches to weekly buckets
  □ Detail sub-tab lists the session
  □ Ranking sub-tab shows a tier badge and progress bar
  □ Close and reopen the app — data persists
  □ npm install && npm run dist:win (Windows) — dist/ folder
    contains a Setup .exe installer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Have Fun Coding
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
