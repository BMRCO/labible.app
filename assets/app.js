const el = (id) => document.getElementById(id);

const state = {
  books: [],
  bible: {},
  verses: [],
  selected: new Set(),
  favorites: loadFavs(),
  viewingFavs: false,
  installPromptEvent: null
};

async function init() {
  await loadData();
  fillBooks();
  attachEvents();
  renderFavs();
  initCookies();
  initInstallFlow();
  
  // Recuperar última leitura
  loadLastReading();

  // Se não houver última leitura, mostra algo inicial
  await showChapter();
}

async function loadData() {
  const booksRes = await fetch("/data/books.json", { cache: "no-cache" });
  state.books = await booksRes.json();

  const bibleRes = await fetch("/data/segond_1910.json", { cache: "no-cache" });
  state.bible = await bibleRes.json();
}

function fillBooks() {
  const s = el("bookSelect");
  if (!s) return;
  s.innerHTML = "";
  state.books.forEach(b => {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = b.name;
    s.appendChild(opt);
  });
  fillChapters();
}

function fillChapters() {
  const bSel = el("bookSelect");
  if (!bSel) return;
  const bookId = bSel.value;
  const chapters = state.bible?.[bookId];
  const s = el("chapterSelect");
  if (!s) return;
  s.innerHTML = "";
  if (!chapters) return;

  Object.keys(chapters)
    .map(n => Number(n))
    .filter(n => Number.isFinite(n))
    .sort((a,b)=>a-b)
    .forEach(n => {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      s.appendChild(opt);
    });
}

function setLastReading(bookId, chapter, label) {
  const data = { bookId, chapter, label, ts: Date.now() };
  localStorage.setItem("labible_last", JSON.stringify(data));
  updateContinueUI(data);
}

function loadLastReading() {
  try {
    const raw = localStorage.getItem("labible_last");
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && data.bookId && data.chapter) {
      updateContinueUI(data);
      // Pré-selecionar nos selects
      if (el("bookSelect")) el("bookSelect").value = data.bookId;
      fillChapters();
      if (el("chapterSelect")) el("chapterSelect").value = String(data.chapter);
    }
  } catch (e) {}
}

function updateContinueUI(data) {
  const labelEl = el("lastReadLabel");
  const btn = el("btnContinue");
  if (!labelEl || !btn) return;

  labelEl.textContent = `Dernière lecture : ${data.label}`;
  btn.disabled = false;
}

async function showChapter() {
  const bSel = el("bookSelect");
  const cSel = el("chapterSelect");
  if (!bSel || !cSel) return;

  const bookId = bSel.value;
  const chapter = cSel.value;
  
  const bookMeta = state.books.find(b => b.id === bookId);
  const bookName = bookMeta?.name || bookId;
  const chapterData = state.bible?.[bookId]?.[chapter];

  if (!chapterData) {
    state.verses = [];
    state.viewingFavs = false;
    el("resultsTitle").textContent = "Résultats";
    clearSelection();
    renderList([]);
    return;
  }

  const nums = Object.keys(chapterData)
    .map(n => Number(n))
    .filter(n => Number.isFinite(n))
    .sort((a,b)=>a-b);

  state.verses = nums.map(vn => ({
    id: `${bookName} ${chapter}:${vn}`,
    text: String(chapterData[String(vn)] || "").trim()
  }));

  state.viewingFavs = false;
  el("resultsTitle").textContent = "Résultats";
  clearSelection();
  renderList(state.verses);

  // Gravar como última leitura
  setLastReading(bookId, chapter, `${bookName} ${chapter}`);
  
  // Scroll para o topo dos resultados
  el("resultsTitle").scrollIntoView({ behavior: "smooth" });
}

function navigateChapter(dir) {
  const bSel = el("bookSelect");
  const cSel = el("chapterSelect");
  if (!bSel || !cSel) return;

  let bookId = bSel.value;
  let chapter = parseInt(cSel.value);
  
  const chapters = state.bible[bookId];
  const maxChap = Math.max(...Object.keys(chapters).map(Number));

  if (dir === 1) { // Next
    if (chapter < maxChap) {
      cSel.value = String(chapter + 1);
    } else {
      // Próximo livro
      const idx = state.books.findIndex(b => b.id === bookId);
      if (idx < state.books.length - 1) {
        bSel.value = state.books[idx + 1].id;
        fillChapters();
        cSel.value = "1";
      }
    }
  } else { // Prev
    if (chapter > 1) {
      cSel.value = String(chapter - 1);
    } else {
      // Livro anterior
      const idx = state.books.findIndex(b => b.id === bookId);
      if (idx > 0) {
        const prevBookId = state.books[idx - 1].id;
        bSel.value = prevBookId;
        fillChapters();
        const prevChapters = state.bible[prevBookId];
        const prevMax = Math.max(...Object.keys(prevChapters).map(Number));
        cSel.value = String(prevMax);
      }
    }
  }
  showChapter();
}

