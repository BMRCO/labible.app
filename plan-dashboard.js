// plan-dashboard.js — Dashboard Premium (Plan 1 an) + chapitres réels
// Utilise /data/segond_1910.json et les routes /{bookSlug}/{chapter}

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
    .replace(/[^a-z0-9]+/g