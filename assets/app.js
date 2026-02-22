import { loadBible, listVerses, getChapterCount, parseReference, formatRef, getVerseText } from "./bible.js";
import { migrateIfNeeded, loadJSON, saveJSON, pushHistory, getSettings, setSettings, resetSettings, STORAGE_KEYS } from "./storage.js";
import { $, setActiveSection, toast, renderResult } from "./ui.js";
import { shareVerseAsImage } from "./share-image.js";

migrateIfNeeded();

const state = {
  books: [],
  bible: {},
  ready: false,
  current: { book: null, chapter: null, selected: new Set() },
  lastRenderedList: [], // pool for favorites / copy
  plan: null,
  vdd: null,
  deferredInstallPrompt: null,
  route: { path: "/", params: {} },
};

const els = {
  year: $("#year"),
  chipInstall: $("#chipInstall"),
  chipOffline: $("#chipOffline"),
  chipUpdated: $("#chipUpdated"),

  bookSelect: $("#bookSelect"),
  chapterSelect: $("#chapterSelect"),
  openBtn: $("#openBtn"),
  continueBtn: $("#continueBtn"),

  reader: $("#reader"),
  readerTitle: $("#readerTitle"),
  readerMeta: $("#readerMeta"),
  verses: $("#verses"),
  prevChapter: $("#prevChapter"),
  nextChapter: $("#nextChapter"),
  prevChapter2: $("#prevChapter2"),
  nextChapter2: $("#nextChapter2"),
  btnReaderFav: $("#btnReaderFav"),
  btnReaderCopy: $("#btnReaderCopy"),
  btnReaderShare: $("#btnReaderShare"),

  // topbar
  btnSearch: $("#btnSearch"),
  btnPlan: $("#btnPlan"),
  btnFav: $("#btnFav"),
  btnSettings: $("#btnSettings"),

  // search
  search: $("#search"),
  searchInput: $("#searchInput"),
  searchGo: $("#searchGo"),
  searchInfo: $("#searchInfo"),
  searchResults: $("#searchResults"),

  // favorites
  favorites: $("#favorites"),
  favList: $("#favList"),
  favSearch: $("#favSearch"),
  favTag: $("#favTag"),
  favApplyTag: $("#favApplyTag"),
  btnExportFav: $("#btnExportFav"),
  btnImportFav: $("#btnImportFav"),
  btnClearFav: $("#btnClearFav"),

  // plan
  plan: $("#plan"),
  planPrev: $("#planPrev"),
  planToday: $("#planToday"),
  planNext: $("#planNext"),
  planDayKicker: $("#planDayKicker"),
  planDayTitle: $("#planDayTitle"),
  planOpen: $("#planOpen"),
  planToggleDone: $("#planToggleDone"),
  planProgress: $("#planProgress"),
  planRefs: $("#planRefs"),

  // vdd
  vddCard: $("#vddCard"),
  vddRef: $("#vddRef"),
  vddText: $("#vddText"),
  btnShareVdd: $("#btnShareVdd"),
  vddSection: $("#vdd"),
  vddList: $("#vddList"),

  // settings
  settingsModal: $("#settingsModal"),
  themeSelect: $("#themeSelect"),
  fontSizeSelect: $("#fontSizeSelect"),
  saveSettings: $("#saveSettings"),
  resetSettings: $("#resetSettings"),
};

boot().catch(err => {
  console.error(err);
  toast("Erreur de chargement.");
});

