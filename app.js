/* LaBible.app — LSG1910 (chargement par livres séparés)
   - Charge /data/bible/books.json (index)
   - Charge /data/bible/<id>.json à la demande
   - Lecture + Recherche + Plan 365 + Installer
*/

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  bible: null,          // { meta, books:[{id,name,abbr, chapters?}], ... }
  bookCache: new Map(), // id -> {id,name,abbr,chapters:[[]...]}
  index: null,          // search index items: {bi,c,v,norm,original}
  current: { book: 0, chapter: 1 },
  deferredPrompt: null,
  indexing: false
};

const LS_KEYS = {
  lastRef: "labible:lastRef",
  bookmarks: "labible:bookmarks",
  plan: "labible:plan365"
};

function toast(msg){
  const el = $("#toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(()=> el.classList.remove("show"), 2200);
}

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function normalize(s){
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

/* -------------------------
   Loader: books.json + livres séparés
-------------------------- */

async function loadBible(){
  // 1) Charge l’index des livres
  const idxUrl = "data/bible/books.json";
  const res = await fetch(idxUrl, { cache: "no-store" });
  if(!res.ok) throw new Error(`Index introuvable: ${idxUrl} (HTTP ${res.status})`);

  const books = await res.json();
  if(!Array.isArray(books) || !books.length) {
    throw new Error("books.json invalide (attendu: array non vide)");
  }

  // normalise index books
  const normBooks = books.map((b, i) => ({
    id: b.id || b.slug || b.code || String(i),
    name: b.name || b.title || b.nom || `Livre ${i+1}`,
    abbr: Array.isArray(b.abbr) ? b.abbr : (Array.isArray(b.abbrev) ? b.abbrev : [])
  }));

  state.bible = { meta: { name: "LSG 1910" }, books: normBooks };

  // 2) UI
  initSelectors();

  // 3) Précharge le livre courant (pour afficher tout de suite)
  await ensureBookLoaded(state.current.book);

  // 4) Render
  refreshChapterSelect();
  renderReading();

  // Search index sera construit à la demande (au premier search)
  state.index = null;
}

function bookFileUrl(bookId){
  return `data/bible/${bookId}.json`;
}

function normalizeBook(raw, fallback){
  const name = raw?.name || raw?.title || raw?.nom || fallback.name;

  // chapters peut être array ou objet
  let chapters = raw?.chapters || raw?.chapter || raw?.capitres || raw?.text || raw?.contents;

  // Si le livre est directement un map de chapitres
  if(!chapters && raw && typeof raw === "object"){
    const keys = Object.keys(raw);
    const looksLikeChapterMap = keys.length && keys.every(k => /^\d+$/.test(k));
    if(looksLikeChapterMap) chapters = raw;
  }

  // object -> array de chapitres
  if(chapters && !Array.isArray(chapters) && typeof chapters === "object"){
    const cKeys = Object.keys(chapters).filter(k=>/^\d+$/.test(k)).sort((a,b)=>+a-+b);
    chapters = cKeys.map(k => chapters[k]);
  }
  if(!Array.isArray(chapters)) chapters = [];

  chapters = chapters.map(ch => {
    // ch object { "1":"", "2":"" } -> array
    if(ch && !Array.isArray(ch) && typeof ch === "object"){
      const vKeys = Object.keys(ch).filter(k=>/^\d+$/.test(k)).sort((a,b)=>+a-+b);
      return vKeys.map(k => String(ch[k] ?? ""));
    }
    if(Array.isArray(ch)){
      if(ch.length && typeof ch[0] === "object"){
        return ch.map(v => String(v.text ?? v.t ?? v.value ?? v.val ?? v.verseText ?? ""));
      }
      return ch.map(v => String(v ?? ""));
    }
    return [];
  });

  return {
    id: fallback.id,
    name,
    abbr: fallback.abbr || [],
    chapters
  };
}

async function ensureBookLoaded(bookIndex){
  const b = state.bible.books[bookIndex];
  if(!b) throw new Error("Livre invalide");

  if(state.bookCache.has(b.id)) return state.bookCache.get(b.id);

  const url = bookFileUrl(b.id);
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`Livre introuvable: ${url} (HTTP ${res.status})`);

  const raw = await res.json();
  const norm = normalizeBook(raw, b);
  state.bookCache.set(b.id, norm);

  return norm;
}

/* -------------------------
   UI: Tabs / Views
-------------------------- */

function setView(viewName){
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === viewName));
  $$(".view").forEach(v => v.classList.toggle("active", v.id === `view-${viewName}`));
  if(viewName === "search") $("#searchInput")?.focus();
}

