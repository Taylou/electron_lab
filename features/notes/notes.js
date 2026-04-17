// ─── Pure helpers (no DOM, no storage — easy to unit-test) ───────────────────

function createNote(text) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
}

function deleteNote(notes, id) {
  return notes.filter(n => n.id !== id);
}

function formatNoteDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── DOM rendering ───────────────────────────────────────────────────────────

function renderNoteEl(note, onDelete) {
  const li = document.createElement('li');
  li.className = 'note-item';
  li.dataset.id = note.id;

  const text = document.createElement('p');
  text.className = 'note-text';
  text.textContent = note.text;

  const meta = document.createElement('span');
  meta.className = 'note-meta';
  meta.textContent = formatNoteDate(note.createdAt);

  const btn = document.createElement('button');
  btn.className = 'btn-icon btn-delete';
  btn.setAttribute('aria-label', 'Delete note');
  btn.textContent = '×';
  btn.addEventListener('click', () => onDelete(note.id));

  li.append(text, meta, btn);
  return li;
}

function renderNotesList(notes, listEl, onDelete) {
  listEl.innerHTML = '';
  if (notes.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'notes-empty';
    empty.textContent = 'No notes yet. Add one above.';
    listEl.appendChild(empty);
    return;
  }
  // newest first
  [...notes].reverse().forEach(note => {
    listEl.appendChild(renderNoteEl(note, onDelete));
  });
}

// ─── Feature initialisation ──────────────────────────────────────────────────

function initNotes() {
  const textarea = document.getElementById('notes-input');
  const addBtn   = document.getElementById('notes-add-btn');
  const listEl   = document.getElementById('notes-list');

  async function loadAndRender() {
    const notes = await Storage.notes.getAll();
    renderNotesList(notes, listEl, handleDelete);
  }

  async function handleAdd() {
    const text = textarea.value.trim();
    if (!text) return;
    const notes = await Storage.notes.getAll();
    const updated = [...notes, createNote(text)];
    await Storage.notes.save(updated);
    textarea.value = '';
    await loadAndRender();
  }

  async function handleDelete(id) {
    const notes = await Storage.notes.getAll();
    const updated = deleteNote(notes, id);
    await Storage.notes.save(updated);
    await loadAndRender();
  }

  addBtn.addEventListener('click', handleAdd);
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd();
  });

  loadAndRender();
}
