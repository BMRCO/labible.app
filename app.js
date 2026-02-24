/* ============================================================
   LaBible.app — app.js
   LSG 1910 — Domaine public
   ============================================================ */

'use strict';

// ── CATALOGUE ────────────────────────────────────────────────
const BOOKS = [
  { n:'Genèse',              ch:50,  nt:false, slug:'Ge'  },
  { n:'Exode',               ch:40,  nt:false, slug:'Ex'  },
  { n:'Lévitique',           ch:27,  nt:false, slug:'Le'  },
  { n:'Nombres',             ch:36,  nt:false, slug:'Nu'  },
  { n:'Deutéronome',         ch:34,  nt:false, slug:'De'  },
  { n:'Josué',               ch:24,  nt:false, slug:'Jos' },
  { n:'Juges',               ch:21,  nt:false, slug:'Jg'  },
  { n:'Ruth',                ch:4,   nt:false, slug:'Ru'  },
  { n:'1 Samuel',            ch:31,  nt:false, slug:'1S'  },
  { n:'2 Samuel',            ch:24,  nt:false, slug:'2S'  },
  { n:'1 Rois',              ch:22,  nt:false, slug:'1R'  },
  { n:'2 Rois',              ch:25,  nt:false, slug:'2R'  },
  { n:'1 Chroniques',        ch:29,  nt:false, slug:'1Ch' },
  { n:'2 Chroniques',        ch:36,  nt:false, slug:'2Ch' },
  { n:'Esdras',              ch:10,  nt:false, slug:'Esd' },
  { n:'Néhémie',             ch:13,  nt:false, slug:'Ne'  },
  { n:'Esther',              ch:10,  nt:false, slug:'Est' },
  { n:'Job',                 ch:42,  nt:false, slug:'Job' },
  { n:'Psaumes',             ch:150, nt:false, slug:'Ps'  },
  { n:'Proverbes',           ch:31,  nt:false, slug:'Pr'  },
  { n:'Ecclésiaste',         ch:12,  nt:false, slug:'Ec'  },
  { n:'Cantique',            ch:8,   nt:false, slug:'Ca'  },
  { n:'Ésaïe',               ch:66,  nt:false, slug:'Es'  },
  { n:'Jérémie',             ch:52,  nt:false, slug:'Jr'  },
  { n:'Lamentations',        ch:5,   nt:false, slug:'La'  },
  { n:'Ézéchiel',            ch:48,  nt:false, slug:'Ez'  },
  { n:'Daniel',              ch:12,  nt:false, slug:'Da'  },
  { n:'Osée',                ch:14,  nt:false, slug:'Os'  },
  { n:'Joël',                ch:3,   nt:false, slug:'Joe' },
  { n:'Amos',                ch:9,   nt:false, slug:'Am'  },
  { n:'Abdias',              ch:1,   nt:false, slug:'Ab'  },
  { n:'Jonas',               ch:4,   nt:false, slug:'Jon' },
  { n:'Michée',              ch:7,   nt:false, slug:'Mi'  },
  { n:'Nahoum',              ch:3,   nt:false, slug:'Na'  },
  { n:'Habacuc',             ch:3,   nt:false, slug:'Ha'  },
  { n:'Sophonie',            ch:3,   nt:false, slug:'So'  },
  { n:'Aggée',               ch:2,   nt:false, slug:'Ag'  },
  { n:'Zacharie',            ch:14,  nt:false, slug:'Za'  },
  { n:'Malachie',            ch:4,   nt:false, slug:'Mal' },
  { n:'Matthieu',            ch:28,  nt:true,  slug:'Mt'  },
  { n:'Marc',                ch:16,  nt:true,  slug:'Mr'  },
  { n:'Luc',                 ch:24,  nt:true,  slug:'Lu'  },
  { n:'Jean',                ch:21,  nt:true,  slug:'Jn'  },
  { n:'Actes',               ch:28,  nt:true,  slug:'Ac'  },
  { n:'Romains',             ch:16,  nt:true,  slug:'Ro'  },
  { n:'1 Corinthiens',       ch:16,  nt:true,  slug:'1Co' },
  { n:'2 Corinthiens',       ch:13,  nt:true,  slug:'2Co' },
  { n:'Galates',             ch:6,   nt:true,  slug:'Ga'  },
  { n:'Éphésiens',           ch:6,   nt:true,  slug:'Ep'  },
  { n:'Philippiens',         ch:4,   nt:true,  slug:'Php' },
  { n:'Colossiens',          ch:4,   nt:true,  slug:'Col' },
  { n:'1 Thessaloniciens',   ch:5,   nt:true,  slug:'1Th' },
  { n:'2 Thessaloniciens',   ch:3,   nt:true,  slug:'2Th' },
  { n:'1 Timothée',          ch:6,   nt:true,  slug:'1Ti' },
  { n:'2 Timothée',          ch:4,   nt:true,  slug:'2Ti' },
  { n:'Tite',                ch:3,   nt:true,  slug:'Tit' },
  { n:'Philémon',            ch:1,   nt:true,  slug:'Phm' },
  { n:'Hébreux',             ch:13,  nt:true,  slug:'Heb' },
  { n:'Jacques',             ch:5,   nt:true,  slug:'Jac' },
  { n:'1 Pierre',            ch:5,   nt:true,  slug:'1Pi' },
  { n:'2 Pierre',            ch:3,   nt:true,  slug:'2Pi' },
  { n:'1 Jean',              ch:5,   nt:true,  slug:'1Jn' },
  { n:'2 Jean',              ch:1,   nt:true,  slug:'2Jn' },
  { n:'3 Jean',              ch:1,   nt:true,  slug:'3Jn' },
  { n:'Jude',                ch:1,   nt:true,  slug:'Jud' },
  { n:'Apocalypse',          ch:22,  nt:true,  slug:'Ap'  },
];

