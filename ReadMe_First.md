========================================================
  ## BUILDING A PRODUCTIVITY DASHBOARD WITH ELECTRON
  ### A Step-by-Step Guide
========================================================

This guide will walk you through how this
Electron application was built, what each file does,
and how to push your work to GitHub and deploy it
to your own GitHub Pages as a live web demo.

Take your time with each section. If something is
confusing, re-read it slowly before moving on or check with me.

--------------------------------------------------------
## WHAT ARE WE BUILDING?
--------------------------------------------------------

We are building a desktop application using Electron.
Electron is a framework that lets you build desktop
apps (like the ones you install on your computer)
using the same technologies used to build websites:
HTML, CSS, and JavaScript.

Our app is a personal Productivity Dashboard with
three simple features:

  1. Quick Notes    - Jot down short notes that save
                      automatically.

  2. Daily Mood     - Log how you feel each day with
                      an emoji and track your history.

  3. Pomodoro Timer - A focus timer (25 min work,
                      5 min break) with a visual
                      countdown ring and OS notifications.

The app also works in a regular web browser, which
means each student can host it on their own GitHub
Pages account as a live demo of their work.

--------------------------------------------------------
### WHAT IS ELECTRON? (A QUICK EXPLANATION)
--------------------------------------------------------

A normal website runs inside a browser (Chrome,
Firefox, etc.). Electron wraps your website in its
own browser window and turns it into a desktop app.

Every Electron app has two sides:

  - The MAIN PROCESS (index.js)
    This is the "back end" of the app. It runs on
    your computer using Node.js. It can access your
    files, send OS notifications, and communicate
    with the operating system.

  - The RENDERER PROCESS (index.html + JS files)
    This is the "front end." It is the webpage the
    user sees and interacts with. It runs in a
    browser-like environment inside the Electron
    window.

These two sides talk to each other using a system
called IPC (Inter-Process Communication). Think of
IPC as a phone call between the back end and the
front end.

For security, they do not talk directly. Instead,
a file called preload.js acts as a safe messenger
between them.

--------------------------------------------------------
### PREREQUISITES (WHAT YOU NEED INSTALLED)
--------------------------------------------------------

Before starting, make sure you have these installed:

  - Node.js  (download from nodejs.org)
  - npm      (comes with Node.js automatically)
  - Git      (download from git-scm.com)
  - A code editor like VS Code (code.visualstudio.com)
  - A GitHub account (github.com)

To check if Node.js and npm are installed, open your
terminal and type:

  node --version
  npm --version

Both should print a version number (e.g. v20.0.0).

--------------------------------------------------------
### PROJECT STRUCTURE OVERVIEW
--------------------------------------------------------

Here is what the project looks like and what each
part does:

  Electron/
  |
  |-- index.js              The main process. Creates
  |                         the app window, handles
  |                         saving/reading data files,
  |                         and sends OS notifications.
  |
  |-- preload.js            The secure bridge between
  |                         the main process and the
  |                         webpage. Exposes safe
  |                         functions to the renderer.
  |
  |-- index.html            The webpage the user sees.
  |                         Contains the three tabs
  |                         and loads all scripts.
  |
  |-- renderer.js           Controls tab switching and
  |                         starts up each feature.
  |
  |-- style.css             All the visual styling
  |                         (colours, layout, fonts).
  |
  |-- package.json          Project settings and the
  |                         list of dependencies.
  |
  |-- storage/
  |   |-- storage.js        The data layer. Decides
  |                         whether to save data using
  |                         IPC (Electron) or
  |                         localStorage (browser).
  |
  |-- features/
      |-- notes/
      |   |-- notes.js      All logic for the Notes
      |                     feature.
      |
      |-- mood/
      |   |-- mood.js       All logic for the Mood
      |                     Tracker feature.
      |
      |-- pomodoro/
          |-- pomodoro.js   All logic for the
                            Pomodoro Timer feature,
                            including notifications.

--------------------------------------------------------
### STEP 1 - INSTALL DEPENDENCIES
--------------------------------------------------------

The project uses Electron as its only dependency.
To install it, open your terminal inside the project
folder and run:

  npm install

This reads package.json and downloads everything
listed under "devDependencies" into a folder called
node_modules. You only need to do this once (or again
if you delete node_modules).

NOTE: Never commit the node_modules folder to Git.
The .gitignore file is already set up to exclude it.

