// plan-lecture.js (LaBible.app) — Plan 1 an (commencer aujourd’hui + checklist)
// Dépend de /data/segond_1910.json et des routes /{bookSlug}/{chapter}

const $ = (id) => document.getElementById(id);

async function loadJSON(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error("Erreur de chargement : " + path);
  return r.json();
}

function escapeHTML(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function normalize(s){
  return String(s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function slugifyBookName(name) {
  return normalize(name)
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function fmtDate(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const da = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}

function daysBetween(d0, d1){
  // UTC noon trick to avoid DST issues
  const a = Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate(), 12,0,0);
  const b = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate(), 12,0,0);
  return Math.floor((b - a) / 86400000);
}

const STORAGE_KEY = "labible_plan1an_v1"; 
// { startDate:"YYYY-MM-DD", doneDays:{ "0":true, "1":true, ... } }

function getState(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; }
  catch { return null; }
}

function saveState(st){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
}

function clearState(){
  localStorage.removeItem(STORAGE_KEY);
}

function ensureState(){
  let st = getState();
  if (!st) st = { startDate: null, doneDays: {} };
  if (!st.doneDays) st.doneDays = {};
  return st;
}

function isDone(dayIndex){
  const st = ensureState();
  return !!st.doneDays[String(dayIndex)];
}

function markDone(dayIndex, yes){
  const st = ensureState();
  if (!st.startDate) return;
  if (yes) st.doneDays[String(dayIndex)] = true;
  else delete st.doneDays[String(dayIndex)];
  saveState(st);
}

function countDone(){
  const st = ensureState();
  return Object.keys(st.doneDays || {}).length;
}

function bookOrderFromDB(DB){
  // Build {bookNumber -> {name, slug, chaptersCount}}
  const mapName = new Map();
  const mapChapters = new Map();

  for (const v of DB.verses){
    if (!mapName.has(v.book)) mapName.set(v.book, v.book_name);
    if (!mapChapters.has(v.book)) mapChapters.set(v.book, new Set());
    mapChapters.get(v.book).add(v.chapter);
  }

  const books = Array.from(mapName.entries())
    .map(([book, name]) => {
      const slug = slugifyBookName(name);
      const chapters = Array.from(mapChapters.get(book) || []).sort((a,b)=>a-b);
      return { book, name, slug, chapters };
    })
    .sort((a,b)=>a.book - b.book);

  return books;
}

function buildChapterRefs(books, bookMin, bookMax){
  // returns array of {book, bookName, bookSlug, chapter}
  const refs = [];
  for (const b of books){
    if (b.book < bookMin || b.book > bookMax) continue;
    for (const c of b.chapters){
      refs.push({ book: b.book, bookName: b.name, bookSlug: b.slug, chapter: c });
    }
  }
  return refs;
}

function buildPsalmsProverbs(books){
  // Psalms book in most datasets is 19, Proverbs 20 (Bible order)
  const ps = books.find(b => normalize(b.name).includes("psaume") || b.book === 19);
  const pr = books.find(b => normalize(b.name).includes("proverbe") || b.book === 20);

  const list = [];
  if (ps){
    for (const c of ps.chapters) list.push({ book: ps.book, bookName: ps.name, bookSlug: ps.slug, chapter: c, track: "ps" });
  }
  if (pr){
    for (const c of pr.chapters) list.push({ book: pr.book, bookName: pr.name, bookSlug: pr.slug, chapter: c, track: "pr" });
  }

  // We will interleave Psalms and Proverbs (1 psalm, 1 proverb, repeat),
  // then remaining Psalms if one ends.
  const psRefs = ps ? ps.chapters.map(c => ({ book: ps.book, bookName: ps.name, bookSlug: ps.slug, chapter: c })) : [];
  const prRefs = pr ? pr.chapters.map(c => ({ book: pr.book, bookName: pr.name, bookSlug: pr.slug, chapter: c })) : [];

  const merged = [];
  let i=0, j=0;
  while (i < psRefs.length || j < prRefs.length){
    if (i < psRefs.length) merged.push(psRefs[i++]);
    if (j < prRefs.length) merged.push(prRefs[j++]);
  }
  return merged;
}

function buildPlan365(DB){
  const books = bookOrderFromDB(DB);

  // Typical Bible numbering: 1..39 OT, 40..66 NT
  const ot = buildChapterRefs(books, 1, 39);
  const nt = buildChapterRefs(books, 40, 66);
  const pspr = buildPsalmsProverbs(books);

  // We make 365 days:
  // - 2 OT chapters/day (most days)
  // - 1 NT chapter/day
  // - Psalms/Proverbs every other day (to keep 3-4 chapters/day)
  //
  // We’ll cycle through OT/NT sequentially; for ps/pr we add on even days until it ends.

  const plan = [];
  let iOT = 0, iNT = 0, iPP = 0;

  for (let day=0; day<365; day++){
    const items = [];

    // OT: 2 chapters/day until exhausted; then 1 if near end
    if (iOT < ot.length) items.push(ot[iOT++]);
    if (iOT < ot.length) items.push(ot[iOT++]);

    // NT: 1 chapter/day
    if (iNT < nt.length) items.push(nt[iNT++]);

    // Add Psalm/Proverb every 2 days (day 0,2,4...) to not overload
    if (day % 2 === 0 && iPP < pspr.length){
      items.push(pspr[iPP++]);
    }

    // If OT/NT ended early (rare with custom datasets), continue from remaining lists
    // Keep 3 items minimum if possible:
    while (items.length < 3){
      if (iOT < ot.length) items.push(ot[iOT++]);
      else if (iNT < nt.length) items.push(nt[iNT++]);
      else if (iPP < pspr.length) items.push(pspr[iPP++]);
      else break;
    }

    plan.push({ day, items });
  }

  return plan;
}

function linkFor(ref){
  return `/${ref.bookSlug}/${ref.chapter}`;
}

function labelFor(ref){
  return `${ref.bookName} ${ref.chapter}`;
}

function renderToday(plan, dayIndex, startDateStr){
  const today = plan[dayIndex];
  if (!today) return;

  const done = isDone(dayIndex);
  $("doneHint").textContent = done ? "✅ Déjà marqué comme lu" : "";

  const rows = today.items.map(ref => {
    const href = linkFor(ref);
    return `
      <div class="card" style="padding:12px;margin-top:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div style="font-weight:900;">${escapeHTML(labelFor(ref))}</div>
          <a class="btn btn-secondary" href="${href}">Lire</a>
        </div>
        <div style="color:var(--muted);font-size:13px;margin-top:6px;">
          Lien : <span style="word-break:break-all;">https://labible.app${href}</span>
        </div>
      </div>
    `;
  }).join("");

  const startDate = new Date(startDateStr + "T00:00:00");
  const todayDate = new Date();
  const dayNumber = dayIndex + 1;

  $("todayLabel").textContent = `Jour ${dayNumber} sur 365 • Début : ${fmtDate(startDate)} • Aujourd’hui : ${fmtDate(todayDate)}`;
  $("todayBox").innerHTML = rows;
}

function renderPlanList(plan){
  // Compact list: show 365 lines, each line: Day X + 3-4 links + done checkbox indicator
  const html = plan.map(d => {
    const done = isDone(d.day);
    const items = d.items.map(ref => {
      const href = linkFor(ref);
      return `<a href="${href}">${escapeHTML(labelFor(ref))}</a>`;
    }).join(" • ");

    return `
      <div style="padding:10px 0;border-top:1px solid var(--border);display:flex;gap:10px;align-items:flex-start;">
        <div style="min-width:92px;font-weight:900;color:${done ? "var(--primary)" : "var(--muted)"};">
          ${done ? "✅" : "⬜"} Jour ${d.day + 1}
        </div>
        <div style="flex:1;line-height:1.55;">
          ${items}
        </div>
      </div>
    `;
  }).join("");

  $("planList").innerHTML = html;
}

function updateProgress(){
  const done = countDone();
  const pct = Math.max(0, Math.min(100, Math.round((done / 365) * 100)));
  $("progressText").textContent = `${done} / 365`;
  $("progressBar").style.width = `${pct}%`;
}

function initButtons(plan){
  $("btnStart").onclick = () => {
    const st = ensureState();
    if (!st.startDate){
      st.startDate = fmtDate(new Date());
      st.doneDays = {};
      saveState(st);
    }
    location.reload();
  };

  $("btnReset").onclick = () => {
    const ok = confirm("Réinitialiser le plan (progression supprimée) ?");
    if (!ok) return;
    clearState();
    location.reload();
  };

  $("btnMarkDone").onclick = () => {
    const st = ensureState();
    if (!st.startDate){
      alert("Cliquez d’abord sur “Commencer aujourd’hui”.");
      return;
    }
    const start = new Date(st.startDate + "T00:00:00");
    const today = new Date();
    let dayIndex = daysBetween(start, today);
    if (dayIndex < 0) dayIndex = 0;
    if (dayIndex > 364) dayIndex = 364;

    markDone(dayIndex, true);
    updateProgress();
    renderPlanList(plan);
    renderToday(plan, dayIndex, st.startDate);
  };

  $("btnUnmarkDone").onclick = () => {
    const st = ensureState();
    if (!st.startDate) return;
    const start = new Date(st.startDate + "T00:00:00");
    const today = new Date();
    let dayIndex = daysBetween(start, today);
    if (dayIndex < 0) dayIndex = 0;
    if (dayIndex > 364) dayIndex = 364;

    markDone(dayIndex, false);
    updateProgress();
    renderPlanList(plan);
    renderToday(plan, dayIndex, st.startDate);
  };
}

async function main(){
  const DB = await loadJSON("/data/segond_1910.json");
  const plan = buildPlan365(DB);

  const st = ensureState();

  if (!st.startDate){
    $("todayLabel").textContent = "Cliquez sur “Commencer aujourd’hui” pour démarrer.";
    $("todayBox").innerHTML = `
      <div class="card" style="padding:12px;margin-top:10px;">
        <div style="font-weight:900;">🚀 Prêt ?</div>
        <div style="color:var(--muted);margin-top:6px;">
          Votre progression sera enregistrée sur votre appareil.
        </div>
      </div>
    `;
  } else {
    const start = new Date(st.startDate + "T00:00:00");
    const today = new Date();
    let dayIndex = daysBetween(start, today);
    if (dayIndex < 0) dayIndex = 0;
    if (dayIndex > 364) dayIndex = 364;
    renderToday(plan, dayIndex, st.startDate);
  }

  initButtons(plan);
  renderPlanList(plan);
  updateProgress();
}

main().catch(err => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:red;white-space:pre-wrap">${escapeHTML(err.message)}</pre>`;
});