// Plan 365 jours [bookIndex (0-based), chapter]
const PLAN_365 = buildPlan365();
function buildPlan365() {
  const plan = [];
  for (let b = 0; b < BOOKS.length; b++) {
    for (let c = 1; c <= BOOKS[b].ch; c++) {
      plan.push([b, c]);
      if (plan.length === 365) return plan;
    }
  }
  // compléter si < 365 en bouclant
  let i = 0;
  while (plan.length < 365) { plan.push(plan[i++ % plan.length]); }
  return plan;
}

// ── ÉTAT ─────────────────────────────────────────────────────
const S = {
  book:       parseInt(localStorage.getItem('lb_book')    || '0'),
  chapter:    parseInt(localStorage.getItem('lb_chapter') || '1'),
  fontSize:   parseInt(localStorage.getItem('lb_font')    || '17'),
  theme:      localStorage.getItem('lb_theme')            || 'dark',
  favorites:  JSON.parse(localStorage.getItem('lb_fav')   || '[]'),
  history:    JSON.parse(localStorage.getItem('lb_hist')  || '[]'),
  planDone:   JSON.parse(localStorage.getItem('lb_plan')  || '[]'),
  // index de recherche : { mot: [[bookIdx, chapNr, verseNr], ...] }
  index:      null,
  indexBuilt: false,
  // cache chapitres en mémoire
  chapCache:  {},
  // verset sélectionné dans la lecture
  selVerse:   null,
  // deferred install prompt
  deferredInstall: null,
};

// ── DOM ───────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── BOOT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  $('year').textContent = new Date().getFullYear();
  applyTheme();
  buildBookSelect();
  syncChapterSelect();
  bindEvents();
  loadChapter(S.book, S.chapter);
  refreshPlan();
  refreshLibrary();
  registerSW();

  // Hero → fermer automatiquement après premier clic
  const hero = $('hero');
  if (hero && localStorage.getItem('lb_heroSeen')) hero.style.display = 'none';
});

// ── THÈME ─────────────────────────────────────────────────────
function applyTheme() {
  document.documentElement.dataset.theme = S.theme;
  $('btnTheme').textContent = S.theme === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
  S.theme = S.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('lb_theme', S.theme);
  applyTheme();
}

// ── TAILLE POLICE ─────────────────────────────────────────────
function applyFont() {
  document.documentElement.style.setProperty('--verse-size', S.fontSize + 'px');
}
function changeFontSize(delta) {
  S.fontSize = Math.min(26, Math.max(13, S.fontSize + delta));
  localStorage.setItem('lb_font', S.fontSize);
  applyFont();
}

// ── SELECT LIVRES/CHAPITRES ───────────────────────────────────
function buildBookSelect() {
  const sel = $('bookSelect');
  sel.innerHTML = '';
  BOOKS.forEach((b, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = b.n;
    if (i === S.book) o.selected = true;
    sel.appendChild(o);
  });
}

function syncChapterSelect() {
  const sel    = $('chapterSelect');
  const maxCh  = BOOKS[S.book].ch;
  // Sécurité : corriger un chapitre invalide
  if (S.chapter < 1 || S.chapter > maxCh) S.chapter = 1;
  sel.innerHTML = '';
  for (let c = 1; c <= maxCh; c++) {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = 'Ch. ' + c;
    if (c === S.chapter) o.selected = true;
    sel.appendChild(o);
  }
}

