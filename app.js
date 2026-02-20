// app.js — LaBible.app (robusto: sem erros de null + suporta /livre/chapitre + favs + search)

const $ = (id) => document.getElementById(id);
const on = (id, evt, fn) => {
  const el = $(id);
  if (el) el.addEventListener(evt, fn);
};

async function loadJSON(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error("Erreur de chargement : " + path);
  return r.json();
}

let DB = null;
let books = [];                 // [{book, name, slug}]
let chaptersByBook = new Map(); // book -> Set(chapters)
let CURRENT = { book: 1, chapter: 1 };

function escapeHTML(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function normalize(s){
  return String(s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function slugifyBookName(name) {
  return normalize(name)
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parsePath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts.length >= 2) {
    const bookSlug = normalize(parts[0]).replace(/[^a-z0-9-]/g, "");
    const chapter = parseInt(parts[1], 10);
    if (bookSlug && Number.isFinite(chapter)) return { bookSlug, chapter };
  }
  return null;
}

function updateUrl(bookNum, chapNum) {
  const b = books.find(x => x.book === bookNum);
  if (!b) return;
  history.replaceState(null, "", `/${b.slug}/${chapNum}`);
}

/* ---------------- Theme ---------------- */
function applyThemeFromStorage(){
  const saved = localStorage.getItem("theme");
  if (saved === "dark") document.body.classList.add("dark");
}

function setupThemeToggle(){
  const btn = $("toggleTheme");
  if (!btn) return;

  const syncIcon = () => {
    btn.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
  };

  syncIcon();

  btn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
    syncIcon();
  });
}

/* ---------------- Favoris ---------------- */
function favKey() { return "bible_fr_favs_v1"; }

function getFavs() {
  try { return JSON.parse(localStorage.getItem(favKey())) || []; }
  catch { return []; }
}

function saveFavs(list) {
  localStorage.setItem(favKey(), JSON.stringify(list));
}

function currentRefText() {
  const bookName = books.find(b => b.book === CURRENT.book)?.name || "";
  return `${bookName} ${CURRENT.chapter}`;
}

function toggleFavoriteCurrent() {
  const favs = getFavs();
  const id = `${CURRENT.book}:${CURRENT.chapter}`;
  const exists = favs.find(x => x.id === id);

  if (exists) {
    saveFavs(favs.filter(x => x.id !== id));
    alert("Retiré des favoris ✅");
  } else {
    favs.unshift({ id, book: CURRENT.book, chapter: CURRENT.chapter, title: currentRefText(), ts: Date.now() });
    saveFavs(favs);
    alert("Ajouté aux favoris ★");
  }
}

function openFavorites() {
  renderFavorites();
  const box = $("favBox");
  if (box) box.classList.remove("hidden");
}

function closeFavorites() {
  const box = $("favBox");
  if (box) box.classList.add("hidden");
}

function renderFavorites() {
  const list = $("favList");
  if (!list) return;

  const favs = getFavs();
  if (!favs.length) {
    list.innerHTML = `<p>Aucun favori.</p>`;
    return;
  }

  list.innerHTML = favs.map(f => `
    <div class="favrow">
      <button class="btn" data-go="${f.book}:${f.chapter}">Ouvrir</button>
      <div class="title">${escapeHTML(f.title)}<div class="small">${escapeHTML(f.id)}</div></div>
      <button class="btn btn-secondary" data-del="${f.book}:${f.chapter}">Supprimer</button>
    </div>
  `).join("");

  list.querySelectorAll("[data-go]").forEach(btn => {
    btn.onclick = () => {
      const [b, c] = btn.getAttribute("data-go").split(":").map(Number);
      const bookSel = $("book");
      if (bookSel) bookSel.value = String(b);
      onBookChange(b, { updateURL: false });

      setTimeout(() => {
        const chapSel = $("chap");
        if (chapSel) chapSel.value = String(c);
        render(b, c, { updateURL: true });
      }, 0);

      closeFavorites();
    };
  });

  list.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = () => {
      const [b, c] = btn.getAttribute("data-del").split(":").map(Number);
      const id = `${b}:${c}`;
      saveFavs(getFavs().filter(x => x.id !== id));
      renderFavorites();
    };
  });
}

/* ---------------- Search ---------------- */
function doSearch() {
  const qEl = $("q");
  const results = $("results");
  const hitsEl = $("hits");
  if (!qEl || !results || !hitsEl) return;

  const qRaw = qEl.value.trim();
  const q = normalize(qRaw);
  if (!q) return;

  const hits = [];
  const maxHits = 80;

  for (const v of DB.verses) {
    if (normalize(v.text).includes(q)) {
      hits.push(v);
      if (hits.length >= maxHits) break;
    }
  }

  results.classList.remove("hidden");

  if (!hits.length) {
    hitsEl.innerHTML = `<p>Aucun résultat pour <b>${escapeHTML(qRaw)}</b>.</p>`;
    return;
  }

  hitsEl.innerHTML = hits.map(v => `
    <div class="hit">
      <div class="ref">${escapeHTML(`${v.book_name} ${v.chapter}:${v.verse}`)}</div>
      <div class="txt">${escapeHTML(v.text)}</div>
    </div>
  `).join("");
}

