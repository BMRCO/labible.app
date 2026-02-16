const $ = (id) => document.getElementById(id);

async function loadJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error("Erreur de chargement: " + path);
  return r.json();
}

// DB completo (1 ficheiro)
let DB = null;

// índices
let books = [];                 // [{book:1, name:"Genèse"}]
let chaptersByBook = new Map(); // book -> Set(chapters)

// posição atual
let CURRENT = { book: 1, chapter: 1 };

function escapeHTML(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

/* ---------------- Favoris ---------------- */

function favKey() {
  return "bible_fr_favs_v1";
}

function getFavs() {
  try { return JSON.parse(localStorage.getItem(favKey())) || []; }
  catch { return []; }
}

function saveFavs(list) {
  localStorage.setItem(favKey(), JSON.stringify(list));
}

function currentRefText() {
  const bookName = books.find(b => b.book === CURRENT.book)?.name || "";
  return `${bookName} ${CURRENT.chapter}`;
}

function toggleFavoriteCurrent() {
  const favs = getFavs();
  const id = `${CURRENT.book}:${CURRENT.chapter}`;
  const exists = favs.find(x => x.id === id);

  if (exists) {
    saveFavs(favs.filter(x => x.id !== id));
    alert("Retiré des favoris ✅");
  } else {
    favs.unshift({
      id,
      book: CURRENT.book,
      chapter: CURRENT.chapter,
      title: currentRefText(),
      ts: Date.now()
    });
    saveFavs(favs);
    alert("Ajouté aux favoris ★");
  }
}

function openFavorites() {
  renderFavorites();
  $("favBox").classList.remove("hidden");
}

function closeFavorites() {
  $("favBox").classList.add("hidden");
}

function renderFavorites() {
  const list = $("favList");
  const favs = getFavs();

  if (!favs.length) {
    list.innerHTML = `<p>Aucun favori.</p>`;
    return;
  }

  list.innerHTML = favs.map(f => `
    <div class="favrow">
      <button class="btn" data-go="${f.book}:${f.chapter}">Ouvrir</button>
      <div class="title">${escapeHTML(f.title)}<div class="small">${escapeHTML(f.id)}</div></div>
      <button class="btn" data-del="${f.book}:${f.chapter}">Supprimer</button>
    </div>
  `).join("");

  // Ouvrir
  list.querySelectorAll("[data-go]").forEach(btn => {
    btn.onclick = () => {
      const [b, c] = btn.getAttribute("data-go").split(":").map(Number);

      $("book").value = String(b);
      onBookChange(b);

      setTimeout(() => {
        $("chap").value = String(c);
        render(b, c);
      }, 0);

      closeFavorites();
    };
  });

  // Supprimer
  list.querySelectorAll("[data-del]").forEach(btn => {
    btn.onclick = () => {
      const [b, c] = btn.getAttribute("data-del").split(":").map(Number);
      const id = `${b}:${c}`;
      saveFavs(getFavs().filter(x => x.id !== id));
      renderFavorites();
    };
  });
}

/* ---------------- Recherche ---------------- */

function normalize(s){
  return String(s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove acentos
}

function doSearch() {
  const qRaw = $("q").value.trim();
  const q = normalize(qRaw);
  if (!q) return;

  const hits = [];
  const maxHits = 80; // limite para não pesar

  for (const v of DB.verses) {
    const t = normalize(v.text);
    if (t.includes(q)) {
      hits.push(v);
      if (hits.length >= maxHits) break;
    }
  }

  renderSearchResults(hits, qRaw);
}

function renderSearchResults(hits, qRaw) {
  $("results").classList.remove("hidden");

  if (!hits.length) {
    $("hits").innerHTML = `<p>Aucun résultat pour <b>${escapeHTML(qRaw)}</b>.</p>`;
    return;
  }

  const html = hits.map(v => {
    const ref = `${v.book_name} ${v.chapter}:${v.verse}`;
    const id = `${v.book}:${v.chapter}:${v.verse}`;
    return `
      <div class="hit">
        <div class="ref">
          <button class="btn" data-open="${id}">Ouvrir</button>
          ${escapeHTML(ref)}
        </div>
        <div class="txt">${escapeHTML(v.text)}</div>
      </div>
    `;
  }).join("");

  $("hits").innerHTML = html;

  $("hits").querySelectorAll("[data-open]").forEach(btn => {
    btn.onclick = () => {
      const [b, c] = btn.getAttribute("data-open").split(":").map(Number);
      $("book").value = String(b);
      onBookChange(b);
      setTimeout(() => {
        $("chap").value = String(c);
        render(b, c);
      }, 0);
    };
  });
}

function clearSearch(){
  $("q").value = "";
  $("results").classList.add("hidden");
  $("hits").innerHTML = "";
}

/* ---------------- Leitura ---------------- */
function readUrl() {
  const path = window.location.pathname.toLowerCase();
  const parts = path.split("/").filter(Boolean);

  if (parts.length === 2) {
    const bookSlug = parts[0];
    const chapter = parseInt(parts[1]);

    const book = books.find(b =>
      b.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "") === bookSlug
    );

    if (book && !isNaN(chapter)) {
      onBookChange(book.book);
      setTimeout(() => {
        $("chap").value = chapter;
        render(book.book, chapter);
      }, 100);
    }
  }
}
async function init() {
  onBookChange(books[0].book);
  readUrl();
  // carrega DB (teu arquivo)
  DB = await loadJSON("data/segond_1910.json");

  // 1) lista de livros (ordenada pelo número)
  const mapBookName = new Map();
  for (const v of DB.verses) {
    if (!mapBookName.has(v.book)) mapBookName.set(v.book, v.book_name);
  }
  books = Array.from(mapBookName.entries())
    .map(([book, name]) => ({ book, name }))
    .sort((a, b) => a.book - b.book);

  // 2) capítulos por livro
  chaptersByBook = new Map();
  for (const v of DB.verses) {
    if (!chaptersByBook.has(v.book)) chaptersByBook.set(v.book, new Set());
    chaptersByBook.get(v.book).add(v.chapter);
  }

  // 3) preencher select de livros
  const bookSel = $("book");
  bookSel.innerHTML = books.map(b => `<option value="${b.book}">${escapeHTML(b.name)}</option>`).join("");
  bookSel.onchange = () => onBookChange(Number(bookSel.value));

  // botões favoritos
  $("btnFav").onclick = toggleFavoriteCurrent;
  $("btnShowFav").onclick = openFavorites;
  $("btnCloseFav").onclick = closeFavorites;

  // botões pesquisa
  $("btnSearch").onclick = doSearch;
  $("btnClear").onclick = clearSearch;
  $("q").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });

  // carrega primeiro livro
  onBookChange(books[0].book);
}

function onBookChange(bookNum) {
  const chapSel = $("chap");
  const chaps = Array.from(chaptersByBook.get(bookNum)).sort((a, b) => a - b);
  chapSel.innerHTML = chaps.map(c => `<option value="${c}">${c}</option>`).join("");
  chapSel.onchange = () => render(bookNum, Number(chapSel.value));

  chapSel.value = String(chaps[0]);
  render(bookNum, chaps[0]);
}

function render(bookNum, chapNum) {
  CURRENT.book = bookNum;
  CURRENT.chapter = chapNum;

  const bookName = books.find(b => b.book === bookNum)?.name || "";
  $("title").textContent = `${bookName} ${chapNum}`;

  const verses = DB.verses
    .filter(v => v.book === bookNum && v.chapter === chapNum)
    .sort((a, b) => a.verse - b.verse);

  $("content").innerHTML = verses
    .map(v => `<p><b>${v.verse}</b> ${escapeHTML(v.text)}</p>`)
    .join("");
}

init().catch(err => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:red">${escapeHTML(err.message)}</pre>`;
});