// ── CHARGER UN CHAPITRE ───────────────────────────────────────
async function loadChapter(bookIdx, chapNr) {
  S.book    = bookIdx;
  S.chapter = chapNr;
  localStorage.setItem('lb_book',    S.book);
  localStorage.setItem('lb_chapter', S.chapter);

  // Sync selects
  $('bookSelect').value    = S.book;
  syncChapterSelect();
  $('chapterSelect').value = S.chapter;

  // Header
  $('pageHeader').textContent = BOOKS[S.book].n + '  ' + S.chapter;

  // Afficher spinner
  const versesEl = $('verses');
  versesEl.innerHTML = '<div class="loadingSpinner">Chargement…</div>';

  try {
    const data = await fetchChapter(S.book, S.chapter);
    renderVerses(data.verses || []);
    addToHistory(S.book, S.chapter);
    refreshLibrary();
    $('readerPage').scrollTop = 0;
  } catch(e) {
    versesEl.innerHTML = `
      <div class="errorMsg">
        ⚠️ Impossible de charger ce chapitre.<br>
        <small>Vérifiez votre connexion ou <a href="#" onclick="loadChapter(${S.book},${S.chapter});return false">réessayez</a>.</small>
      </div>`;
  }
}

// Slugs locaux : nom du dossier dans data/ (minuscules, sans accents)
const BOOK_SLUGS = [
  'genese','exode','levitique','nombres','deuteronome','josue','juges','ruth',
  '1samuel','2samuel','1rois','2rois','1chroniques','2chroniques','esdras',
  'nehemie','esther','job','psaumes','proverbes','ecclesiaste','cantique',
  'esaie','jeremie','lamentations','ezechiel','daniel','osee','joel','amos',
  'abdias','jonas','michee','nahoum','habacuc','sophonie','aggee','zacharie',
  'malachie','matthieu','marc','luc','jean','actes','romains',
  '1corinthiens','2corinthiens','galates','ephesiens','philippiens','colossiens',
  '1thessaloniciens','2thessaloniciens','1timothee','2timothee','tite','philemon',
  'hebreux','jacques','1pierre','2pierre','1jean','2jean','3jean','jude','apocalypse'
];

// Stratégie : data/bible/{slug} → data/bible/{nr} → data/{slug} → API
async function fetchChapter(bookIdx, chapNr) {
  const key    = `${bookIdx}_${chapNr}`;
  const bookNr = bookIdx + 1;
  const slug   = BOOK_SLUGS[bookIdx] || String(bookNr);

  if (S.chapCache[key]) return S.chapCache[key];

  const paths = [
    `./data/bible/${slug}/${chapNr}.json`,
    `./data/bible/${bookNr}/${chapNr}.json`,
    `./data/${slug}/${chapNr}.json`,
    `./data/${bookNr}/${chapNr}.json`,
  ];

  for (const path of paths) {
    try {
      const r = await fetch(path);
      if (r.ok) {
        const d    = await r.json();
        const norm = normalise(d, bookIdx, chapNr);
        if (norm.verses.length > 0) {
          console.log('[LaBible] Chargé depuis :', path);
          S.chapCache[key] = norm;
          return norm;
        } else {
          console.warn('[LaBible] JSON vide ou format inconnu :', path, d);
        }
      } else {
        console.warn('[LaBible] HTTP', r.status, path);
      }
    } catch(e) {
      console.warn('[LaBible] Erreur fetch :', path, e.message);
    }
  }

  // Fallback : API getBible.net v2
  const url = `https://api.getbible.net/v2/lsg/${bookNr}/${chapNr}.json`;
  const r   = await fetch(url);
  if (!r.ok) throw new Error('API ' + r.status);
  const d   = await r.json();
  S.chapCache[key] = normalise(d, bookIdx, chapNr);
  return S.chapCache[key];
}

// Normaliser toutes les structures possibles en { verses: [{verse, text}] }
function normalise(data, bookIdx, chapNr) {
  // Déjà normalisé : tableau de versets avec .verse et .text
  if (data && Array.isArray(data.verses) && data.verses.length > 0
      && data.verses[0].text !== undefined) {
    return { verses: data.verses.map(v => ({
      verse: parseInt(v.verse) || v.verse,
      text:  (v.text || '').replace(/\s+/g,' ').trim()
    })) };
  }
  // Tableau simple de strings : ["Au commencement...", ...]
  if (Array.isArray(data)) {
    return { verses: data.map((t, i) => ({ verse: i + 1, text: String(t).trim() })) };
  }
  // Objet verses non-tableau : { "1": {verse:1, text:"..."}, "2": ... }
  if (data && data.verses && !Array.isArray(data.verses)) {
    return { verses: Object.values(data.verses).map(v => ({
      verse: parseInt(v.verse) || v.verse,
      text:  (v.text || '').replace(/\s+/g,' ').trim()
    })) };
  }
  // Objet clés numériques directement : { "1": "texte...", "2": ... }
  if (data && typeof data === 'object') {
    const keys = Object.keys(data).filter(k => !isNaN(k));
    if (keys.length > 0) {
      return { verses: keys.sort((a,b)=>+a-+b).map(k => ({
        verse: parseInt(k),
        text:  typeof data[k] === 'string' ? data[k].trim()
               : (data[k].text || '').trim()
      })) };
    }
  }
  return { verses: [] };
}