function bindTabs(){
  $$(".tab").forEach(tab => tab.addEventListener("click", () => setView(tab.dataset.view)));
}

/* -------------------------
   Lecture
-------------------------- */

function initSelectors(){
  const bookSelect = $("#bookSelect");
  const chapterSelect = $("#chapterSelect");

  bookSelect.innerHTML = "";
  state.bible.books.forEach((b, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = b.name;
    bookSelect.appendChild(opt);
  });

  // Restore last ref if exists
  const last = localStorage.getItem(LS_KEYS.lastRef);
  if(last){
    const parsed = parseReference(last);
    if(parsed){
      state.current.book = parsed.bi;
      state.current.chapter = parsed.c;
    }
  }

  bookSelect.value = String(state.current.book);

  bookSelect.addEventListener("change", async () => {
    state.current.book = parseInt(bookSelect.value, 10);
    state.current.chapter = 1;
    try{
      await ensureBookLoaded(state.current.book);
      refreshChapterSelect();
      renderReading();
    } catch(e){
      toast(String(e.message || e));
      showLoadError(e);
    }
  });

  chapterSelect.addEventListener("change", () => {
    state.current.chapter = parseInt(chapterSelect.value, 10);
    renderReading();
  });

  $("#btnPrev")?.addEventListener("click", () => navChapter(-1));
  $("#btnNext")?.addEventListener("click", () => navChapter(+1));

  $("#btnCopyRef")?.addEventListener("click", copyCurrentReference);
  $("#btnShare")?.addEventListener("click", shareCurrent);
  $("#btnBookmark")?.addEventListener("click", toggleBookmark);
}

function refreshChapterSelect(){
  const chSel = $("#chapterSelect");
  const bIndex = state.current.book;
  const bMeta = state.bible.books[bIndex];
  const b = state.bookCache.get(bMeta.id);
  const total = b?.chapters?.length || 1;

  chSel.innerHTML = "";
  for(let c=1; c<=total; c++){
    const opt = document.createElement("option");
    opt.value = String(c);
    opt.textContent = String(c);
    chSel.appendChild(opt);
  }
  state.current.chapter = clamp(state.current.chapter, 1, total);
  chSel.value = String(state.current.chapter);
}

async function navChapter(delta){
  const bookIndex = state.current.book;
  const bMeta = state.bible.books[bookIndex];
  const b = state.bookCache.get(bMeta.id);
  const total = b?.chapters?.length || 1;

  let c = state.current.chapter + delta;

  if(c < 1){
    if(bookIndex > 0){
      state.current.book -= 1;
      $("#bookSelect").value = String(state.current.book);
      await ensureBookLoaded(state.current.book);
      const prevMeta = state.bible.books[state.current.book];
      const prevBook = state.bookCache.get(prevMeta.id);
      state.current.chapter = prevBook.chapters.length;
      refreshChapterSelect();
      renderReading();
    } else toast("Début de la Bible.");
    return;
  }

  if(c > total){
    if(bookIndex < state.bible.books.length - 1){
      state.current.book += 1;
      $("#bookSelect").value = String(state.current.book);
      await ensureBookLoaded(state.current.book);
      state.current.chapter = 1;
      refreshChapterSelect();
      renderReading();
    } else toast("Fin de la Bible.");
    return;
  }

  state.current.chapter = c;
  $("#chapterSelect").value = String(c);
  renderReading();
}

