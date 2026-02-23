import { loadBible, getChapterCount, listVerses, getVerseText, formatRef, parseReference } from "./bible.js";
import { migrateIfNeeded, loadJSON, saveJSON, getSettings, setSettings, resetSettings, STORAGE_KEYS } from "./storage.js";
import { $, setActiveSection, toast, renderResult, escapeHtml } from "./ui.js";
import { shareVerseAsImage } from "./share-image.js";

migrateIfNeeded();

const state = {
  books: [],
  index: null,
  ready: false,
  current: { book: null, chapter: null, selected: new Set() },
  lastRenderedList: [],
  deferredInstallPrompt: null,
  plan: null,
  vdd: null,
  debug: {
    enabled: false,
    bibleFormat: "unknown",
    booksCount: 0,
    chaptersCount: 0,
    versesCount: 0,
  }
};

const els = {
  year: $("#year"),

  // DEBUG
  debugBar: $("#debugBar"),

  // PWA
  btnInstallAlways: $("#btnInstallAlways"),
  installBadge: $("#installBadge"),
  chipOffline: $("#chipOffline"),
  chipUpdated: $("#chipUpdated"),

  // top
  btnSearch: $("#btnSearch"),
  btnPlan: $("#btnPlan"),
  btnFav: $("#btnFav"),
  btnSettings: $("#btnSettings"),

  // quick
  bookSelect: $("#bookSelect"),
  chapterSelect: $("#chapterSelect"),
  openBtn: $("#openBtn"),
  continueBtn: $("#continueBtn"),

  // reader
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

  // search
  searchInput: $("#searchInput"),
  searchGo: $("#searchGo"),
  searchInfo: $("#searchInfo"),
  searchResults: $("#searchResults"),

  // favorites
  favList: $("#favList"),
  favSearch: $("#favSearch"),
  favTag: $("#favTag"),
  favApplyTag: $("#favApplyTag"),
  btnExportFav: $("#btnExportFav"),
  btnImportFav: $("#btnImportFav"),
  btnClearFav: $("#btnClearFav"),

  // plan
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
  vddRef: $("#vddRef"),
  vddText: $("#vddText"),
  btnShareVdd: $("#btnShareVdd"),
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
  if (els.year) els.year.textContent = String(new Date().getFullYear());

  applySettings(getSettings());
  initDebugFlags();
  wirePwaInstall();
  wireNetworkBadges();
  wireSW();
  wireNav();
  wireSettings();
  wireQuickNav();
  wireSearch();
  wireFavorites();
  wirePlan();
  wireVdd();

  // GitHub Pages deep-link restore (from 404.html)
  const attempted = sessionStorage.getItem("labible:redirect");
  if (attempted) {
    sessionStorage.removeItem("labible:redirect");
    history.replaceState({}, "", attempted);
  }

  const { books, index, bible } = await loadBible();
  state.books = books;
  state.index = index;
  state.ready = true;

  state.debug.bibleFormat = detectBibleFormat(bible);

  fillBookSelect();
  restoreLastReadToSelectors();

  computeIndexStats();

  state.plan = getPlan365Cached();
  state.vdd = getVdd365Cached();

  renderVddToday();

  if (state.debug.enabled) renderDebugBar();

  routeTo(location.pathname + location.search + location.hash, { silent: true });
  window.addEventListener("popstate", () => routeTo(location.pathname + location.search + location.hash, { silent: true }));
}

/* ---------------- DEBUG ---------------- */

function initDebugFlags() {
  const url = new URL(location.href);
  const byQuery = url.searchParams.get("debug") === "1";
  const byHash = location.hash === "#/debug" || location.hash.includes("debug=1");
  state.debug.enabled = byQuery || byHash;

  if (els.debugBar) els.debugBar.hidden = !state.debug.enabled;

  if (state.debug.enabled && els.debugBar) {
    els.debugBar.style.position = "sticky";
    els.debugBar.style.top = "64px";
    els.debugBar.style.zIndex = "9";
    els.debugBar.style.margin = "12px 0";
    els.debugBar.style.padding = "10px 12px";
    els.debugBar.style.borderRadius = "14px";
    els.debugBar.style.border = "1px solid rgba(255,255,255,.16)";
    els.debugBar.style.background = "rgba(0,0,0,.55)";
    els.debugBar.style.backdropFilter = "blur(10px)";
    els.debugBar.style.color = "rgba(255,255,255,.92)";
    els.debugBar.style.fontSize = "13px";
    els.debugBar.style.lineHeight = "1.35";
  }

  window.__LABIBLE_DEBUG__ = {
    enable() { url.searchParams.set("debug","1"); location.href = url.toString(); },
    disable() { url.searchParams.delete("debug"); location.href = url.toString(); },
  };
}