function clearSearch(){
  const qEl = $("q");
  const results = $("results");
  const hitsEl = $("hits");
  if (qEl) qEl.value = "";
  if (hitsEl) hitsEl.innerHTML = "";
  if (results) results.classList.add("hidden");
}

/* ---------------- Reading ---------------- */
function onBookChange(bookNum, opts = { updateURL: true }) {
  const chapSel = $("chap");
  if (!chapSel) return;

  const chaps = Array.from(chaptersByBook.get(bookNum) || []).sort((a, b) => a - b);
  chapSel.innerHTML = chaps.map(c => `<option value="${c}">${c}</option>`).join("");

  chapSel.onchange = () => render(bookNum, Number(chapSel.value), { updateURL: true });

  const firstChap = chaps[0] || 1;
  chapSel.value = String(firstChap);
  render(bookNum, firstChap, { updateURL: opts.updateURL });
}

function render(bookNum, chapNum, opts = { updateURL: true }) {
  CURRENT.book = bookNum;
  CURRENT.chapter = chapNum;

  const bookObj = books.find(b => b.book === bookNum);
  const bookName = bookObj?.name || "";

  const titleEl = $("title");
  if (titleEl) titleEl.textContent = `${bookName} ${chapNum}`;

  const verses = DB.verses
    .filter(v => v.book === bookNum && v.chapter === chapNum)
    .sort((a, b) => a.verse - b.verse);

  const content = $("content");
  if (!content) return;

  // ✅ Sem botões de share/seleção — texto normal para copiar/colar
  content.innerHTML = verses.map(v => {
    const vid = `v${v.verse}`;
    return `
      <p id="${vid}" class="verse">
        <b class="vnum">${v.verse}</b>
        <span class="vtext">${escapeHTML(v.text)}</span>
      </p>
    `;
  }).join("");

  if (opts.updateURL) updateUrl(bookNum, chapNum);

  if (location.hash && location.hash.startsWith("#v")) {
    const el = document.querySelector(location.hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const results = $("results");
  if (results) results.classList.add("hidden");
}

/* ---------------- Init ---------------- */
async function initApp() {
  applyThemeFromStorage();
  setupThemeToggle();

  // ✅ IMPORTANTE: caminho RELATIVO (corrige /genese/1)
  // Se falhar cache, muda v=4, v=5...
  DB = await loadJSON("./data/segond_1910.json?v=3");

  const mapBookName = new Map();
  for (const v of DB.verses) {
    if (!mapBookName.has(v.book)) mapBookName.set(v.book, v.book_name);
  }

  books = Array.from(mapBookName.entries())
    .map(([book, name]) => ({ book, name, slug: slugifyBookName(name) }))
    .sort((a, b) => a.book - b.book);

  chaptersByBook = new Map();
  for (const v of DB.verses) {
    if (!chaptersByBook.has(v.book)) chaptersByBook.set(v.book, new Set());
    chaptersByBook.get(v.book).add(v.chapter);
  }

  const bookSel = $("book");
  if (!bookSel) throw new Error("HTML incomplet: #book introuvable");

  bookSel.innerHTML = books.map(b => `<option value="${b.book}">${escapeHTML(b.name)}</option>`).join("");
  bookSel.onchange = () => onBookChange(Number(bookSel.value), { updateURL: true });

  on("btnFav", "click", toggleFavoriteCurrent);
  on("btnShowFav", "click", openFavorites);
  on("btnCloseFav", "click", closeFavorites);
  on("btnSearch", "click", doSearch);
  on("btnClear", "click", clearSearch);
  on("q", "keydown", (e) => { if (e.key === "Enter") doSearch(); });
  on("btnCloseResults", "click", () => $("results")?.classList.add("hidden"));

  // Open by URL /slug/chapter
  const wanted = parsePath();
  if (wanted) {
    const foundBook = books.find(b => b.slug === wanted.bookSlug);
    if (foundBook) {
      bookSel.value = String(foundBook.book);
      onBookChange(foundBook.book, { updateURL: false });

      setTimeout(() => {
        const chaps = Array.from(chaptersByBook.get(foundBook.book) || []).sort((a, b) => a - b);
        const chapOk = chaps.includes(wanted.chapter) ? wanted.chapter : (chaps[0] || 1);
        const chapSel = $("chap");
        if (chapSel) chapSel.value = String(chapOk);
        render(foundBook.book, chapOk, { updateURL: true });
      }, 0);
      return;
    }
  }

  onBookChange(books[0].book, { updateURL: true });
}

window.addEventListener("DOMContentLoaded", () => {
  initApp().catch(err => {
    console.error(err);
    document.body.innerHTML = `<pre style="color:red">${escapeHTML(err.message)}</pre>`;
  });
});