// ── RENDU DES VERSETS ─────────────────────────────────────────
function renderVerses(verses) {
  const el  = $('verses');
  const favSet = new Set(S.favorites.map(f => f.key));

  el.innerHTML = verses.map(v => {
    const key = `${S.book}_${S.chapter}_${v.verse}`;
    const cls = favSet.has(key) ? ' fav' : '';
    const txt = (v.text || '').replace(/\s+/g, ' ').trim();
    return `<p class="verse${cls}" data-v="${v.verse}" onclick="onVerseClick(this)">
              <sup class="vn">${v.verse}</sup>${txt}
            </p>`;
  }).join('');

  applyFont();
  S.selVerse = null;
}

function onVerseClick(el) {
  // Désélection
  $$('.verse.sel').forEach(e => e.classList.remove('sel'));
  el.classList.toggle('sel');

  const vNr = parseInt(el.dataset.v);
  const key  = `${S.book}_${S.chapter}_${vNr}`;
  const text = el.querySelector('sup') ? el.textContent.replace(/^\d+/, '').trim() : el.textContent.trim();
  const ref  = `${BOOKS[S.book].n} ${S.chapter}:${vNr}`;

  S.selVerse = el.classList.contains('sel') ? { book:S.book, chap:S.chapter, verse:vNr, key, text, ref } : null;
}

// ── NAVIGATION ────────────────────────────────────────────────
function prevChapter() {
  if (S.chapter > 1) {
    loadChapter(S.book, S.chapter - 1);
  } else if (S.book > 0) {
    loadChapter(S.book - 1, BOOKS[S.book - 1].ch);
  }
}
function nextChapter() {
  if (S.chapter < BOOKS[S.book].ch) {
    loadChapter(S.book, S.chapter + 1);
  } else if (S.book < BOOKS.length - 1) {
    loadChapter(S.book + 1, 1);
  }
}

// ── SWIPE ─────────────────────────────────────────────────────
(function() {
  let x0 = null;
  const page = () => $('readerPage');
  document.addEventListener('touchstart', e => {
    if (!e.target.closest('#readerPage')) return;
    x0 = e.touches[0].clientX;
  }, { passive:true });
  document.addEventListener('touchend', e => {
    if (x0 === null || !e.target.closest('#readerPage')) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 60) return;
    dx < 0 ? nextChapter() : prevChapter();
  }, { passive:true });
})();

// ── FAVORIS ───────────────────────────────────────────────────
function toggleBookmark() {
  if (!S.selVerse) { toast('Appuyez d\'abord sur un verset.'); return; }
  const { key, ref, text } = S.selVerse;
  const idx = S.favorites.findIndex(f => f.key === key);
  const el  = document.querySelector(`.verse[data-v="${S.selVerse.verse}"]`);
  if (idx >= 0) {
    S.favorites.splice(idx, 1);
    if (el) el.classList.remove('fav');
    toast('Retiré des favoris.');
  } else {
    S.favorites.unshift({ key, ref, text });
    if (el) el.classList.add('fav');
    toast('⭐ Ajouté aux favoris !');
  }
  localStorage.setItem('lb_fav', JSON.stringify(S.favorites));
  refreshLibrary();
}

// ── COPIER ────────────────────────────────────────────────────
function copyRef() {
  const v = S.selVerse;
  if (!v) {
    // Copier la référence du chapitre entier
    const txt = `${BOOKS[S.book].n} ${S.chapter} (LSG 1910)`;
    copyToClipboard(txt);
    return;
  }
  copyToClipboard(`«${v.text}» — ${v.ref} (LSG 1910)`);
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text)
    .then(() => toast('📋 Copié !'))
    .catch(() => toast('Copie non supportée.'));
}

// ── PARTAGER ──────────────────────────────────────────────────
function shareChapter() {
  const v = S.selVerse;
  const text = v ? `«${v.text}» — ${v.ref} (LSG 1910)` : `${BOOKS[S.book].n} ${S.chapter} — LaBible.app`;
  const url  = `https://labible.app`;
  if (navigator.share) {
    navigator.share({ title:'LaBible.app', text, url }).catch(()=>{});
  } else {
    copyToClipboard(text);
  }
}