async function boot() {
  els.year.textContent = String(new Date().getFullYear());

  applySettings(getSettings());
  wireInstall();
  wireSW();
  wireNav();
  wireSettings();
  wireQuickNav();
  wireSearch();
  wireFavorites();
  wirePlan();
  wireVdd();

  // Restore deep link from 404.html redirect
  const attempted = sessionStorage.getItem("labible:redirect");
  if (attempted) {
    sessionStorage.removeItem("labible:redirect");
    history.replaceState({}, "", attempted);
  }

  // Load data
  const { books, bible } = await loadBible();
  state.books = books;
  state.bible = bible;
  state.ready = true;

  fillBookSelect();
  restoreLastReadToSelectors();

  // Initialize generators (cached)
  state.plan = await getPlan365();
  state.vdd = await getVdd365();

  // Render VDD widget (today)
  renderVddToday();

  // Route initial
  routeTo(location.pathname + location.search + location.hash, { replace: true });
  window.addEventListener("popstate", () => routeTo(location.pathname + location.search + location.hash, { replace: true, silent: true }));

  // Default view
  if (location.pathname === "/" || location.pathname === "/index.html") {
    setActiveSection(["hero", "quickNav"]);
  }
}

/* -----------------------
   Navigation / Routing
------------------------ */

function wireNav() {
  // Intercept clicks for internal navigation
  document.addEventListener("click", (e) => {
    const a = e.target?.closest?.("a[data-link]");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href) return;
    e.preventDefault();
    navigate(href);
  });

  els.btnSearch.addEventListener("click", () => navigate("/recherche"));
  els.btnPlan.addEventListener("click", () => navigate("/plan/aujourdhui"));
  els.btnFav.addEventListener("click", () => navigate("/favoris"));
  els.btnSettings.addEventListener("click", () => els.settingsModal.showModal());
}

function navigate(path) {
  history.pushState({}, "", path);
  routeTo(path, { replace: false });
}

function routeTo(fullPath, { replace = false, silent = false } = {}) {
  // Accept hash routing fallback: #/v/jean/3/16
  const hashIdx = fullPath.indexOf("#/");
  let path = fullPath;
  if (hashIdx >= 0) path = fullPath.slice(hashIdx + 1);

  path = path.split("?")[0]; // ignore query for now
  if (!path.startsWith("/")) path = "/" + path;

  // Routes:
  // / => home
  // /recherche
  // /favoris
  // /v/:book/:chapter/:verse?
  // /plan/aujourdhui
  // /plan/jour/:n
  // /vdd
  const parts = path.replace(/\/+$/, "").split("/").filter(Boolean);

  if (!silent) window.scrollTo({ top: 0, behavior: "instant" });

  if (parts.length === 0) {
    setActiveSection(["hero", "quickNav"]);
    return;
  }

  const [p0, p1, p2, p3] = parts;

  if (p0 === "recherche") {
    setActiveSection(["search"]);
    els.searchInput.focus();
    return;
  }

  if (p0 === "favoris") {
    setActiveSection(["favorites"]);
    renderFavorites();
    return;
  }

  if (p0 === "vdd") {
    setActiveSection(["vdd"]);
    renderVddList();
    return;
  }

  if (p0 === "plan") {
    setActiveSection(["plan"]);
    if (p1 === "aujourdhui") {
      const day = getDayOfYear(new Date());
      renderPlanDay(day);
      return;
    }
    if (p1 === "jour" && p2) {
      renderPlanDay(clampInt(p2, 1, 365));
      return;
    }
    // fallback
    renderPlanDay(getDayOfYear(new Date()));
    return;
  }

  if (p0 === "v" && p1 && p2) {
    const bookId = String(p1);
    const chapter = Number(p2);
    const verse = p3 ? Number(p3) : null;
    openReader({ book: bookId, chapter, verse });
    return;
  }

  // static placeholders
  if (["mentions", "privacy", "contact"].includes(p0)) {
    toast("Page info: à compléter (statique).");
    setActiveSection(["hero", "quickNav"]);
    return;
  }

  // fallback home
  setActiveSection(["hero", "quickNav"]);
}

/* -----------------------
   Quick Nav / Reader
------------------------ */

