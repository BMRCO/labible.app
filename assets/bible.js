// assets/bible.js (AUTO bookIds + index robusto)

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

  // A) formato array?
  const versesArray = Array.isArray(BIBLE_RAW?.verses)
    ? BIBLE_RAW.verses
    : (Array.isArray(BIBLE_RAW) ? BIBLE_RAW : null);

  if (Array.isArray(versesArray)) {
    INDEX = buildIndexFromArray(versesArray, booksHint);
    BOOKS = buildBooksFromIndex(INDEX, booksHint); // <- aqui está a magia
    return { books: BOOKS, bible: BIBLE_RAW, index: INDEX };
  }

  // B) formato indexado?
  if (BIBLE_RAW && typeof BIBLE_RAW === "object") {
    INDEX = buildIndexFromObject(BIBLE_RAW, booksHint);
    BOOKS = buildBooksFromIndex(INDEX, booksHint);
    return { books: BOOKS, bible: BIBLE_RAW, index: INDEX };
  }

  throw new Error("Format de Bible inconnu.");
}

export function getChapterCount(_books, bookId, index = INDEX) {
  const b = index?.[bookId];
  if (!b) return 0;
  let max = 0;
  for (const c of Object.keys(b.chapters || {})) max = Math.max(max, Number(c));
  return max;
}

export function listVerses(_bible, bookId, chapter, index = INDEX) {
  const b = index?.[bookId];
  if (!b) return [];
  return b.chapters?.[String(chapter)] || [];
}

export function getVerseText(_bible, bookId, chapter, verse, index = INDEX) {
  const list = listVerses(null, bookId, chapter, index);
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

  const bookToken = normalizeBookToken(m[1]);
  const chapter = Number(m[2]);
  const verse = m[3] ? Number(m[3]) : null;
  if (!Number.isFinite(chapter)) return null;

  // 1) match por id
  const byId = (books || []).find(b => String(b.id).toLowerCase() === bookToken);
  if (byId) return { book: byId.id, chapter, verse };

  // 2) match por nome
  const byName = (books || []).find(b => normalizeBookToken(b.name) === bookToken);
  if (byName) return { book: byName.id, chapter, verse };

  // 3) contains
  const contains = (books || []).find(b => normalizeBookToken(b.name).includes(bookToken));
  if (contains) return { book: contains.id, chapter, verse };

  return null;
}

/* ---------- Helpers ---------- */

function buildIndexFromArray(arr, booksHint) {
  const nameById = new Map((booksHint || []).map(b => [String(b.id), String(b.name || b.id)]));
  const idx = {};

  for (const v of arr) {
    const rawBookId = v.book || v.book_id || v.bookId || v.bookID || null;
    const rawBookName = v.book_name || v.bookName || "";

    // prioridade: campo book/id, senão slug do nome
    let bookId = normalizeBookId(rawBookId);
    if (!bookId) bookId = guessBookIdFromName(rawBookName, nameById);

    const bookName =
      String(rawBookName || nameById.get(bookId) || bookId || "").trim() || String(bookId || "");

    const chapter = Number(v.chapter);
    const verse = Number(v.verse);
    const text = String(v.text || "").trim();

    if (!bookId || !Number.isFinite(chapter) || !Number.isFinite(verse)) continue;

    idx[bookId] ||= { name: bookName, chapters: {} };
    if (!idx[bookId].name) idx[bookId].name = bookName;

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
  return Object.keys(index).map(id => ({
    id,
    name: hintMap.get(id) || index[id]?.name || id,
  }));
}

function normalizeBookId(input) {
  const s = String(input || "").trim().toLowerCase();
  return s || null;
}

function normalizeBookToken(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function guessBookIdFromName(bookName, nameByIdMap) {
  const slug = normalizeBookToken(bookName);
  if (!slug) return null;

  // tenta mapear por "prefixo" vs ids conhecidos (gen, exo, etc.)
  const ids = Array.from(nameByIdMap.keys());
  const prefix = slug.slice(0, 3);
  const hit = ids.find(id => id === prefix || id.startsWith(prefix));
  return hit || slug; // fallback: usar slug como id
}
