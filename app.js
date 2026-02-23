/* LaBible.app — LSG1910
   Fonctions:
   - Lecture livre/chapitre
   - Recherche: mot-clé + référence (ex: Jean 3:16)
   - Plan de lecture 365 jours (localStorage)
   - Installer PWA (beforeinstallprompt)
   - Signets (bookmark) (localStorage)
   - Partage / copie
*/

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  bible: null,         // { books: [...] }
  index: null,         // simple search index
  current: { book: 0, chapter: 1 },
  deferredPrompt: null,
};

const LS_KEYS = {
  lastRef: "labible:lastRef",
  bookmarks: "labible:bookmarks",
  plan: "labible:plan365"
};

function toast(msg){
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(()=> el.classList.remove("show"), 2200);
}

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function normalize(s){
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // remove accents
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/* -------------------------
   DATA LOADER (LSG JSON)
-------------------------- */
/*
Format attendu de /data/lsg1910.json :

{
  "meta": { "name":"LSG 1910" },
  "books": [
    {
      "id":"gen",
      "name":"Genèse",
      "abbr":["genese","gen","ge"],
      "chapters":[
        ["Au commencement...", "Ainsi furent achevés..."],  // chapitre 1 : versets (index 0 => verset 1)
        ["Ainsi furent achevés...", "..."]                  // chapitre 2
      ]
    }
  ]
}

=> chapters[c-1][v-1] = texte du verset
*/

async function loadBible(){
  const res = await fetch("/data/lsg1910.json", { cache: "no-store" });
  if(!res.ok) throw new Error("Bible JSON introuvable: /data/lsg1910.json");
  const data = await res.json();

  if(!data || !Array.isArray(data.books)) {
    throw new Error("Format Bible JSON invalide (attendu: {books:[...]})");
  }

  // Validate minimal
  data.books.forEach((b, i) => {
    if(!b.name || !Array.isArray(b.chapters)) {
      throw new Error(`Livre invalide à l'index ${i}`);
    }
  });

  state.bible = data;
  buildSearchIndex();
  initSelectors();
}

function buildSearchIndex(){
  // Index simple: liste de (bookIdx, chap, verse, textNorm, textOriginal)
  const items = [];
  state.bible.books.forEach((book, bi) => {
    book.chapters.forEach((verses, ci) => {
      verses.forEach((t, vi) => {
        const original = String(t || "");
        const norm = normalize(original);
        items.push({
          bi,
          c: ci + 1,
          v: vi + 1,
          norm,
          original
        });
      });
    });
  });
  state.index = items;
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
  $$(".tab").forEach(tab => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });
}

/* -------------------------
   Lecture
-------------------------- */
function initSelectors(){
  const bookSelect = $("#bookSelect");
  bookSelect.innerHTML = "";

  state.bible.books.forEach((b, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = b.name;
    bookSelect.appendChild(opt);
  });

  bookSelect.addEventListener("change", () => {
    state.current.book = parseInt(bookSelect.value, 10);
    state.current.chapter = 1;
    refreshChapterSelect();
    renderReading();
  });

  $("#chapterSelect").addEventListener("change", () => {
    state.current.chapter = parseInt($("#chapterSelect").value, 10);
    renderReading();
  });

  $("#btnPrev").addEventListener("click", () => navChapter(-1));
  $("#btnNext").addEventListener("click", () => navChapter(+1));

  $("#btnCopyRef").addEventListener("click", copyCurrentReference);
  $("#btnShare").addEventListener("click", shareCurrent);
  $("#btnBookmark").addEventListener("click", toggleBookmark);

  // Restore last ref if exists
  const last = localStorage.getItem(LS_KEYS.lastRef);
  if(last){
    const parsed = parseReference(last);
    if(parsed){
      state.current.book = parsed.bi;
      state.current.chapter = parsed.c;
    }
  }

  // set selects + render
  bookSelect.value = String(state.current.book);
  refreshChapterSelect();
  renderReading();
}