function detectBibleFormat(bible) {
  try {
    if (Array.isArray(bible)) return "array";
    if (Array.isArray(bible?.verses)) return "array.verses";
    if (bible && typeof bible === "object") return "indexed.object";
    return "unknown";
  } catch {
    return "unknown";
  }
}

function computeIndexStats() {
  const idx = state.index || {};
  let booksCount = 0, chaptersCount = 0, versesCount = 0;

  for (const bookId of Object.keys(idx)) {
    booksCount++;
    const chapters = idx[bookId]?.chapters || {};
    for (const chKey of Object.keys(chapters)) {
      chaptersCount++;
      const list = chapters[chKey] || [];
      versesCount += list.length;
    }
  }

  state.debug.booksCount = booksCount;
  state.debug.chaptersCount = chaptersCount;
  state.debug.versesCount = versesCount;
}

function swStateText() {
  const has = ("serviceWorker" in navigator);
  return has ? "on" : "off";
}

function cacheSizeText(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return "0";
    return String(raw.length);
  } catch {
    return "?";
  }
}

function renderDebugBar() {
  if (!state.debug.enabled || !els.debugBar) return;

  const installed = isInstalled();
  const installable = !!state.deferredInstallPrompt;
  const online = navigator.onLine;

  const planLen = state.plan?.days?.length || 0;
  const vddLen = state.vdd?.items?.length || 0;

  const last = loadJSON(STORAGE_KEYS.lastRead, null);
  const lastStr = last?.book ? `${last.book} ${last.chapter}` : "—";

  els.debugBar.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
      <div>
        <strong>DEBUG</strong> · <span style="opacity:.85">2026 LaBible.app | LSG 1910</span><br/>
        <span style="opacity:.85">Bible:</span> ${escapeHtml(state.debug.bibleFormat)} ·
        <span style="opacity:.85">Books:</span> ${state.debug.booksCount} ·
        <span style="opacity:.85">Ch:</span> ${state.debug.chaptersCount} ·
        <span style="opacity:.85">V:</span> ${state.debug.versesCount}<br/>
        <span style="opacity:.85">Plan:</span> ${planLen}/365 ·
        <span style="opacity:.85">VDD:</span> ${vddLen}/365 ·
        <span style="opacity:.85">Last:</span> ${escapeHtml(lastStr)}
      </div>

      <div style="text-align:right;">
        <span style="opacity:.85">PWA:</span> ${installed ? "installed" : (installable ? "installable" : "not-ready")} ·
        <span style="opacity:.85">Online:</span> ${online ? "yes" : "no"} ·
        <span style="opacity:.85">SW:</span> ${swStateText()}<br/>
        <span style="opacity:.85">cachePlan bytes:</span> ${cacheSizeText(STORAGE_KEYS.cachePlan)} ·
        <span style="opacity:.85">cacheVdd bytes:</span> ${cacheSizeText(STORAGE_KEYS.cacheVdd)}
      </div>
    </div>

    <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
      <button id="dbgReload" style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.06); color:inherit; cursor:pointer;">Reload</button>
      <button id="dbgRecalc" style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.06); color:inherit; cursor:pointer;">Recalc stats</button>
      <button id="dbgClearCaches" style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.06); color:inherit; cursor:pointer;">Clear plan/vdd cache</button>
      <button id="dbgClose" style="padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.06); color:inherit; cursor:pointer;">Hide debug</button>
    </div>
  `;

  $("#dbgReload")?.addEventListener("click", () => location.reload());
  $("#dbgRecalc")?.addEventListener("click", () => {
    computeIndexStats();
    state.plan = getPlan365Cached(true);
    state.vdd = getVdd365Cached(true);
    renderDebugBar();
    toast("Stats recalculées.");
  });
  $("#dbgClearCaches")?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEYS.cachePlan);
    localStorage.removeItem(STORAGE_KEYS.cacheVdd);
    state.plan = getPlan365Cached(true);
    state.vdd = getVdd365Cached(true);
    renderDebugBar();
    toast("Caches effacés.");
  });
  $("#dbgClose")?.addEventListener("click", () => {
    const url = new URL(location.href);
    url.searchParams.delete("debug");
    history.replaceState({}, "", url.toString());
    state.debug.enabled = false;
    if (els.debugBar) els.debugBar.hidden = true;
    toast("Debug caché.");
  });
}

/* ---------------- Routing ---------------- */

function wireNav() {
  document.addEventListener("click", (e) => {
    const a = e.target?.closest?.("a[data-link]");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href) return;
    e.preventDefault();
    navigate(href);
  });

  els.btnSearch?.addEventListener("click", () => navigate("/recherche"));
  els.btnPlan?.addEventListener("click", () => navigate("/plan/aujourdhui"));
  els.btnFav?.addEventListener("click", () => navigate("/favoris"));
  els.btnSettings?.addEventListener("click", () => els.settingsModal?.showModal());
}

function navigate(path) {
  history.pushState({}, "", path);
  routeTo(path);
  if (state.debug.enabled) renderDebugBar();
}

function routeTo(fullPath, { silent = false } = {}) {
  const hashIdx = fullPath.indexOf("#/");
  let path = fullPath;
  if (hashIdx >= 0) path = fullPath.slice(hashIdx + 1);
  path = path.split("?")[0];
  if (!path.startsWith("/")) path = "/" + path;

  const parts = path.replace(/\/+$/, "").split("/").filter(Boolean);
  if (!silent) window.scrollTo({ top: 0, behavior: "instant" });

  if (parts.length === 0) { setActiveSection(["hero", "quickNav"]); return; }

  const [p0, p1, p2, p3] = parts;

  if (p0 === "debug") {
    state.debug.enabled = true;
    if (els.debugBar) els.debugBar.hidden = false;
    renderDebugBar();
    setActiveSection(["hero", "quickNav"]);
    return;
  }

  if (p0 === "recherche") { setActiveSection(["search"]); els.searchInput?.focus(); return; }
  if (p0 === "favoris") { setActiveSection(["favorites"]); renderFavorites(); return; }
  if (p0 === "vdd") { setActiveSection(["vdd"]); renderVddList(); return; }

  if (p0 === "plan") {
    setActiveSection(["plan"]);
    if (p1 === "aujourdhui") return renderPlanDay(dayOfYear(new Date()));
    if (p1 === "jour" && p2) return renderPlanDay(clampInt(p2, 1, 365));
    return renderPlanDay(dayOfYear(new Date()));
  }

  if (p0 === "v" && p1 && p2) {
    const book = String(p1);
    const chapter = Number(p2);
    const verse = p3 ? Number(p3) : null;
    openReader({ book, chapter, verse });
    return;
  }

  setActiveSection(["hero", "quickNav"]);
}

/* ---------------- Quick nav + Reader ---------------- */

function wireQuickNav() {
  els.openBtn?.addEventListener("click", () => {
    const book = els.bookSelect.value;
    const chapter = Number(els.chapterSelect.value);
    navigate(`/v/${book}/${chapter}`);
  });

  els.continueBtn?.addEventListener("click", () => {
    const last = loadJSON(STORAGE_KEYS.lastRead, null);
    if (last?.book && last?.chapter) navigate(`/v/${last.book}/${last.chapter}`);
    else toast("Aucune lecture récente.");
  });

  els.bookSelect?.addEventListener("change", () => fillChapterSelect());
}

function fillBookSelect() {
  if (!els.bookSelect) return;
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
  if (!els.bookSelect || !els.chapterSelect) return;
  const book = els.bookSelect.value;
  const count = getChapterCount(book, state.index) || 1;
  els.chapterSelect.innerHTML = "";
  for (let i = 1; i <= count; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    els.chapterSelect.appendChild(opt);
  }
}

function restoreLastReadToSelectors() {
  if (!els.bookSelect || !els.chapterSelect) return;
  const last = loadJSON(STORAGE_KEYS.lastRead, null);
  if (!last?.book) return;
  if (!state.books.some(b => b.id === last.book)) return;
  els.bookSelect.value = last.book;
  fillChapterSelect();
  els.chapterSelect.value = String(last.chapter || 1);
}

function openReader({ book, chapter, verse = null }) {
  if (!state.ready) return;

  const count = getChapterCount(book, state.index);
  if (!count || chapter < 1 || chapter > count) { toast("Référence invalide."); return; }

  state.current.book = book;
  state.current.chapter = chapter;
  state.current.selected = new Set();

  saveJSON(STORAGE_KEYS.lastRead, { book, chapter, ts: Date.now() });

  setActiveSection(["reader"]);
  if (els.readerTitle) els.readerTitle.textContent = formatRef(state.books, book, chapter);
  if (els.readerMeta) els.readerMeta.textContent = `Chapitre ${chapter} · LSG 1910`;

  const verses = listVerses(book, chapter, state.index);
  state.lastRenderedList = verses;

  if (!els.verses) return;
  els.verses.innerHTML = "";
  if (!verses.length) {
    els.verses.innerHTML = `<div class="muted">Aucun verset trouvé.</div>`;
  } else {
    for (const v of verses) {
      const div = document.createElement("div");
      div.className = "verse";
      div.dataset.verse = String(v.verse);
      div.innerHTML = `<span class="verse__num">${v.verse}</span> ${escapeHtml(v.text)}`;
      div.addEventListener("click", () => toggleSelect(v.verse, div));
      els.verses.appendChild(div);
    }
  }

  if (els.prevChapter) els.prevChapter.onclick = () => navigate(`/v/${book}/${Math.max(1, chapter - 1)}`);
  if (els.nextChapter) els.nextChapter.onclick = () => navigate(`/v/${book}/${Math.min(count, chapter + 1)}`);
  if (els.prevChapter2 && els.prevChapter) els.prevChapter2.onclick = els.prevChapter.onclick;
  if (els.nextChapter2 && els.nextChapter) els.nextChapter2.onclick = els.nextChapter.onclick;

  if (els.btnReaderCopy) els.btnReaderCopy.onclick = () => copySelectedOrAll();
  if (els.btnReaderShare) els.btnReaderShare.onclick = () => shareSelectedOrAllAsImage();
  if (els.btnReaderFav) els.btnReaderFav.onclick = () => favoriteSelectedOrAll();

  if (verse) {
    const target = els.verses.querySelector(`.verse[data-verse="${verse}"]`);
    if (target) {
      toggleSelect(verse, target, true);
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  if (state.debug.enabled) renderDebugBar();
}

function toggleSelect(verseNum, el, silent = false) {
  const n = Number(verseNum);
  if (state.current.selected.has(n)) {
    state.current.selected.delete(n);
    el.classList.remove("verse--selected");
  } else {
    state.current.selected.add(n);
    el.classList.add("verse--selected");
  }
  if (!silent) toast(state.current.selected.size ? `${state.current.selected.size} sélectionné(s)` : "Sélection effacée");
}

function selectedBundle() {
  const { book, chapter } = state.current;
  if (!book || !chapter) return null;

  const sel = Array.from(state.current.selected).sort((a, b) => a - b);
  const verses = state.lastRenderedList;

  const getText = (v) => verses.find(x => x.verse === v)?.text || getVerseText(book, chapter, v, state.index) || "";

  const lines = sel.length
    ? sel.map(v => ({ v, t: getText(v) }))
    : verses.map(x => ({ v: x.verse, t: x.text }));

  const ref = sel.length
    ? `${formatRef(state.books, book, chapter)}:${sel.join(",")}`
    : formatRef(state.books, book, chapter);

  const text = lines.map(x => sel.length ? `${x.v} ${x.t}` : x.t).join(sel.length ? "\n" : " ");
  return { ref, text, book, chapter, sel };
}

async function copySelectedOrAll() {
  const b = selectedBundle();
  if (!b) return;
  await navigator.clipboard.writeText(`${b.ref}\n\n${b.text}\n\n2026 LaBible.app | LSG 1910`);
  toast("Copié.");
}

async function shareSelectedOrAllAsImage() {
  const b = selectedBundle();
  if (!b) return;
  await shareVerseAsImage({
    title: b.ref,
    text: b.text,
    footer: "2026 LaBible.app | LSG 1910",
  });
}

function favoriteSelectedOrAll() {
  const b = selectedBundle();
  if (!b) return;

  const favs = loadJSON(STORAGE_KEYS.favorites, []);
  const now = Date.now();

  if (b.sel.length) {
    for (const v of b.sel) {
      const text = getVerseText(b.book, b.chapter, v, state.index) || "";
      upsertFav(favs, {
        id: `${b.book}.${b.chapter}.${v}`,
        book: b.book, chapter: b.chapter, verse: v,
        ref: formatRef(state.books, b.book, b.chapter, v),
        text,
        tags: [],
        createdAt: now
      });
    }
  } else {
    upsertFav(favs, {
      id: `${b.book}.${b.chapter}.all`,
      book: b.book, chapter: b.chapter, verse: null,
      ref: formatRef(state.books, b.book, b.chapter),
      text: b.text.slice(0, 4000),
      tags: ["chapitre"],
      createdAt: now
    });
  }

  saveJSON(STORAGE_KEYS.favorites, favs);
  toast("Ajouté aux favoris.");
  if (state.debug.enabled) renderDebugBar();
}

function upsertFav(favs, item) {
  const i = favs.findIndex(x => x.id === item.id);
  if (i >= 0) favs[i] = { ...favs[i], ...item };
  else favs.unshift(item);
}

/* ---------------- Search ---------------- */

function wireSearch() {
  els.searchGo?.addEventListener("click", doSearch);
  els.searchInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
}

function doSearch() {
  if (!state.ready) return;
  const q = String(els.searchInput?.value || "").trim();
  if (!q) return;

  const ref = parseReference(q, state.books);
  if (ref?.book && ref?.chapter) {
    navigate(`/v/${ref.book}/${ref.chapter}${ref.verse ? `/${ref.verse}` : ""}`);
    return;
  }

  const needle = q.toLowerCase();
  const max = 120;
  const out = [];
  const t0 = performance.now();

  for (const b of state.books) {
    const bookId = b.id;
    const cc = getChapterCount(bookId, state.index);
    for (let ch = 1; ch <= cc; ch++) {
      const verses = listVerses(bookId, ch, state.index);
      for (const v of verses) {
        if (String(v.text).toLowerCase().includes(needle)) {
          out.push({ book: bookId, chapter: ch, verse: v.verse, ref: formatRef(state.books, bookId, ch, v.verse), text: v.text });
          if (out.length >= max) break;
        }
      }
      if (out.length >= max) break;
    }
    if (out.length >= max) break;
  }

  const ms = Math.round(performance.now() - t0);
  if (els.searchInfo) els.searchInfo.textContent = `${out.length} résultat(s) (max ${max}) · ${ms} ms`;

  if (!els.searchResults) return;
  els.searchResults.innerHTML = "";
  if (!out.length) { els.searchResults.innerHTML = `<div class="muted">Aucun résultat.</div>`; return; }

  for (const r of out) {
    const div = renderResult({ ref: r.ref, text: r.text, right: "Ouvrir" });
    div.style.cursor = "pointer";
    div.addEventListener("click", () => navigate(`/v/${r.book}/${r.chapter}/${r.verse}`));
    els.searchResults.appendChild(div);
  }

  if (state.debug.enabled) renderDebugBar();
}

/* ---------------- Favorites ---------------- */

function wireFavorites() {
  els.favSearch?.addEventListener("input", renderFavorites);

  els.btnClearFav?.addEventListener("click", () => {
    if (!confirm("Effacer tous les favoris ?")) return;
    saveJSON(STORAGE_KEYS.favorites, []);
    renderFavorites();
    if (state.debug.enabled) renderDebugBar();
  });

  els.btnExportFav?.addEventListener("click", () => {
    const favs = loadJSON(STORAGE_KEYS.favorites, []);
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), favs }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "labible-favoris.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  els.btnImportFav?.addEventListener("change", async (e) => {
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
    if (state.debug.enabled) renderDebugBar();
  });

  els.favApplyTag?.addEventListener("click", () => {
    const tag = String(els.favTag?.value || "").trim().toLowerCase();
    if (!tag) return toast("Tag vide.");

    const favs = loadJSON(STORAGE_KEYS.favorites, []);
    const filtered = filterFavs(favs);
    const set = new Set(filtered.map(x => x.id));

    for (const f of favs) {
      if (!set.has(f.id)) continue;
      const tags = Array.isArray(f.tags) ? f.tags : [];
      if (!tags.includes(tag)) tags.push(tag);
      f.tags = tags;
    }
    saveJSON(STORAGE_KEYS.favorites, favs);
    toast("Tag appliqué.");
    renderFavorites();
    if (state.debug.enabled) renderDebugBar();
  });
}

function filterFavs(favs) {
  const q = String(els.favSearch?.value || "").trim().toLowerCase();
  if (!q) return favs;
  return favs.filter(f =>
    String(f.ref || "").toLowerCase().includes(q) ||
    String(f.text || "").toLowerCase().includes(q) ||
    (Array.isArray(f.tags) && f.tags.some(t => String(t).toLowerCase().includes(q)))
  );
}

function renderFavorites() {
  if (!els.favList) return;

  const favs = loadJSON(STORAGE_KEYS.favorites, []);
  const filtered = filterFavs(favs);

  els.favList.innerHTML = "";
  if (!filtered.length) { els.favList.innerHTML = `<div class="muted">Aucun favori.</div>`; return; }

  for (const f of filtered) {
    const item = document.createElement("div");
    item.className = "result";
    item.innerHTML = `
      <div class="result__row">
        <div class="result__ref">${escapeHtml(f.ref || "")}</div>
        <div class="result__right">
          <button class="btn btn--ghost" data-act="open" type="button">📖</button>
          <button class="btn btn--ghost" data-act="share" type="button">🖼️</button>
          <button class="btn btn--ghost" data-act="del" type="button">🗑️</button>
        </div>
      </div>
      <div class="result__text">${escapeHtml(f.text || "")}</div>
      <div class="muted small">${Array.isArray(f.tags) && f.tags.length ? ("Tags: " + f.tags.join(", ")) : ""}</div>
    `;

    item.querySelector('[data-act="open"]')?.addEventListener("click", () => {
      const url = f.verse ? `/v/${f.book}/${f.chapter}/${f.verse}` : `/v/${f.book}/${f.chapter}`;
      navigate(url);
    });

    item.querySelector('[data-act="share"]')?.addEventListener("click", async () => {
      await shareVerseAsImage({ title: f.ref, text: f.text, footer: "2026 LaBible.app | LSG 1910" });
    });

    item.querySelector('[data-act="del"]')?.addEventListener("click", () => {
      const all = loadJSON(STORAGE_KEYS.favorites, []);
      saveJSON(STORAGE_KEYS.favorites, all.filter(x => x.id !== f.id));
      renderFavorites();
      if (state.debug.enabled) renderDebugBar();
    });

    els.favList.appendChild(item);
  }
}

/* ---------------- Plan 365 ---------------- */

function wirePlan() {
  els.planPrev?.addEventListener("click", () => stepPlan(-1));
  els.planNext?.addEventListener("click", () => stepPlan(+1));
  els.planToday?.addEventListener("click", () => navigate("/plan/aujourdhui"));

  els.planOpen?.addEventListener("click", () => {
    const day = currentPlanDay();
    const refs = state.plan?.days?.[day - 1]?.refs || [];
    if (!refs.length) return toast("Lecture vide.");
    navigate(`/v/${refs[0].book}/${refs[0].chapter}`);
  });

  els.planToggleDone?.addEventListener("click", () => {
    const day = currentPlanDay();
    const done = loadJSON(STORAGE_KEYS.planDone, {});
    done[String(day)] = !done[String(day)];
    saveJSON(STORAGE_KEYS.planDone, done);
    renderPlanDay(day);
    if (state.debug.enabled) renderDebugBar();
  });
}

function currentPlanDay() {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts[0] === "plan" && parts[1] === "jour" && parts[2]) return clampInt(parts[2], 1, 365);
  return dayOfYear(new Date());
}

function stepPlan(delta) {
  const day = clampInt(currentPlanDay() + delta, 1, 365);
  navigate(`/plan/jour/${day}`);
}

function renderPlanDay(day) {
  if (!state.plan) return;

  const d = clampInt(day, 1, 365);
  const item = state.plan.days[d - 1];

  if (els.planDayKicker) els.planDayKicker.textContent = `Jour ${d} / 365`;
  if (els.planDayTitle) els.planDayTitle.textContent = item?.title || `Jour ${d}`;

  const done = loadJSON(STORAGE_KEYS.planDone, {});
  const isDone = !!done[String(d)];
  if (els.planToggleDone) els.planToggleDone.textContent = isDone ? "↩️ Marquer comme non fait" : "✅ Marquer comme fait";

  const progress = Object.values(done).filter(Boolean).length;
  if (els.planProgress) els.planProgress.textContent = `Progrès: ${progress}/365`;

  if (!els.planRefs) return;
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

function getPlan365Cached(force = false) {
  if (!force) {
    const cached = loadJSON(STORAGE_KEYS.cachePlan, null);
    if (cached?.days?.length === 365) return cached;
  }

  const chapters = [];
  for (const b of state.books) {
    const cc = getChapterCount(b.id, state.index);
    for (let ch = 1; ch <= cc; ch++) chapters.push({ book: b.id, chapter: ch });
  }

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

  const plan = { version: 1, name: "Plan 365 (auto)", days };
  saveJSON(STORAGE_KEYS.cachePlan, plan);
  return plan;
}

/* ---------------- VDD 365 ---------------- */

function wireVdd() {
  els.btnShareVdd?.addEventListener("click", async () => {
    const today = dayOfYear(new Date());
    const it = state.vdd?.items?.[today - 1];
    if (!it) return;
    const ref = formatRef(state.books, it.book, it.chapter, it.verse);
    const text = getVerseText(it.book, it.chapter, it.verse, state.index);
    await shareVerseAsImage({ title: ref, text, footer: "2026 LaBible.app | LSG 1910" });
  });
}

function renderVddToday() {
  const today = dayOfYear(new Date());
  const it = state.vdd?.items?.[today - 1];
  if (!it) {
    if (els.vddRef) els.vddRef.textContent = "—";
    if (els.vddText) els.vddText.textContent = "—";
    return;
  }

  const ref = formatRef(state.books, it.book, it.chapter, it.verse);
  const text = getVerseText(it.book, it.chapter, it.verse, state.index);

  if (els.vddRef) els.vddRef.textContent = ref;
  if (els.vddText) els.vddText.textContent = text || "—";
}

function renderVddList() {
  if (!els.vddList || !state.vdd?.items) return;

  els.vddList.innerHTML = "";
  for (let i = 0; i < 365; i++) {
    const it = state.vdd.items[i];
    if (!it) continue;

    const day = i + 1;
    const ref = formatRef(state.books, it.book, it.chapter, it.verse);
    const text = getVerseText(it.book, it.chapter, it.verse, state.index);

    const div = document.createElement("div");
    div.className = "result";
    div.innerHTML = `
      <div class="result__row">
        <div class="result__ref">Jour ${day} · ${escapeHtml(ref)}</div>
        <div class="result__right">
          <button class="btn btn--ghost" data-act="open" type="button">📖</button>
          <button class="btn btn--ghost" data-act="share" type="button">🖼️</button>
        </div>
      </div>
      <div class="result__text">${escapeHtml(text)}</div>
    `;

    div.querySelector('[data-act="open"]')?.addEventListener("click", () => navigate(`/v/${it.book}/${it.chapter}/${it.verse}`));
    div.querySelector('[data-act="share"]')?.addEventListener("click", async () => {
      await shareVerseAsImage({ title: ref, text, footer: "2026 LaBible.app | LSG 1910" });
    });

    els.vddList.appendChild(div);
  }
}

function getVdd365Cached(force = false) {
  if (!force) {
    const cached = loadJSON(STORAGE_KEYS.cacheVdd, null);
    if (cached?.items?.length === 365) return cached;
  }

  const all = [];
  for (const b of state.books) {
    const cc = getChapterCount(b.id, state.index);
    for (let ch = 1; ch <= cc; ch++) {
      const verses = listVerses(b.id, ch, state.index);
      for (const v of verses) all.push({ book: b.id, chapter: ch, verse: v.verse });
    }
  }

  const total = all.length;
  if (!total) {
    const empty = { version: 1, name: "VDD 365 (auto)", items: Array.from({ length: 365 }, () => null) };
    saveJSON(STORAGE_KEYS.cacheVdd, empty);
    return empty;
  }

  const step = total / 365;
  const items = [];
  for (let i = 0; i < 365; i++) {
    const idx = Math.floor(i * step);
    items.push(all[Math.min(idx, total - 1)]);
  }

  const vdd = { version: 1, name: "VDD 365 (auto)", items };
  saveJSON(STORAGE_KEYS.cacheVdd, vdd);
  return vdd;
}

/* ---------------- Settings ---------------- */

function wireSettings() {
  const cur = getSettings();
  if (els.themeSelect) els.themeSelect.value = cur.theme || "system";
  if (els.fontSizeSelect) els.fontSizeSelect.value = String(cur.fontScale || 100);

  els.saveSettings?.addEventListener("click", () => {
    const next = setSettings({
      theme: els.themeSelect?.value || "system",
      fontScale: Number(els.fontSizeSelect?.value || 100),
    });
    applySettings(next);
    toast("Réglages enregistrés.");
    if (state.debug.enabled) renderDebugBar();
  });

  els.resetSettings?.addEventListener("click", () => {
    const next = resetSettings();
    if (els.themeSelect) els.themeSelect.value = next.theme;
    if (els.fontSizeSelect) els.fontSizeSelect.value = String(next.fontScale);
    applySettings(next);
    toast("Réglages réinitialisés.");
    if (state.debug.enabled) renderDebugBar();
  });
}

function applySettings(s) {
  document.documentElement.style.setProperty("--fontScale", String(s.fontScale || 100));
}

/* ---------------- PWA Install + network + SW ---------------- */

function isInstalled() {
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  if ("standalone" in navigator && navigator.standalone) return true; // iOS
  return false;
}

/**
 * ✅ CORRIGIDO:
 * - esconde o badge quando a app já está instalada (evita duplicação "Installée / Installé")
 * - mantém só o botão visível
 * - botão fica visualmente mais discreto quando instalada
 */
function setInstallUI({ installed, installable }) {
  if (els.installBadge) {
    if (installed) {
      els.installBadge.hidden = true;
    } else {
      els.installBadge.hidden = false;
      els.installBadge.textContent = installable ? "📲 Installable" : "ℹ️";
    }
  }

  if (els.btnInstallAlways) {
    els.btnInstallAlways.disabled = installed;
    els.btnInstallAlways.textContent = installed ? "✅ Installée" : "⬇️ Installer";

    if (installed) {
      els.btnInstallAlways.classList.remove("btn--primary");
      els.btnInstallAlways.classList.add("btn--ghost");
      els.btnInstallAlways.title = "Application déjà installée";
    } else {
      els.btnInstallAlways.classList.add("btn--primary");
      els.btnInstallAlways.classList.remove("btn--ghost");
      els.btnInstallAlways.title = "Installer";
    }
  }

  if (state.debug.enabled) renderDebugBar();
}

function wirePwaInstall() {
  setInstallUI({ installed: isInstalled(), installable: false });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    setInstallUI({ installed: isInstalled(), installable: true });
  });

  window.addEventListener("appinstalled", () => {
    state.deferredInstallPrompt = null;
    setInstallUI({ installed: true, installable: false });
  });

  els.btnInstallAlways?.addEventListener("click", async () => {
    if (isInstalled()) return;

    if (state.deferredInstallPrompt) {
      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice;
      state.deferredInstallPrompt = null;
      setInstallUI({ installed: isInstalled(), installable: false });
      return;
    }

    alert(
      "Installer (iPhone/iPad):\n\n1) Ouvrir dans Safari\n2) Bouton Partager (⬆️)\n3) “Sur l’écran d’accueil”\n\nAndroid: menu ⋮ > “Installer l’application”."
    );
  });
}

function wireNetworkBadges() {
  const update = () => {
    if (els.chipOffline) els.chipOffline.hidden = navigator.onLine;
    if (state.debug.enabled) renderDebugBar();
  };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

function wireSW() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.register("/sw.js").catch(console.warn);

  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data === "SW_UPDATED" && els.chipUpdated) {
      els.chipUpdated.hidden = false;
      setTimeout(() => {
        if (els.chipUpdated) els.chipUpdated.hidden = true;
      }, 2500);
      if (state.debug.enabled) renderDebugBar();
    }
  });
}

/* ---------------- helpers ---------------- */

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  return clampInt(Math.floor((d - start) / 86400000) + 1, 1, 365);
}

function clampInt(x, min, max) {
  const n = Number(x);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}