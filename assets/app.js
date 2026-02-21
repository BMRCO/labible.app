const el = (id) => document.getElementById(id);

const state = {
  books: [],
  bible: [],
  verses: [],
  selected: new Set(),
  favorites: loadFavs(),
  viewingFavs: false,
  installPromptEvent: null
};

async function init() {
  await loadData();
  fillBooks();
  attachEvents();
  renderFavs();
  initCookies();
  initInstallFlow();
}

async function loadData() {
  const booksRes = await fetch("/data/books.json", { cache: "no-cache" });
  state.books = await booksRes.json();
  const bibleRes = await fetch("/data/segond_1910.json", { cache: "no-cache" });
  const fullData = await bibleRes.json();
  state.bible = fullData.verses || fullData;
}

function fillBooks() {
  const s = el("bookSelect");
  s.innerHTML = "";
  state.books.forEach(b => {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = b.name;
    s.appendChild(opt);
  });
  fillChapters();
}

function fillChapters() {
  const bookId = el("bookSelect").value;
  const bookMeta = state.books.find(b => b.id === bookId);
  const bookName = bookMeta?.name || bookId;
  const chapters = new Set();
  state.bible.forEach(v => {
    if (v.book_name === bookName || v.book === bookId) {
      chapters.add(v.chapter);
    }
  });
  const s = el("chapterSelect");
  s.innerHTML = "";
  Array.from(chapters).sort((a, b) => a - b).forEach(n => {
    const opt = document.createElement("option");
    opt.value = String(n);
    opt.textContent = String(n);
    s.appendChild(opt);
  });
}

async function showChapter() {
  const bookId = el("bookSelect").value;
  const chapter = parseInt(el("chapterSelect").value);
  const bookMeta = state.books.find(b => b.id === bookId);
  const bookName = bookMeta?.name || bookId;
  state.verses = state.bible
    .filter(v => (v.book_name === bookName || v.book === bookId) && v.chapter === chapter)
    .map(v => ({
      id: `${bookName} ${v.chapter}:${v.verse}`,
      text: String(v.text || "").trim()
    }));
  state.viewingFavs = false;
  el("resultsTitle").textContent = "Résultats";
  clearSelection();
  renderList(state.verses);
}

function searchGlobal(q) {
  const query = q.trim().toLowerCase();
  if (query.length < 2) {
    el("resultsTitle").textContent = state.viewingFavs ? "Favoris" : "Résultats";
    renderList(state.viewingFavs ? favsToVerses() : state.verses);
    return;
  }
  const results = [];
  for (const v of state.bible) {
    if (String(v.text || "").toLowerCase().includes(query)) {
      results.push({
        id: `${v.book_name} ${v.chapter}:${v.verse}`,
        text: String(v.text).trim()
      });
      if (results.length >= 250) break;
    }
  }
  el("resultsTitle").textContent = `Recherche`;
  clearSelection();
  renderList(results);
}

function renderList(list) {
  const box = el("verseList");
  box.innerHTML = "";
  if (!list || list.length === 0) {
    box.innerHTML = `<div class="hint">Aucun résultat.</div>`;
    return;
  }
  list.forEach(v => {
    const div = document.createElement("div");
    div.className = "item" + (state.selected.has(v.id) ? " selected" : "");
    div.innerHTML = `
      <div class="vtext">${escapeHtml(v.text)}</div>
      <div class="vmeta">${escapeHtml(v.id)} · Louis Segond 1910</div>
    `;
    div.addEventListener("click", () => {
      toggleSelected(v.id);
      div.classList.toggle("selected");
    });
    box.appendChild(div);
  });
}

function toggleSelected(id) {
  if (state.selected.has(id)) state.selected.delete(id);
  else state.selected.add(id);
  updateSelectedCount();
}

function clearSelection() {
  state.selected.clear();
  updateSelectedCount();
}

function updateSelectedCount() {
  el("selectedCount").textContent = `${state.selected.size} sélectionné`;
}

function toggleFavoriteSelected() {
  const ids = Array.from(state.selected);
  if (ids.length === 0) return alert("Sélectionne au menos um versículo.");
  let changed = 0;
  const pool = state.viewingFavs ? favsToVerses() : (state.verses.length > 0 ? state.verses : []);
  // Se não houver versículos carregados, precisamos buscar no cache de favoritos ou na bíblia toda (mais lento)
  // Simplificação: apenas favoritos se estiver na vista de favoritos, ou os versículos visuais.
  // Para busca global, o pool seria os resultados da busca.
  
  ids.forEach(id => {
    if (state.favorites[id]) {
      delete state.favorites[id];
      changed++;
    } else {
      // Tenta encontrar o texto no pool atual ou nos favoritos (se estivermos tirando)
      const v = pool.find(item => item.id === id);
      if (v) {
        state.favorites[id] = { id, text: v.text, when: Date.now() };
        changed++;
      }
    }
  });
  saveFavs(state.favorites);
  renderFavs();
  alert(`Favoris mis à jour ✅ (${changed})`);
}

