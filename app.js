const $ = (id) => document.getElementById(id);

async function loadJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error("Erreur de chargement: " + path);
  return r.json();
}

let DB = null;

// índices
let books = [];                 // [{book:1, name:"Genèse", slug:"genese"}]
let chaptersByBook = new Map(); // book -> Set(chapters)

// posição atual
let CURRENT = { book: 1, chapter: 1 };

function escapeHTML(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

/* ---------------- Slug + URL ---------------- */

function normalize(s){
  return String(s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove acentos
}

function slugifyBookName(name) {
  // Ex: "1 Samuel" => "1-samuel"
  // "Cantique des cantiques" => "cantique-des-cantiques"
  // "Ésaïe" => "esaie"
  return normalize(name)
    .replace(/['’]/g, "")         // remove apóstrofos
    .replace(/[^a-z0-9]+/g, "-")  // tudo não alfanumérico vira "-"
    .replace(/-+/g, "-")          // colapsa múltiplos "-"
    .replace(/^-|-$/g, "");       // remove "-" no começo/fim
}

function parsePath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  // Esperado: /{bookSlug}/{chapter}
  if (parts.length >= 2) {
    const bookSlug = normalize(parts[0]).replace(/[^a-z0-9-]/g, "");
    const chapter = parseInt(parts[1], 10);
    if (bookSlug && Number.isFinite(chapter)) return { bookSlug, chapter };
  }
  return null;
}

function updateUrl(bookNum, chapNum) {
  const b = books.find(x => x.book === bookNum);
  if (!b) return;
  const url = `/${b.slug}/${chapNum}`;
  // Não recarrega a página; só muda a URL
  history.replaceState(null, "", url);
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

  list.querySelectorAll("[data-go]").forEach(btn => {
    btn.onclick = () => {
      const [b, c] = btn.getAttribute("data-go").split(":").map(Number);
      $("book").value = String(b);
      onBookChange(b, { updateURL: false });

      setTimeout(() => {
        $("chap").value = String(c);
        render(b, c, { updateURL: true });
      }, 0);

      closeFavorites();
    };
  });

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

function doSearch() {
  const qRaw = $("q").value.trim();
  const q = normalize(qRaw);
  if (!q) return;

  const hits = [];
  const maxHits = 80;

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
      onBookChange(b, { updateURL: false });
      setTimeout(() => {
        $("chap").value = String(c);
        render(b, c, { updateURL: true });
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

async function init() {
  DB = await loadJSON("data/segond_1910.json");

  // 1) map livro -> nome
  const mapBookName = new Map();
  for (const v of DB.verses) {
    if (!mapBookName.has(v.book)) mapBookName.set(v.book, v.book_name);
  }

  books = Array.from(mapBookName.entries())
    .map(([book, name]) => ({ book, name, slug: slugifyBookName(name) }))
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
  bookSel.onchange = () => onBookChange(Number(bookSel.value), { updateURL: true });

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

  // 4) abrir pelo URL se existir
  const wanted = parsePath();
  if (wanted) {
    const foundBook = books.find(b => b.slug === wanted.bookSlug);
    if (foundBook) {
      $("book").value = String(foundBook.book);
      onBookChange(foundBook.book, { updateURL: false });

      setTimeout(() => {
        const chaps = Array.from(chaptersByBook.get(foundBook.book)).sort((a, b) => a - b);
        const chapOk = chaps.includes(wanted.chapter) ? wanted.chapter : chaps[0];
        $("chap").value = String(chapOk);
        render(foundBook.book, chapOk, { updateURL: true });
      }, 0);

      return; // não cai no default
    }
  }

  // 5) default: primeiro livro
  onBookChange(books[0].book, { updateURL: true });
}

function onBookChange(bookNum, opts = { updateURL: true }) {
  const chapSel = $("chap");
  const chaps = Array.from(chaptersByBook.get(bookNum)).sort((a, b) => a - b);

  chapSel.innerHTML = chaps.map(c => `<option value="${c}">${c}</option>`).join("");
  chapSel.onchange = () => render(bookNum, Number(chapSel.value), { updateURL: true });

  const firstChap = chaps[0];
  chapSel.value = String(firstChap);
  render(bookNum, firstChap, { updateURL: opts.updateURL });
}

function render(bookNum, chapNum, opts = { updateURL: true }) {
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

  if (opts.updateURL) updateUrl(bookNum, chapNum);
}

init().catch(err => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:red">${escapeHTML(err.message)}</pre>`;
});