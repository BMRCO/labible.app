<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="theme-color" content="#0b0b0c" />
  <title>LaBible.app | App — LSG 1910</title>

  <meta name="description"
        content="LaBible.app — App Bible Louis Segond 1910 (domaine public) : lecture, recherche et plan de lecture." />

  <style>
    :root{
      --bg:#0b0b0c;
      --paper:#f6f1e6;
      --paper-2:#efe6d6;
      --ink:#121212;
      --line:rgba(255,255,255,.10);
      --brand:#d7c49a;
      --shadow: 0 10px 30px rgba(0,0,0,.35);
      --radius:16px;
      --radius2:22px;
      --max:1100px;
      --ok:#56d364;
      --warn:#ffb86b;
      --err:#ff6b6b;
    }
    *{box-sizing:border-box}
    html,body{height:100%}
    body{
      margin:0;
      min-height:100vh;
      display:flex;
      flex-direction:column;

      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji","Segoe UI Emoji";
      background:
        radial-gradient(1200px 600px at 10% 0%, rgba(215,196,154,.18), transparent 55%),
        radial-gradient(900px 500px at 90% 10%, rgba(255,255,255,.06), transparent 60%),
        var(--bg);
      color:#f7f7f7;
    }
    a{color:inherit; text-decoration:none}
    button, input, select{font:inherit}
    .container{max-width:var(--max); margin:0 auto; padding:0 16px}
    main{flex:1; padding:18px 0 26px}

    /* Top bar */
    .topbar{
      position:sticky; top:0; z-index:50;
      backdrop-filter: blur(10px);
      background: rgba(11,11,12,.72);
      border-bottom: 1px solid var(--line);
    }
    .topbar-inner{
      height:64px;
      display:flex; align-items:center; gap:12px;
    }
    .brand{
      display:flex; align-items:center; gap:10px;
      min-width: 210px;
    }
    .logo{
      width:34px; height:34px; border-radius:10px;
      display:grid; place-items:center;
      background: linear-gradient(180deg, rgba(215,196,154,.22), rgba(215,196,154,.05));
      border:1px solid rgba(215,196,154,.25);
      box-shadow: 0 8px 20px rgba(0,0,0,.25);
      flex: 0 0 auto;
    }
    .brand-title{display:flex; flex-direction:column; line-height:1.05}
    .brand-title strong{font-weight:800; letter-spacing:.2px}
    .brand-title span{font-size:12px; color: rgba(255,255,255,.62)}
    .spacer{flex:1}

    .nav{
      display:flex; align-items:center; gap:6px;
      padding:6px;
      border:1px solid var(--line);
      border-radius: 999px;
      background: rgba(255,255,255,.04);
    }
    .nav a{
      padding:8px 12px;
      border-radius: 999px;
      font-size:13px;
      color: rgba(255,255,255,.78);
      transition: .15s ease;
      white-space:nowrap;
    }
    .nav a:hover{background: rgba(255,255,255,.07); color:#fff}
    .nav a.active{background: rgba(215,196,154,.14); color:#fff; border:1px solid rgba(215,196,154,.22)}
    @media (max-width: 920px){ .nav{display:none} }

    .btn{
      height:38px;
      padding:0 12px;
      border-radius:999px;
      border:1px solid var(--line);
      background: rgba(255,255,255,.04);
      color:#fff;
      cursor:pointer;
      transition:.15s ease;
      display:inline-flex; align-items:center; justify-content:center; gap:8px;
      font-size:13px;
      white-space:nowrap;
    }
    .btn:hover{background: rgba(255,255,255,.07)}
    .btn.primary{
      border-color: rgba(215,196,154,.30);
      background: linear-gradient(180deg, rgba(215,196,154,.18), rgba(215,196,154,.08));
    }
    .btn.primary:hover{
      border-color: rgba(215,196,154,.42);
      background: linear-gradient(180deg, rgba(215,196,154,.22), rgba(215,196,154,.10));
    }

    .search{
      position:relative;
      width:min(420px, 100%);
      display:flex; align-items:center;
    }
    .search input{
      width:100%;
      padding:10px 12px 10px 38px;
      border-radius:999px;
      border:1px solid var(--line);
      background: rgba(255,255,255,.04);
      color:#fff;
      outline:none;
      transition:.15s ease;
    }
    .search input:focus{
      border-color: rgba(215,196,154,.35);
      box-shadow: 0 0 0 4px rgba(215,196,154,.10);
      background: rgba(255,255,255,.06);
    }
    .search svg{
      position:absolute; left:12px;
      width:16px; height:16px;
      opacity:.7;
    }
    @media (max-width: 920px){ .search{display:none} }

    /* Layout */
    .title{
      display:flex; flex-wrap:wrap;
      align-items:baseline; justify-content:space-between;
      gap:8px;
      margin-bottom: 10px;
    }
    .title h1{margin:0; font-size:18px; letter-spacing:.2px}
    .subtitle{font-size:12px; color: rgba(255,255,255,.65)}

    .grid{
      display:grid;
      grid-template-columns: 1.35fr .65fr;
      gap: 14px;
      align-items:start;
    }
    @media (max-width: 980px){ .grid{grid-template-columns:1fr} }

    .panel{
      border-radius: var(--radius2);
      border: 1px solid var(--line);
      background:
        radial-gradient(900px 320px at 20% 0%, rgba(215,196,154,.20), transparent 55%),
        rgba(255,255,255,.04);
      box-shadow: var(--shadow);
      overflow:hidden;
    }
    .panel-inner{padding:14px}

    .card{
      border-radius: var(--radius);
      border: 1px solid var(--line);
      background: rgba(0,0,0,.22);
      padding:14px;
    }

    .row{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      align-items:center;
    }
    .field{
      display:flex; flex-direction:column; gap:6px;
      min-width: 200px;
      flex: 1 1 220px;
    }
    .label{font-size:12px; color: rgba(255,255,255,.65)}
    select, .mini-input{
      width:100%;
      padding:10px 12px;
      border-radius:12px;
      border:1px solid var(--line);
      background: rgba(255,255,255,.04);
      color:#fff;
      outline:none;
    }
    select:focus, .mini-input:focus{
      border-color: rgba(215,196,154,.35);
      box-shadow: 0 0 0 4px rgba(215,196,154,.10);
    }

    .toolbar{
      display:flex; flex-wrap:wrap;
      gap:10px; align-items:center; justify-content:space-between;
      margin: 10px 0 12px;
    }
    .toolbar .left, .toolbar .right{display:flex; gap:8px; flex-wrap:wrap; align-items:center}
    .pill{
      border:1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.03);
      padding:6px 10px;
      border-radius:999px;
      font-size:12px;
      color: rgba(255,255,255,.75);
      white-space:nowrap;
    }

    .bible{
      margin-top: 12px;
      padding: 16px 14px;
      border-radius: var(--radius2);
      border: 1px solid rgba(0,0,0,.14);
      background: linear-gradient(180deg, var(--paper), var(--paper-2));
      color: var(--ink);
      box-shadow: 0 10px 24px rgba(0,0,0,.22);
      line-height: 1.8;
    }
    .bible h2{
      margin:0 0 10px;
      font-size: 18px;
      letter-spacing: .2px;
    }
    .verses{font-size: 16px}
    .verse{display:inline}
    .vnum{
      font-size: 12px;
      color: rgba(0,0,0,.55);
      vertical-align: super;
      margin-right: 6px;
      font-weight: 650;
    }

    .hint{
      font-size:12px;
      color: rgba(255,255,255,.65);
      margin-top: 10px;
    }

    .status{
      display:flex; gap:8px; flex-wrap:wrap;
      align-items:center;
      font-size:12px;
      color: rgba(255,255,255,.72);
      margin-top: 8px;
    }
    .dot{width:8px; height:8px; border-radius:999px; background: rgba(255,255,255,.35)}
    .dot.ok{background: var(--ok)}
    .dot.warn{background: var(--warn)}
    .dot.err{background: var(--err)}

    /* Search results */
    .results{
      display:flex; flex-direction:column; gap:10px;
      margin-top: 10px;
    }
    .result{
      border:1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.03);
      border-radius:14px;
      padding: 10px 12px;
    }
    .result .ref{
      font-size:12px;
      color: rgba(255,255,255,.75);
      margin-bottom: 6px;
      display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;
    }
    .result .txt{
      font-size:13px;
      line-height:1.55;
      color: rgba(255,255,255,.88);
    }

    /* Footer */
    footer{
      border-top: 1px solid var(--line);
      background: rgba(0,0,0,.24);
      margin-top: 12px;
    }
    .foot-bottom{
      padding: 10px 0 12px;
      display:flex;
      gap:10px;
      justify-content:space-between;
      align-items:flex-start;
      flex-wrap:wrap;
      color: rgba(255,255,255,.58);
      font-size:12px;
    }
    .foot-left{
      display:flex;
      flex-wrap:wrap;
      align-items:center;
      gap:6px;
      line-height:1.5;
      min-width: min(680px, 100%);
    }
    .sep{opacity:.55; white-space:nowrap; margin:0 2px}
    .link-dotted{
      color:rgba(255,255,255,.78);
      border-bottom:1px dotted rgba(255,255,255,.25);
      padding-bottom:1px;
      white-space:nowrap;
    }

    .toast{
      position:fixed;
      bottom:18px; left:50%;
      transform:translateX(-50%);
      min-width: min(520px, calc(100vw - 24px));
      padding: 10px 12px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.65);
      backdrop-filter: blur(10px);
      box-shadow: 0 16px 45px rgba(0,0,0,.35);
      color: rgba(255,255,255,.90);
      font-size: 13px;
      display:none;
      z-index: 80;
    }
    .toast.show{display:block}
    .toast strong{color:#fff}
  </style>
</head>

<body>
  <header class="topbar" role="banner">
    <div class="container">
      <div class="topbar-inner">
        <a class="brand" href="index.html" aria-label="LaBible.app">
          <div class="logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path d="M6.2 5.8c2.3-.9 5-.9 7.3 0 1.1.4 2.2.4 3.3 0V18c-1.1.4-2.2.4-3.3 0-2.3-.9-5-.9-7.3 0-1.1.4-2.2.4-3.3 0V5.8c1.1.4 2.2.4 3.3 0Z" stroke="rgba(215,196,154,.95)" stroke-width="1.6" />
              <path d="M12 6.2V18.1" stroke="rgba(0,0,0,.35)" stroke-width="1.1"/>
            </svg>
          </div>
          <div class="brand-title">
            <strong>LaBible.app</strong>
            <span>App — LSG 1910</span>
          </div>
        </a>

        <nav class="nav" aria-label="Navigation">
          <a class="active" href="#lecture" data-nav="lecture">Lecture</a>
          <a href="#plan" data-nav="plan">Plan</a>
          <a href="#recherche" data-nav="recherche">Recherche</a>
        </nav>

        <div class="spacer"></div>

        <div class="search" aria-label="Recherche rapide">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M10.5 18.2a7.7 7.7 0 1 1 0-15.4 7.7 7.7 0 0 1 0 15.4Z" stroke="rgba(255,255,255,.72)" stroke-width="1.6"/>
            <path d="M16.7 16.7 21 21" stroke="rgba(255,255,255,.72)" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
          <input id="globalSearch" placeholder="Rechercher (ex: Jean 3:16, foi, amour…)" />
        </div>

        <a class="btn" href="https://t.me/appbible" target="_blank" rel="noopener">📣 Telegram</a>
      </div>
    </div>
  </header>

  <main class="container">
    <div class="title">
      <h1 id="pageTitle">Lecture</h1>
      <div class="subtitle">Bible Louis Segond 1910 — domaine public</div>
    </div>

    <div class="grid">
      <section class="panel" id="lecture">
        <div class="panel-inner">
          <div class="card">
            <div class="row">
              <div class="field">
                <div class="label">Livre</div>
                <select id="bookSelect" aria-label="Livre"></select>
              </div>
              <div class="field" style="min-width:140px; flex:0 0 160px">
                <div class="label">Chapitre</div>
                <select id="chapterSelect" aria-label="Chapitre"></select>
              </div>
              <div class="field" style="min-width:140px; flex:0 0 160px">
                <div class="label">Aller à (verset)</div>
                <input id="gotoInput" class="mini-input" placeholder="Ex: 16" inputmode="numeric" />
              </div>
            </div>

            <div class="toolbar">
              <div class="left">
                <button class="btn" id="prevBtn">← Précédent</button>
                <button class="btn" id="nextBtn">Suivant →</button>
                <span class="pill" id="refPill">—</span>
              </div>
              <div class="right">
                <button class="btn" id="copyRefBtn">📋 Copier la référence</button>
                <button class="btn primary" id="saveProgressBtn">✅ Marquer comme lu</button>
              </div>
            </div>

            <div class="status" id="loadStatus">
              <span class="dot warn" id="statusDot"></span>
              <span id="statusText">Chargement de la Bible…</span>
            </div>

            <div class="hint">
              Recherche : mot clé (ex: <b>grâce</b>) ou référence (ex: <b>Jean 3:16</b>).
            </div>
          </div>

          <div class="bible" id="bibleBox" aria-live="polite">
            <h2 id="chapterTitle">—</h2>
            <div class="verses" id="versesBox">Veuillez patienter…</div>
          </div>
        </div>
      </section>

      <aside>
        <section class="card" id="plan">
          <h3 style="margin:0 0 8px; font-size:16px;">Plan de lecture</h3>
          <p style="margin:0 0 10px; color:rgba(255,255,255,.72); font-size:13px; line-height:1.5;">
            Simple : avance chapitre par chapitre. Ton progrès est enregistré sur cet appareil.
          </p>

          <div class="row" style="margin-top:10px">
            <button class="btn primary" id="planGoBtn">📖 Continuer</button>
            <button class="btn" id="planResetBtn">↩️ Réinitialiser</button>
          </div>

          <div class="status" style="margin-top:10px">
            <span class="dot ok"></span>
            <span id="planStatus">—</span>
          </div>
        </section>

        <section class="card" id="recherche" style="margin-top:14px">
          <h3 style="margin:0 0 8px; font-size:16px;">Recherche</h3>

          <div class="row" style="margin-top:10px">
            <input id="searchInput" class="mini-input" placeholder="Rechercher…" />
            <button class="btn primary" id="searchBtn">🔎 Chercher</button>
            <button class="btn" id="clearBtn">✖ Effacer</button>
          </div>

          <div class="results" id="resultsBox"></div>

          <div class="hint" style="margin-top:10px">
            Limite : 50 résultats pour rester rapide.
          </div>
        </section>
      </aside>
    </div>
  </main>

  <footer role="contentinfo">
    <div class="container">
      <div class="foot-bottom">
        <div class="foot-left">
          <span>2026</span>
          <span class="sep">|</span>
          <strong style="color:#fff;">LaBible.app</strong>
          <span class="sep">|</span>
          <span>Texte Bible : LSG1910 - Domaine Public</span>
          <span class="sep">|</span>
          <a class="link-dotted" href="https://t.me/appbible" target="_blank" rel="noopener">Telegram</a>
          <span class="sep">|</span>
          <a class="link-dotted" href="mailto:contact@labible.app">Contact</a>
        </div>

        <div class="pill">LSG 1910</div>
      </div>
    </div>
  </footer>

  <div class="toast" id="toast"></div>

  <script>
    const BIBLE_JSON_URL = "data/lsg1910.json";
    const LS_KEYS = {
      progress: "labible_progress_v1",
      lastRef: "labible_last_ref_v1"
    };

    const $ = (id) => document.getElementById(id);

    const bookSelect = $("bookSelect");
    const chapterSelect = $("chapterSelect");
    const gotoInput = $("gotoInput");
    const prevBtn = $("prevBtn");
    const nextBtn = $("nextBtn");
    const copyRefBtn = $("copyRefBtn");
    const saveProgressBtn = $("saveProgressBtn");

    const statusDot = $("statusDot");
    const statusText = $("statusText");

    const chapterTitle = $("chapterTitle");
    const versesBox = $("versesBox");
    const refPill = $("refPill");

    const globalSearch = $("globalSearch");

    const searchInput = $("searchInput");
    const searchBtn = $("searchBtn");
    const clearBtn = $("clearBtn");
    const resultsBox = $("resultsBox");

    const planGoBtn = $("planGoBtn");
    const planResetBtn = $("planResetBtn");
    const planStatus = $("planStatus");

    const toast = $("toast");

    let Bible = null;
    let current = { b: 0, c: 0 };

    function showToast(message, ms=1800){
      toast.innerHTML = message;
      toast.classList.add("show");
      window.clearTimeout(showToast._t);
      showToast._t = window.setTimeout(()=>toast.classList.remove("show"), ms);
    }

    function setStatus(kind, text){
      statusDot.classList.remove("ok","warn","err");
      statusDot.classList.add(kind);
      statusText.textContent = text;
    }

    function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

    function safeLower(s){
      return (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    }

    function escapeHtml(str){
      return (str ?? "").toString()
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
    }

    function normalizeBible(raw){
      const root = raw?.books ?? raw?.data ?? raw;

      if (Array.isArray(root)){
        const books = root.map((b, i) => normalizeBook(b, i)).filter(Boolean);
        if (books.length) return { books };
      }

      if (root && typeof root === "object" && !Array.isArray(root)){
        if (root.chapters){
          const single = normalizeBook(root, 0);
          if (single) return { books:[single] };
        }

        const entries = Object.entries(root);
        const books = entries.map(([name, val], i) => {
          const bookObj = (val && typeof val === "object" && !Array.isArray(val)) ? { name, ...val } : { name, chapters: val };
          return normalizeBook(bookObj, i);
        }).filter(Boolean);

        if (books.length) return { books };
      }

      return null;
    }

    function normalizeBook(bookLike, idx){
      if (!bookLike) return null;
      const name = bookLike.name || bookLike.title || bookLike.book || bookLike.nom || bookLike.abbrev || ("Livre " + (idx+1));
      let chapters = bookLike.chapters ?? bookLike.Chapters ?? bookLike.capitres ?? bookLike.chapter ?? null;

      if (Array.isArray(chapters)){
        const normCh = chapters.map(ch => {
          if (Array.isArray(ch)) return ch.map(v => (v ?? "").toString());
          if (ch && typeof ch === "object"){
            const verses = ch.verses ?? ch.Verses ?? ch.texte ?? ch.text ?? ch;
            if (Array.isArray(verses)) return verses.map(v => (v ?? "").toString());
          }
          return null;
        }).filter(Boolean);

        if (normCh.length) return { id: idx, name: name.toString(), chapters: normCh };
      }

      if (chapters && typeof chapters === "object" && !Array.isArray(chapters)){
        const keys = Object.keys(chapters).sort((a,b)=>Number(a)-Number(b));
        const normCh = keys.map(k=>{
          const ch = chapters[k];
          if (Array.isArray(ch)) return ch.map(v => (v ?? "").toString());
          if (ch && typeof ch === "object"){
            const verses = ch.verses ?? ch.Verses ?? ch.text ?? ch.texte;
            if (Array.isArray(verses)) return verses.map(v => (v ?? "").toString());
          }
          return null;
        }).filter(Boolean);
        if (normCh.length) return { id: idx, name: name.toString(), chapters: normCh };
      }

      return null;
    }

    function makeRef(bi, ci){
      const b = Bible.books[bi];
      return `${b.name} ${ci+1}`;
    }

    function makeRefWithVerse(bi, ci, vi){
      const b = Bible.books[bi];
      return `${b.name} ${ci+1}:${vi+1}`;
    }

    function populateSelectors(){
      bookSelect.innerHTML = "";
      Bible.books.forEach((b, i)=>{
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = b.name;
        bookSelect.appendChild(opt);
      });
    }

    function populateChapters(bi){
      const book = Bible.books[bi];
      chapterSelect.innerHTML = "";
      for (let i=0; i<book.chapters.length; i++){
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = String(i+1);
        chapterSelect.appendChild(opt);
      }
    }

    function renderChapter(){
      const bi = current.b;
      const ci = current.c;
      const book = Bible.books[bi];
      const verses = book.chapters[ci] || [];

      bookSelect.value = String(bi);
      populateChapters(bi);
      chapterSelect.value = String(ci);

      const ref = makeRef(bi, ci);
      refPill.textContent = ref;
      chapterTitle.textContent = ref;

      if (!verses.length){
        versesBox.innerHTML = "<em>Chapitre vide ou format non reconnu.</em>";
        return;
      }

      const frag = document.createDocumentFragment();
      verses.forEach((txt, i)=>{
        const span = document.createElement("span");
        span.className = "verse";
        span.id = `v${i+1}`;
        span.innerHTML = `<span class="vnum">${i+1}</span>${escapeHtml(txt)} `;
        frag.appendChild(span);
      });

      versesBox.innerHTML = "";
      versesBox.appendChild(frag);

      localStorage.setItem(LS_KEYS.lastRef, JSON.stringify(current));
      updatePlanStatus();
    }

    function goTo(bi, ci){
      bi = clamp(bi, 0, Bible.books.length-1);
      ci = clamp(ci, 0, Bible.books[bi].chapters.length-1);
      current = { b: bi, c: ci };
      renderChapter();
      location.hash = "#lecture";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function prevChapter(){
      let bi = current.b, ci = current.c - 1;
      if (ci < 0){
        bi = bi - 1;
        if (bi < 0){ showToast("Déjà au début."); return; }
        ci = Bible.books[bi].chapters.length - 1;
      }
      goTo(bi, ci);
    }

    function nextChapter(){
      let bi = current.b, ci = current.c + 1;
      if (ci >= Bible.books[bi].chapters.length){
        bi = bi + 1;
        if (bi >= Bible.books.length){ showToast("Fin de la Bible."); return; }
        ci = 0;
      }
      goTo(bi, ci);
    }

    function gotoVerse(){
      const val = (gotoInput.value || "").trim();
      if (!val) return;
      const n = Number(val);
      if (!Number.isFinite(n) || n < 1){
        showToast("Format invalide. Ex: 16");
        return;
      }
      const el = document.getElementById("v" + n);
      if (!el){
        showToast("Verset introuvable dans ce chapitre.");
        return;
      }
      el.scrollIntoView({behavior:"smooth", block:"center"});
      el.style.background = "rgba(215,196,154,.25)";
      el.style.borderRadius = "10px";
      window.setTimeout(()=>{ el.style.background = "transparent"; }, 900);
    }

    function getProgress(){
      try{
        const raw = localStorage.getItem(LS_KEYS.progress);
        if (!raw) return { b:0, c:0, completed:0 };
        const obj = JSON.parse(raw);
        if (typeof obj?.b !== "number" || typeof obj?.c !== "number") return { b:0, c:0, completed:0 };
        return { b: obj.b, c: obj.c, completed: Number(obj.completed||0) };
      }catch{
        return { b:0, c:0, completed:0 };
      }
    }

    function totalChapters(){
      return Bible.books.reduce((sum,b)=>sum + (b.chapters?.length||0), 0);
    }

    function setProgress(p){
      localStorage.setItem(LS_KEYS.progress, JSON.stringify(p));
      updatePlanStatus();
    }

    function computeNextChapter(bi, ci){
      let nb = bi, nc = ci + 1;
      if (nc >= Bible.books[nb].chapters.length){
        nb += 1;
        nc = 0;
        if (nb >= Bible.books.length){
          nb = Bible.books.length - 1;
          nc = Bible.books[nb].chapters.length - 1;
          return { b: nb, c: nc };
        }
      }
      return { b: nb, c: nc };
    }

    function updatePlanStatus(){
      const p = getProgress();
      const total = totalChapters();
      const currentRef = makeRef(p.b, p.c);
      const pct = total ? Math.round((p.completed / total)*100) : 0;
      planStatus.textContent = `Prochain : ${currentRef} — Progression : ${p.completed}/${total} (${pct}%)`;
    }

    function planContinue(){
      const p = getProgress();
      goTo(p.b, p.c);
      showToast(`<strong>Plan</strong> : ${escapeHtml(makeRef(p.b,p.c))}`);
    }

    function markAsRead(){
      const p = getProgress();
      const viewed = { b: current.b, c: current.c };
      const next = computeNextChapter(viewed.b, viewed.c);
      const total = totalChapters();
      const completed = clamp((p.completed || 0) + 1, 0, total);
      setProgress({ b: next.b, c: next.c, completed });
      showToast("✅ Chapitre marqué comme lu.");
    }

    function resetPlan(){
      setProgress({ b:0, c:0, completed:0 });
      showToast("Plan réinitialisé.");
    }

    function parseReference(query){
      const q = query.trim();
      if (!q) return null;

      const m = q.match(/^(.*?)(\d+)(?::(\d+))?\s*$/);
      if (!m) return null;

      const bookPart = m[1].trim();
      const chap = Number(m[2]);
      const verse = m[3] ? Number(m[3]) : null;
      if (!bookPart || !Number.isFinite(chap) || chap < 1) return null;

      const needle = safeLower(bookPart);
      let best = -1;

      for (let i=0;i<Bible.books.length;i++){
        const bn = safeLower(Bible.books[i].name);
        if (bn === needle){ best = i; break; }
      }
      if (best === -1){
        for (let i=0;i<Bible.books.length;i++){
          const bn = safeLower(Bible.books[i].name);
          if (bn.startsWith(needle)){ best = i; break; }
        }
      }
      if (best === -1){
        for (let i=0;i<Bible.books.length;i++){
          const bn = safeLower(Bible.books[i].name);
          if (bn.includes(needle)){ best = i; break; }
        }
      }
      if (best === -1) return null;

      const ci = chap - 1;
      if (ci < 0 || ci >= Bible.books[best].chapters.length) return null;

      const vi = verse ? (verse - 1) : null;
      if (vi !== null){
        const verses = Bible.books[best].chapters[ci] || [];
        if (vi < 0 || vi >= verses.length) return null;
      }

      return { bookIndex: best, chapterIndex: ci, verseIndex: vi };
    }

    function highlight(textEscaped, rawQuery){
      const q = rawQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!q) return textEscaped;
      try{
        const re = new RegExp(q, "ig");
        return textEscaped.replace(re, (m)=>`<mark style="background:rgba(215,196,154,.55); padding:0 3px; border-radius:6px;">${m}</mark>`);
      }catch{
        return textEscaped;
      }
    }

    function runSearch(q){
      const query = (q ?? "").trim();
      resultsBox.innerHTML = "";
      if (!query){
        showToast("Tape quelque chose pour chercher.");
        return;
      }

      const ref = parseReference(query);
      if (ref){
        goTo(ref.bookIndex, ref.chapterIndex);
        window.setTimeout(()=>{
          if (ref.verseIndex !== null){
            const el = document.getElementById("v"+(ref.verseIndex+1));
            if (el) el.scrollIntoView({behavior:"smooth", block:"center"});
          }
        }, 180);
        showToast("📖 Ouverture : " + (ref.verseIndex!==null ? escapeHtml(makeRefWithVerse(ref.bookIndex, ref.chapterIndex, ref.verseIndex)) : escapeHtml(makeRef(ref.bookIndex, ref.chapterIndex))));
        return;
      }

      const needle = safeLower(query);
      const max = 50;
      let count = 0;

      const out = document.createDocumentFragment();

      for (let bi=0; bi<Bible.books.length; bi++){
        const book = Bible.books[bi];
        for (let ci=0; ci<book.chapters.length; ci++){
          const verses = book.chapters[ci] || [];
          for (let vi=0; vi<verses.length; vi++){
            const t = verses[vi] || "";
            if (safeLower(t).includes(needle)){
              count++;
              if (count <= max){
                const div = document.createElement("div");
                div.className = "result";
                const refTxt = makeRefWithVerse(bi, ci, vi);
                div.innerHTML = `
                  <div class="ref">
                    <span>${escapeHtml(refTxt)}</span>
                    <button class="btn" data-open="${bi},${ci},${vi}" style="height:30px; padding:0 10px; font-size:12px;">Ouvrir</button>
                  </div>
                  <div class="txt">${highlight(escapeHtml(t), query)}</div>
                `;
                out.appendChild(div);
              }
              if (count >= 5000) break;
            }
          }
        }
      }

      resultsBox.appendChild(out);
      if (count === 0){
        resultsBox.innerHTML = `<div class="hint">Aucun résultat.</div>`;
      } else {
        const shown = Math.min(count, max);
        const more = count > max ? ` (affichage limité à ${max})` : "";
        showToast(`<strong>${shown}</strong> résultat(s)${more}`);
      }

      resultsBox.querySelectorAll("[data-open]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const [bi,ci,vi] = btn.getAttribute("data-open").split(",").map(Number);
          goTo(bi,ci);
          window.setTimeout(()=>{
            const el = document.getElementById("v"+(vi+1));
            if (el) el.scrollIntoView({behavior:"smooth", block:"center"});
          }, 180);
        });
      });
    }

    async function init(){
      try{
        setStatus("warn", "Chargement de la Bible…");
        const res = await fetch(BIBLE_JSON_URL, { cache: "no-cache" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const raw = await res.json();

        const norm = normalizeBible(raw);
        if (!norm || !norm.books?.length) throw new Error("Format non reconnu");

        Bible = norm;
        populateSelectors();

        let last = null;
        try{ last = JSON.parse(localStorage.getItem(LS_KEYS.lastRef) || "null"); }catch{}
        if (last && typeof last.b==="number" && typeof last.c==="number"){
          current = { b: clamp(last.b,0,Bible.books.length-1), c: 0 };
          current.c = clamp(last.c,0,Bible.books[current.b].chapters.length-1);
        }

        setStatus("ok", "Bible chargée.");
        renderChapter();
        updatePlanStatus();
      }catch(err){
        console.error(err);
        setStatus("err", "Erreur : impossible de charger data/lsg1910.json");
        versesBox.innerHTML = `
          <strong>Erreur de chargement.</strong><br/>
          Vérifie que le fichier existe : <code>data/lsg1910.json</code> et que le JSON est valide.
        `;
        return;
      }

      bookSelect.addEventListener("change", ()=>{
        const bi = Number(bookSelect.value);
        current.b = clamp(bi,0,Bible.books.length-1);
        current.c = 0;
        renderChapter();
      });

      chapterSelect.addEventListener("change", ()=>{
        const ci = Number(chapterSelect.value);
        current.c = clamp(ci,0,Bible.books[current.b].chapters.length-1);
        renderChapter();
      });

      prevBtn.addEventListener("click", prevChapter);
      nextBtn.addEventListener("click", nextChapter);

      gotoInput.addEventListener("keydown", (e)=>{
        if (e.key === "Enter") gotoVerse();
      });

      copyRefBtn.addEventListener("click", async ()=>{
        const ref = makeRef(current.b, current.c);
        try{
          await navigator.clipboard.writeText(ref);
          showToast("📋 Référence copiée : <strong>"+escapeHtml(ref)+"</strong>");
        }catch{
          showToast("Copie impossible (permission).");
        }
      });

      saveProgressBtn.addEventListener("click", markAsRead);

      globalSearch.addEventListener("keydown", (e)=>{
        if (e.key === "Enter"){
          searchInput.value = globalSearch.value;
          runSearch(globalSearch.value);
          location.hash = "#recherche";
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });

      searchBtn.addEventListener("click", ()=>runSearch(searchInput.value));
      searchInput.addEventListener("keydown", (e)=>{ if(e.key==="Enter") runSearch(searchInput.value); });
      clearBtn.addEventListener("click", ()=>{
        searchInput.value = "";
        resultsBox.innerHTML = "";
      });

      planGoBtn.addEventListener("click", planContinue);
      planResetBtn.addEventListener("click", resetPlan);
    }

    init();
  </script>
</body>
</html>