function wireQuickNav() {
  els.openBtn.addEventListener("click", () => {
    const book = els.bookSelect.value;
    const chapter = Number(els.chapterSelect.value);
    navigate(`/v/${book}/${chapter}`);
  });

  els.continueBtn.addEventListener("click", () => {
    const last = loadJSON(STORAGE_KEYS.lastRead, null);
    if (last?.book && last?.chapter) {
      navigate(`/v/${last.book}/${last.chapter}`);
    } else {
      toast("Aucune lecture récente.");
    }
  });

  els.bookSelect.addEventListener("change", () => fillChapterSelect());
}

function fillBookSelect() {
  els.bookSelect.innerHTML = "";
  for (const b of state.books) {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = b.name ?? b.id;
    els.bookSelect.appendChild(opt);
  }
  fillChapterSelect();
}

function fillChapterSelect() {
  const book = els.bookSelect.value;
  const count = getChapterCount(state.books, book) || 1;
  els.chapterSelect.innerHTML = "";
  for (let i = 1; i <= count; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    els.chapterSelect.appendChild(opt);
  }
}

function restoreLastReadToSelectors() {
  const last = loadJSON(STORAGE_KEYS.lastRead, null);
  if (!last?.book) return;
  const exists = state.books.some(b => b.id === last.book);
  if (!exists) return;
  els.bookSelect.value = last.book;
  fillChapterSelect();
  if (last.chapter) els.chapterSelect.value = String(last.chapter);
}

