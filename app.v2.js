/* =========================
   LaBible.app — app.js
   Fonte: /data/lsg1910.json
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

const DATA_URL = "/data/lsg1910.json";
const DATA_URL_CDN = "https://cdn.jsdelivr.net/gh/BMRCO/labible@main/data/lsg1910.json";

const state = {
  bible: null,
  index: null,
  indexing: false,
  current: { book: 0, chapter: 1 },
  deferredPrompt: null,
  readFont: 16,
  vddRef: null,
  selectedVerse: null  // { bookName, chapter, verse, text }
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
  return (s||"").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/['']/g,"'").replace(/\s+/g," ").trim();
}
function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function nowIso(){ return new Date().toISOString(); }
function dateKey(d=new Date()){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

/* ---------- verse action bar ---------- */
function buildVerseShareText(bookName, chapter, verse, text){
  const cleanText = String(text||"").replace(/^¶\s*/,"").trim();
  const ref = `${bookName} ${chapter}:${verse}`;
  const url = `https://labible.app/#${bookName}-${chapter}`;
  return `« ${cleanText} »\n— ${ref} (LSG 1910)\n📖 ${url}`;
}

function showVerseActions(bookName, chapter, verse, text, el){
  // Retirer sélection précédente
  $$(".verse.selected").forEach(p => p.classList.remove("selected"));
  el.classList.add("selected");
  state.selectedVerse = { bookName, chapter, verse, text };

  // Retirer ancien panel si existir
  $("#verseActionBar")?.remove();

  const bar = document.createElement("div");
  bar.id = "verseActionBar";
  bar.style.cssText = `
    display:flex; gap:8px; padding:8px 12px; margin-top:4px;
    background:rgba(226,197,122,.1); border-radius:12px;
    border:1px solid rgba(226,197,122,.25); flex-wrap:wrap;
  `;

  const ref = `${bookName} ${chapter}:${verse}`;

  const btnFav = document.createElement("button");
  btnFav.className = "chip";
  const favs = getFavs();
  const isFav = favs.some(f => f.type==="verse" && f.ref===ref);
  btnFav.textContent = isFav ? "✅ Favori" : "🔖 Favori";
  btnFav.onclick = () => { toggleFavVerse(bookName, chapter, verse, text); bar.remove(); el.classList.remove("selected"); state.selectedVerse=null; };

  const btnCopy = document.createElement("button");
  btnCopy.className = "chip";
  btnCopy.textContent = "📎 Copier";
  btnCopy.onclick = async () => {
    await copyText(buildVerseShareText(bookName, chapter, verse, text));
    bar.remove(); el.classList.remove("selected"); state.selectedVerse=null;
  };

  const btnShare = document.createElement("button");
  btnShare.className = "chip";
  btnShare.textContent = "🔗 Partager";
  btnShare.onclick = async () => {
    await shareVerse(bookName, chapter, verse, text);
    bar.remove(); el.classList.remove("selected"); state.selectedVerse=null;
  };

  const btnClose = document.createElement("button");
  btnClose.className = "chip";
  btnClose.textContent = "✕";
  btnClose.style.marginLeft = "auto";
  btnClose.onclick = () => { bar.remove(); el.classList.remove("selected"); state.selectedVerse=null; };

  bar.appendChild(btnFav);
  bar.appendChild(btnCopy);
  bar.appendChild(btnShare);
  bar.appendChild(btnClose);

  el.insertAdjacentElement("afterend", bar);
}

async function shareVerse(bookName, chapter, verse, text){
  const shareText = buildVerseShareText(bookName, chapter, verse, text);
  const url = `https://labible.app/#${bookName}-${chapter}`;
  if(navigator.share){
    try{ await navigator.share({ title:`${bookName} ${chapter}:${verse} — LaBible.app`, text: shareText, url }); } catch{}
  } else {
    await copyText(shareText);
  }
}