function refreshChapterSelect(){
  const chSel = $("#chapterSelect");
  const book = state.bible.books[state.current.book];
  const total = book.chapters.length;

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

function navChapter(delta){
  const book = state.bible.books[state.current.book];
  const total = book.chapters.length;
  let c = state.current.chapter + delta;

  if(c < 1){
    // previous book last chapter
    if(state.current.book > 0){
      state.current.book -= 1;
      const prevBook = state.bible.books[state.current.book];
      state.current.chapter = prevBook.chapters.length;
      $("#bookSelect").value = String(state.current.book);
      refreshChapterSelect();
      renderReading();
    } else {
      toast("Début de la Bible.");
    }
    return;
  }

  if(c > total){
    // next book first chapter
    if(state.current.book < state.bible.books.length - 1){
      state.current.book += 1;
      state.current.chapter = 1;
      $("#bookSelect").value = String(state.current.book);
      refreshChapterSelect();
      renderReading();
    } else {
      toast("Fin de la Bible.");
    }
    return;
  }

  state.current.chapter = c;
  $("#chapterSelect").value = String(c);
  renderReading();
}

function currentRefString(){
  const b = state.bible.books[state.current.book];
  return `${b.name} ${state.current.chapter}`;
}

function renderReading(highlightVerse = null){
  const b = state.bible.books[state.current.book];
  const c = state.current.chapter;
  const verses = b.chapters[c - 1] || [];

  $("#pageHeader").textContent = `${b.name} ${c}`;
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

  // save last ref
  localStorage.setItem(LS_KEYS.lastRef, `${b.name} ${c}`);
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
  try{
    await navigator.clipboard.writeText(ref);
    toast("Référence copiée.");
  } catch {
    toast("Impossible de copier.");
  }
}

async function shareCurrent(){
  const b = state.bible.books[state.current.book];
  const c = state.current.chapter;
  const url = location.origin + location.pathname + `#${encodeURIComponent(b.name)}-${c}`;
  const text = `${b.name} ${c} — LaBible.app`;

  if(navigator.share){
    try{
      await navigator.share({ title: "LaBible.app", text, url });
    } catch {}
  } else {
    try{
      await navigator.clipboard.writeText(url);
      toast("Lien copié.");
    } catch {
      toast("Partage non disponible.");
    }
  }
}

/* -------------------------
   Recherche
-------------------------- */
function bindSearch(){
  $("#btnSearch").addEventListener("click", doSearch);
  $("#searchInput").addEventListener("keydown", (e) => {
    if(e.key === "Enter") doSearch();
  });
}

function parseReference(input){
  // Accept:
  // - "Jean 3:16"
  // - "Jean 3"
  // - "Jn 3:16" if abbr provided in json
  const s = normalize(input);
  if(!s) return null;

  // Find last number block (chapter[:verse]?)
  const m = s.match(/(\d+)\s*(?::\s*(\d+))?\s*$/);
  if(!m) return null;

  const chap = parseInt(m[1], 10);
  const verse = m[2] ? parseInt(m[2], 10) : null;

  const bookPart = s.slice(0, m.index).trim();
  if(!bookPart) return null;

  // Find book by name or abbr
  const bi = findBookIndex(bookPart);
  if(bi < 0) return null;

  const book = state.bible.books[bi];
  const c = clamp(chap, 1, book.chapters.length);

  let v = null;
  if(verse !== null){
    const maxV = (book.chapters[c-1] || []).length || 1;
    v = clamp(verse, 1, maxV);
  }

  return { bi, c, v };
}

function findBookIndex(bookPart){
  const key = normalize(bookPart);

  // exact match on normalized name
  for(let i=0; i<state.bible.books.length; i++){
    const b = state.bible.books[i];
    if(normalize(b.name) === key) return i;
  }

  // startsWith / contains (helpful)
  for(let i=0; i<state.bible.books.length; i++){
    const b = state.bible.books[i];
    const n = normalize(b.name);
    if(n.startsWith(key) || n.includes(key)) return i;
  }

  // abbr array
  for(let i=0; i<state.bible.books.length; i++){
    const b = state.bible.books[i];
    const ab = Array.isArray(b.abbr) ? b.abbr : [];
    if(ab.map(normalize).includes(key)) return i;
  }

  return -1;
}

function highlightText(text, query){
  if(!query) return escapeHtml(text);
  const q = normalize(query);
  if(q.length < 2) return escapeHtml(text);

  // highlight words (split)
  const words = q.split(" ").filter(w => w.length >= 2).slice(0, 5);
  let out = escapeHtml(text);

  words.forEach(w => {
    const re = new RegExp(escapeRegExp(w), "ig");
    out = out.replace(re, (m) => `<span class="hl">${escapeHtml(m)}</span>`);
  });

  return out;
}

function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function doSearch(){
  const qRaw = $("#searchInput").value || "";
  const q = normalize(qRaw);

  $("#searchResults").innerHTML = "";
  $("#searchMeta").textContent = "";

  if(!q){
    toast("Entrez un mot ou une référence.");
    return;
  }

  // Reference first
  const ref = parseReference(qRaw);
  if(ref){
    openReference(ref);
    return;
  }

  // Keyword search (simple contains)
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
    const b = state.bible.books[r.bi];
    const refStr = `${b.name} ${r.c}:${r.v}`;

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
    btn.addEventListener("click", () => {
      const r = parseReference(btn.getAttribute("data-open"));
      if(r) openReference(r);
    });
  });
  box.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const t = btn.getAttribute("data-copy");
      try{ await navigator.clipboard.writeText(t); toast("Copié."); } catch { toast("Impossible de copier."); }
    });
  });
}

