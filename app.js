/* =========================
   LaBible.app — app.js
   (stable, vdd opens in reader)
   ========================= */

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const LS = {
  theme: "labible:theme",
  font: "labible:font",
  last: "labible:lastRef",
  fav: "labible:favs",
  hist: "labible:history",
  plan: "labible:plan365",
  vdd: "labible:vddCache"
};

const BOOKS_INDEX_URL = "/data/bible/books.json";

const state = {
  bible: null,
  bookCache: new Map(),
  index: null,
  indexing: false,
  current: { book: 0, chapter: 1 },
  deferredPrompt: null,
  readFont: 16,
  vddRef: null
};

/* ---------- helpers ---------- */
function toast(msg){
  const el = $("#toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(()=> el.classList.remove("show"), 2200);
}
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function normalize(s){
  return (s||"")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/['']/g,"'")
    .replace(/\s+/g," ")
    .trim();
}
function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function nowIso(){ return new Date().toISOString(); }
function dateKey(d=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const da=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}

/* ---------- file urls ---------- */
function bookFileUrl(bookId){
  const meta = state.bible?.books?.find(b => b.id === bookId);
  const filename = meta?.file ? meta.file : `${bookId}.json`;
  return `/data/bible/${filename}`;
}

/* ---------- views / ui ---------- */
function setView(view){
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === view));
  $$(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));
  if(view === "search") $("#searchInput")?.focus();
  if(view === "library") renderLibrary();
}
function bindTabs(){
  $$(".tab").forEach(tab => tab.addEventListener("click", () => setView(tab.dataset.view)));
}

/* ---------- theme / font ---------- */
function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(LS.theme, theme);
  const btn = $("#btnTheme");
  if(btn) btn.textContent = theme === "light" ? "☀️" : "🌙";
}
function loadTheme(){
  const saved = localStorage.getItem(LS.theme);
  if(saved === "light" || saved === "dark") applyTheme(saved);
  else applyTheme("dark");
}
function applyFont(px){
  state.readFont = clamp(px, 14, 22);
  document.documentElement.style.setProperty("--readFont", `${state.readFont}px`);
  localStorage.setItem(LS.font, String(state.readFont));
}
function loadFont(){
  const v = parseInt(localStorage.getItem(LS.font) || "16", 10);
  applyFont(isFinite(v) ? v : 16);
}

/* ---------- normalize book formats ---------- */
function normalizeBook(raw, fallback){
  let detectedName = null;
  let payload = raw;

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const keys = Object.keys(raw);
    if (keys.length === 1) {
      const k0 = keys[0];
      const v0 = raw[k0];
      if (v0 && typeof v0 === "object" && !Array.isArray(v0)) {
        const chapKeys = Object.keys(v0).filter(k => /^\d+$/.test(k));
        if (chapKeys.length) {
          detectedName = k0;
          payload = v0;
        }
      }
    }
  }

  const name = fallback?.name || detectedName || raw?.name || raw?.title || raw?.nom || "Livre";
  const abbr = Array.isArray(raw?.abbr) ? raw.abbr
            : (Array.isArray(raw?.abbrev) ? raw.abbrev
            : (fallback?.abbr || []));

  let chapters =
    payload?.chapters || payload?.chapter || payload?.capitres || payload?.contents || payload?.text;

  if (!chapters && payload && typeof payload === "object" && !Array.isArray(payload)) {
    const keys = Object.keys(payload);
    const looksLikeChapters = keys.length && keys.every(k => /^\d+$/.test(k));
    if (looksLikeChapters) chapters = payload;
  }

  if (chapters && !Array.isArray(chapters) && typeof chapters === "object") {
    const cKeys = Object.keys(chapters).filter(k => /^\d+$/.test(k)).sort((a,b)=>+a-+b);
    chapters = cKeys.map(k => chapters[k]);
  }

  if (!Array.isArray(chapters)) chapters = [];

  chapters = chapters.map(ch => {
    if (ch && typeof ch === "object" && !Array.isArray(ch)) {
      const vKeys = Object.keys(ch).filter(k => /^\d+$/.test(k)).sort((a,b)=>+a-+b);
      return vKeys.map(k => String(ch[k] ?? ""));
    }
    if (Array.isArray(ch)) {
      if (ch.length && typeof ch[0] === "object") {
        return ch.map(v => String(v.text ?? v.t ?? v.value ?? v.val ?? v.verseText ?? ""));
      }
      return ch.map(v => String(v ?? ""));
    }
    return [];
  });

  return { id: fallback.id, name, abbr, chapters };
}

