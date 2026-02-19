const $ = (id) => document.getElementById(id);

/* ===================== SAFE ONCLICK ===================== */
function safeClick(id, fn) {
  const el = $(id);
  if (el) el.onclick = fn;
}

/* ===================== LOAD JSON ===================== */
async function loadJSON(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error("Erreur de chargement : " + path);
  return r.json();
}

let DB = null;
let books = [];
let chaptersByBook = new Map();
let CURRENT = { book: 1, chapter: 1 };

/* ===================== INIT ===================== */
async function init() {

  DB = await loadJSON("/data/segond_1910.json");

  const mapBookName = new Map();
  for (const v of DB.verses) {
    if (!mapBookName.has(v.book)) {
      mapBookName.set(v.book, v.book_name);
    }
  }

  books = Array.from(mapBookName.entries())
    .map(([book, name]) => ({ book, name }))
    .sort((a, b) => a.book - b.book);

  chaptersByBook = new Map();
  for (const v of DB.verses) {
    if (!chaptersByBook.has(v.book)) {
      chaptersByBook.set(v.book, new Set());
    }
    chaptersByBook.get(v.book).add(v.chapter);
  }

  const bookSel = $("book");
  const chapSel = $("chap");

  if (bookSel) {
    bookSel.innerHTML = books
      .map(b => `<option value="${b.book}">${b.name}</option>`)
      .join("");

    bookSel.onchange = () => {
      onBookChange(Number(bookSel.value));
    };
  }

  if (chapSel) {
    chapSel.onchange = () => {
      render(Number(bookSel.value), Number(chapSel.value));
    };
  }

  safeClick("btnSearch", doSearch);
  safeClick("btnClear", clearSearch);
  safeClick("btnFav", () => alert("Favori ajouté"));
  safeClick("btnShowFav", () => alert("Favoris"));
  safeClick("btnCloseFav", () => {
    const box = $("favBox");
    if (box) box.classList.add("hidden");
  });

  onBookChange(books[0].book);
}

/* ===================== BOOK CHANGE ===================== */
function onBookChange(bookNum) {
  const chapSel = $("chap");
  if (!chapSel) return;

  const chaps = Array.from(chaptersByBook.get(bookNum)).sort((a, b) => a - b);

  chapSel.innerHTML = chaps
    .map(c => `<option value="${c}">${c}</option>`)
    .join("");

  render(bookNum, chaps[0]);
}

/* ===================== RENDER ===================== */
function render(bookNum, chapNum) {

  CURRENT.book = bookNum;
  CURRENT.chapter = chapNum;

  const title = $("title");
  const content = $("content");

  const bookName = books.find(b => b.book === bookNum)?.name || "";

  if (title) {
    title.textContent = `${bookName} ${chapNum}`;
  }

  const verses = DB.verses
    .filter(v => v.book === bookNum && v.chapter === chapNum)
    .sort((a, b) => a.verse - b.verse);

  if (content) {
    content.innerHTML = verses
      .map(v => `<p><b>${v.verse}</b> ${v.text}</p>`)
      .join("");
  }
}

/* ===================== SEARCH ===================== */
function doSearch() {
  const qInput = $("q");
  const hits = $("hits");
  const results = $("results");

  if (!qInput || !hits || !results) return;

  const q = qInput.value.trim().toLowerCase();
  if (!q) return;

  const found = DB.verses.filter(v =>
    v.text.toLowerCase().includes(q)
  ).slice(0, 50);

  results.classList.remove("hidden");

  hits.innerHTML = found.map(v =>
    `<div><b>${v.book_name} ${v.chapter}:${v.verse}</b> ${v.text}</div>`
  ).join("");
}

function clearSearch() {
  const qInput = $("q");
  const hits = $("hits");
  const results = $("results");

  if (qInput) qInput.value = "";
  if (hits) hits.innerHTML = "";
  if (results) results.classList.add("hidden");
}

/* ===================== START ===================== */
init().catch(err => {
  console.error(err);
  document.body.innerHTML =
    `<pre style="color:red">${err.message}</pre>`;
});