function openReference(ref){
  state.current.book = ref.bi;
  state.current.chapter = ref.c;

  $("#bookSelect").value = String(ref.bi);
  refreshChapterSelect();
  $("#chapterSelect").value = String(ref.c);

  setView("read");
  renderReading(ref.v || null);

  toast(ref.v ? "Ouverture du verset…" : "Ouverture du chapitre…");
}

/* -------------------------
   Plan de lecture 365 jours
-------------------------- */
function buildPlan365(){
  // Plan simple: 365 jours, lecture continue:
  // - NT: ~260 chapitres, AT: ~929 chapitres => on combine 1 chap NT + 2-3 chap AT selon le jour
  // Sans calcul compliqué: on répartit:
  // - chaque jour: 1 chapitre NT (jusqu’à fin NT), puis continue AT
  // - et AT: ~2 chap/jour + ajustement
  //
  // C’est un plan “pratique” et stable: on va générer une liste de références "Livre Chapitre"
  const books = state.bible.books;

  // Heuristique: détecter NT vs AT par position (souvent OT 39, NT 27)
  const OT = books.slice(0, 39);
  const NT = books.slice(39);

  const otChaps = flattenChapters(OT);
  const ntChaps = flattenChapters(NT);

  const days = 365;
  const plan = [];

  let otIndex = 0;
  let ntIndex = 0;

  for(let d=1; d<=days; d++){
    const today = [];

    // 1 chapitre NT tant qu'il en reste
    if(ntIndex < ntChaps.length){
      today.push(ntChaps[ntIndex]);
      ntIndex++;
    }

    // AT: 2 chapitres/jour, parfois 3 pour finir
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

    plan.push({
      day: d,
      refs: today // array of { bi, c, label }
    });
  }

  return plan;
}

function flattenChapters(bookList){
  const out = [];
  bookList.forEach(book => {
    const bi = state.bible.books.indexOf(book);
    for(let c=1; c<=book.chapters.length; c++){
      out.push({ bi, c, label: `${book.name} ${c}` });
    }
  });
  return out;
}

