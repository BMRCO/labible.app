const $ = (id) => document.getElementById(id);

async function loadJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error("Erreur de chargement: " + path);
  return r.json();
}

let DB = null;
let books = [];
let chaptersByBook = new Map();
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

/* Theme */
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

/* Share verse (texto + link) */
async function shareVerse(bookName, bookSlug, chapter, verse, verseText) {
  const url = `${location.origin}/${bookSlug}/${chapter}#v${verse}`;
  const full = `${bookName} ${chapter}:${verse}\n\n${verseText}\n\n${url}`;

  try {
    if (navigator.share) {
      await navigator.share({ title: "La Bible", text: full, url });
      return;
    }
  } catch (_) {}

  try {
    await navigator.clipboard.writeText(full);
    alert("Texte + lien copiés ✅");
    return;
  } catch (_) {}

  prompt("Copiez le texte :", full);
}

/* Favoris */
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
  $("favBox").classList.remove("hidden");
}

function closeFavorites() {
  $("favBox").classList.add("hidden");
}

function renderFavorites() {
  const list = $("favList");
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
      $("book").value = String(b);
      onBookChange(b, { updateURL: false });
      setTimeout(() => {
        $("chap").value = String(c);
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

/* Search */
function doSearch() {
  const qRaw = $("q").value.trim();
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

  $("results").classList.remove("hidden");

  if (!hits.length) {
    $("hits").innerHTML = `<p>Aucun résultat pour <b>${escapeHTML(qRaw)}</b>.</p>`;
    return;
  }

  $("hits").innerHTML = hits.map(v => `
    <div class="hit">
      <div class="ref">${escapeHTML(`${v.book_name} ${v.chapter}:${v.verse}`)}</div>
      <div class="txt">${escapeHTML(v.text)}</div>
    </div>
  `).join("");
}

function clearSearch(){
  $("q").value = "";
  $("results").classList.add("hidden");
  $("hits").innerHTML = "";
}

/* Reading */
async function init() {
  applyThemeFromStorage();
  setupThemeToggle();

  DB = await loadJSON("/data/segond_1910.json");

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
  bookSel.innerHTML = books.map(b => `<option value="${b.book}">${escapeHTML(b.name)}</option>`).join("");
  bookSel.onchange = () => onBookChange(Number(bookSel.value), { updateURL: true });

  $("btnFav").onclick = toggleFavoriteCurrent;
  $("btnShowFav").onclick = openFavorites;
  $("btnCloseFav").onclick = closeFavorites;

  $("btnSearch").onclick = doSearch;
  $("btnClear").onclick = clearSearch;
  $("q").addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

  const closeResultsBtn = $("btnCloseResults");
  if (closeResultsBtn) closeResultsBtn.onclick = () => $("results").classList.add("hidden");

  // Delegation share
  $("content").addEventListener("click", (e) => {
    const btn = e.target.closest(".sharebtn");
    if (!btn) return;

    const bookNum = Number(btn.dataset.book);
    const chapter = Number(btn.dataset.chapter);
    const verse = Number(btn.dataset.verse);
    const verseText = btn.dataset.text || "";

    const bookObj = books.find(b => b.book === bookNum);
    if (!bookObj) return;

    shareVerse(bookObj.name, bookObj.slug, chapter, verse, verseText);
  });

  // Open by URL
  const wanted = parsePath();
  if (wanted) {
    const foundBook = books.find(b => b.slug === wanted.bookSlug);
    if (foundBook) {
      $("book").value = String(foundBook.book);
      onBookChange(foundBook.book, { updateURL: false });

      setTimeout(() => {
        const chaps = Array.from(chaptersByBook.get(foundBook.book)).sort((a, b) => a - b);
        const chapOk = chaps.includes(wanted.chapter) ? wanted.chapter : chaps[0];
        $("chap").value = String(chapOk);
        render(foundBook.book, chapOk, { updateURL: true });
      }, 0);

      return;
    }
  }

  onBookChange(books[0].book, { updateURL: true });
}

function onBookChange(bookNum, opts = { updateURL: true }) {
  const chapSel = $("chap");
  const chaps = Array.from(chaptersByBook.get(bookNum)).sort((a, b) => a - b);

  chapSel.innerHTML = chaps.map(c => `<option value="${c}">${c}</option>`).join("");
  chapSel.onchange = () => render(bookNum, Number(chapSel.value), { updateURL: true });

  const firstChap = chaps[0];
  chapSel.value = String(firstChap);
  render(bookNum, firstChap, { updateURL: opts.updateURL });
}

function render(bookNum, chapNum, opts = { updateURL: true }) {
  CURRENT.book = bookNum;
  CURRENT.chapter = chapNum;

  const bookObj = books.find(b => b.book === bookNum);
  const bookName = bookObj?.name || "";

  $("title").textContent = `${bookName} ${chapNum}`;

  const verses = DB.verses
    .filter(v => v.book === bookNum && v.chapter === chapNum)
    .sort((a, b) => a.verse - b.verse);

  $("content").innerHTML = verses.map(v => {
    const vid = `v${v.verse}`;
    const safeAttr = escapeHTML(v.text).replaceAll('"', "&quot;");
    return `
      <p id="${vid}">
        <b>${v.verse}</b>
        ${escapeHTML(v.text)}
        <button type="button"
          class="sharebtn"
          data-book="${bookNum}"
          data-chapter="${chapNum}"
          data-verse="${v.verse}"
          data-text="${safeAttr}"
          title="Partager">🔗</button>
      </p>
    `;
  }).join("");

  if (opts.updateURL) updateUrl(bookNum, chapNum);

  if (location.hash && location.hash.startsWith("#v")) {
    const el = document.querySelector(location.hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("results").classList.add("hidden");
}

init().catch(err => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:red">${escapeHTML(err.message)}</pre>`;
});