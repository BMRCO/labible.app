const el = (id) => document.getElementById(id);

const KEYS = {
  favs: "labible_favs_v1",
  last: "labible_last_v1",
  cookie: "labible_cookie_choice_v1"
};

const state = {
  books: [],
  bible: {},
  verses: [],
  selected: new Set(),
  viewingFavs: false,
  favorites: loadJson(KEYS.favs, {}),
  last: loadJson(KEYS.last, null),
  installPromptEvent: null
};

function setStatus(msg) {
  const p = el("statusPill");
  if (p) p.textContent = msg;
}

async function init() {
  setStatus("Chargement…");
  await loadData();
  initSelectors();
  initInstallFlow();
  initCookies();
  bindEvents();
  renderFavs();

  // Restore last read if possible
  if (state.last?.bookId && state.last?.chapter) {
    const ok = trySetBookAndChapter(state.last.bookId, state.last.chapter);
    if (ok) await showChapter();
    else await showChapter();
  } else {
    await showChapter();
  }

  setStatus("Prêt");
}

async function loadData() {
  const booksRes = await fetch("/data/books.json", { cache: "no-cache" });
  state.books = await booksRes.json();

  const bibleRes = await fetch("/data/segond_1910.json", { cache: "no-cache" });
  state.bible = await bibleRes.json();
}

function initSelectors() {
  const bookSelect = el("bookSelect");
  bookSelect.innerHTML = "";

  state.books.forEach(b => {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = b.name;
    bookSelect.appendChild(opt);
  });

  fillChapters();
}

function fillChapters() {
  const bookId = el("bookSelect").value;
  const chapters = state.bible?.[bookId];
  const chapterSelect = el("chapterSelect");
  chapterSelect.innerHTML = "";
  if (!chapters) return;

  Object.keys(chapters)
    .map(n => Number(n))
    .filter(n => Number.isFinite(n))
    .sort((a,b)=>a-b)
    .forEach(n => {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      chapterSelect.appendChild(opt);
    });
}

function trySetBookAndChapter(bookId, chapter) {
  const hasBook = state.books.some(b => b.id === bookId);
  if (!hasBook) return false;

  el("bookSelect").value = bookId;
  fillChapters();

  const exists = !!state.bible?.[bookId]?.[String(chapter)];
  if (!exists) return false;

  el("chapterSelect").value = String(chapter);
  return true;
}

async function showChapter() {
  const bookId = el("bookSelect").value;
  const chapter = el("chapterSelect").value;

  const bookMeta = state.books.find(b => b.id === bookId);
  const bookName = bookMeta?.name || bookId;

  const chapterData = state.bible?.[bookId]?.[chapter];
  if (!chapterData) {
    state.verses = [];
    state.viewingFavs = false;
    el("resultsTitle").textContent = "Résultats";
    el("resultsMeta").textContent = "";
    clearSelection();
    renderList([]);
    saveLast({ bookId, chapter: Number(chapter) });
    return;
  }

  const verseNums = Object.keys(chapterData)
    .map(n => Number(n))
    .filter(n => Number.isFinite(n))
    .sort((a,b)=>a-b);

  state.verses = verseNums.map(vn => ({
    id: `${bookName} ${chapter}:${vn}`,
    text: String(chapterData[String(vn)] || "").trim(),
    bookId,
    chapter: Number(chapter),
    verse: vn
  }));

  state.viewingFavs = false;
  el("resultsTitle").textContent = "Résultats";
  el("resultsMeta").textContent = `${bookName} ${chapter} · ${verseNums.length} versets`;
  clearSelection();
  renderList(state.verses);
  saveLast({ bookId, chapter: Number(chapter) });
}

function goChapter(delta) {
  const bookId = el("bookSelect").value;
  const current = Number(el("chapterSelect").value || "1");
  const chapters = state.bible?.[bookId];
  if (!chapters) return;

  const keys = Object.keys(chapters)
    .map(n => Number(n))
    .filter(n => Number.isFinite(n))
    .sort((a,b)=>a-b);

  const idx = keys.indexOf(current);
  if (idx < 0) return;

  const nextIdx = idx + delta;
  if (nextIdx < 0 || nextIdx >= keys.length) return;

  el("chapterSelect").value = String(keys[nextIdx]);
  showChapter();
}