async function ensureBookLoaded(bookIndex){
  const meta = state.bible.books[bookIndex];
  if(!meta) throw new Error("Livre invalide.");

  if(state.bookCache.has(meta.id)) return state.bookCache.get(meta.id);

  const url = bookFileUrl(meta.id);
  const res = await fetch(url, { cache:"no-store" });

  if(!res.ok) throw new Error(`Livre introuvable : ${url} (HTTP ${res.status})`);

  let raw;
  try{ raw = await res.json(); }
  catch{ throw new Error(`JSON invalide dans ${url}.`); }

  const book = normalizeBook(raw, meta);
  if(!book.chapters.length) throw new Error(`Format invalide dans ${url} (chapitres).`);

  state.bookCache.set(meta.id, book);
  return book;
}

function restoreLastRef(){
  const last = localStorage.getItem(LS.last);
  if(!last) return;
  const ref = parseReference(last);
  if(!ref) return;
  state.current.book = ref.bi;
  state.current.chapter = ref.c;
}

async function loadBible(){
  const res = await fetch(BOOKS_INDEX_URL, { cache:"no-store" });
  if(!res.ok) throw new Error(`Index introuvable : ${BOOKS_INDEX_URL} (HTTP ${res.status})`);

  const idx = await res.json();
  const booksArr = Array.isArray(idx) ? idx : idx.books;
  if(!Array.isArray(booksArr) || !booksArr.length){
    throw new Error("books.json invalide (attendu : [..] ou {books:[..]}).");
  }

  state.bible = {
    meta: {
      name: (!Array.isArray(idx) && idx?.version) ? idx.version : "LSG1910",
      title: (!Array.isArray(idx) && idx?.title) ? idx.title : "LSG1910",
      language: (!Array.isArray(idx) && idx?.language) ? idx.language : "fr"
    },
    books: booksArr.map((b,i)=>({
      id: b.id || b.slug || b.code || String(i),
      name: b.name || b.title || b.nom || `Livre ${i+1}`,
      file: b.file || null,
      abbr: Array.isArray(b.abbr) ? b.abbr : (Array.isArray(b.abbrev) ? b.abbrev : [])
    }))
  };

  initSelectors();
  restoreLastRef();

  $("#bookSelect").value = String(state.current.book);
  await ensureBookLoaded(state.current.book);
  refreshChapterSelect();
  renderReading();

  await computeVerseOfDay();
  await renderPlan();
  renderLibrary();
}

/* ---------- selectors / reading ---------- */
function initSelectors(){
  const bookSelect = $("#bookSelect");
  const chapterSelect = $("#chapterSelect");

  bookSelect.innerHTML = "";
  state.bible.books.forEach((b,i)=>{
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = b.name;
    bookSelect.appendChild(opt);
  });

  bookSelect.addEventListener("change", async () => {
    state.current.book = parseInt(bookSelect.value,10);
    state.current.chapter = 1;
    await ensureBookLoaded(state.current.book);
    refreshChapterSelect();
    renderReading();
  });

  chapterSelect.addEventListener("change", () => {
    state.current.chapter = parseInt(chapterSelect.value,10);
    renderReading();
  });

  $("#btnPrev")?.addEventListener("click", () => navChapter(-1));
  $("#btnNext")?.addEventListener("click", () => navChapter(+1));

  $("#btnCopyRef")?.addEventListener("click", () => copyText(currentRefString()));
  $("#btnShare")?.addEventListener("click", shareCurrent);
  $("#btnBookmark")?.addEventListener("click", toggleFavCurrent);

  $("#btnFontMinus")?.addEventListener("click", () => applyFont(state.readFont - 1));
  $("#btnFontPlus")?.addEventListener("click", () => applyFont(state.readFont + 1));

  $("#btnVDD")?.addEventListener("click", async () => {
    try{
      await computeVerseOfDay(true);
      if(state.vddRef){
        await openReference(state.vddRef);
        toast("Verset du jour ✅");
      } else {
        toast("Impossible d'ouvrir le verset du jour.");
      }
    }catch(e){
      console.error(e);
      toast("Erreur : verset du jour.");
    }
  });
}

