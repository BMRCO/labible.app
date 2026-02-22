let BOOKS = null;
let BIBLE = null;

// books.json expected structure: [{ id, name, chapters } ...] OR similar
// segond_1910.json expected structure: { "<bookId>": { "<chapter>": { "<verse>": "text" } } } OR similar.

export async function loadBible() {
  if (BOOKS && BIBLE) return { books: BOOKS, bible: BIBLE };

  const [booksRes, bibleRes] = await Promise.all([
    fetch("data/books.json", { cache: "no-store" }),
    fetch("data/segond_1910.json", { cache: "no-store" }),
  ]);

  if (!booksRes.ok || !bibleRes.ok) throw new Error("Impossible de charger les données Bible.");

  BOOKS = await booksRes.json();
  BIBLE = await bibleRes.json();

  return { books: BOOKS, bible: BIBLE };
}

export function normalizeBookId(input) {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();

  // Quick aliases (French + common)
  const map = new Map([
    ["gen", "genese"], ["gn", "genese"], ["genese", "genese"],
    ["ex", "exode"], ["exo", "exode"], ["exode", "exode"],
    ["ps", "psaumes"], ["psa", "psaumes"], ["psaumes", "psaumes"],
    ["pr", "proverbes"], ["prov", "proverbes"], ["proverbes", "proverbes"],
    ["mt", "matthieu"], ["mat", "matthieu"], ["matthieu", "matthieu"],
    ["mc", "marc"], ["mk", "marc"], ["marc", "marc"],
    ["lc", "luc"], ["lk", "luc"], ["luc", "luc"],
    ["jn", "jean"], ["jhn", "jean"], ["jean", "jean"],
    ["ac", "actes"], ["act", "actes"], ["actes", "actes"],
    ["rm", "romains"], ["rom", "romains"], ["romains", "romains"],
    ["1co", "1corinthiens"], ["2co", "2corinthiens"],
    ["ap", "apocalypse"], ["apo", "apocalypse"], ["apocalypse", "apocalypse"],
  ]);

  if (map.has(s)) return map.get(s);
  return s;
}

export function escapeHtml(str) {
  // PRO: real HTML escaping
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function getBookById(books, id) {
  const needle = String(id).toLowerCase();
  return books.find(b => String(b.id).toLowerCase() === needle) || null;
}

export function getChapterCount(books, bookId) {
  const b = getBookById(books, bookId);
  if (!b) return 0;
  // common patterns
  if (Number.isFinite(b.chapters)) return Number(b.chapters);
  if (Array.isArray(b.chapters)) return b.chapters.length;
  if (Array.isArray(b.chapterCount)) return b.chapterCount.length;
  if (Number.isFinite(b.chapterCount)) return Number(b.chapterCount);
  return 0;
}

export function listVerses(bible, bookId, chapter) {
  const book = bible?.[bookId] || bible?.[String(bookId)] || null;
  if (!book) return [];
  const ch = book?.[String(chapter)] || book?.[chapter] || null;
  if (!ch) return [];
  // ch could be object { "1": "text" ... } or array
  if (Array.isArray(ch)) {
    return ch.map((t, i) => ({ verse: i + 1, text: String(t || "") }));
  }
  return Object.keys(ch)
    .map(v => ({ verse: Number(v), text: String(ch[v] || "") }))
    .filter(x => Number.isFinite(x.verse))
    .sort((a, b) => a.verse - b.verse);
}

export function getVerseText(bible, bookId, chapter, verse) {
  const list = listVerses(bible, bookId, chapter);
  const found = list.find(x => x.verse === Number(verse));
  return found ? found.text : "";
}

export function parseReference(input, books) {
  // Accept: "Jn 3:16", "Jean 3:16", "jean 3 16", "jean 3"
  const raw = String(input || "").trim();
  if (!raw) return null;

  const cleaned = raw
    .replace(/[.,;!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // find first number block (chapter/verse)
  const m = cleaned.match(/^(.+?)\s+(\d+)(?::(\d+))?$/i) || cleaned.match(/^(.+?)\s+(\d+)\s+(\d+)$/i);
  if (!m) return null;

  const bookName = normalizeBookId(m[1]);
  const chapter = Number(m[2]);
  const verse = m[3] ? Number(m[3]) : null;

  if (!Number.isFinite(chapter)) return null;

  // map bookName to actual id (books.json is source of truth)
  const candidates = books.map(b => String(b.id));
  const direct = candidates.find(id => String(id).toLowerCase() === bookName);
  if (direct) return { book: direct, chapter, verse };

  // try match by name field
  const byName = books.find(b => String(b.name || "").toLowerCase() === bookName);
  if (byName) return { book: byName.id, chapter, verse };

  // contains match (fallback)
  const contains = books.find(b => String(b.name || "").toLowerCase().includes(bookName));
  if (contains) return { book: contains.id, chapter, verse };

  return null;
}

export function formatRef(books, bookId, chapter, verse = null) {
  const b = getBookById(books, bookId);
  const bookName = b?.name || bookId;
  return verse ? `${bookName} ${chapter}:${verse}` : `${bookName} ${chapter}`;
}