// ── VERSET DU JOUR ────────────────────────────────────────────
const VDD_LIST = [
  [43,3,16], // Jean 3:16
  [18,23,1], // Psaumes 23:1
  [44,10,13], // Romains 10:13
  [45,8,28],  // Romains 8:28
  [59,4,13],  // Philippiens 4:13
  [59,4,6],   // Philippiens 4:6
  [23,40,31], // Ésaïe 40:31
  [43,14,6],  // Jean 14:6
  [2,20,12],  // Exode 20:12
  [18,119,105], // Ps 119:105
  [43,16,33], // Jean 16:33
  [44,12,2],  // Romains 12:2
  [43,1,1],   // Jean 1:1
  [43,15,5],  // Jean 15:5
  [18,46,1],  // Ps 46:1
  [23,41,10], // Ésaïe 41:10
  [20,3,5],   // Prov 3:5
  [20,4,23],  // Prov 4:23
  [42,11,28], // Matthieu 11:28
  [44,5,8],   // Romains 5:8
  [44,8,1],   // Romains 8:1
  [60,3,23],  // Colossiens 3:23
  [58,4,8],   // Éphésiens 4:8 – adjusted
  [43,8,32],  // Jean 8:32
  [18,37,4],  // Ps 37:4
  [42,6,33],  // Matthieu 6:33
  [1,1,1],    // Genèse 1:1
  [43,10,10], // Jean 10:10
  [44,3,23],  // Romains 3:23
  [65,1,8],   // Apocalypse 1:8
];

function getVDD() {
  const day = Math.floor(Date.now() / 86400000);
  return VDD_LIST[day % VDD_LIST.length];
}

async function loadVDD() {
  const [bIdx, chapNr, vNr] = getVDD();
  try {
    const data = await fetchChapter(bIdx, chapNr);
    const v = (data.verses || []).find(x => parseInt(x.verse) === vNr);
    if (!v) return null;
    const ref  = `${BOOKS[bIdx].n} ${chapNr}:${vNr}`;
    const text = (v.text || '').replace(/\s+/g,' ').trim();
    return { bIdx, chapNr, vNr, ref, text, key:`${bIdx}_${chapNr}_${vNr}` };
  } catch(_) { return null; }
}

async function openVDD() {
  const [bIdx, chapNr] = getVDD();
  switchView('read');
  await loadChapter(bIdx, chapNr);
  const vNr = getVDD()[2];
  setTimeout(() => {
    const el = document.querySelector(`.verse[data-v="${vNr}"]`);
    if (el) { el.scrollIntoView({behavior:'smooth',block:'center'}); el.classList.add('sel'); }
  }, 300);
}

// ── HISTORIQUE ────────────────────────────────────────────────
function addToHistory(bookIdx, chapNr) {
  const ref = `${BOOKS[bookIdx].n} ${chapNr}`;
  S.history = S.history.filter(h => h.ref !== ref);
  S.history.unshift({ ref, bookIdx, chapNr, ts: Date.now() });
  if (S.history.length > 50) S.history.length = 50;
  localStorage.setItem('lb_hist', JSON.stringify(S.history));
}

// ── PLAN DE LECTURE ───────────────────────────────────────────
function getDayOfYear() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.floor((now - start) / 86400000);
}

function refreshPlan() {
  const day    = getDayOfYear();
  const ref    = PLAN_365[day % 365];
  const [bIdx, chapNr] = ref;
  const label  = `Jour ${day + 1}/365 — ${BOOKS[bIdx].n} ${chapNr}`;
  const done   = S.planDone.includes(day);
  const pct    = Math.round((S.planDone.length / 365) * 100);

  $('planTodayText').textContent = label;
  $('planTodayMeta').textContent = done ? '✅ Lu aujourd\'hui' : '';
  $('progressFill').style.width = pct + '%';
  $('progressText').textContent = pct + '% (' + S.planDone.length + '/365)';
}

function openTodayPlan() {
  const day   = getDayOfYear();
  const [bIdx, chapNr] = PLAN_365[day % 365];
  switchView('read');
  loadChapter(bIdx, chapNr);
}

function markPlanDone() {
  const day = getDayOfYear();
  if (!S.planDone.includes(day)) {
    S.planDone.push(day);
    localStorage.setItem('lb_plan', JSON.stringify(S.planDone));
    toast('✅ Journée marquée comme lue !');
    refreshPlan();
  } else {
    toast('Déjà marqué pour aujourd\'hui.');
  }
}

function resetPlan() {
  if (!confirm('Réinitialiser tout le plan de lecture ?')) return;
  S.planDone = [];
  localStorage.setItem('lb_plan', JSON.stringify(S.planDone));
  refreshPlan();
  toast('Plan réinitialisé.');
}

function jumpToDay() {
  const d = parseInt(prompt('Aller au jour (1–365) :', getDayOfYear() + 1));
  if (!d || d < 1 || d > 365) return;
  const [bIdx, chapNr] = PLAN_365[d - 1];
  switchView('read');
  loadChapter(bIdx, chapNr);
}

