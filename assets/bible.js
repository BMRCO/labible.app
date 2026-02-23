let BOOKS = null;
let BIBLE_RAW = null;
let INDEX = null; // { [bookId]: { name, chapters: { [chapter]: [{verse,text}] } } }

export async function loadBible() {
  if (BOOKS && BIBLE_RAW && INDEX) return { books: BOOKS, bible: BIBLE_RAW, index: INDEX };

  const [booksRes, bibleRes] = await Promise.all([
    fetch("data/books.json", { cache: "no-store" }).catch(() => null),
    fetch("data/segond_1910.json", { cache: "no-store" }),
  ]);

  if (!bibleRes.ok) throw new Error("Impossible de charger segond_1910.json");
  BIBLE_RAW = await bibleRes.json();

  const booksHint = booksRes && booksRes.ok ? await booksRes.json() : [];

  const versesArray = Array.isArray(BIBLE_RAW?.verses)
    ? BIBLE_RAW.verses
    : (Array.isArray(BIBLE_RAW) ? BIBLE_RAW : null);

  if (Array.isArray(versesArray)) {
    INDEX = buildIndexFromArray(versesArray, booksHint);
    BOOKS = buildBooksFromIndex(INDEX, booksHint);
    return { books: BOOKS, bible: BIBLE_RAW, index: INDEX };
  }

  if (BIBLE_RAW && typeof BIBLE_RAW === "object") {
    INDEX = buildIndexFromObject(BIBLE_RAW, booksHint);
    BOOKS = buildBooksFromIndex(INDEX, booksHint);
    return { books: BOOKS, bible: BIBLE_RAW, index: INDEX };
  }

  throw new Error("Format de Bible inconnu.");
}

export function getBooks() { return BOOKS || []; }
export function getIndex() { return INDEX; }

export function getChapterCount(bookId, index = INDEX) {
  const b = index?.[bookId];
  if (!b) return 0;
  let max = 0;
  for (const c of Object.keys(b.chapters || {})) max = Math.max(max, Number(c));
  return max;
}

export function listVerses(bookId, chapter, index = INDEX) {
  const b = index?.[bookId];
  if (!b) return [];
  return b.chapters?.[String(chapter)] || [];
}

export function getVerseText(bookId, chapter, verse, index = INDEX) {
  const list = listVerses(bookId, chapter, index);
  const found = list.find(x => x.verse === Number(verse));
  return found ? found.text : "";
}

export function formatRef(books, bookId, chapter, verse = null) {
  const b = (books || []).find(x => String(x.id) === String(bookId));
  const bookName = b?.name || bookId;
  return verse ? `${bookName} ${chapter}:${verse}` : `${bookName} ${chapter}`;
}

export function parseReference(input, books) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const cleaned = raw.replace(/[.,;!?]/g, " ").replace(/\s+/g, " ").trim();
  const m =
    cleaned.match(/^(.+?)\s+(\d+)(?::(\d+))?$/i) ||
    cleaned.match(/^(.+?)\s+(\d+)\s+(\d+)$/i);
  if (!m) return null;

  const token = normalizeToken(m[1]);
  const chapter = Number(m[2]);
  const verse = m[3] ? Number(m[3]) : null;
  if (!Number.isFinite(chapter)) return null;

  // alias comuns FR
  const alias = new Map([
    ["gn","genese"],["gen","genese"],
    ["exo","exode"],["ex","exode"],
    ["ps","psaumes"],["psa","psaumes"],
    ["pr","proverbes"],["prov","proverbes"],
    ["mt","matthieu"],["mat","matthieu"],
    ["mc","marc"],["mk","marc"],
    ["lc","luc"],["lk","luc"],
    ["jn","jean"],["jean","jean"],
    ["ac","actes"],["act","actes"],
    ["rm","romains"],["rom","romains"],
    ["ap","apocalypse"],["apo","apocalypse"],
  ]);
  const want = alias.get(token) || token;

  const byId = (books || []).find(b => normalizeToken(b.id) === want);
  if (byId) return { book: byId.id, chapter, verse };

  const byName = (books || []).find(b => normalizeToken(b.name) === want);
  if (byName) return { book: byName.id, chapter, verse };

  const contains = (books || []).find(b => normalizeToken(b.name).includes(want));
  if (contains) return { book: contains.id, chapter, verse };

  return null;
}

/* ---------- builders ---------- */

function buildIndexFromArray(arr, booksHint) {
  const nameById = new Map((booksHint || []).map(b => [String(b.id), String(b.name || b.id)]));
  const idx = {};

  for (const v of arr) {
    const rawBookId = v.book || v.book_id || v.bookId || v.bookID || null;
    const rawBookName = v.book_name || v.bookName || "";

    let bookId = normalizeId(rawBookId);
    if (!bookId) bookId = slugify(rawBookName);

    const bookName = String(rawBookName || nameById.get(bookId) || bookId).trim() || bookId;
    const chapter = Number(v.chapter);
    const verse = Number(v.verse);
    const text = String(v.text || "").trim();

    if (!bookId || !Number.isFinite(chapter) || !Number.isFinite(verse)) continue;

    idx[bookId] ||= { name: bookName, chapters: {} };
    idx[bookId].name ||= bookName;
    idx[bookId].chapters[String(chapter)] ||= [];
    idx[bookId].chapters[String(chapter)].push({ verse, text });
  }

  for (const b of Object.values(idx)) {
    for (const ch of Object.keys(b.chapters)) {
      b.chapters[ch].sort((a, c) => a.verse - c.verse);
    }
  }
  return idx;
}

function buildIndexFromObject(obj, booksHint) {
  const nameById = new Map((booksHint || []).map(b => [String(b.id), String(b.name || b.id)]));
  const idx = {};

  for (const bookId of Object.keys(obj)) {
    const chaptersObj = obj[bookId];
    if (!chaptersObj || typeof chaptersObj !== "object") continue;

    idx[bookId] ||= { name: nameById.get(bookId) || bookId, chapters: {} };

    for (const chapterKey of Object.keys(chaptersObj)) {
      const versesObj = chaptersObj[chapterKey];
      if (!versesObj) continue;

      const list = Array.isArray(versesObj)
        ? versesObj.map((t, i) => ({ verse: i + 1, text: String(t || "") }))
        : Object.keys(versesObj).map(v => ({ verse: Number(v), text: String(versesObj[v] || "") }));

      idx[bookId].chapters[String(chapterKey)] = list
        .filter(x => Number.isFinite(x.verse))
        .sort((a, b) => a.verse - b.verse);
    }
  }
  return idx;
}

function buildBooksFromIndex(index, booksHint) {
  const hintMap = new Map((booksHint || []).map(b => [String(b.id), String(b.name || b.id)]));
  return Object.keys(index).map(id => ({ id, name: hintMap.get(id) || index[id]?.name || id }));
}

function normalizeId(s) {
  const x = String(s || "").trim().toLowerCase();
  return x || null;
}
function normalizeToken(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}
function slugify(s) { return normalizeToken(s) || null; }