async function openReader({ book, chapter, verse = null }) {
  if (!state.ready) return;

  const count = getChapterCount(state.books, book);
  if (!count || chapter < 1 || chapter > count) {
    toast("Référence invalide.");
    return;
  }

  state.current.book = book;
  state.current.chapter = chapter;
  state.current.selected = new Set();

  saveJSON(STORAGE_KEYS.lastRead, { book, chapter, ts: Date.now() });
  pushHistory({ book, chapter });

  // update quick selectors
  els.bookSelect.value = book;
  fillChapterSelect();
  els.chapterSelect.value = String(chapter);

  // render
  setActiveSection(["reader"]);
  const title = formatRef(state.books, book, chapter);
  els.readerTitle.textContent = title;
  els.readerMeta.textContent = `Chapitre ${chapter} · LSG 1910`;

  const verses = listVerses(state.bible, book, chapter);
  state.lastRenderedList = verses;

  els.verses.innerHTML = "";
  for (const v of verses) {
    const div = document.createElement("div");
    div.className = "verse";
    div.dataset.verse = String(v.verse);
    div.innerHTML = `<span class="verse__num">${v.verse}</span> ${escapeMini(v.text)}`;
    div.addEventListener("click", () => toggleVerseSelect(v.verse, div));
    els.verses.appendChild(div);
  }

  // if deep link includes verse, auto select + scroll
  if (verse) {
    const target = els.verses.querySelector(`.verse[data-verse="${verse}"]`);
    if (target) {
      toggleVerseSelect(verse, target, { silent: true });
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // reader actions
  els.prevChapter.onclick = () => navigate(`/v/${book}/${Math.max(1, chapter - 1)}`);
  els.nextChapter.onclick = () => navigate(`/v/${book}/${Math.min(count, chapter + 1)}`);
  els.prevChapter2.onclick = els.prevChapter.onclick;
  els.nextChapter2.onclick = els.nextChapter.onclick;

  els.btnReaderCopy.onclick = () => copySelectedOrAll();
  els.btnReaderShare.onclick = () => shareSelectedOrAll();
  els.btnReaderFav.onclick = () => favoriteSelectedOrAll();

  // update route (if opened from internal openReader call)
  if (!location.pathname.startsWith(`/v/${book}/${chapter}`)) {
    history.replaceState({}, "", `/v/${book}/${chapter}`);
  }
}

function toggleVerseSelect(verseNum, el, { silent = false } = {}) {
  const n = Number(verseNum);
  if (state.current.selected.has(n)) {
    state.current.selected.delete(n);
    el.classList.remove("verse--selected");
  } else {
    state.current.selected.add(n);
    el.classList.add("verse--selected");
  }
  if (!silent) {
    const c = state.current.selected.size;
    toast(c ? `${c} verset(s) sélectionné(s)` : "Sélection effacée");
  }
}

function selectedTextBundle() {
  const book = state.current.book;
  const chapter = state.current.chapter;
  if (!book || !chapter) return null;

  const sel = Array.from(state.current.selected).sort((a, b) => a - b);
  const verses = state.lastRenderedList;

  const getText = (v) => verses.find(x => x.verse === v)?.text || getVerseText(state.bible, book, chapter, v) || "";
  const lines = sel.length ? sel.map(v => ({ v, t: getText(v) })) : verses.map(x => ({ v: x.verse, t: x.text }));

  const ref = sel.length
    ? `${formatRef(state.books, book, chapter)}:${sel.join(",")}`
    : formatRef(state.books, book, chapter);

  const text = lines.map(x => (sel.length ? `${x.v} ${x.t}` : x.t)).join(sel.length ? "\n" : " ");

  return { ref, text, book, chapter, sel };
}

async function copySelectedOrAll() {
  const b = selectedTextBundle();
  if (!b) return;

  const payload = `${b.ref}\n\n${b.text}\n\nLSG 1910 — LaBible.app`;
  await navigator.clipboard.writeText(payload);
  toast("Copié.");
}

async function shareSelectedOrAll() {
  const b = selectedTextBundle();
  if (!b) return;

  // Prefer image share for better “viral”
  await shareVerseAsImage({
    title: b.ref,
    text: b.text,
    footer: "LSG 1910 — LaBible.app",
  });
}

function favoriteSelectedOrAll() {
  const b = selectedTextBundle();
  if (!b) return;

  const favs = loadJSON(STORAGE_KEYS.favorites, []);
  const now = Date.now();

  // Save each selected verse (or whole chapter as one item if none selected)
  if (b.sel.length) {
    for (const v of b.sel) {
      const text = getVerseText(state.bible, b.book, b.chapter, v) || "";
      const item = {
        id: `${b.book}.${b.chapter}.${v}`,
        book: b.book, chapter: b.chapter, verse: v,
        ref: formatRef(state.books, b.book, b.chapter, v),
        text,
        tags: [],
        createdAt: now,
      };
      upsertFavorite(favs, item);
    }
  } else {
    const item = {
      id: `${b.book}.${b.chapter}.all`,
      book: b.book, chapter: b.chapter, verse: null,
      ref: formatRef(state.books, b.book, b.chapter),
      text: b.text.slice(0, 4000),
      tags: ["chapitre"],
      createdAt: now,
    };
    upsertFavorite(favs, item);
  }

  saveJSON(STORAGE_KEYS.favorites, favs);
  toast("Ajouté aux favoris.");
}

function upsertFavorite(favs, item) {
  const i = favs.findIndex(x => x.id === item.id);
  if (i >= 0) favs[i] = { ...favs[i], ...item };
  else favs.unshift(item);
}

function escapeMini(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/* -----------------------
   Search
------------------------ */

function wireSearch() {
  els.searchGo.addEventListener("click", () => doSearch());
  els.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
}

async function doSearch() {
  if (!state.ready) return;

  const q = String(els.searchInput.value || "").trim();
  if (!q) return;

  // Try reference first
  const ref = parseReference(q, state.books);
  if (ref?.book && ref?.chapter) {
    navigate(`/v/${ref.book}/${ref.chapter}${ref.verse ? `/${ref.verse}` : ""}`);
    return;
  }

  // Keyword search (simple, offline, fast enough for LSG)
  const needle = q.toLowerCase();
  const max = 120;
  const out = [];
  const t0 = performance.now();

  // iterate books/chapters/verses
  for (const b of state.books) {
    const bookId = b.id;
    const cc = getChapterCount(state.books, bookId);
    for (let ch = 1; ch <= cc; ch++) {
      const verses = listVerses(state.bible, bookId, ch);
      for (const v of verses) {
        const textLower = String(v.text).toLowerCase();
        if (textLower.includes(needle)) {
          out.push({
            book: bookId, chapter: ch, verse: v.verse,
            ref: formatRef(state.books, bookId, ch, v.verse),
            text: v.text,
          });
          if (out.length >= max) break;
        }
      }
      if (out.length >= max) break;
    }
    if (out.length >= max) break;
  }

  const ms = Math.round(performance.now() - t0);
  els.searchInfo.textContent = `${out.length} résultat(s) (max ${max}) · ${ms} ms`;

  els.searchResults.innerHTML = "";
  for (const r of out) {
    const div = renderResult({ ref: r.ref, text: r.text, right: "Ouvrir" });
    div.style.cursor = "pointer";
    div.addEventListener("click", () => navigate(`/v/${r.book}/${r.chapter}/${r.verse}`));
    els.searchResults.appendChild(div);
  }

  if (!out.length) {
    els.searchResults.innerHTML = `<div class="muted">Aucun résultat.</div>`;
  }
}

/* -----------------------
   Favorites (PRO)
------------------------ */

function wireFavorites() {
  els.favSearch.addEventListener("input", () => renderFavorites());
  els.btnClearFav.addEventListener("click", () => {
    if (!confirm("Effacer tous les favoris ?")) return;
    saveJSON(STORAGE_KEYS.favorites, []);
    renderFavorites();
  });

  els.btnExportFav.addEventListener("click", () => {
    const favs = loadJSON(STORAGE_KEYS.favorites, []);
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), favs }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "labible-favoris.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  els.btnImportFav.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const parsed = JSON.parse(txt);
      const favs = Array.isArray(parsed?.favs) ? parsed.favs : (Array.isArray(parsed) ? parsed : []);
      if (!Array.isArray(favs)) throw new Error("Invalid");
      saveJSON(STORAGE_KEYS.favorites, favs);
      toast("Import terminé.");
      renderFavorites();
    } catch {
      toast("Import invalide.");
    } finally {
      e.target.value = "";
    }
  });

  els.favApplyTag.addEventListener("click", () => {
    const tag = String(els.favTag.value || "").trim().toLowerCase();
    if (!tag) { toast("Tag vide."); return; }

    // apply tag to selected favorites (simple: apply to all filtered)
    const favs = loadJSON(STORAGE_KEYS.favorites, []);
    const filteredIds = getFilteredFavorites(favs).map(x => x.id);
    const set = new Set(filteredIds);

    for (const f of favs) {
      if (!set.has(f.id)) continue;
      const tags = Array.isArray(f.tags) ? f.tags : [];
      if (!tags.includes(tag)) tags.push(tag);
      f.tags = tags;
    }

    saveJSON(STORAGE_KEYS.favorites, favs);
    toast("Tag appliqué.");
    renderFavorites();
  });
}

