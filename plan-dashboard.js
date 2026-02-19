// plan-dashboard.js — Dashboard Premium (Plan 1 an) + chapitres réels + filtre + partage
// Protegido: só roda se a página tiver os elementos do plano.

const $ = (id) => document.getElementById(id);

// ✅ Se não for a página do plano, não faz nada (evita erro no index)
if (!document.getElementById("btnStart") || !document.getElementById("planList")) {
  console.log("[plan-dashboard] Not on plan page -> skip");
} else {

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
    const a = Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate(), 12,0,0);
    const b = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate(), 12,0,0);
    return Math.floor((b - a) / 86400000);
  }

  /* ---------------- Storage ---------------- */
  const STORAGE = "labible_plan_dashboard_v4";
  // { startDate:"YYYY-MM-DD", doneDays:{}, filterNonLus:boolean }

  function getState(){
    try { return JSON.parse(localStorage.getItem(STORAGE)) || { startDate:null, doneDays:{}, filterNonLus:false }; }
    catch { return { startDate:null, doneDays:{}, filterNonLus:false }; }
  }
  function saveState(st){ localStorage.setItem(STORAGE, JSON.stringify(st)); }
  function resetState(){ localStorage.removeItem(STORAGE); }

  function isDone(dayIndex){
    const st = getState();
    return !!st.doneDays[String(dayIndex)];
  }
  function setDone(dayIndex, yes){
    const st = getState();
    if (!st.startDate) return;
    if (yes) st.doneDays[String(dayIndex)] = true;
    else delete st.doneDays[String(dayIndex)];
    saveState(st);
  }
  function countDone(){
    const st = getState();
    return Object.keys(st.doneDays || {}).length;
  }

  /* ---------------- Plan builder from DB ---------------- */
  function bookOrderFromDB(DB){
    const mapName = new Map();
    const mapChapters = new Map();

    for (const v of DB.verses){
      if (!mapName.has(v.book)) mapName.set(v.book, v.book_name);
      if (!mapChapters.has(v.book)) mapChapters.set(v.book, new Set());
      mapChapters.get(v.book).add(v.chapter);
    }

    return Array.from(mapName.entries())
      .map(([book, name]) => {
        const slug = slugifyBookName(name);
        const chapters = Array.from(mapChapters.get(book) || []).sort((a,b)=>a-b);
        return { book, name, slug, chapters };
      })
      .sort((a,b)=>a.book - b.book);
  }

  function buildChapterRefs(books, bookMin, bookMax){
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
    const ps = books.find(b => normalize(b.name).includes("psaume") || b.book === 19);
    const pr = books.find(b => normalize(b.name).includes("proverbe") || b.book === 20);

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
    const ot = buildChapterRefs(books, 1, 39);
    const nt = buildChapterRefs(books, 40, 66);
    const pspr = buildPsalmsProverbs(books);

    const plan = [];
    let iOT = 0, iNT = 0, iPP = 0;

    for (let day=0; day<365; day++){
      const items = [];

      if (iOT < ot.length) items.push(ot[iOT++]);
      if (iOT < ot.length) items.push(ot[iOT++]);

      if (iNT < nt.length) items.push(nt[iNT++]);

      if (day % 2 === 0 && iPP < pspr.length) items.push(pspr[iPP++]);

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

  function linkFor(ref){ return `/${ref.bookSlug}/${ref.chapter}`; }
  function labelFor(ref){ return `${ref.bookName} ${ref.chapter}`; }

  /* ---------------- Share ---------------- */
  async function shareToday(dayIndex, items){
    const dayNumber = dayIndex + 1;
    const lines = items.map(ref => `- ${labelFor(ref)}: ${location.origin}${linkFor(ref)}`).join("\n");
    const text = `📖 Plan de lecture (1 an) – Jour ${dayNumber}\n\n${lines}\n\nLaBible.app`;

    try {
      if (navigator.share) {
        await navigator.share({ title: `Plan de lecture – Jour ${dayNumber}`, text });
        return;
      }
    } catch (_) {}

    try {
      await navigator.clipboard.writeText(text);
      alert("Lecture du jour copiée ✅");
      return;
    } catch (_) {}

    prompt("Copiez le texte :", text);
  }

  /* ---------------- UI ---------------- */
  let PLAN = null;
  let TODAY_INDEX = 0;

  function computeTodayIndex(){
    const st = getState();
    if (!st.startDate) return 0;
    const start = new Date(st.startDate + "T00:00:00");
    const today = new Date();
    let idx = daysBetween(start, today);
    if (idx < 0) idx = 0;
    if (idx > 364) idx = 364;
    return idx;
  }

  function updateHeader(){
    const st = getState();
    $("btnFilter").textContent = st.filterNonLus ? "Afficher tout" : "Afficher non lus";

    if (!st.startDate){
      $("currentDay").textContent = "—";
      $("progressStats").textContent = "0 / 365";
      $("streakCount").textContent = "0 jours";
      $("progressBar").style.width = "0%";
      return;
    }

    TODAY_INDEX = computeTodayIndex();
    $("currentDay").textContent = `Jour ${TODAY_INDEX + 1}`;

    const done = countDone();
    $("progressStats").textContent = `${done} / 365`;
    $("progressBar").style.width = `${Math.round((done/365)*100)}%`;

    let streak = 0;
    for (let i = TODAY_INDEX; i >= 0; i--){
      if (isDone(i)) streak++;
      else break;
    }
    $("streakCount").textContent = `${streak} jours`;
  }

  function renderToday(){
    const st = getState();
    const box = $("todayBox");

    if (!st.startDate){
      box.innerHTML = `
        <div style="font-weight:900;font-size:16px;">🚀 Commencer</div>
        <div style="color:var(--muted);margin-top:6px;">
          Cliquez sur “Commencer aujourd’hui” pour démarrer le plan.
        </div>`;
      return;
    }

    const day = PLAN[TODAY_INDEX];
    const done = isDone(TODAY_INDEX);

    const cards = day.items.map(ref => {
      const href = linkFor(ref);
      return `
        <div class="card" style="padding:12px;margin-top:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div style="font-weight:900;">${escapeHTML(labelFor(ref))}</div>
            <a class="btn btn-secondary" href="${href}">Lire</a>
          </div>
          <div style="color:var(--muted);font-size:13px;margin-top:6px;">
            ${location.origin}${href}
          </div>
        </div>`;
    }).join("");

    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <div style="font-weight:900;font-size:16px;">📅 Lecture du jour</div>
          <div style="color:var(--muted);font-size:13px;margin-top:2px;">
            ${done ? "✅ Lu" : "⬜ Non lu"}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button id="btnShareToday" class="btn btn-secondary">📤 Partager</button>
          <button id="btnMarkToday" class="btn">${done ? "↩ Annuler" : "✅ Marquer comme lu"}</button>
        </div>
      </div>
      ${cards}
    `;

    $("btnMarkToday").onclick = () => {
      setDone(TODAY_INDEX, !done);
      updateHeader();
      renderToday();
      renderPlanList();
    };
    $("btnShareToday").onclick = () => shareToday(TODAY_INDEX, day.items);
  }

  function renderPlanList(){
    const st = getState();
    const el = $("planList");

    if (!st.startDate){
      el.innerHTML = `<div style="color:var(--muted);">Le plan apparaîtra après “Commencer aujourd’hui”.</div>`;
      return;
    }

    const days = st.filterNonLus ? PLAN.filter(d => !isDone(d.day)) : PLAN;

    el.innerHTML = (days.map(d => {
      const done = isDone(d.day);
      const items = d.items.map(ref => `<a href="${linkFor(ref)}">${escapeHTML(labelFor(ref))}</a>`).join(" • ");
      return `
        <div style="padding:10px 0;border-top:1px solid var(--border);display:flex;gap:10px;align-items:flex-start;">
          <div style="min-width:110px;font-weight:900;color:${done ? "var(--primary)" : "var(--muted)"};">
            ${done ? "✅" : "⬜"} Jour ${d.day + 1}
          </div>
          <div style="flex:1;line-height:1.55;">${items}</div>
        </div>`;
    }).join("")) || `<div style="color:var(--muted);padding:10px 0;">🎉 Tout est déjà marqué comme lu.</div>`;
  }

  function wireButtons(){
    $("btnStart").onclick = () => {
      const st = getState();
      if (!st.startDate){
        st.startDate = fmtDate(new Date());
        st.doneDays = {};
        st.filterNonLus = false;
        saveState(st);
      }
      updateHeader();
      renderToday();
      renderPlanList();
    };

    $("btnReset").onclick = () => {
      if (!confirm("Réinitialiser le plan (progression supprimée) ?")) return;
      resetState();
      updateHeader();
      renderToday();
      renderPlanList();
    };

    $("btnToday").onclick = () => $("todayBox").scrollIntoView({ behavior:"smooth", block:"start" });

    $("btnFilter").onclick = () => {
      const st = getState();
      st.filterNonLus = !st.filterNonLus;
      saveState(st);
      updateHeader();
      renderPlanList();
    };
  }

  async function main(){
    const DB = await loadJSON("/data/segond_1910.json");
    PLAN = buildPlan365(DB);
    TODAY_INDEX = computeTodayIndex();
    wireButtons();
    updateHeader();
    renderToday();
    renderPlanList();
  }

  main().catch(err => {
    console.error(err);
    document.body.innerHTML = `<pre style="color:red;white-space:pre-wrap">${escapeHTML(err.message)}</pre>`;
  });
}