function currentRefString(){
  const bMeta = state.bible.books[state.current.book];
  return `${bMeta.name} ${state.current.chapter}`;
}

function renderReading(highlightVerse = null){
  try{
    const bMeta = state.bible.books[state.current.book];
    const b = state.bookCache.get(bMeta.id);
    if(!b) throw new Error("Livre non chargé.");

    const c = state.current.chapter;
    const verses = b.chapters[c - 1] || [];

    $("#pageHeader").textContent = `${bMeta.name} ${c}`;
    const versesEl = $("#verses");
    versesEl.innerHTML = "";

    verses.forEach((txt, i) => {
      const p = document.createElement("p");
      p.className = "verse";

      const vnum = document.createElement("span");
      vnum.className = "vnum";
      vnum.textContent = String(i + 1);

      const span = document.createElement("span");
      span.textContent = " " + String(txt || "");

      p.appendChild(vnum);
      p.appendChild(span);

      if(highlightVerse && (i + 1) === highlightVerse){
        p.style.outline = "2px solid rgba(226,197,122,.35)";
        p.style.borderRadius = "12px";
        p.style.padding = "6px 8px";
        p.scrollIntoView({ block:"center", behavior:"smooth" });
      }

      versesEl.appendChild(p);
    });

    localStorage.setItem(LS_KEYS.lastRef, `${bMeta.name} ${c}`);
  } catch(e){
    showLoadError(e);
  }
}

function showLoadError(err){
  const versesEl = $("#verses");
  if(!versesEl) return;
  versesEl.innerHTML = `
    <p class="verse"><span class="vnum">!</span>
    <span>Impossible de charger la Bible. (${escapeHtml(String(err.message || err))})</span></p>
  `;
}

/* -------------------------
   Bookmarks
-------------------------- */

function getBookmarks(){
  try { return JSON.parse(localStorage.getItem(LS_KEYS.bookmarks) || "[]"); }
  catch { return []; }
}
function setBookmarks(arr){
  localStorage.setItem(LS_KEYS.bookmarks, JSON.stringify(arr));
}

function toggleBookmark(){
  const ref = currentRefString();
  const arr = getBookmarks();
  const idx = arr.indexOf(ref);
  if(idx >= 0){
    arr.splice(idx, 1);
    setBookmarks(arr);
    toast("Signet supprimé.");
  } else {
    arr.unshift(ref);
    setBookmarks(arr.slice(0, 50));
    toast("Signet ajouté.");
  }
}

/* -------------------------
   Copy / Share
-------------------------- */

async function copyCurrentReference(){
  const ref = currentRefString();
  try{ await navigator.clipboard.writeText(ref); toast("Référence copiée."); }
  catch { toast("Impossible de copier."); }
}

async function shareCurrent(){
  const bMeta = state.bible.books[state.current.book];
  const c = state.current.chapter;
  const url = location.origin + location.pathname + `#${encodeURIComponent(bMeta.name)}-${c}`;
  const text = `${bMeta.name} ${c} — LaBible.app`;

  if(navigator.share){
    try{ await navigator.share({ title: "LaBible.app", text, url }); } catch {}
  } else {
    try{ await navigator.clipboard.writeText(url); toast("Lien copié."); }
    catch { toast("Partage non disponible."); }
  }
}

/* -------------------------
   Recherche (index on-demand)
-------------------------- */

function bindSearch(){
  $("#btnSearch")?.addEventListener("click", doSearch);
  $("#searchInput")?.addEventListener("keydown", (e) => { if(e.key === "Enter") doSearch(); });
}