function getFilteredFavorites(favs) {
  const q = String(els.favSearch.value || "").trim().toLowerCase();
  if (!q) return favs;
  return favs.filter(f =>
    String(f.ref || "").toLowerCase().includes(q) ||
    String(f.text || "").toLowerCase().includes(q) ||
    (Array.isArray(f.tags) && f.tags.some(t => String(t).toLowerCase().includes(q)))
  );
}

function renderFavorites() {
  const favs = loadJSON(STORAGE_KEYS.favorites, []);
  const filtered = getFilteredFavorites(favs);

  els.favList.innerHTML = "";
  if (!filtered.length) {
    els.favList.innerHTML = `<div class="muted">Aucun favori.</div>`;
    return;
  }

  for (const f of filtered) {
    const item = document.createElement("div");
    item.className = "result";
    const tags = (Array.isArray(f.tags) ? f.tags : []).map(t => `<span class="tag">${escapeMini(t)}</span>`).join("");
    item.innerHTML = `
      <div class="result__head">
        <div class="result__ref">${escapeMini(f.ref || "")}</div>
        <div class="row">
          <button class="btn btn--ghost" data-act="open">📖</button>
          <button class="btn btn--ghost" data-act="copy">📋</button>
          <button class="btn btn--ghost" data-act="share">📤</button>
          <button class="btn btn--ghost" data-act="del">🗑️</button>
        </div>
      </div>
      <div class="result__text">${escapeMini(f.text || "")}</div>
      <div class="tags">${tags}</div>
    `;

    item.querySelector('[data-act="open"]').addEventListener("click", () => {
      const url = f.verse ? `/v/${f.book}/${f.chapter}/${f.verse}` : `/v/${f.book}/${f.chapter}`;
      navigate(url);
    });

    item.querySelector('[data-act="copy"]').addEventListener("click", async () => {
      const payload = `${f.ref}\n\n${f.text}\n\nLSG 1910 — LaBible.app`;
      await navigator.clipboard.writeText(payload);
      toast("Copié.");
    });

    item.querySelector('[data-act="share"]').addEventListener("click", async () => {
      await shareVerseAsImage({ title: f.ref, text: f.text, footer: "LSG 1910 — LaBible.app" });
    });

    item.querySelector('[data-act="del"]').addEventListener("click", () => {
      const all = loadJSON(STORAGE_KEYS.favorites, []);
      saveJSON(STORAGE_KEYS.favorites, all.filter(x => x.id !== f.id));
      renderFavorites();
    });

    els.favList.appendChild(item);
  }
}