// ── BIBLIOTHÈQUE ──────────────────────────────────────────────
async function refreshLibrary() {
  // Verset du jour
  const vdd = await loadVDD();
  if (vdd) {
    $('vddBox').textContent = `«${vdd.text}» — ${vdd.ref}`;
    $('vddBox').dataset.bIdx   = vdd.bIdx;
    $('vddBox').dataset.chapNr = vdd.chapNr;
    $('vddBox').dataset.vNr    = vdd.vNr;
    $('vddBox').dataset.text   = vdd.text;
    $('vddBox').dataset.ref    = vdd.ref;
  }

  // Favoris
  const favEl = $('favList');
  favEl.innerHTML = S.favorites.length === 0
    ? '<div class="emptyMsg">Aucun favori.</div>'
    : S.favorites.map((f, i) => `
        <div class="listItem" onclick="goToRef(${JSON.stringify(f.key)})">
          <div class="listRef">${f.ref}</div>
          <div class="listText">${f.text}</div>
          <button class="chipSm" onclick="event.stopPropagation();deleteFav(${i})">✕</button>
        </div>`).join('');

  // Historique
  const histEl = $('historyList');
  histEl.innerHTML = S.history.length === 0
    ? '<div class="emptyMsg">Aucun historique.</div>'
    : S.history.slice(0, 30).map(h => `
        <div class="listItem" onclick="loadChapter(${h.bookIdx},${h.chapNr});switchView('read')">
          <div class="listRef">${h.ref}</div>
        </div>`).join('');
}

function goToRef(key) {
  const [bIdx, chapNr, vNr] = key.split('_').map(Number);
  switchView('read');
  loadChapter(bIdx, chapNr).then(() => {
    setTimeout(() => {
      const el = document.querySelector(`.verse[data-v="${vNr}"]`);
      if (el) { el.scrollIntoView({behavior:'smooth',block:'center'}); el.classList.add('sel'); }
    }, 300);
  });
}

function deleteFav(i) {
  S.favorites.splice(i, 1);
  localStorage.setItem('lb_fav', JSON.stringify(S.favorites));
  refreshLibrary();
  // Retire la classe fav si le chapitre est ouvert
  $$('.verse.fav').forEach(el => {
    const vNr = parseInt(el.dataset.v);
    const key = `${S.book}_${S.chapter}_${vNr}`;
    if (!S.favorites.find(f => f.key === key)) el.classList.remove('fav');
  });
}

function clearFavorites() {
  if (!confirm('Vider tous les favoris ?')) return;
  S.favorites = [];
  localStorage.setItem('lb_fav', JSON.stringify(S.favorites));
  $$('.verse.fav').forEach(el => el.classList.remove('fav'));
  refreshLibrary();
  toast('Favoris effacés.');
}

function clearHistory() {
  if (!confirm('Effacer l\'historique ?')) return;
  S.history = [];
  localStorage.setItem('lb_hist', JSON.stringify(S.history));
  refreshLibrary();
  toast('Historique effacé.');
}

// ── RECHERCHE ─────────────────────────────────────────────────

// Parser les références : "Jean 3:16", "Ps 23:1", "Romains 8"
function parseRef(q) {
  const aliases = {};
  BOOKS.forEach((b, i) => {
    [b.n.toLowerCase(), b.slug.toLowerCase()].forEach(k => { aliases[k] = i; });
    // variantes courantes
    if (b.n.startsWith('1 ')) aliases['1' + b.n.slice(2).toLowerCase()] = i;
    if (b.n.startsWith('2 ')) aliases['2' + b.n.slice(2).toLowerCase()] = i;
    if (b.n.startsWith('3 ')) aliases['3' + b.n.slice(2).toLowerCase()] = i;
  });

  const m = q.trim().match(/^(.+?)\s+(\d+)(?::(\d+))?$/i);
  if (!m) return null;
  const bookKey = m[1].toLowerCase().replace(/[éèê]/g,'e').replace(/[àâ]/g,'a');
  const chapNr  = parseInt(m[2]);
  const verseNr = m[3] ? parseInt(m[3]) : null;

  // Chercher la correspondance la plus proche
  const bookIdx = aliases[bookKey] ?? Object.keys(aliases).find(k => k.startsWith(bookKey)) !== undefined
    ? aliases[Object.keys(aliases).find(k => k.startsWith(bookKey))]
    : null;

  if (bookIdx === null || bookIdx === undefined) return null;
  if (chapNr < 1 || chapNr > BOOKS[bookIdx].ch) return null;
  return { bookIdx, chapNr, verseNr };
}

let searchDebounce = null;

function triggerSearch() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(doSearch, 350);
}