--------------------------------------------------------
### STEP 2 - RUN THE APP
--------------------------------------------------------

To start the app, run:

  npm start

This runs the command "electron ." which tells Electron
to look at index.js as the starting point and open
the app window.

You should see a dark window with three tabs at the
top: Notes, Mood, and Pomodoro.

If the window does not appear, check the terminal for
error messages.

--------------------------------------------------------
### STEP 3 - UNDERSTAND THE MAIN PROCESS (index.js)
--------------------------------------------------------

Open index.js. This file does four things:

  A) Defines a simple file store
     The functions readStore() and writeStore() read
     and write JSON files on your computer. This is
     where notes and mood entries are saved when
     running as a desktop app.

     A JSON file is just a text file that stores data
     in a structured way, like a list of objects.

  B) Registers IPC handlers
     Lines like ipcMain.handle('notes:getAll', ...)
     define what happens when the front end asks for
     data. Think of each handler as a function that
     answers a specific request from the webpage.

     The channel names follow the pattern:
       feature:action
     For example: 'notes:getAll', 'mood:save'

  C) Sends OS notifications
     The handler ipcMain.on('pomodoro:notify', ...)
     receives a message from the renderer and fires
     a real operating system notification using
     Electron's built-in Notification class. This is
     why timer alerts appear as proper desktop
     notifications, not just browser pop-ups.

  D) Creates the window
     createWindow() makes the actual app window and
     loads index.html. Notice the webPreferences:

       contextIsolation: true
         Means the webpage cannot access Node.js
         directly. This is a security best practice.

       nodeIntegration: false
         Disables direct Node.js access in the
         renderer. Always keep this false.

       preload: path to preload.js
         Loads preload.js before the webpage runs,
         so the safe bridge is ready.

--------------------------------------------------------
### STEP 4 - UNDERSTAND THE BRIDGE (preload.js)
--------------------------------------------------------

Open preload.js. This file uses contextBridge to
expose a safe, limited set of functions to the
webpage. The webpage can only call these specific
functions -- nothing else from Node.js.

The result is window.electronAPI, which the webpage
can use like this:

  window.electronAPI.notes.getAll()
  window.electronAPI.mood.save(entry)
  window.electronAPI.pomodoro.notify(message)

Notice that pomodoro.notify uses ipcRenderer.send
(one-way, fire-and-forget) instead of invoke. That
is because we do not need a response back -- we just
want to fire the notification and move on.

When the app runs in a browser (not Electron),
window.electronAPI does not exist. The storage and
notification code handle that gracefully using
'electronAPI' in window as a check before calling it.

--------------------------------------------------------
### STEP 5 - UNDERSTAND THE APP SHELL (index.html)
--------------------------------------------------------

Open index.html. This is the page the user sees.
Key things to notice:

  - The Content-Security-Policy meta tag is a security
    header that tells the browser only to load scripts
    and styles from our own files. This prevents
    malicious code from being injected.

  - The <nav> section contains three buttons. Each
    button has a data-tab attribute that matches the
    id of a <section> below it.

  - Each <section> is a tab-panel. Only one is visible
    at a time (controlled by the "active" CSS class).

  - At the bottom, the scripts are loaded in a specific
    order. This matters because each script depends on
    the one loaded before it:

      storage.js       (must load first - others use it)
      notes.js
      mood.js
      pomodoro.js
      renderer.js      (must load last - calls init
                        functions from the others)

--------------------------------------------------------
### STEP 6 - UNDERSTAND THE STORAGE LAYER (storage/storage.js)
#### Watch out for a Design Pattern
--------------------------------------------------------

Open storage/storage.js. This is one of the most
important files in the project.

The Storage object is a "provider" -- it checks at
startup whether window.electronAPI exists:

  - If YES (running as Electron desktop app):
    Data is saved via IPC calls to the main process,
    which writes JSON files to your computer.

  - If NO (running in a browser / GitHub Pages):
    Data is saved using localStorage, which is a
    simple key-value store built into every browser.

The key design decision here is that EVERY storage
function returns a Promise, even when the underlying
operation (like localStorage) is instant. This means
when a real database is added later, the feature
files do not need to change at all -- only the IPC
handler bodies in index.js change.

This is called the "provider pattern" and is a common
technique in real-world software development.