function findBookIndex(bookPart){
  const key = normalize(bookPart);

  // match by name
  for(let i=0; i<state.bible.books.length; i++){
    const b = state.bible.books[i];
    if(normalize(b.name) === key) return i;
  }
  // startsWith / includes
  for(let i=0; i<state.bible.books.length; i++){
    const b = state.bible.books[i];
    const n = normalize(b.name);
    if(n.startsWith(key) || n.includes(key)) return i;
  }
  // abbr
  for(let i=0; i<state.bible.books.length; i++){
    const b = state.bible.books[i];
    if((b.abbr || []).map(normalize).includes(key)) return i;
  }
  return -1;
}

function parseReference(input){
  const s = normalize(input);
  if(!s) return null;

  const m = s.match(/(\d+)\s*(?::\s*(\d+))?\s*$/);
  if(!m) return null;

  const chap = parseInt(m[1], 10);
  const verse = m[2] ? parseInt(m[2], 10) : null;

  const bookPart = s.slice(0, m.index).trim();
  if(!bookPart) return null;

  const bi = findBookIndex(bookPart);
  if(bi < 0) return null;

  return { bi, c: chap, v: verse };
}

function highlightText(text, query){
  if(!query) return escapeHtml(text);
  const q = normalize(query);
  if(q.length < 2) return escapeHtml(text);

  const words = q.split(" ").filter(w => w.length >= 2).slice(0, 5);
  let out = escapeHtml(text);

  words.forEach(w => {
    const re = new RegExp(escapeRegExp(w), "ig");
    out = out.replace(re, (m) => `<span class="hl">${escapeHtml(m)}</span>`);
  });

  return out;
}

async function buildSearchIndexOnDemand(){
  if(state.index) return;
  if(state.indexing) return;

  state.indexing = true;
  toast("Indexation… (1ère fois)");

  const items = [];
  for(let bi=0; bi<state.bible.books.length; bi++){
    const bMeta = state.bible.books[bi];
    try{
      const book = state.bookCache.get(bMeta.id) || await ensureBookLoaded(bi);
      for(let ci=0; ci<book.chapters.length; ci++){
        const verses = book.chapters[ci];
        for(let vi=0; vi<verses.length; vi++){
          const original = String(verses[vi] || "");
          items.push({
            bi,
            c: ci + 1,
            v: vi + 1,
            norm: normalize(original),
            original
          });
        }
      }
    } catch(e){
      // ignore one book if missing
      console.warn("Index skip book:", bMeta.id, e);
    }
  }

  state.index = items;
  state.indexing = false;
  toast("Recherche prête ✅");
}

async function openReference(ref){
  state.current.book = ref.bi;
  await ensureBookLoaded(ref.bi);

  const bMeta = state.bible.books[ref.bi];
  const b = state.bookCache.get(bMeta.id);

  const c = clamp(ref.c, 1, b.chapters.length);
  state.current.chapter = c;

  $("#bookSelect").value = String(ref.bi);
  refreshChapterSelect();
  $("#chapterSelect").value = String(c);

  setView("read");
  renderReading(ref.v ? clamp(ref.v, 1, (b.chapters[c-1]||[]).length || 1) : null);
}

async function doSearch(){
  const qRaw = $("#searchInput").value || "";
  const q = normalize(qRaw);

  $("#searchResults").innerHTML = "";
  $("#searchMeta").textContent = "";

  if(!q){
    toast("Entrez un mot ou une référence.");
    return;
  }

  // Référence ?
  const ref = parseReference(qRaw);
  if(ref){
    await openReference(ref);
    return;
  }

  // Index on demand (charge tous les livres une fois)
  await buildSearchIndexOnDemand();

  const max = 60;
  const results = [];
  for(const item of state.index){
    if(item.norm.includes(q)){
      results.push(item);
      if(results.length >= max) break;
    }
  }

  $("#searchMeta").textContent = results.length
    ? `${results.length}${results.length === max ? "+" : ""} résultat(s)`
    : "Aucun résultat.";

  const box = $("#searchResults");
  results.forEach(r => {
    const bName = state.bible.books[r.bi].name;
    const refStr = `${bName} ${r.c}:${r.v}`;

    const div = document.createElement("div");
    div.className = "result";
    div.innerHTML = `
      <div class="resultRef">${escapeHtml(refStr)}</div>
      <div class="resultText">${highlightText(r.original, qRaw)}</div>
      <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="chip" data-open="${escapeHtml(refStr)}">📖 Ouvrir</button>
        <button class="chip" data-copy="${escapeHtml(refStr)}">📎 Copier</button>
      </div>
    `;
    box.appendChild(div);
  });

  box.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const r = parseReference(btn.getAttribute("data-open"));
      if(r) await openReference(r);
    });
  });
  box.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const t = btn.getAttribute("data-copy");
      try{ await navigator.clipboard.writeText(t); toast("Copié."); } catch { toast("Impossible de copier."); }
    });
  });
}

