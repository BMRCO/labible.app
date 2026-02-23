const el = (id) => document.getElementById(id);

const state = {
  books: [],
  bible: {},
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

  // “feel like app”: mostrar algo logo
  await showChapter();
}

async function loadData() {
  const booksRes = await fetch("/data/books.json", { cache: "no-cache" });
  state.books = await booksRes.json();

  const bibleRes = await fetch("/data/segond_1910.json", { cache: "no-cache" });
  state.bible = await bibleRes.json();
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
  const chapters = state.bible?.[bookId];
  const s = el("chapterSelect");
  s.innerHTML = "";
  if (!chapters) return;

  Object.keys(chapters)
    .map(n => Number(n))
    .filter(n => Number.isFinite(n))
    .sort((a,b)=>a-b)
    .forEach(n => {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      s.appendChild(opt);
    });
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
    clearSelection();
    renderList([]);
    return;
  }

  const nums = Object.keys(chapterData)
    .map(n => Number(n))
    .filter(n => Number.isFinite(n))
    .sort((a,b)=>a-b);

  state.verses = nums.map(vn => ({
    id: `${bookName} ${chapter}:${vn}`,
    text: String(chapterData[String(vn)] || "").trim()
  }));

  state.viewingFavs = false;
  el("resultsTitle").textContent = "Résultats";
  clearSelection();
  renderList(state.verses);
}

function searchGlobal(q) {
  const query = String(q || "").trim().toLowerCase();

  if (query.length < 2) {
    el("resultsTitle").textContent = state.viewingFavs ? "Favoris" : "Résultats";
    renderList(state.viewingFavs ? favsToVerses() : state.verses);
    return;
  }

  const results = [];
  for (const [bookId, chapters] of Object.entries(state.bible)) {
    const bookMeta = state.books.find(b => b.id === bookId);
    const bookName = bookMeta?.name || bookId;

    for (const [chapNum, verses] of Object.entries(chapters)) {
      for (const [verseNum, text] of Object.entries(verses)) {
        const t = String(text || "");
        if (t.toLowerCase().includes(query)) {
          results.push({ id: `${bookName} ${chapNum}:${verseNum}`, text: t.trim() });
          if (results.length >= 300) {
            el("resultsTitle").textContent = "Recherche (limite)";
            clearSelection();
            state.viewingFavs = false;
            renderList(results);
            return;
          }
        }
      }
    }
  }

  el("resultsTitle").textContent = "Recherche";
  clearSelection();
  state.viewingFavs = false;
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
  if (ids.length === 0) return alert("Sélectionne au moins un verset.");

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

  favs.slice(0, 8).forEach(f => {
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
  return Object.values(state.favorites)
    .sort((a,b)=>b.when-a.when)
    .map(f => ({ id: f.id, text: f.text }));
}

function loadFavs() {
  try { return JSON.parse(localStorage.getItem("labible_favs") || "{}"); }
  catch { return {}; }
}
function saveFavs(obj) {
  localStorage.setItem("labible_favs", JSON.stringify(obj));
}

function buildShareText() {
  const ids = Array.from(state.selected);
  if (ids.length === 0) return "";

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
    await navigator.share({ title:"LaBible.app", text: txt });
  } else {
    await navigator.clipboard.writeText(txt);
    alert("Partage non supporté — texte copié ✅");
  }
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

function initCookies() {
  const key = "labible_cookie_choice";
  const banner = el("cookieBanner");
  const choice = localStorage.getItem(key);
  if (!choice) banner.classList.add("show");

  el("cookieAccept").addEventListener("click", () => {
    localStorage.setItem(key, "accept");
    banner.classList.remove("show");
    // Se usares GA4: carregar script só aqui.
  });

  el("cookieDeny").addEventListener("click", () => {
    localStorage.setItem(key, "deny");
    banner.classList.remove("show");
  });
}

function attachEvents() {
  el("bookSelect").addEventListener("change", () => {
    fillChapters();
    showChapter();
  });

  el("chapterSelect").addEventListener("change", showChapter);

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
  return String(str).replace(/[&<>"']/g, (s) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[s]));
}

init();