--------------------------------------------------------
### STEP 7 - UNDERSTAND THE FEATURES
--------------------------------------------------------

Each feature file follows the same structure:

  1. Pure helper functions at the top
     These functions take plain values and return
     plain values. They do NOT touch the DOM or
     storage. This makes them very easy to test later.

     Example from notes.js:
       createNote(text)  -- makes a new note object
       deleteNote(notes, id) -- removes a note by id

  2. DOM rendering functions in the middle
     These functions create or update HTML elements.
     They receive their data as arguments instead of
     fetching it themselves.

  3. An init function at the bottom
     initNotes(), initMood(), initPomodoro()
     Each init function attaches event listeners and
     does the first data load when the app opens.
     renderer.js calls these when the page loads.

--- NOTES FEATURE (features/notes/notes.js) ---

The Notes feature is a simple CRUD system:
  Create, Read, Update, Delete.

When you click "Add Note":
  1. The current notes are fetched from storage.
  2. A new note object is created (with a unique ID,
     the text, and a timestamp).
  3. The new note is added to the list.
  4. The updated list is saved back to storage.
  5. The UI re-renders the full list.

Each note has this shape:
  { id, text, createdAt }

--- MOOD TRACKER (features/mood/mood.js) ---

The Mood Tracker keeps a log of daily entries. Only
one entry is saved per day -- if you save again on
the same day, it updates (overwrites) that entry.
This is called an "upsert" (update + insert).

The emoji scale goes from 1 (worst) to 5 (best):
  😞 😐 🙂 😄 🚀

When you open the Mood tab, if you already logged
today, your saved emoji and note are pre-filled.

Each entry has this shape:
  { date, emoji, note, timestamp }

The history section shows the last 7 entries,
newest first.

--- POMODORO TIMER (features/pomodoro/pomodoro.js) ---

The Pomodoro technique is a time management method:
  - Work for 25 minutes (focused, no distractions)
  - Take a 5 minute break
  - Repeat

The timer uses an explicit state machine. The app
is always in one of three states:
  IDLE  -> WORK  -> BREAK -> IDLE (and so on)

The visual ring is an SVG circle. Its progress is
calculated with simple math:

  circumference = 2 * pi * radius
  dashoffset = circumference * (1 - progress)

As progress goes from 1.0 to 0.0, the ring drains.

NOTIFICATIONS: The timer fires three alerts:

  - When your 25-min work session ends:
    "You've earned it. Take 5 minutes."

  - When 1 minute of break remains:
    "Break ends soon -- start wrapping up."

  - When your break ends:
    "Time to focus again."

How notifications are sent depends on context:
  - In Electron: a message is sent via IPC to the
    main process, which uses Electron's Notification
    class to show a real OS notification.
  - In a browser: the browser's own Notification API
    is used as a fallback (requires user permission).

This feature has NO data storage -- the timer resets
if you close the app. That is intentional. A timer
is temporary state, not data worth saving.

--------------------------------------------------------
### STEP 8 - UNDERSTAND THE RENDERER (renderer.js)
--------------------------------------------------------

Open renderer.js. It does two simple things:

  1. Tab switching
     When a tab button is clicked, it removes "active"
     from all buttons and panels, then adds it to the
     clicked button and its matching panel.

  2. Calls all init functions
     initNotes(), initMood(), initPomodoro()
     These start each feature up.

--------------------------------------------------------
### STEP 9 - PUSH YOUR WORK TO GITHUB
--------------------------------------------------------

Now that you understand the project, here is how to
push your code from the Dev branch to GitHub.

IMPORTANT: Each student should do this on their own
GitHub account. Do not push to the original project
repository without permission.

First, fork the repository on GitHub:
  1. Go to the project repository on github.com
  2. Click the "Fork" button in the top right
  3. This creates your own personal copy

Then, clone your fork to your machine:

  git clone https://github.com/YOUR-USERNAME/REPO-NAME.git
  cd REPO-NAME

Or if you are already working inside the project
folder, make sure your remote points to your fork:

  git remote set-url origin https://github.com/YOUR-USERNAME/REPO-NAME.git

--- SWITCH TO THE DEV BRANCH ---

Check which branch you are on:

  git branch

If you are not on Dev, switch to it:

  git checkout Dev

If Dev does not exist locally yet:

  git checkout -b Dev

--- CHECK WHAT HAS CHANGED ---

See all the files you have added or modified:

  git status