/* -------------------------
   Plan de lecture 365 jours (sur chapitres)
-------------------------- */

function getPlanState(){
  try{ return JSON.parse(localStorage.getItem(LS_KEYS.plan) || "null"); }
  catch { return null; }
}
function setPlanState(obj){
  localStorage.setItem(LS_KEYS.plan, JSON.stringify(obj));
}

function flattenAllChapters(){
  // On génère une liste de refs (bookIndex, chapter)
  const out = [];
  // NOTE: pour compter chapitres, on doit connaître longueur => on charge tous les livres une fois (OK, 66)
  // Ici, on fait lazy: si un livre pas encore chargé, on le chargera lors de buildPlan
  return out;
}

async function buildPlan365(){
  // On charge tous les livres pour connaître nb chapitres
  for(let bi=0; bi<state.bible.books.length; bi++){
    await ensureBookLoaded(bi);
  }

  const books = state.bible.books;

  // heuristique AT/NT: 39/27
  const OT = books.slice(0, 39);
  const NT = books.slice(39);

  const otChaps = [];
  OT.forEach((bm) => {
    const bi = books.findIndex(x => x.id === bm.id);
    const b = state.bookCache.get(bm.id);
    for(let c=1; c<=b.chapters.length; c++) otChaps.push({ bi, c, label: `${bm.name} ${c}` });
  });

  const ntChaps = [];
  NT.forEach((bm) => {
    const bi = books.findIndex(x => x.id === bm.id);
    const b = state.bookCache.get(bm.id);
    for(let c=1; c<=b.chapters.length; c++) ntChaps.push({ bi, c, label: `${bm.name} ${c}` });
  });

  const days = 365;
  const plan = [];
  let otIndex = 0;
  let ntIndex = 0;

  for(let d=1; d<=days; d++){
    const today = [];

    if(ntIndex < ntChaps.length){
      today.push(ntChaps[ntIndex]);
      ntIndex++;
    }

    const remainingDays = days - d + 1;
    const remainingOT = otChaps.length - otIndex;
    let otPerDay = 2;
    if(remainingOT / remainingDays > 2.2) otPerDay = 3;

    for(let k=0; k<otPerDay; k++){
      if(otIndex < otChaps.length){
        today.push(otChaps[otIndex]);
        otIndex++;
      }
    }

    plan.push({ day: d, refs: today });
  }

  return plan;
}

async function ensurePlan(){
  let st = getPlanState();
  if(!st || !Array.isArray(st.plan) || typeof st.doneDay !== "number"){
    const plan = await buildPlan365();
    st = { createdAt: Date.now(), doneDay: 0, plan };
    setPlanState(st);
  }
  return st;
}

async function todayPlanDay(){
  const st = await ensurePlan();
  const created = new Date(st.createdAt);
  const now = new Date();

  const start = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  const cur = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((cur - start) / (24*60*60*1000)) + 1;
  return clamp(diff, 1, 365);
}