/* -----------------------
   Plan 365 (auto + cache)
------------------------ */

function wirePlan() {
  els.planPrev.addEventListener("click", () => stepPlan(-1));
  els.planNext.addEventListener("click", () => stepPlan(+1));
  els.planToday.addEventListener("click", () => navigate("/plan/aujourdhui"));

  els.planOpen.addEventListener("click", () => {
    const day = currentPlanDay();
    const refs = state.plan.days[day - 1]?.refs || [];
    if (!refs.length) { toast("Lecture vide."); return; }
    // open first ref
    const r0 = refs[0];
    navigate(`/v/${r0.book}/${r0.chapter}`);
  });

  els.planToggleDone.addEventListener("click", () => {
    const day = currentPlanDay();
    const done = loadJSON(STORAGE_KEYS.planDone, {});
    done[String(day)] = !done[String(day)];
    saveJSON(STORAGE_KEYS.planDone, done);
    renderPlanDay(day);
  });
}

function currentPlanDay() {
  // derive from URL if possible
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts[0] === "plan" && parts[1] === "jour" && parts[2]) return clampInt(parts[2], 1, 365);
  return getDayOfYear(new Date());
}

function stepPlan(delta) {
  const day = clampInt(currentPlanDay() + delta, 1, 365);
  navigate(`/plan/jour/${day}`);
}

function renderPlanDay(day) {
  const d = clampInt(day, 1, 365);
  const item = state.plan.days[d - 1];

  els.planDayKicker.textContent = `Jour ${d} / 365`;
  els.planDayTitle.textContent = item?.title || `Lecture du jour ${d}`;

  const done = loadJSON(STORAGE_KEYS.planDone, {});
  const isDone = !!done[String(d)];
  els.planToggleDone.textContent = isDone ? "↩️ Marquer comme non fait" : "✅ Marquer comme fait";

  const progress = Object.values(done).filter(Boolean).length;
  els.planProgress.textContent = `Progrès: ${progress}/365`;

  els.planRefs.innerHTML = "";
  const refs = item?.refs || [];
  for (const r of refs) {
    const refStr = formatRef(state.books, r.book, r.chapter);
    const div = renderResult({ ref: refStr, text: "Ouvrir", right: "" });
    div.style.cursor = "pointer";
    div.addEventListener("click", () => navigate(`/v/${r.book}/${r.chapter}`));
    els.planRefs.appendChild(div);
  }
}

/* -----------------------
   VDD 365 (auto + cache)
------------------------ */