function searchGlobal(q) {
  const query = String(q || "").trim().toLowerCase();
  if (query.length < 2) {
    el("resultsTitle").textContent = state.viewingFavs ? "Favoris" : "Résultats";
    renderList(state.viewingFavs ? favsToVerses() : state.verses);
    return;
  }

  const results = [];
  for (const [bookId, chapters] of Object.entries(state.bible)) {
    const bookMeta = state.books.find(b => b.id === bookId);
    const bookName = bookMeta?.name || bookId;
    for (const [chapNum, verses] of Object.entries(chapters)) {
      for (const [verseNum, text] of Object.entries(verses)) {
        const t = String(text || "");
        if (t.toLowerCase().includes(query)) {
          results.push({
            id: `${bookName} ${chapNum}:${verseNum}`,
            text: t.trim()
          });
          if (results.length >= 300) break;
        }
      }
      if (results.length >= 300) break;
    }
    if (results.length >= 300) break;
  }

  el("resultsTitle").textContent = results.length >= 300 ? "Recherche (limite 300)" : "Recherche";
  clearSelection();
  state.viewingFavs = false;
  renderList(results);
}

function renderList(list) {
  const box = el("verseList");
  if (!box) return;
  box.innerHTML = "";

  if (!list || list.length === 0) {
    box.innerHTML = `<div class="hint">Aucun résultat.</div>`;
    return;
  }

  list.forEach(v => {
    const div = document.createElement("div");
    div.className = "item" + (state.selected.has(v.id) ? " selected" : "");
    div.innerHTML = `
      <div class="vtext">${escapeHtml(v.text)}</div>
      <div class="vmeta">${escapeHtml(v.id)} · Louis Segond 1910</div>
    `;
    div.addEventListener("click", () => {
      toggleSelected(v.id);
      div.classList.toggle("selected");
    });
    box.appendChild(div);
  });
}

function toggleSelected(id) {
  if (state.selected.has(id)) state.selected.delete(id);
  else state.selected.add(id);
  updateSelectedCount();
}

function clearSelection() {
  state.selected.clear();
  updateSelectedCount();
}

function updateSelectedCount() {
  const count = state.selected.size;
  el("selectedCount").textContent = `${count} sélectionné${count > 1 ? 's' : ''}`;
  el("selectionActions").style.display = count > 0 ? "flex" : "none";
}

function toggleFavoriteSelected() {
  const ids = Array.from(state.selected);
  if (ids.length === 0) return;

  // Precisamos encontrar o texto para os IDs selecionados
  // Se estivermos na busca, os resultados estão em renderList mas não no state.verses global fixo
  // Simplificação: só permite favoritar o que está visível ou já é favorito
  const currentPool = state.viewingFavs ? favsToVerses() : state.verses;
  // Nota: se for busca global, o pool atual pode não ter todos. 
  // Mas para o MVP, assumimos que o user favoritou o que viu.

  let changed = 0;
  ids.forEach(id => {
    if (state.favorites[id]) {
      delete state.favorites[id];
    } else {
      // Tentar achar no pool atual
      const v = currentPool.find(item => item.id === id);
      if (v) {
        state.favorites[id] = { id: v.id, text: v.text, when: Date.now() };
      }
    }
    changed++;
  });

  saveFavs(state.favorites);
  renderFavs();
  clearSelection();
  renderList(state.viewingFavs ? favsToVerses() : state.verses);
}