async function renderPlan(){
  const st = await ensurePlan();
  const day = await todayPlanDay();
  const entry = st.plan[day - 1];

  $("#planTodayText").textContent = `Jour ${day} — ${entry.refs.map(r => r.label).join(" · ")}`;

  const done = st.doneDay;
  $("#planTodayMeta").textContent = done >= day ? "✅ Déjà marqué comme lu." : `Progression actuelle : jour ${done} terminé.`;

  const pct = Math.round((done / 365) * 100);
  $("#progressFill").style.width = `${pct}%`;
  $("#progressText").textContent = `${pct}%`;

  $("#btnOpenToday").onclick = async () => {
    const r0 = entry.refs[0];
    await openReference({ bi: r0.bi, c: r0.c, v: null });
  };

  $("#btnMarkDone").onclick = async () => {
    const curDay = await todayPlanDay();
    const cur = await ensurePlan();
    if(cur.doneDay >= curDay){ toast("Déjà fait."); return; }
    cur.doneDay = curDay;
    setPlanState(cur);
    await renderPlan();
    toast("Lecture marquée comme faite.");
  };

  $("#btnResetPlan").onclick = async () => {
    localStorage.removeItem(LS_KEYS.plan);
    await renderPlan();
    toast("Plan réinitialisé.");
  };

  $("#btnJumpDay").onclick = async () => {
    const input = prompt("Aller à quel jour ? (1–365)");
    if(!input) return;
    const d = clamp(parseInt(input, 10) || 1, 1, 365);
    const st2 = await ensurePlan();
    const e = st2.plan[d-1];
    toast(`Jour ${d}: ${e.refs.map(r=>r.label).join(" · ")}`);
  };
}

/* -------------------------
   Installer (PWA)
-------------------------- */

function bindInstallButton(){
  const btnInstall = $("#btnInstall");
  if(!btnInstall) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    btnInstall.hidden = false;
  });

  btnInstall.addEventListener("click", async () => {
    if(!state.deferredPrompt) return;
    btnInstall.disabled = true;
    try{
      state.deferredPrompt.prompt();
      await state.deferredPrompt.userChoice;
      state.deferredPrompt = null;
      btnInstall.hidden = true;
    } finally {
      btnInstall.disabled = false;
    }
  });

  window.addEventListener("appinstalled", () => {
    state.deferredPrompt = null;
    btnInstall.hidden = true;
    toast("Installé ✅");
  });

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  if(isIOS && !isStandalone){
    const hint = $("#installHint");
    if(hint) hint.textContent = "💡 Sur iPhone : partage → « Sur l’écran d’accueil » pour l’installer.";
  }
}

/* -------------------------
   Hero + SW
-------------------------- */

function bindHeroButtons(){
  $("#btnOpenRead")?.addEventListener("click", () => setView("read"));
  $("#btnOpenSearch")?.addEventListener("click", () => setView("search"));
  $("#btnOpenPlan")?.addEventListener("click", () => setView("plan"));
  $("#btnHome")?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function registerSW(){
  if("serviceWorker" in navigator){
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(()=>{});
    });
  }
}

function handleHash(){
  const h = decodeURIComponent((location.hash || "").replace(/^#/, ""));
  if(!h) return;
  const m = h.match(/(.+)-(\d+)$/);
  if(!m) return;

  const bookName = m[1];
  const chap = parseInt(m[2], 10);
  const bi = findBookIndex(bookName);
  if(bi >= 0) openReference({ bi, c: chap, v: null });
}

/* -------------------------
   Init
-------------------------- */

async function init(){
  $("#year").textContent = String(new Date().getFullYear());

  bindTabs();
  bindSearch();
  bindInstallButton();
  bindHeroButtons();
  registerSW();

  try{
    await loadBible();
    await renderPlan();
    handleHash();
    toast("Bible chargée ✅");
  } catch(err){
    console.error(err);
    showLoadError(err);
    $("#searchMeta").textContent = "Bible non chargée.";
    $("#planTodayText").textContent = "Bible non chargée (plan indisponible).";
    toast(String(err.message || err));
  }
}

init();