/* ---------- views ---------- */
function setView(view){
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === view));
  $$(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));
  if(view === "search") $("#searchInput")?.focus();
  if(view === "library") renderLibrary();
  // Fermer le panel de verset si on change de vue
  $("#verseActionBar")?.remove();
  $$(".verse.selected").forEach(p => p.classList.remove("selected"));
  state.selectedVerse = null;
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
  applyTheme(localStorage.getItem(LS.theme) === "light" ? "light" : "dark");
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

/* ---------- charger la bible ---------- */
async function loadBible(){
  let res;
  try{
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    res = await fetch(DATA_URL, { signal: ctrl.signal });
    clearTimeout(timer);
    if(!res.ok) throw new Error("local failed");
  } catch(e){
    try{
      res = await fetch(DATA_URL_CDN);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch(e2){
      throw new Error("Impossible de charger la Bible. Vérifiez votre connexion.");
    }
  }

  const raw = await res.json();

  const verses = Array.isArray(raw) ? raw : (raw.verses || raw.data || raw);
  if(!Array.isArray(verses) || !verses.length) throw new Error("Format lsg1910.json invalide.");

  const dataMap = new Map();
  const bookMeta = new Map();

  for(const v of verses){
    const bookNr  = v.book ?? v.book_nr ?? v.bookNumber ?? v.b;
    const chapNr  = v.chapter ?? v.chap ?? v.c;
    const verseNr = v.verse ?? v.v;
    const text    = String(v.text ?? v.t ?? "")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_,h) => String.fromCharCode(parseInt(h,16)))
      .trim();
    const bname   = v.book_name ?? v.bookName ?? v.name ?? `Livre ${bookNr}`;

    if(!bookNr || !chapNr || !verseNr) continue;

    if(!bookMeta.has(bookNr)) bookMeta.set(bookNr, bname);

    if(!dataMap.has(bookNr)) dataMap.set(bookNr, new Map());
    const bookMap = dataMap.get(bookNr);

    if(!bookMap.has(chapNr)) bookMap.set(chapNr, []);
    const chArr = bookMap.get(chapNr);
    chArr[verseNr - 1] = text;
  }

  const sortedNrs = [...bookMeta.keys()].sort((a,b) => a - b);
  const books = sortedNrs.map(nr => ({
    nr,
    name: bookMeta.get(nr),
    abbr: []
  }));

  state.bible = { books, data: dataMap };

  initSelectors();

  const last = localStorage.getItem(LS.last);
  if(last){
    const ref = parseReference(last);
    if(ref){ state.current.book = ref.bi; state.current.chapter = ref.c; }
  }

  $("#bookSelect").value = String(state.current.book);
  refreshChapterSelect();
  renderReading();

  await computeVerseOfDay();
  await renderPlan();
  renderLibrary();
}

/* ---------- sélecteurs ---------- */
function initSelectors(){
  const bookSelect    = $("#bookSelect");
  const chapterSelect = $("#chapterSelect");

  bookSelect.innerHTML = "";
  state.bible.books.forEach((b, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = b.name;
    bookSelect.appendChild(opt);
  });

  bookSelect.addEventListener("change", async () => {
    state.current.book = parseInt(bookSelect.value, 10);
    state.current.chapter = 1;
    refreshChapterSelect();
    renderReading();
  });

  chapterSelect.addEventListener("change", () => {
    state.current.chapter = parseInt(chapterSelect.value, 10);
    renderReading();
  });

  $("#btnPrev")?.addEventListener("click", () => navChapter(-1));
  $("#btnNext")?.addEventListener("click", () => navChapter(+1));
  $("#btnCopyRef")?.addEventListener("click", () => {
    if(state.selectedVerse){
      const { bookName, chapter, verse, text } = state.selectedVerse;
      copyText(buildVerseShareText(bookName, chapter, verse, text));
    } else {
      copyText(currentRefString());
    }
  });
  $("#btnShare")?.addEventListener("click", () => {
    if(state.selectedVerse){
      const { bookName, chapter, verse, text } = state.selectedVerse;
      shareVerse(bookName, chapter, verse, text);
    } else {
      shareCurrent();
    }
  });
  $("#btnBookmark")?.addEventListener("click", toggleFavCurrent);
  $("#btnFontMinus")?.addEventListener("click", () => applyFont(state.readFont - 1));
  $("#btnFontPlus")?.addEventListener("click", () => applyFont(state.readFont + 1));
  $("#btnVDD")?.addEventListener("click", async () => {
    await computeVerseOfDay(true);
    if(state.vddRef){ await openReference(state.vddRef); toast("Verset du jour ✅"); }
  });
}