function refreshChapterSelect(){
  const chapterSelect = $("#chapterSelect");
  const meta = state.bible.books[state.current.book];
  const book = state.bookCache.get(meta.id);
  const total = book?.chapters?.length || 1;

  chapterSelect.innerHTML = "";
  for(let c=1;c<=total;c++){
    const opt = document.createElement("option");
    opt.value = String(c);
    opt.textContent = `Ch. ${c}`;
    chapterSelect.appendChild(opt);
  }
  state.current.chapter = clamp(state.current.chapter, 1, total);
  chapterSelect.value = String(state.current.chapter);
}

async function navChapter(delta){
  const bi = state.current.book;
  const meta = state.bible.books[bi];
  const book = state.bookCache.get(meta.id);
  const total = book?.chapters?.length || 1;

  let c = state.current.chapter + delta;

  if(c < 1){
    if(bi > 0){
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
    if(bi < state.bible.books.length - 1){
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
  const meta = state.bible.books[state.current.book];
  return `${meta.name} ${state.current.chapter}`;
}

/* ---------- favorites / history ---------- */
function getFavs(){ try{ return JSON.parse(localStorage.getItem(LS.fav) || "[]"); } catch { return []; } }
function setFavs(arr){ localStorage.setItem(LS.fav, JSON.stringify(arr)); }
function getHistory(){ try{ return JSON.parse(localStorage.getItem(LS.hist) || "[]"); } catch { return []; } }
function setHistory(arr){ localStorage.setItem(LS.hist, JSON.stringify(arr)); }

function pushHistory(ref){
  let arr = getHistory().filter(x => x?.ref !== ref);
  arr.unshift({ ref, at: nowIso() });
  arr = arr.slice(0, 30);
  setHistory(arr);
}

function updateFavButtonState(){
  const ref = currentRefString();
  const favs = getFavs();
  const btn = $("#btnBookmark");
  if(btn) btn.textContent = favs.some(f => f.type==="ref" && f.ref===ref) ? "✅ Favori" : "🔖 Favori";
}

function toggleFavCurrent(){
  const ref = currentRefString();
  const favs = getFavs();
  const idx = favs.findIndex(f => f.type==="ref" && f.ref===ref);
  if(idx >= 0){
    favs.splice(idx,1);
    toast("Favori supprimé.");
  } else {
    favs.unshift({ type:"ref", ref, at: nowIso() });
    toast("Favori ajouté.");
  }
  setFavs(favs.slice(0, 120));
  updateFavButtonState();
  renderLibrary();
}

function toggleFavVerse(bookName, chapter, verse, text){
  const ref = `${bookName} ${chapter}:${verse}`;
  const favs = getFavs();
  const idx = favs.findIndex(f => f.type==="verse" && f.ref===ref);
  if(idx >= 0){
    favs.splice(idx,1);
    toast("Verset retiré des favoris.");
  } else {
    favs.unshift({ type:"verse", ref, text: String(text||""), at: nowIso() });
    toast("Verset ajouté aux favoris.");
  }
  setFavs(favs.slice(0, 200));
  renderLibrary();
}

/* ---------- render reading ---------- */
function renderReading(highlightVerse=null){
  try{
    const meta = state.bible.books[state.current.book];
    const book = state.bookCache.get(meta.id);
    const c = state.current.chapter;

    $("#pageHeader").textContent = `${meta.name} ${c}`;

    const verses = book.chapters[c-1] || [];
    const box = $("#verses");
    box.innerHTML = "";

    verses.forEach((t,i)=>{
      const p = document.createElement("p");
      p.className = "verse";

      const vnum = document.createElement("span");
      vnum.className = "vnum";
      vnum.textContent = String(i+1);

      const span = document.createElement("span");
      span.textContent = " " + String(t||"");

      p.appendChild(vnum);
      p.appendChild(span);

      p.addEventListener("click", () => toggleFavVerse(meta.name, c, i+1, t));

      if(highlightVerse && (i+1) === highlightVerse){
        p.style.outline = "2px solid rgba(226,197,122,.35)";
        p.style.borderRadius = "12px";
        p.style.padding = "6px 8px";
        p.scrollIntoView({ block:"center", behavior:"smooth" });
      }

      box.appendChild(p);
    });

    const refStr = `${meta.name} ${c}`;
    localStorage.setItem(LS.last, refStr);
    pushHistory(refStr);
    updateFavButtonState();
  } catch(err){
    $("#pageHeader").textContent = "Erreur";
    $("#verses").innerHTML = `<p class="verse"><span class="vnum">!</span><span>${escapeHtml(err.message||String(err))}</span></p>`;
  }
}

/* ---------- swipe navigation ---------- */
function bindSwipe(){
  const page = $("#readerPage");
  if(!page) return;
  let startX=0, startY=0, active=false;

  page.addEventListener("touchstart", (e)=>{
    const t=e.touches?.[0]; if(!t) return;
    startX=t.clientX; startY=t.clientY; active=true;
  }, {passive:true});

  page.addEventListener("touchend", (e)=>{
    if(!active) return; active=false;
    const t=e.changedTouches?.[0]; if(!t) return;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if(Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy)*1.2) return;
    if(dx < 0) navChapter(+1); else navChapter(-1);
  }, {passive:true});
}

/* ---------- search ---------- */
function findBookIndex(bookPart){
  const key = normalize(bookPart);
  for(let i=0;i<state.bible.books.length;i++){
    if(normalize(state.bible.books[i].name) === key) return i;
  }
  for(let i=0;i<state.bible.books.length;i++){
    const n = normalize(state.bible.books[i].name);
    if(n.startsWith(key) || n.includes(key)) return i;
  }
  for(let i=0;i<state.bible.books.length;i++){
    const ab = state.bible.books[i].abbr || [];
    if(ab.map(normalize).includes(key)) return i;
  }
  return -1;
}

function parseReference(input){
  const s = normalize(input);
  const m = s.match(/(\d+)\s*(?::\s*(\d+))?\s*$/);
  if(!m) return null;

  const chap = parseInt(m[1],10);
  const verse = m[2] ? parseInt(m[2],10) : null;

  const bookPart = s.slice(0, m.index).trim();
  if(!bookPart) return null;

  const bi = findBookIndex(bookPart);
  if(bi < 0) return null;

  return { bi, c: chap, v: verse };
}

function highlightText(text, query){
  const q = normalize(query);
  if(q.length < 2) return escapeHtml(text);

  const words = q.split(" ").filter(w=>w.length>=2).slice(0,6);
  let out = escapeHtml(text);
  words.forEach(w=>{
    const re = new RegExp(escapeRegExp(w), "ig");
    out = out.replace(re, (m)=>`<span class="hl">${escapeHtml(m)}</span>`);
  });
  return out;
}

async function openReference(ref){
  state.current.book = ref.bi;
  await ensureBookLoaded(ref.bi);

  const meta = state.bible.books[ref.bi];
  const book = state.bookCache.get(meta.id);

  const c = clamp(ref.c, 1, book.chapters.length);
  state.current.chapter = c;

  $("#bookSelect").value = String(ref.bi);
  refreshChapterSelect();
  $("#chapterSelect").value = String(c);

  setView("read");
  renderReading(ref.v ? clamp(ref.v, 1, (book.chapters[c-1]||[]).length || 1) : null);
}

async function buildIndex(force=false){
  if(state.index && !force) return;
  if(state.indexing) return;

  state.indexing = true;
  $("#searchMeta").textContent = "Indexation…";
  toast("Indexation…");

  for(let bi=0; bi<state.bible.books.length; bi++){
    await ensureBookLoaded(bi);
  }

  const items = [];
  for(let bi=0; bi<state.bible.books.length; bi++){
    const meta = state.bible.books[bi];
    const book = state.bookCache.get(meta.id);
    for(let ci=0; ci<book.chapters.length; ci++){
      const verses = book.chapters[ci];
      for(let vi=0; vi<verses.length; vi++){
        const original = String(verses[vi] || "");
        items.push({ bi, c: ci+1, v: vi+1, norm: normalize(original), original });
      }
    }
  }

  state.index = items;
  state.indexing = false;
  $("#searchMeta").textContent = `Index prêt — ${items.length.toLocaleString("fr-FR")} versets.`;
  toast("Recherche prête ✅");
}

async function doSearch(){
  const qRaw = $("#searchInput")?.value || "";
  const q = normalize(qRaw);

  $("#searchResults").innerHTML = "";
  $("#searchMeta").textContent = "";

  if(!q){ toast("Veuillez saisir un mot ou une référence."); return; }

  const ref = parseReference(qRaw);
  if(ref){ await openReference(ref); return; }

  if(!state.index){
    $("#searchMeta").textContent = "Appuyez sur ⚡ Index (une seule fois).";
    toast("Index requis ⚡");
    return;
  }

  const max = 80;
  const results = [];
  for(const item of state.index){
    if(item.norm.includes(q)){
      results.push(item);
      if(results.length >= max) break;
    }
  }

  $("#searchMeta").textContent = results.length ? `${results.length}${results.length===max?"+":""} résultat(s)` : "Aucun résultat.";

  const box = $("#searchResults");
  results.forEach(r=>{
    const bName = state.bible.books[r.bi].name;
    const refStr = `${bName} ${r.c}:${r.v}`;
    const div = document.createElement("div");
    div.className = "result";
    div.innerHTML = `
      <div class="resultRef">${escapeHtml(refStr)}</div>
      <div class="resultText">${highlightText(r.original, qRaw)}</div>
      <div class="itemBtns">
        <button class="chip" data-open="${escapeHtml(refStr)}">📖 Ouvrir</button>
        <button class="chip" data-copy="${escapeHtml(refStr)}">📎 Copier</button>
      </div>
    `;
    box.appendChild(div);
  });

  box.querySelectorAll("[data-open]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const r = parseReference(btn.getAttribute("data-open"));
      if(r) await openReference(r);
    });
  });

  box.querySelectorAll("[data-copy]").forEach(btn=>{
    btn.addEventListener("click", async ()=> copyText(btn.getAttribute("data-copy")));
  });
}

