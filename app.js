/* =========================
   LaBible.app — app.js
   Version A (stable original + install works)
   ========================= */

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const LS = {
  theme: "labible:theme",
  font: "labible:font",
  last: "labible:lastRef"
};

const BOOKS_INDEX_URL = "/data/bible/books.json";

const state = {
  bible: null,
  bookCache: new Map(),
  current: { book: 0, chapter: 1 },
  deferredPrompt: null,
  readFont: 16
};

/* ---------- helpers ---------- */

function toast(msg){
  const el = $("#toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(()=> el.classList.remove("show"), 2200);
}

function clamp(n, a, b){
  return Math.max(a, Math.min(b, n));
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function isIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/* ---------- theme ---------- */

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

/* ---------- font ---------- */

function applyFont(px){
  state.readFont = clamp(px, 14, 22);
  document.documentElement.style.setProperty("--readFont", `${state.readFont}px`);
  localStorage.setItem(LS.font, String(state.readFont));
}

function loadFont(){
  const v = parseInt(localStorage.getItem(LS.font) || "16", 10);
  applyFont(isFinite(v) ? v : 16);
}

/* ---------- bible loading ---------- */

async function loadBible(){
  const res = await fetch(BOOKS_INDEX_URL, { cache: "no-store" });
  if(!res.ok) throw new Error(`Index introuvable: ${BOOKS_INDEX_URL}`);

  const idx = await res.json();
  const books = Array.isArray(idx) ? idx : idx.books;
  if(!Array.isArray(books) || !books.length) throw new Error("books.json invalide.");

  state.bible = { books };

  initSelectors();
  await loadBook(0);
  refreshChapters();
  renderReading();
}

async function loadBook(index){
  const meta = state.bible.books[index];
  const file = meta.file || `${meta.id}.json`;
  const url = `/data/bible/${file}`;

  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`Livre introuvable: ${url}`);

  const raw = await res.json();

  // suporta {chapters:[...]} ou estrutura compatível
  const chapters = raw?.chapters || raw?.chapter || raw?.capitres;
  if(!Array.isArray(chapters) || !chapters.length) throw new Error(`Format invalide: ${url}`);

  state.bookCache.set(meta.id, chapters);
}

/* ---------- selectors ---------- */

function initSelectors(){
  const bookSelect = $("#bookSelect");
  const chapterSelect = $("#chapterSelect");
  if(!bookSelect || !chapterSelect) return;

  bookSelect.innerHTML = "";

  state.bible.books.forEach((b,i)=>{
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = b.name || b.title || b.nom || `Livre ${i+1}`;
    bookSelect.appendChild(opt);
  });

  bookSelect.addEventListener("change", async ()=>{
    state.current.book = parseInt(bookSelect.value, 10) || 0;
    state.current.chapter = 1;
    await loadBook(state.current.book);
    refreshChapters();
    renderReading();
  });

  chapterSelect.addEventListener("change", ()=>{
    state.current.chapter = parseInt(chapterSelect.value, 10) || 1;
    renderReading();
  });

  $("#btnPrev")?.addEventListener("click", ()=> navChapter(-1));
  $("#btnNext")?.addEventListener("click", ()=> navChapter(+1));
}

function refreshChapters(){
  const chapterSelect = $("#chapterSelect");
  if(!chapterSelect) return;

  const meta = state.bible.books[state.current.book];
  const chapters = state.bookCache.get(meta.id) || [];
  const total = chapters.length || 1;

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
  const meta = state.bible.books[state.current.book];
  const chapters = state.bookCache.get(meta.id) || [];
  const total = chapters.length || 1;

  let c = state.current.chapter + delta;

  if(c < 1){
    if(state.current.book > 0){
      state.current.book -= 1;
      $("#bookSelect").value = String(state.current.book);
      await loadBook(state.current.book);
      refreshChapters();

      const meta2 = state.bible.books[state.current.book];
      const ch2 = state.bookCache.get(meta2.id) || [];
      state.current.chapter = ch2.length || 1;
      $("#chapterSelect").value = String(state.current.chapter);
      renderReading();
    } else toast("Début de la Bible.");
    return;
  }

  if(c > total){
    if(state.current.book < state.bible.books.length - 1){
      state.current.book += 1;
      $("#bookSelect").value = String(state.current.book);
      await loadBook(state.current.book);
      state.current.chapter = 1;
      refreshChapters();
      renderReading();
    } else toast("Fin de la Bible.");
    return;
  }

  state.current.chapter = c;
  $("#chapterSelect").value = String(c);
  renderReading();
}

/* ---------- render ---------- */

function renderReading(){
  const meta = state.bible.books[state.current.book];
  const chapters = state.bookCache.get(meta.id) || [];
  const verses = chapters[state.current.chapter-1] || [];

  $("#pageHeader").textContent = `${meta.name || meta.title || "Livre"} ${state.current.chapter}`;

  const box = $("#verses");
  box.innerHTML = "";

  verses.forEach((t,i)=>{
    const p = document.createElement("p");
    p.className = "verse";
    p.innerHTML = `<span class="vnum">${i+1}</span> ${escapeHtml(String(t ?? ""))}`;
    box.appendChild(p);
  });

  localStorage.setItem(LS.last, `${meta.name || meta.title || "Livre"} ${state.current.chapter}`);
}

/* ---------- install PWA (fixed) ---------- */

function bindInstall(){
  const btn = $("#btnInstall");
  if(!btn) return;

  // mostra o botão (mesmo sem prompt) para dar instruções no fallback
  btn.hidden = false;

  window.addEventListener("beforeinstallprompt", (e)=>{
    e.preventDefault();
    state.deferredPrompt = e;
    // botão já está visível, ok
  });

  btn.addEventListener("click", async ()=>{
    // Se o Chrome disponibilizar prompt nativo
    if(state.deferredPrompt){
      btn.disabled = true;
      try{
        state.deferredPrompt.prompt();
        await state.deferredPrompt.userChoice;
        state.deferredPrompt = null;
      } finally {
        btn.disabled = false;
      }
      return;
    }

    // Fallback (quando o Chrome não dispara beforeinstallprompt)
    if(isIOS()){
      alert("Installer sur iPhone/iPad :\n1) Partager (⤴︎)\n2) « Sur l’écran d’accueil »\n3) Ajouter");
    } else {
      alert("Installer :\n• Chrome menu (⋮) → « Installer l’application »\n• Ou « Ajouter à l’écran d’accueil »");
    }
  });

  window.addEventListener("appinstalled", ()=>{
    state.deferredPrompt = null;
    btn.hidden = true;
    toast("Installée ✅");
  });
}

/* ---------- service worker register (required for installability) ---------- */
function registerSW(){
  if(!("serviceWorker" in navigator)) return;
  window.addEventListener("load", async ()=>{
    try{
      await navigator.serviceWorker.register("/sw.js");
    } catch (e){
      console.warn("SW register failed", e);
    }
  });
}

/* ---------- header ---------- */

function bindHeader(){
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
  bindHeader();
  bindInstall();
  registerSW();

  try{
    await loadBible();
    toast("Bible chargée ✅");
  }catch(err){
    console.error(err);
    $("#pageHeader").textContent = "Erreur";
    $("#verses").innerHTML = `<p class="verse"><span class="vnum">!</span><span>${escapeHtml(err.message || String(err))}</span></p>`;
    toast(err.message || "Erreur");
  }
}

init();