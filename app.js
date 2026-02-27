/* =========================
   LaBible.app — app.js
   Version A (stable original)
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
  const res = await fetch(BOOKS_INDEX_URL);
  if(!res.ok) throw new Error("books.json introuvable.");

  const books = await res.json();
  state.bible = { books };

  initSelectors();
  await loadBook(0);
  renderReading();
}

async function loadBook(index){
  const meta = state.bible.books[index];
  const res = await fetch(`/data/bible/${meta.file}`);
  if(!res.ok) throw new Error("Livre introuvable.");

  const raw = await res.json();
  state.bookCache.set(meta.id, raw.chapters);
}

/* ---------- selectors ---------- */

function initSelectors(){
  const bookSelect = $("#bookSelect");
  bookSelect.innerHTML = "";

  state.bible.books.forEach((b,i)=>{
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = b.name;
    bookSelect.appendChild(opt);
  });

  bookSelect.addEventListener("change", async ()=>{
    state.current.book = parseInt(bookSelect.value);
    state.current.chapter = 1;
    await loadBook(state.current.book);
    refreshChapters();
    renderReading();
  });

  refreshChapters();
}

function refreshChapters(){
  const chapterSelect = $("#chapterSelect");
  const chapters = state.bookCache.get(
    state.bible.books[state.current.book].id
  );

  chapterSelect.innerHTML = "";

  for(let i=0;i<chapters.length;i++){
    const opt = document.createElement("option");
    opt.value = i+1;
    opt.textContent = `Ch. ${i+1}`;
    chapterSelect.appendChild(opt);
  }

  chapterSelect.addEventListener("change", ()=>{
    state.current.chapter = parseInt(chapterSelect.value);
    renderReading();
  });
}

/* ---------- render ---------- */

function renderReading(){
  const meta = state.bible.books[state.current.book];
  const chapters = state.bookCache.get(meta.id);
  const verses = chapters[state.current.chapter-1] || [];

  $("#pageHeader").textContent = `${meta.name} ${state.current.chapter}`;

  const box = $("#verses");
  box.innerHTML = "";

  verses.forEach((t,i)=>{
    const p = document.createElement("p");
    p.className = "verse";
    p.innerHTML = `<span class="vnum">${i+1}</span> ${escapeHtml(t)}`;
    box.appendChild(p);
  });

  localStorage.setItem(LS.last, `${meta.name} ${state.current.chapter}`);
}

/* ---------- install PWA ---------- */

function bindInstall(){
  const btn = $("#btnInstall");

  window.addEventListener("beforeinstallprompt", (e)=>{
    e.preventDefault();
    state.deferredPrompt = e;
    btn.hidden = false;
  });

  btn?.addEventListener("click", async ()=>{
    if(!state.deferredPrompt) return;

    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;

    state.deferredPrompt = null;
    btn.hidden = true;
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
  loadTheme();
  loadFont();
  bindHeader();
  bindInstall();

  try{
    await loadBible();
  }catch(err){
    $("#pageHeader").textContent = "Erreur";
    $("#verses").innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

init();