function bindSearch(){
  $("#btnSearch")?.addEventListener("click", doSearch);
  $("#searchInput")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") doSearch(); });

  $("#btnBuildIndex")?.addEventListener("click", async ()=> buildIndex(false));
  $("#btnClearSearch")?.addEventListener("click", ()=>{
    $("#searchInput").value = "";
    $("#searchMeta").textContent = "";
    $("#searchResults").innerHTML = "";
  });
}

/* ---------- clipboard / share ---------- */
async function copyText(t){
  try{ await navigator.clipboard.writeText(t); toast("Copié ✅"); }
  catch{ toast("Impossible de copier."); }
}

async function shareCurrent(){
  const meta = state.bible.books[state.current.book];
  const c = state.current.chapter;
  const url = location.origin + location.pathname + `#${encodeURIComponent(meta.name)}-${c}`;
  const text = `${meta.name} ${c} — LaBible.app | LSG1910`;
  if(navigator.share){
    try{ await navigator.share({ title:"LaBible.app", text, url }); } catch {}
  } else {
    await copyText(url);
  }
}

/* ---------- verse of day ---------- */
function seededRand(seed){
  let x = seed >>> 0;
  x ^= x << 13; x >>>= 0;
  x ^= x >> 17; x >>>= 0;
  x ^= x << 5;  x >>>= 0;
  return x >>> 0;
}