function searchGlobal(q) {
  const query = String(q || "").trim().toLowerCase();

  if (query.length < 2) {
    if (state.viewingFavs) {
      el("resultsTitle").textContent = "Favoris";
      el("resultsMeta").textContent = `${Object.keys(state.favorites).length} éléments`;
      renderList(favsToVerses());
    } else {
      el("resultsTitle").textContent = "Résultats";
      const bookMeta = state.books.find(b => b.id === el("bookSelect").value);
      const bookName = bookMeta?.name || el("bookSelect").value;
      el("resultsMeta").textContent = `${bookName} ${el("chapterSelect").value}`;
      renderList(state.verses);
    }
    return;
  }

  setStatus("Recherche…");
  const results = [];

  for (const [bookId, chapters] of Object.entries(state.bible)) {
    const bookMeta = state.books.find(b => b.id === bookId);
    const bookName = bookMeta?.name || bookId;

    for (const [chapNum, verses] of Object.entries(chapters)) {
      for (const [verseNum, text] of Object.entries(verses)) {
        const t = String(text || "");
        if (t.toLowerCase().includes(query)) {
          results.push({
            id: `${bookName} ${chapNum}:${verseNum}`,
            text: t.trim()
          });
          if (results.length >= 300) {
            el("resultsTitle").textContent = "Recherche (limite)";
            el("resultsMeta").textContent = `“${query}” · 300+ résultats`;
            state.viewingFavs = false;
            clearSelection();
            renderList(results);
            setStatus("Prêt");
            return;
          }
        }
      }
    }
  }

  el("resultsTitle").textContent = "Recherche";
  el("resultsMeta").textContent = `“${query}” · ${results.length} résultats`;
  state.viewingFavs = false;
  clearSelection();
  renderList(results);
  setStatus("Prêt");
}