function wireVdd() {
  els.btnShareVdd.addEventListener("click", async () => {
    const today = getDayOfYear(new Date());
    const it = state.vdd.items[today - 1];
    if (!it) return;
    const ref = formatRef(state.books, it.book, it.chapter, it.verse);
    const text = getVerseText(state.bible, it.book, it.chapter, it.verse);
    await shareVerseAsImage({ title: ref, text, footer: "LSG 1910 — LaBible.app" });
  });
}

function renderVddToday() {
  const today = getDayOfYear(new Date());
  const it = state.vdd.items[today - 1];
  if (!it) return;

  const ref = formatRef(state.books, it.book, it.chapter, it.verse);
  const text = getVerseText(state.bible, it.book, it.chapter, it.verse);

  els.vddRef.textContent = ref;
  els.vddText.textContent = text || "—";
}

function renderVddList() {
  els.vddList.innerHTML = "";
  for (let i = 0; i < 365; i++) {
    const it = state.vdd.items[i];
    const day = i + 1;
    const ref = formatRef(state.books, it.book, it.chapter, it.verse);
    const text = getVerseText(state.bible, it.book, it.chapter, it.verse);

    const div = document.createElement("div");
    div.className = "result";
    div.innerHTML = `
      <div class="result__head">
        <div class="result__ref">Jour ${day} · ${escapeMini(ref)}</div>
        <div class="row">
          <button class="btn btn--ghost" data-act="open">📖</button>
          <button class="btn btn--ghost" data-act="share">📤</button>
        </div>
      </div>
      <div class="result__text">${escapeMini(text)}</div>
    `;
    div.querySelector('[data-act="open"]').addEventListener("click", () => navigate(`/v/${it.book}/${it.chapter}/${it.verse}`));
    div.querySelector('[data-act="share"]').addEventListener("click", async () => {
      await shareVerseAsImage({ title: ref, text, footer: "LSG 1910 — LaBible.app" });
    });

    els.vddList.appendChild(div);
  }
}

/* -----------------------
   Settings
------------------------ */

function wireSettings() {
  els.btnSettings.addEventListener("click", () => els.settingsModal.showModal());

  const cur = getSettings();
  els.themeSelect.value = cur.theme || "system";
  els.fontSizeSelect.value = String(cur.fontScale || 100);

  els.saveSettings.addEventListener("click", () => {
    const next = setSettings({
      theme: els.themeSelect.value,
      fontScale: Number(els.fontSizeSelect.value),
    });
    applySettings(next);
    toast("Réglages enregistrés.");
  });

  els.resetSettings.addEventListener("click", () => {
    const next = resetSettings();
    els.themeSelect.value = next.theme;
    els.fontSizeSelect.value = String(next.fontScale);
    applySettings(next);
    toast("Réglages réinitialisés.");
  });
}

function applySettings(s) {
  // theme
  document.documentElement.dataset.theme = s.theme;
  // font scale
  document.documentElement.style.setProperty("--fontScale", String(s.fontScale || 100));

  // Apply theme override
  // If user chooses light/dark, force it:
  document.documentElement.style.colorScheme = (s.theme === "dark") ? "dark" : (s.theme === "light" ? "light" : "normal");
  if (s.theme === "dark") {
    document.documentElement.classList.add("force-dark");
    document.documentElement.classList.remove("force-light");
  } else if (s.theme === "light") {
    document.documentElement.classList.add("force-light");
    document.documentElement.classList.remove("force-dark");
  } else {
    document.documentElement.classList.remove("force-dark");
    document.documentElement.classList.remove("force-light");
  }
}

/* -----------------------
   Install / Service Worker
------------------------ */