function getBookData(bi){
  const book = state.bible.books[bi];
  if(!book) return null;
  return state.bible.data.get(book.nr) || null;
}

function refreshChapterSelect(){
  const chapterSelect = $("#chapterSelect");
  const bookMap = getBookData(state.current.book);
  const total = bookMap ? bookMap.size : 1;

  chapterSelect.innerHTML = "";
  for(let c = 1; c <= total; c++){
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
  const bookMap = getBookData(bi);
  const total = bookMap ? bookMap.size : 1;
  let c = state.current.chapter + delta;

  if(c < 1){
    if(bi > 0){
      state.current.book -= 1;
      $("#bookSelect").value = String(state.current.book);
      const prevMap = getBookData(state.current.book);
      state.current.chapter = prevMap ? prevMap.size : 1;
      refreshChapterSelect();
      renderReading();
    } else toast("Début de la Bible.");
    return;
  }
  if(c > total){
    if(bi < state.bible.books.length - 1){
      state.current.book += 1;
      $("#bookSelect").value = String(state.current.book);
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
  const book = state.bible.books[state.current.book];
  return `${book.name} ${state.current.chapter}`;
}

/* ---------- favoris / historique ---------- */
function getFavs(){ try{ return JSON.parse(localStorage.getItem(LS.fav)||"[]"); }catch{ return []; } }
function setFavs(a){ localStorage.setItem(LS.fav, JSON.stringify(a)); }
function getHistory(){ try{ return JSON.parse(localStorage.getItem(LS.hist)||"[]"); }catch{ return []; } }
function setHistory(a){ localStorage.setItem(LS.hist, JSON.stringify(a)); }

function pushHistory(ref){
  let arr = getHistory().filter(x => x?.ref !== ref);
  arr.unshift({ ref, at: nowIso() });
  setHistory(arr.slice(0, 30));
}

function updateFavButtonState(){
  const ref = currentRefString();
  const btn = $("#btnBookmark");
  if(btn) btn.textContent = getFavs().some(f => f.type==="ref" && f.ref===ref) ? "✅ Favori" : "🔖 Favori";
}

function toggleFavCurrent(){
  const ref = currentRefString();
  const favs = getFavs();
  const idx = favs.findIndex(f => f.type==="ref" && f.ref===ref);
  if(idx >= 0){ favs.splice(idx,1); toast("Favori supprimé."); }
  else { favs.unshift({ type:"ref", ref, at: nowIso() }); toast("Favori ajouté."); }
  setFavs(favs.slice(0, 120));
  updateFavButtonState();
  renderLibrary();
}

function toggleFavVerse(bookName, chapter, verse, text){
  const ref = `${bookName} ${chapter}:${verse}`;
  const favs = getFavs();
  const idx = favs.findIndex(f => f.type==="verse" && f.ref===ref);
  if(idx >= 0){ favs.splice(idx,1); toast("Verset retiré."); }
  else { favs.unshift({ type:"verse", ref, text: String(text||""), at: nowIso() }); toast("Verset ajouté ⭐"); }
  setFavs(favs.slice(0, 200));
  renderLibrary();
}

/* ---------- rendu lecture ---------- */
function renderReading(highlightVerse=null){
  try{
    // Fermer panel de verset si ouvert
    $("#verseActionBar")?.remove();
    state.selectedVerse = null;

    const book    = state.bible.books[state.current.book];
    const bookMap = getBookData(state.current.book);
    const c       = state.current.chapter;
    const verses  = bookMap?.get(c) || [];

    $("#pageHeader").textContent = `${book.name} ${c}`;

    const box = $("#verses");
    box.innerHTML = "";

    verses.forEach((t, i) => {
      if(t === undefined || t === null) return;
      const p    = document.createElement("p");
      p.className = "verse";

      const vnum = document.createElement("span");
      vnum.className = "vnum";
      vnum.textContent = String(i + 1);

      const span = document.createElement("span");
      span.textContent = " " + String(t);

      p.appendChild(vnum);
      p.appendChild(span);

      // Toque: mostrar menu de acções do versículo
      p.addEventListener("click", () => {
        // Se já seleccionado, fechar
        if(p.classList.contains("selected")){
          $("#verseActionBar")?.remove();
          p.classList.remove("selected");
          state.selectedVerse = null;
        } else {
          showVerseActions(book.name, c, i+1, t, p);
        }
      });

      if(highlightVerse && (i+1) === highlightVerse){
        p.style.outline = "2px solid rgba(226,197,122,.35)";
        p.style.borderRadius = "12px";
        p.style.padding = "6px 8px";
        setTimeout(() => p.scrollIntoView({ block:"center", behavior:"smooth" }), 80);
      }

      box.appendChild(p);
    });

    const refStr = `${book.name} ${c}`;
    localStorage.setItem(LS.last, refStr);
    pushHistory(refStr);
    updateFavButtonState();
    history.replaceState(null, "", `#${book.name}-${c}`.normalize('NFC'));
    document.title = `${book.name} ${c} \u2014 LaBible.app`;
  } catch(err){
    $("#pageHeader").textContent = "Erreur";
    $("#verses").innerHTML = `<p class="verse"><span class="vnum">!</span><span>${escapeHtml(err.message)}</span></p>`;
  }
}

/* ---------- swipe ---------- */
function bindSwipe(){
  const page = $("#readerPage");
  if(!page) return;
  let sx=0, sy=0, active=false;

  page.addEventListener("touchstart", e => {
    const t = e.touches?.[0]; if(!t) return;
    sx=t.clientX; sy=t.clientY; active=true;
  }, {passive:true});

  page.addEventListener("touchend", e => {
    if(!active) return; active=false;
    const t = e.changedTouches?.[0]; if(!t) return;
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if(Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy)*1.2) return;
    navChapter(dx < 0 ? +1 : -1);
  }, {passive:true});
}

/* ---------- recherche ---------- */
function findBookIndex(bookPart){
  const key = normalize(bookPart);
  const books = state.bible.books;
  for(let i=0;i<books.length;i++) if(normalize(books[i].name) === key) return i;
  for(let i=0;i<books.length;i++){
    const n = normalize(books[i].name);
    if(n.startsWith(key) || n.includes(key)) return i;
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
  let out = escapeHtml(text);
  q.split(" ").filter(w=>w.length>=2).slice(0,6).forEach(w => {
    const re = new RegExp(escapeRegExp(w), "ig");
    out = out.replace(re, m => `<span class="hl">${escapeHtml(m)}</span>`);
  });
  return out;
}

async function openReference(ref){
  state.current.book = ref.bi;
  const bookMap = getBookData(ref.bi);
  const total = bookMap ? bookMap.size : 1;
  state.current.chapter = clamp(ref.c, 1, total);

  $("#bookSelect").value = String(ref.bi);
  refreshChapterSelect();
  $("#chapterSelect").value = String(state.current.chapter);

  setView("read");
  const verses = bookMap?.get(state.current.chapter) || [];
  renderReading(ref.v ? clamp(ref.v, 1, verses.length || 1) : null);
}

async function buildIndex(force=false){
  if(state.index && !force) return;
  if(state.indexing) return;
  state.indexing = true;
  $("#searchMeta").textContent = "Indexation…";

  const items = [];
  for(let bi=0; bi<state.bible.books.length; bi++){
    const book = state.bible.books[bi];
    const bookMap = state.bible.data.get(book.nr);
    if(!bookMap) continue;
    for(const [chapNr, verses] of bookMap){
      verses.forEach((t, vi) => {
        if(!t) return;
        items.push({ bi, c: chapNr, v: vi+1, norm: normalize(t), original: t });
      });
    }
  }

  state.index = items;
  state.indexing = false;
  $("#searchMeta").textContent = `Index prêt \u2014 ${items.length.toLocaleString("fr-FR")} versets.`;
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
    toast("Index requis ⚡"); return;
  }

  const max = 80;
  const results = [];
  for(const item of state.index){
    if(item.norm.includes(q)){ results.push(item); if(results.length >= max) break; }
  }

  $("#searchMeta").textContent = results.length
    ? `${results.length}${results.length===max?"+":""} résultat(s)`
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
      <div class="itemBtns">
        <button class="chip" data-open="${escapeHtml(refStr)}">📖 Ouvrir</button>
        <button class="chip" data-copy="${escapeHtml(refStr)}">📎 Copier</button>
        <button class="chip" data-share="${escapeHtml(refStr)}">🔗 Partager</button>
      </div>`;
    box.appendChild(div);
  });

  box.querySelectorAll("[data-open]").forEach(btn =>
    btn.addEventListener("click", async () => {
      const r = parseReference(btn.getAttribute("data-open"));
      if(r) await openReference(r);
    })
  );
  box.querySelectorAll("[data-copy]").forEach(btn =>
    btn.addEventListener("click", () => {
      const refStr = btn.getAttribute("data-copy");
      const parsed = parseReference(refStr);
      const bookMap = parsed ? getBookData(parsed.bi) : null;
      const verses = bookMap?.get(parsed?.c) || [];
      const text = parsed?.v ? String(verses[parsed.v - 1] || "") : "";
      const bName = parsed ? state.bible.books[parsed.bi].name : "";
      copyText(buildVerseShareText(bName, parsed?.c, parsed?.v, text));
    })
  );
  box.querySelectorAll("[data-share]").forEach(btn =>
    btn.addEventListener("click", async () => {
      const refStr = btn.getAttribute("data-share");
      const parsed = parseReference(refStr);
      const bookMap = parsed ? getBookData(parsed.bi) : null;
      const verses = bookMap?.get(parsed?.c) || [];
      const text = parsed?.v ? String(verses[parsed.v - 1] || "") : "";
      const bName = parsed ? state.bible.books[parsed.bi].name : "";
      await shareVerse(bName, parsed?.c, parsed?.v, text);
    })
  );
}

function bindSearch(){
  $("#btnSearch")?.addEventListener("click", doSearch);
  $("#searchInput")?.addEventListener("keydown", e => { if(e.key==="Enter") doSearch(); });
  $("#btnBuildIndex")?.addEventListener("click", () => buildIndex(false));
  $("#btnClearSearch")?.addEventListener("click", () => {
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
  const book = state.bible.books[state.current.book];
  const c = state.current.chapter;
  const bookMap = getBookData(state.current.book);
  const verses = bookMap?.get(c) || [];
  const first = verses[0] ? String(verses[0]).replace(/^¶\s*/, "").slice(0, 100) : "";
  const url = `https://labible.app/#${book.name}-${c}`;
  const shareText = first ? `${book.name} ${c} :\n"${first}…"` : `${book.name} ${c}`;
  if(navigator.share){
    try{ await navigator.share({ title:`${book.name} ${c} \u2014 LaBible.app`, text: shareText, url }); } catch{}
  } else {
    await copyText(`${shareText}\n\n📖 ${url}`);
  }
}

/* ---------- verset du jour ---------- */
function seededRand(seed){
  let x = seed >>> 0;
  x ^= x << 13; x >>>= 0; x ^= x >> 17; x >>>= 0; x ^= x << 5; x >>>= 0;
  return x >>> 0;
}

async function computeVerseOfDay(force=false){
  const k = dateKey();
  if(!force){
    try{
      const cached = JSON.parse(localStorage.getItem(LS.vdd)||"null");
      if(cached?.key===k && cached?.ref){
        state.vddRef = cached.ref;
        const el = $("#vddBox");
        if(el) el.textContent = cached.text || "\u2014";
        return;
      }
    } catch{}
  }

  const books = state.bible.books;
  const seed1 = seededRand(Number(k.replace(/-/g,""))||1);
  const bi = seed1 % books.length;
  const bookMap = getBookData(bi);
  if(!bookMap) return;

  const chapKeys = [...bookMap.keys()];
  const seed2 = seededRand(seed1);
  const ci = chapKeys[seed2 % chapKeys.length];
  const verses = bookMap.get(ci) || [];
  const seed3 = seededRand(seed2);
  const vi = verses.length ? (seed3 % verses.length) : 0;
  const text = String(verses[vi] || "").trim();

  state.vddRef = { bi, c: ci, v: vi+1 };
  const line = `${books[bi].name} ${ci}:${vi+1} \u2014 ${text||"…"}`;
  const el = $("#vddBox");
  if(el) el.textContent = line;
  localStorage.setItem(LS.vdd, JSON.stringify({ key:k, ref:state.vddRef, text:line, at:nowIso() }));
}

/* ---------- plan 365 ---------- */
async function ensurePlan(){
  let st = null;
  try{ st = JSON.parse(localStorage.getItem(LS.plan)||"null"); } catch{}
  if(st && Array.isArray(st.plan) && typeof st.doneDay==="number") return st;

  const books = state.bible.books;
  const OT = books.slice(0, 39);
  const NT = books.slice(39);

  const toChaps = (arr) => arr.flatMap(bm => {
    const bMap = state.bible.data.get(bm.nr);
    const bi = books.findIndex(x=>x.nr===bm.nr);
    return bMap ? [...bMap.keys()].map(c => ({ bi, c, label:`${bm.name} ${c}` })) : [];
  });

  const otChaps = toChaps(OT);
  const ntChaps = toChaps(NT);
  const plan = [];
  let oi=0, ni=0;

  for(let d=1; d<=365; d++){
    const refs = [];
    if(ni < ntChaps.length) refs.push(ntChaps[ni++]);
    const rem = 365-d+1;
    const otDay = ((otChaps.length-oi)/rem > 2.2) ? 3 : 2;
    for(let k=0; k<otDay && oi<otChaps.length; k++) refs.push(otChaps[oi++]);
    plan.push({ day:d, refs });
  }

  st = { createdAt: Date.now(), doneDay:0, plan };
  localStorage.setItem(LS.plan, JSON.stringify(st));
  return st;
}

function planDayFrom(createdAt){
  const diff = Math.floor((Date.now() - createdAt) / 86400000) + 1;
  return clamp(diff, 1, 365);
}

async function renderPlan(){
  const st = await ensurePlan();
  const day = planDayFrom(st.createdAt);
  const entry = st.plan[day-1];

  $("#planTodayText").textContent = `Jour ${day} \u2014 ${entry.refs.map(r=>r.label).join(" · ")}`;
  $("#planTodayMeta").textContent = st.doneDay >= day ? "✅ Déjà marqué." : `Progression : jour ${st.doneDay} terminé.`;

  const pct = Math.round((st.doneDay/365)*100);
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
    toast(`Jour ${d} : ${st2.plan[d-1].refs.map(r=>r.label).join(" · ")}`);
  };
}

/* ---------- bibliothèque ---------- */
function renderLibrary(){
  const favs = getFavs();
  const hist = getHistory();

  const renderItems = (containerId, items, limit=30) => {
    const box = $(containerId);
    box.innerHTML = items.length ? "" : `<div class="muted small">Aucun élément.</div>`;
    items.slice(0, limit).forEach(f => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div class="itemTop"><div>
          <div class="itemRef">${escapeHtml(f.ref||"")}</div>
          <div class="itemMeta">${escapeHtml(new Date(f.at||Date.now()).toLocaleString("fr-FR"))}</div>
        </div></div>
        ${f.text ? `<div class="itemMeta" style="margin-top:8px">${escapeHtml(f.text).slice(0,200)}${f.text.length>200?"…":""}</div>` : ""}
        <div class="itemBtns">
          <button class="chip" data-open="${escapeHtml(f.ref)}">📖 Ouvrir</button>
          <button class="chip" data-copy="${escapeHtml(f.ref)}">📎 Copier</button>
          <button class="chip" data-share="${escapeHtml(f.ref)}">🔗 Partager</button>
        </div>`;
      box.appendChild(div);
    });
    box.querySelectorAll("[data-open]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const r = parseReference(btn.getAttribute("data-open"));
        if(r) await openReference(r); else toast("Référence non reconnue.");
      })
    );
    box.querySelectorAll("[data-copy]").forEach(btn =>
      btn.addEventListener("click", () => {
        const refStr = btn.getAttribute("data-copy");
        const parsed = parseReference(refStr);
        const bookMap = parsed ? getBookData(parsed.bi) : null;
        const verses = bookMap?.get(parsed?.c) || [];
        const text = parsed?.v ? String(verses[parsed.v - 1] || "") : "";
        const bName = parsed ? state.bible.books[parsed.bi].name : "";
        if(parsed?.v && text){
          copyText(buildVerseShareText(bName, parsed.c, parsed.v, text));
        } else {
          const url = parsed ? `https://labible.app/#${bName}-${parsed.c}` : "";
          copyText(url || refStr);
        }
      })
    );
    box.querySelectorAll("[data-share]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const refStr = btn.getAttribute("data-share");
        const parsed = parseReference(refStr);
        const bookMap = parsed ? getBookData(parsed.bi) : null;
        const verses = bookMap?.get(parsed?.c) || [];
        const text = parsed?.v ? String(verses[parsed.v - 1] || "") : "";
        const bName = parsed ? state.bible.books[parsed.bi].name : "";
        await shareVerse(bName, parsed?.c, parsed?.v, text);
      })
    );
  };

  renderItems("#favList", favs);
  renderItems("#historyList", hist);
}