function renderList(list) {
  const box = el("verseList");
  box.innerHTML = "";

  if (!list || list.length === 0) {
    box.innerHTML = `<div class="muted small">Aucun résultat.</div>`;
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
  // refresh UI selection classes
  document.querySelectorAll(".item.selected").forEach(n => n.classList.remove("selected"));
}

function updateSelectedCount() {
  el("selectedCount").textContent = `${state.selected.size} sélectionné`;
}

function favsToVerses() {
  return Object.values(state.favorites)
    .sort((a,b)=>b.when-a.when)
    .map(f => ({ id: f.id, text: f.text }));
}

function renderFavs() {
  const favBox = el("favList");
  favBox.innerHTML = "";

  const favs = Object.values(state.favorites).sort((a,b)=>b.when-a.when);

  if (favs.length === 0) {
    favBox.innerHTML = `<div class="muted small">Aucun favori.</div>`;
    return;
  }

  favs.slice(0, 10).forEach(f => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="vtext">${escapeHtml(f.text)}</div>
      <div class="vmeta">${escapeHtml(f.id)} · Louis Segond 1910</div>
    `;
    // click opens that reference (best effort: match by book name is hard)
    favBox.appendChild(div);
  });
}

function toggleFavoriteSelected() {
  const ids = Array.from(state.selected);
  if (ids.length === 0) return alert("Sélectionne au moins un verset.");

  // build pool to fetch text
  const pool = state.viewingFavs ? favsToVerses() : state.verses;
  const byId = new Map(pool.map(v => [v.id, v]));

  let changed = 0;

  ids.forEach(id => {
    if (state.favorites[id]) {
      delete state.favorites[id];
      changed++;
    } else {
      const v = byId.get(id);
      state.favorites[id] = { id, text: v?.text || "", when: Date.now() };
      changed++;
    }
  });

  saveJson(KEYS.favs, state.favorites);
  renderFavs();
  alert(`Favoris mis à jour ✅ (${changed})`);
}

function buildShareText() {
  const ids = Array.from(state.selected);
  if (ids.length === 0) return "";

  // best effort text lookup
  const pool = state.viewingFavs ? favsToVerses() : state.verses;
  const byId = new Map(pool.map(v => [v.id, v]));

  const lines = [];
  ids.slice(0, 6).forEach(id => {
    const v = byId.get(id);
    if (!v) return;
    lines.push(v.text);
    lines.push(`— ${id} (Louis Segond 1910)`);
    lines.push("");
  });
  lines.push("LaBible.app");
  return lines.join("\n").trim();
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
    await navigator.clipboard.writeText(txt);
    alert("Partage non supporté — texte copié ✅");
  }
}

function openLastRead() {
  if (!state.last?.bookId || !state.last?.chapter) {
    alert("Aucune lecture précédente.");
    return;
  }
  const ok = trySetBookAndChapter(state.last.bookId, state.last.chapter);
  if (!ok) return alert("Dernière lecture indisponible.");
  el("searchInput").value = "";
  showChapter();
}

function clearFavs() {
  if (!confirm("Effacer tous les favoris ?")) return;
  state.favorites = {};
  saveJson(KEYS.favs, state.favorites);
  renderFavs();
  if (state.viewingFavs) {
    el("resultsTitle").textContent = "Favoris";
    el("resultsMeta").textContent = "0 éléments";
    renderList([]);
  }
}

function clearData() {
  if (!confirm("Réinitialiser l’app (favoris + dernier lu + cookies) ?")) return;
  localStorage.removeItem(KEYS.favs);
  localStorage.removeItem(KEYS.last);
  localStorage.removeItem(KEYS.cookie);
  state.favorites = {};
  state.last = null;
  state.viewingFavs = false;
  renderFavs();
  el("searchInput").value = "";
  initCookies(true);
  showChapter();
}

function saveLast(obj) {
  state.last = obj;
  saveJson(KEYS.last, obj);
}

function initInstallFlow() {
  const installBtn = el("installBtn");
  installBtn.style.display = "none";

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.installPromptEvent = e;
    installBtn.style.display = "inline-flex";
  });

  installBtn.addEventListener("click", async () => {
    if (!state.installPromptEvent) {
      alert("Utilise le menu du navigateur → Ajouter à l’écran d’accueil.");
      return;
    }
    state.installPromptEvent.prompt();
    await state.installPromptEvent.userChoice;
    state.installPromptEvent = null;
    installBtn.style.display = "none";
  });
}

function initCookies(forceShow = false) {
  const banner = el("cookieBanner");
  const choice = localStorage.getItem(KEYS.cookie);

  if (forceShow) banner.classList.add("show");
  else if (!choice) banner.classList.add("show");
  else banner.classList.remove("show");

  el("cookieAccept").onclick = () => {
    localStorage.setItem(KEYS.cookie, "accept");
    banner.classList.remove("show");
    // Se quiseres GA4, carrega o script aqui (e só aqui).
  };
  el("cookieDeny").onclick = () => {
    localStorage.setItem(KEYS.cookie, "deny");
    banner.classList.remove("show");
  };
}

function bindEvents() {
  el("bookSelect").addEventListener("change", () => {
    fillChapters();
    el("searchInput").value = "";
    showChapter();
  });

  el("chapterSelect").addEventListener("change", () => {
    el("searchInput").value = "";
    showChapter();
  });

  el("loadBtn").addEventListener("click", () => {
    el("searchInput").value = "";
    showChapter();
  });

  el("prevBtn").addEventListener("click", () => goChapter(-1));
  el("nextBtn").addEventListener("click", () => goChapter(+1));

  el("searchInput").addEventListener("input", (e) => searchGlobal(e.target.value));

  el("toggleFavBtn").addEventListener("click", () => {
    state.viewingFavs = !state.viewingFavs;
    el("searchInput").value = "";
    clearSelection();

    if (state.viewingFavs) {
      el("resultsTitle").textContent = "Favoris";
      el("resultsMeta").textContent = `${Object.keys(state.favorites).length} éléments`;
      renderList(favsToVerses());
    } else {
      showChapter();
    }
  });

  el("copyBtn").addEventListener("click", copySelected);
  el("shareBtn").addEventListener("click", shareSelected);
  el("favBtn").addEventListener("click", toggleFavoriteSelected);

  el("clearSelBtn").addEventListener("click", () => {
    clearSelection();
    if (state.viewingFavs) renderList(favsToVerses());
    else renderList(state.verses);
  });

  el("openLastBtn").addEventListener("click", openLastRead);
  el("clearFavsBtn").addEventListener("click", clearFavs);
  el("clearDataBtn").addEventListener("click", clearData);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[s]));
}

function loadJson(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

init();