async function computeVerseOfDay(force=false){
  const k = dateKey();

  if(!force){
    try{
      const cached = JSON.parse(localStorage.getItem(LS.vdd) || "null");
      if(cached?.key === k && cached?.ref){
        state.vddRef = cached.ref;
        const vddBox = $("#vddBox");
        if(vddBox) vddBox.textContent = cached.text || "—";
        return;
      }
    } catch {}
  }

  const seedBase = Number(k.replace(/-/g,"")) || 1;
  const seed1 = seededRand(seedBase);
  const bi = seed1 % state.bible.books.length;

  const book = await ensureBookLoaded(bi);
  const seed2 = seededRand(seed1);
  const ci = (seed2 % book.chapters.length) + 1;
  const verses = book.chapters[ci-1] || [];
  const seed3 = seededRand(seed2);
  const vi = verses.length ? ((seed3 % verses.length) + 1) : 1;

  const ref = { bi, c: ci, v: vi };
  const meta = state.bible.books[bi];
  const text = String((verses[vi-1] || "")).trim();

  state.vddRef = ref;
  const line = `${meta.name} ${ci}:${vi} — ${text || "…"}`;
  const vddBox = $("#vddBox");
  if(vddBox) vddBox.textContent = line;

  localStorage.setItem(LS.vdd, JSON.stringify({ key: k, ref, text: line, at: nowIso() }));
}

