/* LaBible.app | LSG1910
   Mode actuel: Recherche + Plan (Lecture masquée temporairement)
   - Installer PWA
   - Recherche: mot-clé + référence (affiche juste la ref pour l’instant)
   - Plan 365 jours (localStorage) - basé sur une liste simple (placeholder)
   - SW minimal (sans offline)
*/

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  deferredPrompt: null,
};

const LS_KEYS = {
  plan: "labible:plan365",
};

function toast(msg){
  const el = $("#toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(()=> el.classList.remove("show"), 2200);
}

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function normalize(s){
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

/* -------------------------
   Views / Tabs
-------------------------- */
function setView(viewName){
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === viewName));
  $$(".view").forEach(v => v.classList.toggle("active", v.id === `view-${viewName}`));
  if(viewName === "search") $("#searchInput")?.focus();
}

function bindTabs(){
  $$(".tab").forEach(tab => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });
}

/* -------------------------
   Installer PWA
-------------------------- */
function bindInstallButton(){
  const btnInstall = $("#btnInstall");
  if(!btnInstall) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    btnInstall.hidden = false;
  });

  btnInstall.addEventListener("click", async () => {
    if(!state.deferredPrompt) return;

    btnInstall.disabled = true;
    try{
      state.deferredPrompt.prompt();
      await state.deferredPrompt.userChoice;
      state.deferredPrompt = null;
      btnInstall.hidden = true;
    } finally {
      btnInstall.disabled = false;
    }
  });

  window.addEventListener("appinstalled", () => {
    state.deferredPrompt = null;
    btnInstall.hidden = true;
    toast("Installé ✅");
  });
}

/* -------------------------
   Service Worker (no offline)
-------------------------- */
function registerSW(){
  if("serviceWorker" in navigator){
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(()=>{});
    });
  }
}

/* -------------------------
   Recherche
-------------------------- */
function bindSearch(){
  $("#btnSearch")?.addEventListener("click", doSearch);
  $("#searchInput")?.addEventListener("keydown", (e) => {
    if(e.key === "Enter") doSearch();
  });
}

function parseReference(input){
  // Exemple: "Jean 3:16" / "1 Jean 2:1"
  const s = normalize(input);
  if(!s) return null;

  const m = s.match(/(\d+)\s*(?::\s*(\d+))?\s*$/);
  if(!m) return null;

  const chap = parseInt(m[1], 10);
  const verse = m[2] ? parseInt(m[2], 10) : null;
  const bookPart = s.slice(0, m.index).trim();

  if(!bookPart) return null;
  return { bookPart, chap, verse };
}

function doSearch(){
  const qRaw = $("#searchInput").value || "";
  const q = normalize(qRaw);

  $("#searchResults").innerHTML = "";
  $("#searchMeta").textContent = "";

  if(!q){
    toast("Entrez un mot ou une référence.");
    return;
  }

  const ref = parseReference(qRaw);

  // Comme la lecture par livres n’est pas activée, on affiche un résultat simple
  if(ref){
    $("#searchMeta").textContent = "Référence détectée.";
    const refStr = `${ref.bookPart} ${ref.chap}${ref.verse ? ":" + ref.verse : ""}`;

    const div = document.createElement("div");
    div.className = "result";
    div.innerHTML = `
      <div class="resultRef">${escapeHtml(refStr)}</div>
      <div class="resultText">Lecture en cours d’activation. Pour l’instant, la recherche affiche la référence.</div>
    `;
    $("#searchResults").appendChild(div);
    return;
  }

  // Recherche mot-clé: placeholder
  $("#searchMeta").textContent = "Recherche mot-clé (en cours d’activation).";
  const div = document.createElement("div");
  div.className = "result";
  div.innerHTML = `
    <div class="resultRef">Mot-clé: ${escapeHtml(qRaw)}</div>
    <div class="resultText">La recherche complète sera activée quand les livres seront connectés.</div>
  `;
  $("#searchResults").appendChild(div);
}

/* -------------------------
   Plan de lecture (placeholder stable)
-------------------------- */
function getPlanState(){
  try{ return JSON.parse(localStorage.getItem(LS_KEYS.plan) || "null"); }
  catch { return null; }
}
function setPlanState(obj){
  localStorage.setItem(LS_KEYS.plan, JSON.stringify(obj));
}

function buildPlan365(){
  // Placeholder: 365 jours “Jour N”
  const plan = [];
  for(let d=1; d<=365; d++){
    plan.push({ day: d, label: `Jour ${d} — Lecture (à connecter aux livres)` });
  }
  return plan;
}

function todayPlanDay(createdAt){
  const created = new Date(createdAt);
  const now = new Date();
  const start = new Date(created.getFullYear(), created.getMonth(), created.getDate());
  const cur = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((cur - start) / (24*60*60*1000)) + 1;
  return clamp(diff, 1, 365);
}

function ensurePlan(){
  let st = getPlanState();
  if(!st || !Array.isArray(st.plan) || typeof st.doneDay !== "number"){
    st = { createdAt: Date.now(), doneDay: 0, plan: buildPlan365() };
    setPlanState(st);
  }
  return st;
}

function renderPlan(){
  const st = ensurePlan();
  const day = todayPlanDay(st.createdAt);
  const entry = st.plan[day - 1];

  $("#planTodayText").textContent = entry.label;

  const done = st.doneDay;
  $("#planTodayMeta").textContent = done >= day ? "✅ Déjà marqué comme lu." : `Progression actuelle : jour ${done} terminé.`;

  const pct = Math.round((done / 365) * 100);
  $("#progressFill").style.width = `${pct}%`;
  $("#progressText").textContent = `${pct}%`;

  $("#btnOpenToday").onclick = () => {
    toast("Lecture bientôt disponible.");
  };

  $("#btnMarkDone").onclick = () => {
    const curDay = todayPlanDay(st.createdAt);
    const cur = ensurePlan();
    if(cur.doneDay >= curDay){ toast("Déjà fait."); return; }
    cur.doneDay = curDay;
    setPlanState(cur);
    renderPlan();
    toast("Lecture marquée comme faite.");
  };

  $("#btnResetPlan").onclick = () => {
    localStorage.removeItem(LS_KEYS.plan);
    renderPlan();
    toast("Plan réinitialisé.");
  };

  $("#btnJumpDay").onclick = () => {
    const input = prompt("Aller à quel jour ? (1–365)");
    if(!input) return;
    const d = clamp(parseInt(input, 10) || 1, 1, 365);
    const st2 = ensurePlan();
    const e = st2.plan[d-1];
    toast(e.label);
  };
}

/* -------------------------
   Hero buttons
-------------------------- */
function bindHeroButtons(){
  $("#btnOpenSearch")?.addEventListener("click", () => setView("search"));
  $("#btnOpenPlan")?.addEventListener("click", () => setView("plan"));
  $("#btnHome")?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

/* -------------------------
   Init
-------------------------- */
function init(){
  $("#year").textContent = String(new Date().getFullYear());

  bindTabs();
  bindSearch();
  bindInstallButton();
  bindHeroButtons();
  registerSW();

  // Vue par défaut: Recherche
  setView("search");
  renderPlan();
}

init();