function renderFavs() {
  const favBox = el("favList");
  if (!favBox) return;
  favBox.innerHTML = "";
  const favs = Object.values(state.favorites).sort((a,b)=>b.when - a.when);

  if (favs.length === 0) {
    favBox.innerHTML = `<div class="hint">Aucun favori.</div>`;
    return;
  }

  favs.slice(0, 10).forEach(f => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="vtext">${escapeHtml(f.text)}</div>
      <div class="vmeta">${escapeHtml(f.id)}</div>
    `;
    div.addEventListener("click", () => {
      // Ao clicar num favorito lateral, tenta ir para esse capítulo
      const parts = f.id.match(/(.+) (\d+):(\d+)/);
      if (parts) {
        const bName = parts[1];
        const chap = parts[2];
        const book = state.books.find(b => b.name === bName || b.id === bName);
        if (book) {
          el("bookSelect").value = book.id;
          fillChapters();
          el("chapterSelect").value = chap;
          showChapter();
        }
      }
    });
    favBox.appendChild(div);
  });
}

function favsToVerses() {
  return Object.values(state.favorites)
    .sort((a,b)=>b.when - a.when)
    .map(f => ({ id: f.id, text: f.text }));
}

function loadFavs() {
  try { return JSON.parse(localStorage.getItem("labible_favs") || "{}"); } 
  catch { return {}; }
}

function saveFavs(obj) {
  localStorage.setItem("labible_favs", JSON.stringify(obj));
}

function buildShareText() {
  const ids = Array.from(state.selected);
  if (ids.length === 0) return "";
  
  // Tentar achar os textos. Como podem vir de busca global, o state.verses pode não ter.
  // Para simplificar, usamos uma busca rápida no DOM ou no state.bible se necessário.
  const lines = [];
  ids.forEach(id => {
    // Busca no state.bible (mais confiável)
    const parts = id.match(/(.+) (\d+):(\d+)/);
    if (parts) {
      const bName = parts[1];
      const chap = parts[2];
      const vNum = parts[3];
      const book = state.books.find(b => b.name === bName || b.id === bName);
      if (book) {
        const txt = state.bible[book.id]?.[chap]?.[vNum];
        if (txt) {
          lines.push(txt.trim());
          lines.push(`— ${id} (LSG 1910)`);
          lines.push("");
        }
      }
    }
  });
  lines.push("LaBible.app");
  return lines.join("
").trim();
}

async function copySelected() {
  const txt = buildShareText();
  if (!txt) return;
  await navigator.clipboard.writeText(txt);
  alert("Copié ✅");
}

async function shareSelected() {
  const txt = buildShareText();
  if (!txt) return;
  if (navigator.share) {
    await navigator.share({ title: "LaBible.app", text: txt });
  } else {
    copySelected();
  }
}

function initInstallFlow() {
  const btn = el("installBtn");
  if (!btn) return;
  btn.style.display = "none";
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.installPromptEvent = e;
    btn.style.display = "inline-flex";
  });
  btn.addEventListener("click", async () => {
    if (!state.installPromptEvent) return;
    state.installPromptEvent.prompt();
    await state.installPromptEvent.userChoice;
    state.installPromptEvent = null;
    btn.style.display = "none";
  });
}

function initCookies() {
  const banner = el("cookieBanner");
  if (!banner) return;
  if (!localStorage.getItem("labible_cookie")) banner.classList.add("show");
  el("cookieAccept").addEventListener("click", () => {
    localStorage.setItem("labible_cookie", "1");
    banner.classList.remove("show");
  });
  el("cookieDeny").addEventListener("click", () => {
    localStorage.setItem("labible_cookie", "0");
    banner.classList.remove("show");
  });
}

function attachEvents() {
  el("bookSelect")?.addEventListener("change", () => {
    fillChapters();
    showChapter();
  });
  el("chapterSelect")?.addEventListener("change", showChapter);
  el("loadBtn")?.addEventListener("click", showChapter);
  el("prevBtn")?.addEventListener("click", () => navigateChapter(-1));
  el("nextBtn")?.addEventListener("click", () => navigateChapter(1));
  
  el("btnContinue")?.addEventListener("click", showChapter);
  el("openLastBtn")?.addEventListener("click", showChapter);

  el("toggleFavBtn")?.addEventListener("click", () => {
    state.viewingFavs = !state.viewingFavs;
    clearSelection();
    if (state.viewingFavs) {
      el("resultsTitle").textContent = "Favoris";
      renderList(favsToVerses());
    } else {
      showChapter();
    }
  });

  el("searchInput")?.addEventListener("input", (e) => searchGlobal(e.target.value));
  el("copyBtn")?.addEventListener("click", copySelected);
  el("shareBtn")?.addEventListener("click", shareSelected);
  el("favBtn")?.addEventListener("click", toggleFavoriteSelected);
  el("clearSelBtn")?.addEventListener("click", clearSelection);
  
  el("clearFavsBtn")?.addEventListener("click", () => {
    if (confirm("Effacer tous os favoris ?")) {
      state.favorites = {};
      saveFavs({});
      renderFavs();
      if (state.viewingFavs) renderList([]);
    }
  });
  
  el("resetBtn")?.addEventListener("click", () => {
    if (confirm("Réinitialiser l'application (favoris e cache) ?")) {
      localStorage.clear();
      location.reload();
    }
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (s) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}

init();