async function doSearch() {
  const q   = $('searchInput').value.trim();
  const res = $('searchResults');
  const meta = $('searchMeta');

  if (q.length < 2) { res.innerHTML = ''; meta.textContent = ''; return; }

  // Tentative de parsing de référence
  const ref = parseRef(q);
  if (ref) {
    res.innerHTML = `<div class="resultItem" onclick="goToSearchRef(${ref.bookIdx},${ref.chapNr},${ref.verseNr || 1})">
      <span class="resultRef">${BOOKS[ref.bookIdx].n} ${ref.chapNr}${ref.verseNr ? ':' + ref.verseNr : ''}</span>
      <span class="resultText">Ouvrir ce passage →</span>
    </div>`;
    meta.textContent = 'Référence détectée.';
    return;
  }

  meta.textContent = 'Recherche en cours…';
  res.innerHTML    = '<div class="loadingSpinner">Recherche…</div>';

  // Essayer l'API getBible search
  try {
    const url  = `https://api.getbible.net/v2/lsg.json`;
    // L'API getBible ne supporte pas la recherche directe de texte ;
    // on utilise l'index local si disponible, sinon cache
    throw new Error('no_api_search');
  } catch(_) {
    searchInCache(q);
  }
}

function searchInCache(q) {
  const meta = $('searchMeta');
  const res  = $('searchResults');
  const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  const hits  = [];

  for (const [key, data] of Object.entries(S.chapCache)) {
    const [bIdx, chapNr] = key.split('_').map(Number);
    for (const v of (data.verses || [])) {
      const txt = (v.text || '').toLowerCase();
      if (words.every(w => txt.includes(w))) {
        hits.push({ bIdx, chapNr, verse: v.verse, text: v.text });
      }
    }
  }

  // Aussi chercher dans l'index si construit
  if (S.index) {
    const sets = words.map(w => {
      const result = new Set();
      for (const k of Object.keys(S.index)) {
        if (k.startsWith(w)) S.index[k].forEach(entry => result.add(entry.join('|')));
      }
      return result;
    });
    if (sets.length) {
      const intersection = [...sets[0]].filter(e => sets.every(s => s.has(e)));
      intersection.forEach(e => {
        const [bIdx, chapNr, vNr] = e.split('|').map(Number);
        const key = `${bIdx}_${chapNr}`;
        const cached = S.chapCache[key];
        const v = cached?.verses?.find(x => parseInt(x.verse) === vNr);
        if (v && !hits.find(h => h.bIdx===bIdx && h.chapNr===chapNr && h.verse===vNr)) {
          hits.push({ bIdx, chapNr, verse: v.verse, text: v.text });
        }
      });
    }
  }

  if (hits.length === 0) {
    meta.textContent = S.indexBuilt
      ? `Aucun résultat.`
      : `Aucun résultat dans les chapitres consultés. Construisez l'index (⚡) pour une recherche complète.`;
    res.innerHTML = '';
    return;
  }

  meta.textContent = `${hits.length} résultat${hits.length > 1 ? 's' : ''} ${S.indexBuilt ? '' : '(chapitres consultés)'}`;
  const re  = new RegExp(`(${words.map(escRe).join('|')})`, 'gi');
  res.innerHTML = hits.slice(0, 80).map(h => {
    const ref  = `${BOOKS[h.bIdx].n} ${h.chapNr}:${h.verse}`;
    const hl   = (h.text || '').replace(re, '<mark>$1</mark>');
    return `<div class="resultItem" onclick="goToSearchRef(${h.bIdx},${h.chapNr},${h.verse})">
              <span class="resultRef">${ref}</span>
              <span class="resultText">${hl}</span>
            </div>`;
  }).join('');
}

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

function goToSearchRef(bIdx, chapNr, vNr) {
  switchView('read');
  loadChapter(bIdx, chapNr).then(() => {
    setTimeout(() => {
      const el = document.querySelector(`.verse[data-v="${vNr}"]`);
      if (el) { el.scrollIntoView({behavior:'smooth',block:'center'}); el.classList.add('sel'); }
    }, 400);
  });
}

function clearSearch() {
  $('searchInput').value = '';
  $('searchResults').innerHTML = '';
  $('searchMeta').textContent = '';
}

// ── INDEX DE RECHERCHE (construction async) ───────────────────
async function buildSearchIndex() {
  const btn = $('btnBuildIndex');
  btn.disabled = true;
  btn.textContent = '⏳ Index…';
  toast('Construction de l\'index (cela peut prendre 1–2 min)…');

  S.index = {};
  let loaded = 0;

  for (let b = 0; b < BOOKS.length; b++) {
    for (let c = 1; c <= BOOKS[b].ch; c++) {
      try {
        const data = await fetchChapter(b, c);
        for (const v of (data.verses || [])) {
          const words = (v.text || '').toLowerCase().replace(/[^a-zàâäéèêëîïôùûüç\s]/gi,'').split(/\s+/);
          for (const w of words) {
            if (w.length < 3) continue;
            if (!S.index[w]) S.index[w] = [];
            S.index[w].push([b, c, parseInt(v.verse)]);
          }
        }
        loaded++;
        if (loaded % 50 === 0) {
          btn.textContent = `⏳ ${Math.round((loaded / (BOOKS.reduce((a,x)=>a+x.ch,0))) * 100)}%`;
          await new Promise(r => setTimeout(r, 0)); // yield
        }
      } catch(_) {}
    }
  }

  S.indexBuilt = true;
  btn.textContent = '✅ Index';
  btn.disabled = false;
  toast('⚡ Index construit ! La recherche est maintenant complète.');
}