function renderFavs() {
  const favBox = el("favList");
  favBox.innerHTML = "";
  const favs = Object.values(state.favorites).sort((a,b)=>b.when-a.when);
  if (favs.length === 0) {
    favBox.innerHTML = `<div class="hint">Aucun favori pour l’instant.</div>`;
    return;
  }
  favs.slice(0, 6).forEach(f => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="vtext">${escapeHtml(f.text)}</div>
      <div class="vmeta">${escapeHtml(f.id)} · Louis Segond 1910</div>
    `;
    favBox.appendChild(div);
  });
}

function favsToVerses() {
  return Object.values(state.favorites).sort((a,b)=>b.when-a.when).map(f => ({ id: f.id, text: f.text }));
}

function loadFavs() {
  try { return JSON.parse(localStorage.getItem("labible_favs") || "{}"); } catch { return {}; }
}

function saveFavs(obj) {
  localStorage.setItem("labible_favs", JSON.stringify(obj));
}

function buildShareText() {
  const ids = Array.from(state.selected);
  if (ids.length === 0) return "";
  const lines = [];
  // Procura o texto nos versículos atuais ou favoritos
  const pool = [...state.verses, ...favsToVerses()];
  ids.slice(0, 10).forEach(id => {
    const v = pool.find(item => item.id === id);
    if (v) {
      lines.push(`${v.text}`);
      lines.push(`— ${id} (Louis Segond 1910)`);
      lines.push("");
    }
  });
  lines.push("LaBible.app");
  return lines.join("
").trim();
}

async function copySelected() {
  const txt = buildShareText();
  if (!txt) return alert("Sélectionne au moins un verset.");
  await navigator.clipboard.writeText(txt);
  alert("Copié ✅");
}

async function shareSelected() {
  const txt = buildShareText();
  if (!txt) return alert("Sélectionne au moins un verset.");
  if (navigator.share) {
    await navigator.share({ title: "LaBible.app", text: txt });
  } else {
    copySelected();
  }
}

function initInstallFlow() {
  const btn = el("btnInstall");
  if (!btn) return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.installPromptEvent = e;
    btn.classList.add("visible");
  });
  btn.addEventListener("click", async () => {
    if (!state.installPromptEvent) return;
    state.installPromptEvent.prompt();
    await state.installPromptEvent.userChoice;
    state.installPromptEvent = null;
    btn.classList.remove("visible");
  });
}

function initCookies() {
  const key = "labible_cookie_choice";
  const banner = el("cookieBanner");
  if (!banner) return;
  const choice = localStorage.getItem(key);
  if (!choice) banner.classList.add("show");
  el("cookieAccept").addEventListener("click", () => {
    localStorage.setItem(key, "accept");
    banner.classList.remove("show");
  });
  el("cookieDeny").addEventListener("click", () => {
    localStorage.setItem(key, "deny");
    banner.classList.remove("show");
  });
}

function attachEvents() {
  el("bookSelect").addEventListener("change", fillChapters);
  el("loadBtn").addEventListener("click", showChapter);
  el("clearBtn").addEventListener("click", () => {
    el("searchInput").value = "";
    clearSelection();
    renderList(state.viewingFavs ? favsToVerses() : state.verses);
  });
  el("toggleFavBtn").addEventListener("click", () => {
    state.viewingFavs = !state.viewingFavs;
    clearSelection();
    if (state.viewingFavs) {
      el("resultsTitle").textContent = "Favoris";
      renderList(favsToVerses());
    } else {
      el("resultsTitle").textContent = "Résultats";
      renderList(state.verses);
    }
  });
  el("clearSelBtn").addEventListener("click", () => {
    clearSelection();
    renderList(state.viewingFavs ? favsToVerses() : state.verses);
  });
  el("searchInput").addEventListener("input", (e) => searchGlobal(e.target.value));
  el("copyBtn").addEventListener("click", copySelected);
  el("shareBtn").addEventListener("click", shareSelected);
  el("favBtn").addEventListener("click", toggleFavoriteSelected);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
}

init();