function getPlanState(){
  try{
    return JSON.parse(localStorage.getItem(LS_KEYS.plan) || "null");
  } catch {
    return null;
  }
}
function setPlanState(obj){
  localStorage.setItem(LS_KEYS.plan, JSON.stringify(obj));
}

function ensurePlan(){
  let st = getPlanState();
  if(!st || !Array.isArray(st.plan) || typeof st.doneDay !== "number"){
    const plan = buildPlan365();
    st = { createdAt: Date.now(), doneDay: 0, plan };
    setPlanState(st);
  }
  return st;
}

function todayPlanDay(){
  // Jour stable: basé sur date locale, à partir de la première utilisation
  const st = ensurePlan();
  const created = new Date(st.createdAt);
  const now = new Date();
  // diff jours (start at 1)
  const start = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  const cur = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((cur - start) / (24*60*60*1000)) + 1;
  return clamp(diff, 1, 365);
}

function renderPlan(){
  const st = ensurePlan();
  const day = todayPlanDay();
  const entry = st.plan[day - 1];

  const refsText = entry.refs.map(r => r.label).join(" · ");
  $("#planTodayText").textContent = `Jour ${day} — ${refsText}`;

  const done = st.doneDay;
  const doneTxt = done >= day ? "✅ Déjà marqué comme lu." : `Progression actuelle : jour ${done} terminé.`;
  $("#planTodayMeta").textContent = doneTxt;

  const pct = Math.round((done / 365) * 100);
  $("#progressFill").style.width = `${pct}%`;
  $("#progressText").textContent = `${pct}%`;

  $("#btnOpenToday").onclick = () => {
    // open the first ref of today
    const r0 = entry.refs[0];
    openReference({ bi: r0.bi, c: r0.c, v: null });
  };

  $("#btnMarkDone").onclick = () => {
    const curDay = todayPlanDay();
    const cur = ensurePlan();
    if(cur.doneDay >= curDay){
      toast("Déjà fait.");
      return;
    }
    cur.doneDay = curDay;
    setPlanState(cur);
    renderPlan();
    toast("Lecture marquée comme faite.");
  };

  $("#btnResetPlan").onclick = () => {
    localStorage.removeItem(LS_KEYS.plan);
    renderPlan();
    toast("Plan réinitialisé.");
  };

  $("#btnJumpDay").onclick = () => {
    const input = prompt("Aller à quel jour ? (1–365)");
    if(!input) return;
    const d = clamp(parseInt(input, 10) || 1, 1, 365);
    const st2 = ensurePlan();
    const e = st2.plan[d-1];
    toast(`Jour ${d}: ${e.refs.map(r=>r.label).join(" · ")}`);
  };
}

/* -------------------------
   Installer (PWA)
-------------------------- */
function bindInstallButton(){
  const btnInstall = $("#btnInstall");

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

  // iOS hint handling (no install prompt)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  if(isIOS && !isStandalone){
    $("#installHint").textContent = "💡 Sur iPhone : partage → « Sur l’écran d’accueil » pour l’installer.";
  }
}

/* -------------------------
   Hero buttons
-------------------------- */
function bindHeroButtons(){
  $("#btnOpenRead").addEventListener("click", () => setView("read"));
  $("#btnOpenSearch").addEventListener("click", () => setView("search"));
  $("#btnOpenPlan").addEventListener("click", () => setView("plan"));
  $("#btnHome").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* -------------------------
   Hash deep-link
-------------------------- */
function handleHash(){
  // Format: #Jean-3
  const h = decodeURIComponent((location.hash || "").replace(/^#/, ""));
  if(!h) return;
  const m = h.match(/(.+)-(\d+)$/);
  if(!m) return;
  const bookName = m[1];
  const chap = parseInt(m[2], 10);
  const bi = findBookIndex(bookName);
  if(bi >= 0){
    openReference({ bi, c: chap, v: null });
  }
}

/* -------------------------
   Service Worker minimal (no offline)
-------------------------- */
function registerSW(){
  if("serviceWorker" in navigator){
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(()=>{});
    });
  }
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
    renderPlan();
    handleHash();
    toast("Bible chargée ✅");
  } catch(err){
    console.error(err);
    $("#verses").innerHTML = `<p class="verse"><span class="vnum">!</span> <span>Impossible de charger la Bible. Vérifie <b>/data/lsg1910.json</b>.</span></p>`;
    $("#searchMeta").textContent = "Bible non chargée.";
    $("#planTodayText").textContent = "Bible non chargée (plan indisponible).";
    toast("Erreur: Bible introuvable.");
  }
}