--- STAGE YOUR FILES ---

Add all your changed files to the "staging area"
(this is what will be included in your commit):

  git add index.js
  git add preload.js
  git add index.html
  git add renderer.js
  git add style.css
  git add package.json
  git add storage/storage.js
  git add features/notes/notes.js
  git add features/mood/mood.js
  git add features/pomodoro/pomodoro.js
  git add GUIDE.txt

Or add everything at once (use with care):

  git add .

--- COMMIT YOUR CHANGES ---

A commit is a saved snapshot of your work with a
message describing what you did:

  git commit -m "add notes, mood tracker, and pomodoro timer features"

Write a clear, short message. Good commit messages
describe WHAT changed and WHY, not HOW.

--- PUSH TO GITHUB ---

Send your commits to GitHub on the Dev branch:

  git push origin Dev

After pushing, go to your repository on github.com
and you should see the Dev branch with your new files.

--------------------------------------------------------
### STEP 10 - MERGE DEV INTO MAIN (PULL REQUEST)
--------------------------------------------------------

On real projects, you do not push directly to main.
Instead, you open a Pull Request (PR) -- a request
for someone to review and approve your changes before
they are merged.

--- CREATE A PULL REQUEST ON GITHUB ---

  1. Go to YOUR forked repository on github.com
  2. You will see a banner: "Dev had recent pushes"
     Click "Compare & pull request"
  3. Make sure the base repository is YOUR fork, not
     the original project. Change it if needed.
  4. Fill in the title (e.g. "Add three dashboard features")
  5. In the description, briefly explain what you built
  6. Click "Create pull request"
  7. Since this is your own fork, you can merge it:
     Click "Merge pull request" then "Confirm merge"

Your Dev branch is now merged into your fork's main.

--- SYNC YOUR LOCAL MAIN BRANCH ---

After merging, update your local machine:

  git checkout main
  git pull origin main

--------------------------------------------------------
### STEP 11 - DEPLOY YOUR FORK TO GITHUB PAGES
--------------------------------------------------------

GitHub Pages is a free service that hosts static
websites directly from a GitHub repository. Each
student will deploy their own fork as a personal
live demo.

NOTE: GitHub Pages serves your index.html as a
website. The Electron-specific features (IPC, file
saving, native OS notifications) will not work in
the browser -- but all three features still work
using localStorage and the browser notification
fallback.

--- ENABLE GITHUB PAGES ON YOUR FORK ---

  1. Go to YOUR forked repository on github.com
  2. Click the "Settings" tab at the top
  3. In the left sidebar, click "Pages"
  4. Under "Source", select:
       Branch: main
       Folder: / (root)
  5. Click "Save"
  6. GitHub will show a banner with your URL:
       https://YOUR-USERNAME.github.io/REPO-NAME/

It may take 1-2 minutes for the site to go live.
Refresh the page if you do not see it immediately.

--- TEST YOUR DEPLOYED APP ---

Open the URL in your browser. You should see the
Productivity Dashboard. Try:

  - Adding a note (it saves to localStorage in the browser)
  - Logging your mood
  - Starting the Pomodoro timer and allowing
    notification permission when prompted

--- FUTURE DEPLOYMENTS ---

Every time you push changes to your main branch,
GitHub Pages will automatically update your live
site within a few minutes. No extra steps needed.

--------------------------------------------------------
### SUMMARY OF KEY CONCEPTS 
--------------------------------------------------------

  Electron        Desktop apps built with web tech
  Main Process    Back end -- file system, IPC,
                   OS notifications
  Renderer        Front end -- HTML, CSS, JS
  preload.js      Secure bridge between the two
  contextBridge   Safely exposes functions to the UI
  IPC             How main and renderer communicate
                   ipcMain.handle = two-way (returns data)
                   ipcMain.on    = one-way (fire and forget)
  Provider Pattern Swap storage backend without
                   touching feature code
  Pure Functions  Functions with no side effects --
                   easy to test
  State Machine   Explicit list of states an app
                   can be in (IDLE, WORK, BREAK)
  Git branches    Isolate your work on Dev, merge to
                   main when ready
  Fork            Your own personal copy of a repo
  Pull Request    A formal review before merging
  GitHub Pages    Free static website hosting from
                   YOUR OWN GitHub repository

--------------------------------------------------------
have fun coding!
--------------------------------------------------------
