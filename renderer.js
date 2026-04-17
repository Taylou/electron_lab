// ─── Tab navigation ───────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ─── Feature initialisation ───────────────────────────────────────────────────

initNotes();
initMood();
initPomodoro();
initReport();

Storage.access.logToday(); // record today as an accessed day (idempotent)

// const Notification_Title = 'Welcome to the Productivity Dashboard!';
// const Notification_Body = 'Your all-in-one tool for notes, mood tracking, and Pomodoro sessions.';
// const Click_Message = 'Click here to open the dashboard.';

// new window.Notification({ title: Notification_Title, body: Notification_Body }).show().onclick = () => {
//   document.getElementById('dashboard').classList.add('active');
// };  