// ── TABS ─────────────────────────────────────────────────────
function switchView(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  if (name === 'library') refreshLibrary();
  if (name === 'plan')    refreshPlan();
}

// ── TOAST ─────────────────────────────────────────────────────
let toastTimer = null;
function toast(msg, dur = 2800) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), dur);
}

// ── SERVICE WORKER ────────────────────────────────────────────
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) {
              toast('🔄 Mise à jour disponible. Rechargez la page.', 6000);
            }
          });
        });
      })
      .catch(() => {});
  }
}

// ── PWA INSTALL ───────────────────────────────────────────────
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  S.deferredInstall = e;
  $('btnInstall').hidden = false;
});

function promptInstall() {
  if (!S.deferredInstall) { toast('Installation non disponible sur ce navigateur.'); return; }
  S.deferredInstall.prompt();
  S.deferredInstall.userChoice.then(r => {
    if (r.outcome === 'accepted') toast('✅ Application installée !');
    S.deferredInstall = null;
    $('btnInstall').hidden = true;
  });
}

// ── BINDING ÉVÉNEMENTS ────────────────────────────────────────
function bindEvents() {
  // Theme / font
  $('btnTheme').onclick    = toggleTheme;
  $('btnFontMinus').onclick = () => changeFontSize(-1);
  $('btnFontPlus').onclick  = () => changeFontSize(+1);

  // Navigation lecture
  $('bookSelect').onchange    = () => {
    S.book = parseInt($('bookSelect').value); S.chapter = 1;
    syncChapterSelect(); loadChapter(S.book, S.chapter);
  };
  $('chapterSelect').onchange = () => loadChapter(S.book, parseInt($('chapterSelect').value));
  $('btnPrev').onclick        = prevChapter;
  $('btnNext').onclick        = nextChapter;

  // Actions sur versets
  $('btnBookmark').onclick = toggleBookmark;
  $('btnCopyRef').onclick  = copyRef;
  $('btnShare').onclick    = shareChapter;
  $('btnVDD').onclick      = openVDD;

  // Recherche
  $('searchInput').oninput  = triggerSearch;
  $('searchInput').onkeydown = e => { if (e.key === 'Enter') doSearch(); };
  $('btnSearch').onclick     = doSearch;
  $('btnClearSearch').onclick = clearSearch;
  $('btnBuildIndex').onclick  = buildSearchIndex;

  // Plan
  $('btnOpenToday').onclick = openTodayPlan;
  $('btnMarkDone').onclick  = markPlanDone;
  $('btnResetPlan').onclick = resetPlan;
  $('btnJumpDay').onclick   = jumpToDay;

  // Bibliothèque
  $('btnClearFav').onclick     = clearFavorites;
  $('btnClearHistory').onclick = clearHistory;
  $('btnOpenVDD').onclick      = openVDD;
  $('btnCopyVDD').onclick      = async () => {
    const vdd = await loadVDD();
    if (vdd) copyToClipboard(`«${vdd.text}» — ${vdd.ref} (LSG 1910)`);
  };

  // Hero buttons → switch view
  $('btnOpenRead').onclick    = () => { switchView('read');    $('hero').style.display='none'; localStorage.setItem('lb_heroSeen','1'); };
  $('btnOpenSearch').onclick  = () => { switchView('search');  $('hero').style.display='none'; localStorage.setItem('lb_heroSeen','1'); };
  $('btnOpenPlan').onclick    = () => { switchView('plan');    $('hero').style.display='none'; localStorage.setItem('lb_heroSeen','1'); };
  $('btnOpenLibrary').onclick = () => { switchView('library'); $('hero').style.display='none'; localStorage.setItem('lb_heroSeen','1'); };

  // Tabs
  $$('.tab').forEach(t => { t.onclick = () => switchView(t.dataset.view); });

  // Accueil
  $('btnHome').onclick = () => {
    switchView('read');
    $('hero') && ($('hero').style.display = 'flex');
    localStorage.removeItem('lb_heroSeen');
  };

  // Install
  $('btnInstall').onclick = promptInstall;

  // Keyboard shortcut: ← →
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft')  prevChapter();
    if (e.key === 'ArrowRight') nextChapter();
  });
}