function wireInstall() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    els.chipInstall.hidden = false;
  });

  els.chipInstall.addEventListener("click", async () => {
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    const res = await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    els.chipInstall.hidden = true;
    toast(res?.outcome === "accepted" ? "Installée !" : "Installation annulée.");
  });

  window.addEventListener("online", () => { els.chipOffline.hidden = true; });
  window.addEventListener("offline", () => { els.chipOffline.hidden = false; });
  if (!navigator.onLine) els.chipOffline.hidden = false;
}

function wireSW() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(console.warn);

  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data === "SW_UPDATED") {
      els.chipUpdated.hidden = false;
      setTimeout(() => (els.chipUpdated.hidden = true), 2500);
    }
  });
}

/* -----------------------
   Plan/VDD Generators (Auto)
------------------------ */

async function getPlan365() {
  // Try override file plan/plan_365.json. If empty, auto-generate.
  const cache = loadJSON(STORAGE_KEYS.planCache, null);
  if (cache?.days?.length === 365 && cache?.sig) return cache;

  let override = null;
  try {
    const res = await fetch("plan/plan_365.json", { cache: "no-store" });
    if (res.ok) override = await res.json();
  } catch {}

  const auto = generatePlanFromChapters();
  const merged = (override?.days?.length === 365) ? { ...auto, ...override } : auto;

  saveJSON(STORAGE_KEYS.planCache, merged);
  return merged;
}

function generatePlanFromChapters() {
  // Flatten all chapters into list [{book, chapter}]
  const chapters = [];
  for (const b of state.books) {
    const cc = getChapterCount(state.books, b.id);
    for (let ch = 1; ch <= cc; ch++) chapters.push({ book: b.id, chapter: ch });
  }

  // Split into 365 groups as evenly as possible
  const total = chapters.length;
  const perDay = total / 365;

  const days = [];
  let idx = 0;
  for (let day = 1; day <= 365; day++) {
    const nextIdx = Math.round(day * perDay);
    const slice = chapters.slice(idx, nextIdx);
    idx = nextIdx;

    const title = slice.length
      ? `${formatRef(state.books, slice[0].book, slice[0].chapter)}${slice.length > 1 ? " …" : ""}`
      : `Jour ${day}`;

    days.push({ day, title, refs: slice });
  }

  // ensure length + no empties at end
  while (days.length < 365) days.push({ day: days.length + 1, title: `Jour ${days.length + 1}`, refs: [] });

  const sig = `auto:${total}:${state.books.length}`;
  return { version: 1, name: "Plan 365 (auto)", sig, days };
}

async function getVdd365() {
  const cache = loadJSON(STORAGE_KEYS.vddCache, null);
  if (cache?.items?.length === 365 && cache?.sig) return cache;

  let override = null;
  try {
    const res = await fetch("data/vdd_365.json", { cache: "no-store" });
    if (res.ok) override = await res.json();
  } catch {}

  const auto = generateVddFromAllVerses();
  const merged = (override?.items?.length === 365) ? { ...auto, ...override } : auto;

  saveJSON(STORAGE_KEYS.vddCache, merged);
  return merged;
}

function generateVddFromAllVerses() {
  // Flatten all verses keys into list, then pick 365 evenly spaced.
  const all = [];
  for (const b of state.books) {
    const bookId = b.id;
    const cc = getChapterCount(state.books, bookId);
    for (let ch = 1; ch <= cc; ch++) {
      const verses = listVerses(state.bible, bookId, ch);
      for (const v of verses) all.push({ book: bookId, chapter: ch, verse: v.verse });
    }
  }

  const total = all.length;
  const step = total / 365;
  const items = [];
  for (let i = 0; i < 365; i++) {
    const idx = Math.floor(i * step);
    items.push(all[Math.min(idx, total - 1)]);
  }

  const sig = `auto:${total}:${state.books.length}`;
  return { version: 1, name: "VDD 365 (auto)", sig, items };
}

/* -----------------------
   Helpers
------------------------ */

function getDayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d - start;
  const day = Math.floor(diff / 86400000) + 1;
  return clampInt(day, 1, 365);
}

function clampInt(x, min, max) {
  const n = Number(x);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}