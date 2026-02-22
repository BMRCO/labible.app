export function $(sel, root = document) {
  return root.querySelector(sel);
}
export function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function show(el) { el.hidden = false; }
export function hide(el) { el.hidden = true; }

export function setActiveSection(idsToShow) {
  const sections = ["hero", "quickNav", "reader", "search", "favorites", "plan", "vdd"];
  for (const id of sections) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.hidden = !idsToShow.includes(id);
  }
}

export function toast(text) {
  // small inline toast
  const t = document.createElement("div");
  t.textContent = text;
  t.style.position = "fixed";
  t.style.left = "50%";
  t.style.bottom = "18px";
  t.style.transform = "translateX(-50%)";
  t.style.padding = "10px 12px";
  t.style.borderRadius = "999px";
  t.style.border = "1px solid rgba(255,255,255,.14)";
  t.style.background = "rgba(0,0,0,.65)";
  t.style.color = "rgba(255,255,255,.92)";
  t.style.backdropFilter = "blur(8px)";
  t.style.zIndex = "9999";
  document.body.appendChild(t);
  setTimeout(() => { t.remove(); }, 1900);
}

export function renderResult({ ref, text, right = "" }) {
  const div = document.createElement("div");
  div.className = "result";
  div.innerHTML = `
    <div class="result__head">
      <div class="result__ref">${escapeHtml(ref)}</div>
      <div class="badge">${escapeHtml(right)}</div>
    </div>
    <div class="result__text">${escapeHtml(text)}</div>
  `;
  return div;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}