init();

async function loadBible(){
  const res = await fetch("/data/lsg1910.json", { cache: "no-store" });
  if(!res.ok) throw new Error("Bible JSON introuvable: /data/lsg1910.json");

  const raw = await res.json();

  // --- Normalisation multi-formats ---
  // Format A (recommandé): { meta, books:[{name, chapters:[[v1,v2...], ...]}] }
  // Format B: { books:[...] } mais chapitres sous forme d'objets
  // Format C: { bible:[...] } ou { data:[...] }
  let data = raw;

  if (data && Array.isArray(data.bible) && !data.books) data = { books: data.bible, meta: data.meta || {} };
  if (data && Array.isArray(data.data) && !data.books) data = { books: data.data, meta: data.meta || {} };

  // Si books est un objet (clé->livre), on convertit en array
  if (data && data.books && !Array.isArray(data.books) && typeof data.books === "object") {
    data.books = Object.values(data.books);
  }

  if(!data || !Array.isArray(data.books)) {
    throw new Error("Format Bible JSON invalide (attendu: books:[])");
  }

  // Convertit chaque livre vers le format interne
  const books = data.books.map((b, bi) => {
    const name = b.name || b.title || b.book || b.nom || `Livre ${bi+1}`;

    // chapters peut être:
    // - array de chapitres => chaque chapitre array de versets (ok)
    // - objet { "1": [...], "2":[...] } => convertir
    // - array d'objets versets => convertir
    let chapters = b.chapters || b.chapter || b.chaps || b.capitres || b.contents;

    if (chapters && !Array.isArray(chapters) && typeof chapters === "object") {
      // { "1": [...], "2": [...] }
      const keys = Object.keys(chapters).sort((a,b)=>parseInt(a,10)-parseInt(b,10));
      chapters = keys.map(k => chapters[k]);
    }

    if (!Array.isArray(chapters)) chapters = [];

    // Nettoie chapitres/versets
    chapters = chapters.map(ch => {
      // ch peut être:
      // - array de strings (ok)
      // - objet { "1":"txt", "2":"txt" } => convertir en array
      // - array d'objets {v:1, t:""} => convertir
      if (ch && !Array.isArray(ch) && typeof ch === "object") {
        const k = Object.keys(ch).sort((a,b)=>parseInt(a,10)-parseInt(b,10));
        return k.map(x => String(ch[x] ?? ""));
      }
      if (Array.isArray(ch)) {
        // array de strings ou d'objets
        if (ch.length && typeof ch[0] === "object") {
          // ex: [{verse:1,text:"..."}, ...]
          return ch.map(v => String(v.text ?? v.t ?? v.verseText ?? v.val ?? ""));
        }
        return ch.map(v => String(v ?? ""));
      }
      return [];
    });

    const abbr = Array.isArray(b.abbr) ? b.abbr : (Array.isArray(b.abbrev) ? b.abbrev : []);

    return {
      id: b.id || b.slug || b.code || String(bi),
      name,
      abbr,
      chapters
    };
  });

  // Validation minimal
  books.forEach((b, i) => {
    if(!b.name || !Array.isArray(b.chapters)) {
      throw new Error(`Livre invalide à l'index ${i}`);
    }
  });

  state.bible = { meta: data.meta || {}, books };

  buildSearchIndex();
  initSelectors();
}