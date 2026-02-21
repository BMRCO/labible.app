const el = (id) => document.getElementById(id);

/**
 * EXPECTED DATA SHAPES
 * - /data/books.json : [{ "id": "gen", "name": "Genèse" }, ...]
 * - /data/segond_1910.json :
 *   {
 *     "gen": {
 *       "1": { "1": "Au commencement...", "2": "..." },
 *       "2": { ... }
 *     },
 *     ...
 *   }
 */

const state = {
  books: [],
  bible: {},
  verses: [],
  selected: new Set(),
  favorites: loadFavs(),
  viewingFavs: false,
  installPromptEvent: null
};

// =============================
// INIT
// =============================
async function init() {
  await loadData();
  fillBooks();
  attachEvents();
  renderFavs();
  initCookies();
  initInstallFlow();
  // Show initial chapter to feel like an app (optional)
  // await showChapter();
}

async function loadData() {
  const booksRes = await fetch("/data/books.json", { cache: "no-cache" });
  state.books = await booksRes.json();

  const bibleRes = await fetch("/data/segond_1910.json", { cache: "no-cache" });
  state.bible = await bibleRes.json();
}

// =============================
// UI: BOOKS / CHAPTERS
// =============================
function fillBooks() {
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
  const chapterSelect = el("chapterSelect");
  chapterSelect.innerHTML = "";

  const chapters = state.bible?.[bookId];
  if (!chapters) return;

  const nums = Object.keys(chapters)
    .map(n => Number(n))
    .filter(n => Number.isFinite(n))
    .sort((a,b) => a-b);

  nums.forEach(n => {
    const opt = document.createElement("option");
    opt.value = String(n);
    opt.textContent = String(n);
    chapterSelect.appendChild(opt);
  });
}

// =============================
// CHAPTER LOADING
// =============================
async function showChapter() {
  const bookId = el("bookSelect").value;
  const chapter = el("chapterSelect").value;

  const bookMeta = state.books.find(b => b.id === bookId);
  const bookName = bookMeta?.name || bookId;

  const chapterData = state.bible?.[bookId]?.[chapter];
  if (!chapterData) {
    state.verses = [];
    renderVerses([]);
    return;
  }

  const verseNums = Object.keys(chapterData)
    .map(n => Number(n))
    .filter(n => Number.isFinite(n))
    .sort((a,b) => a-b);

  state.verses = verseNums.map(vn => ({
    id: `${bookName} ${chapter}:${vn}`,
    text: String(chapterData[String(vn)] || "").trim(),
    bookId, bookName, chapter: Number(chapter), verse: vn
  }));

  state.viewingFavs = false;
  state.selected.clear();
  updateSelectedCount();
  el("resultsTitle").textContent = "Résultats";
  renderVerses(state.verses);
}

// =============================
// SEARCH (global across entire bible JSON)
// =============================
function searchVerses(query) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) {
    // revert current chapter view
    renderVerses(state.viewingFavs ? favsToVerses() : state.verses);
    return;
  }

  const results = [];
  for (const [bookId, chapters] of Object.entries(state.bible)) {
    const bookMeta = state.books.find(b => b.id === bookId);
    const bookName = bookMeta?.name || bookId;

    for (const [chapNum, verses] of Object.entries(chapters)) {
      for (const [verseNum, text] of Object.entries(verses)) {
        const t = String(text || "");
        if (t.toLowerCase().includes(q)) {
          results.push({
            id: `${bookName} ${chapNum}:${verseNum}`,
            text: t.trim()
          });
          // soft limit to keep UI snappy
          if (results.length >= 250) {
            renderSearchResults(results, q, true);
            return;
          }
        }
      }
    }
  }

  renderSearchResults(results, q, false);
}

function renderSearchResults(results, q, capped) {
  state.viewingFavs = false;
  state.selected.clear();
  updateSelectedCount();
  el("resultsTitle").textContent = capped ? `Recherche (limite) · “${q}”` : `Recherche · “${q}”`;
  renderVerses(results);
}