/* ---------- plan 365 ---------- */
async function ensurePlan(){
  let st = null;
  try{ st = JSON.parse(localStorage.getItem(LS.plan) || "null"); } catch {}
  if(st && Array.isArray(st.plan) && typeof st.doneDay==="number" && st.createdAt) return st;

  for(let bi=0; bi<state.bible.books.length; bi++){
    await ensureBookLoaded(bi);
  }

  const books = state.bible.books;
  const OT = books.slice(0, 39);
  const NT = books.slice(39);

  const otChaps = [];
  OT.forEach(bm=>{
    const b = state.bookCache.get(bm.id);
    for(let c=1; c<=b.chapters.length; c++) otChaps.push({ bi: books.findIndex(x=>x.id===bm.id), c, label:`${bm.name} ${c}` });
  });

  const ntChaps = [];
  NT.forEach(bm=>{
    const b = state.bookCache.get(bm.id);
    for(let c=1; c<=b.chapters.length; c++) ntChaps.push({ bi: books.findIndex(x=>x.id===bm.id), c, label:`${bm.name} ${c}` });
  });

  const days = 365;
  const plan = [];
  let oi=0, ni=0;

  for(let d=1; d<=days; d++){
    const refs = [];
    if(ni < ntChaps.length) refs.push(ntChaps[ni++]);

    const remainingDays = days - d + 1;
    const remainingOT = otChaps.length - oi;
    let otPerDay = (remainingOT / remainingDays > 2.2) ? 3 : 2;

    for(let k=0;k<otPerDay;k++){
      if(oi < otChaps.length) refs.push(otChaps[oi++]);
    }

    plan.push({ day:d, refs });
  }

  st = { createdAt: Date.now(), doneDay: 0, plan };
  localStorage.setItem(LS.plan, JSON.stringify(st));
  return st;
}

function planDayFrom(createdAt){
  const created = new Date(createdAt);
  const now = new Date();
  const start = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  const cur = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((cur - start) / (24*60*60*1000)) + 1;
  return clamp(diff, 1, 365);
}

async function renderPlan(){
  const st = await ensurePlan();
  const day = planDayFrom(st.createdAt);
  const entry = st.plan[day-1];

  $("#planTodayText").textContent = `Jour ${day} — ${entry.refs.map(r=>r.label).join(" · ")}`;
  $("#planTodayMeta").textContent = st.doneDay >= day ? "✅ Déjà marqué comme lu." : `Progression : jour ${st.doneDay} terminé.`;

  const pct = Math.round((st.doneDay / 365) * 100);
  $("#progressFill").style.width = `${pct}%`;
  $("#progressText").textContent = `${pct}%`;

  $("#btnOpenToday").onclick = async () => {
    const r0 = entry.refs[0];
    await openReference({ bi:r0.bi, c:r0.c, v:null });
  };

  $("#btnMarkDone").onclick = async () => {
    const st2 = await ensurePlan();
    const today = planDayFrom(st2.createdAt);
    if(st2.doneDay >= today){ toast("Déjà fait."); return; }
    st2.doneDay = today;
    localStorage.setItem(LS.plan, JSON.stringify(st2));
    await renderPlan();
    toast("Lecture marquée ✅");
  };

  $("#btnResetPlan").onclick = async () => {
    localStorage.removeItem(LS.plan);
    await renderPlan();
    toast("Plan réinitialisé.");
  };

  $("#btnJumpDay").onclick = async () => {
    const input = prompt("Aller à quel jour ? (1–365)");
    if(!input) return;
    const d = clamp(parseInt(input,10)||1,1,365);
    const st2 = await ensurePlan();
    const e = st2.plan[d-1];
    toast(`Jour ${d} : ${e.refs.map(r=>r.label).join(" · ")}`);
  };
}