function bindLibraryButtons(){
  $("#btnClearFav")?.addEventListener("click", () => {
    if(confirm("Supprimer tous les favoris ?")){
      localStorage.removeItem(LS.fav); renderLibrary(); toast("Favoris supprimés.");
    }
  });
  $("#btnClearHistory")?.addEventListener("click", () => {
    if(confirm("Supprimer l'historique ?")){
      localStorage.removeItem(LS.hist); renderLibrary(); toast("Historique supprimé.");
    }
  });
  $("#btnOpenVDD")?.addEventListener("click", async () => {
    if(!state.vddRef) await computeVerseOfDay(true);
    if(state.vddRef) await openReference(state.vddRef);
  });
  $("#btnCopyVDD")?.addEventListener("click", () => copyText($("#vddBox")?.textContent||""));
}

/* ---------- PWA ---------- */
function bindInstall(){
  const btn = $("#btnInstall");
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); state.deferredPrompt = e;
    if(btn) btn.hidden = false;
  });
  btn?.addEventListener("click", async () => {
    if(!state.deferredPrompt) return;
    btn.disabled = true;
    try{ state.deferredPrompt.prompt(); await state.deferredPrompt.userChoice; state.deferredPrompt=null; btn.hidden=true; }
    finally{ btn.disabled=false; }
  });
  window.addEventListener("appinstalled", () => { state.deferredPrompt=null; if(btn) btn.hidden=true; toast("Installée ✅"); });
}

function bindHeaderActions(){
  $("#btnHome")?.addEventListener("click", () => window.scrollTo({top:0, behavior:"smooth"}));
  $("#btnTheme")?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme")||"dark";
    applyTheme(cur==="dark" ? "light" : "dark");
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
    toast(String(err.message||err));
  }
}

init();