// =============================
// RENDER VERSES
// =============================
function renderVerses(list) {
  const box = el("verseList");
  box.innerHTML = "";

  if (!list || list.length === 0) {
    box.innerHTML = `<div class="small">Aucun résultat.</div>`;
    return;
  }

  list.forEach(v => {
    const div = document.createElement("div");
    div.className = "verse" + (state.selected.has(v.id) ? " selected" : "");

    div.innerHTML = `
      <div class="text">« ${formatSignatureQuote(v.text)} »</div>
      <div class="meta">— ${escapeHtml(v.id)} · Louis Segond 1910</div>
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

function updateSelectedCount() {
  el("selectedCount").textContent = `${state.selected.size} sélectionné`;
}

function formatSignatureQuote(t) {
  if (!t) return "";
  const s = String(t).trim().replace(/\s+/g, " ");
  if (s.length < 90) return s;
  // Gentle editorial line breaks
  return s
    .replace(/([;:!?])\s+/g, "$1\n")
    .replace(/,\s+/g, ",\n");
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

// =============================
// FAVORITES (single-button on selected verses)
// =============================
function toggleFavoriteSelected() {
  const ids = Array.from(state.selected);
  if (ids.length === 0) {
    alert("Sélectionne au moins un verset.");
    return;
  }

  // Build a lookup from current rendered list
  const pool = state.viewingFavs ? favsToVerses() : state.verses;
  const byId = new Map(pool.map(v => [v.id, v]));

  let added = 0, removed = 0;

  ids.forEach(id => {
    if (state.favorites[id]) {
      delete state.favorites[id];
      removed++;
    } else {
      const v = byId.get(id);
      state.favorites[id] = { id, text: v?.text || "", when: Date.now() };
      added++;
    }
  });

  saveFavs(state.favorites);
  renderFavs();
  alert(added && !removed ? "Ajouté aux favoris ✅" : removed && !added ? "Retiré des favoris ✅" : "Favoris mis à jour ✅");
}

function renderFavs() {
  const favBox = el("favList");
  favBox.innerHTML = "";

  const favs = Object.values(state.favorites).sort((a,b) => b.when - a.when);

  if (favs.length === 0) {
    favBox.innerHTML = `<div class="small">Aucun favori pour l’instant.</div>`;
    return;
  }

  favs.slice(0, 6).forEach(f => {
    const div = document.createElement("div");
    div.className = "verse";
    div.innerHTML = `
      <div class="text">« ${formatSignatureQuote(f.text)} »</div>
      <div class="meta">— ${escapeHtml(f.id)} · Louis Segond 1910</div>
    `;
    favBox.appendChild(div);
  });
}

function favsToVerses() {
  return Object.values(state.favorites)
    .sort((a,b) => b.when - a.when)
    .map(f => ({ id: f.id, text: f.text }));
}

function loadFavs() {
  try { return JSON.parse(localStorage.getItem("labible_favs") || "{}"); }
  catch { return {}; }
}

function saveFavs(obj) {
  localStorage.setItem("labible_favs", JSON.stringify(obj));
}

// =============================
// SHARE / COPY
// =============================
function buildShareText() {
  const ids = Array.from(state.selected);
  if (ids.length === 0) return "";

  // pool for text lookup
  const pool = state.viewingFavs ? favsToVerses() : state.verses;
  const byId = new Map(pool.map(v => [v.id, v]));

  const lines = [];
  lines.push("LaBible.app");
  lines.push("");

  ids.slice(0, 5).forEach(id => {
    const v = byId.get(id);
    const text = v?.text ? String(v.text) : "";
    lines.push(`« ${text} »`);
    lines.push(`— ${id} (Louis Segond 1910)`);
    lines.push("");
  });

  lines.push("#LaBible #LSG1910 #versetdujour");
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

// =============================
// INSTALL (PWA)
// =============================
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
      alert("Installation disponible via le menu du navigateur (Ajouter à l’écran d’accueil).");
      return;
    }
    state.installPromptEvent.prompt();
    await state.installPromptEvent.userChoice;
    state.installPromptEvent = null;
    installBtn.style.display = "none";
  });
}

// =============================
// COOKIES BANNER (opt-in)
// =============================
function initCookies() {
  const key = "labible_cookie_choice";
  const banner = el("cookieBanner");
  const choice = localStorage.getItem(key);
  if (!choice) banner.classList.add("show");

  el("cookieAccept").addEventListener("click", () => {
    localStorage.setItem(key, "accept");
    banner.classList.remove("show");
    // Place optional analytics loader here (ONLY after accept)
  });

  el("cookieDeny").addEventListener("click", () => {
    localStorage.setItem(key, "deny");
    banner.classList.remove("show");
  });
}

// =============================
// EVENTS
// =============================
function attachEvents() {
  el("bookSelect").addEventListener("change", () => {
    fillChapters();
  });

  el("loadBtn").addEventListener("click", async () => {
    await showChapter();
  });

  el("clearBtn").addEventListener("click", () => {
    el("searchInput").value = "";
    state.selected.clear();
    updateSelectedCount();
    renderVerses(state.viewingFavs ? favsToVerses() : state.verses);
  });

  el("searchInput").addEventListener("input", () => {
    const q = el("searchInput").value;
    // if user is typing, show search results
    if (q.trim().length >= 2) {
      searchVerses(q);
    } else {
      // revert
      renderVerses(state.viewingFavs ? favsToVerses() : state.verses);
      el("resultsTitle").textContent = state.viewingFavs ? "Favoris" : "Résultats";
    }
  });

  el("toggleFavBtn").addEventListener("click", () => {
    state.viewingFavs = !state.viewingFavs;
    state.selected.clear();
    updateSelectedCount();

    if (state.viewingFavs) {
      el("resultsTitle").textContent = "Favoris";
      renderVerses(favsToVerses());
    } else {
      el("resultsTitle").textContent = "Résultats";
      renderVerses(state.verses);
    }
  });

  el("clearSelBtn").addEventListener("click", () => {
    state.selected.clear();
    updateSelectedCount();
    renderVerses(state.viewingFavs ? favsToVerses() : state.verses);
  });

  el("copyBtn").addEventListener("click", copySelected);
  el("shareBtn").addEventListener("click", shareSelected);
  el("favBtn").addEventListener("click", toggleFavoriteSelected);
}

init();