/* ---------- library ---------- */
function renderLibrary(){
  const favs = getFavs();
  const hist = getHistory();

  const favList = $("#favList");
  favList.innerHTML = favs.length ? "" : `<div class="muted small">Aucun favori.</div>`;
  favs.slice(0,30).forEach(f=>{
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemRef">${escapeHtml(f.ref || "")}</div>
          <div class="itemMeta">${escapeHtml(new Date(f.at || Date.now()).toLocaleString("fr-FR"))}</div>
        </div>
      </div>
      ${f.text ? `<div class="itemMeta" style="margin-top:10px">${escapeHtml(f.text).slice(0,220)}${f.text.length>220?"…":""}</div>` : ``}
      <div class="itemBtns">
        <button class="chip" data-open="${escapeHtml(f.ref)}">📖 Ouvrir</button>
        <button class="chip" data-copy="${escapeHtml(f.ref)}">📎 Copier</button>
      </div>
    `;
    favList.appendChild(div);
  });

  favList.querySelectorAll("[data-open]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const r = parseReference(btn.getAttribute("data-open"));
      if(r) await openReference(r);
      else toast("Référence non reconnue.");
    });
  });
  favList.querySelectorAll("[data-copy]").forEach(btn=>{
    btn.addEventListener("click", async ()=> copyText(btn.getAttribute("data-copy")));
  });

  const historyList = $("#historyList");
  historyList.innerHTML = hist.length ? "" : `<div class="muted small">Aucun historique.</div>`;
  hist.slice(0,30).forEach(h=>{
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemRef">${escapeHtml(h.ref || "")}</div>
          <div class="itemMeta">${escapeHtml(new Date(h.at || Date.now()).toLocaleString("fr-FR"))}</div>
        </div>
      </div>
      <div class="itemBtns">
        <button class="chip" data-open="${escapeHtml(h.ref)}">📖 Ouvrir</button>
        <button class="chip" data-copy="${escapeHtml(h.ref)}">📎 Copier</button>
      </div>
    `;
    historyList.appendChild(div);
  });

  historyList.querySelectorAll("[data-open]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const r = parseReference(btn.getAttribute("data-open"));
      if(r) await openReference(r);
      else toast("Référence non reconnue.");
    });
  });
  historyList.querySelectorAll("[data-copy]").forEach(btn=>{
    btn.addEventListener("click", async ()=> copyText(btn.getAttribute("data-copy")));
  });
}

function bindLibraryButtons(){
  $("#btnClearFav")?.addEventListener("click", ()=>{
    if(confirm("Supprimer tous les favoris ?")){
      localStorage.removeItem(LS.fav);
      renderLibrary();
      toast("Favoris supprimés.");
    }
  });

  $("#btnClearHistory")?.addEventListener("click", ()=>{
    if(confirm("Supprimer l'historique ?")){
      localStorage.removeItem(LS.hist);
      renderLibrary();
      toast("Historique supprimé.");
    }
  });

  $("#btnOpenVDD")?.addEventListener("click", async ()=>{
    if(!state.vddRef) await computeVerseOfDay(true);
    if(state.vddRef) await openReference(state.vddRef);
  });

  $("#btnCopyVDD")?.addEventListener("click", async ()=>{
    await copyText($("#vddBox")?.textContent || "");
  });
}

/* ---------- PWA install ---------- */
function bindInstall(){
  const btn = $("#btnInstall");
  window.addEventListener("beforeinstallprompt", (e)=>{
    e.preventDefault();
    state.deferredPrompt = e;
    if(btn) btn.hidden = false;
  });

  btn?.addEventListener("click", async ()=>{
    if(!state.deferredPrompt) return;
    btn.disabled = true;
    try{
      state.deferredPrompt.prompt();
      await state.deferredPrompt.userChoice;
      state.deferredPrompt = null;
      btn.hidden = true;
    } finally { btn.disabled = false; }
  });

  window.addEventListener("appinstalled", ()=>{
    state.deferredPrompt = null;
    if(btn) btn.hidden = true;
    toast("Installée ✅");
  });
}

/* ---------- header actions ---------- */
function bindHeaderActions(){
  $("#btnHome")?.addEventListener("click", ()=> window.scrollTo({top:0, behavior:"smooth"}));
  $("#btnTheme")?.addEventListener("click", ()=>{
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(cur === "dark" ? "light" : "dark");
  });
}

/* ---------- init ---------- */
async function init(){
  const y = $("#year");
  if(y) y.textContent = String(new Date().getFullYear());

  loadTheme();
  loadFont();

  bindTabs();
  bindHeaderActions();
  bindSearch();
  bindSwipe();
  bindLibraryButtons();
  bindInstall();

  try{
    await loadBible();
    toast("Bible chargée ✅");
  } catch(err){
    console.error(err);
    $("#pageHeader").textContent = "Erreur";
    $("#verses").innerHTML = `<p class="verse"><span class="vnum">!</span><span>${escapeHtml(err.message||String(err))}</span></p>`;
    toast(String(err.message || err));
  }
}

init();
