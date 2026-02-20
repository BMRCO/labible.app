/* app.js — LaBible.app
   Global layout rules:
   - No top links (remove any header nav / top nav remnants)
   - Clickable logo -> home
   - Footer-only navigation injected on every page
*/

(() => {
  "use strict";

  // Small helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function safeRemoveTopNav() {
    // Remove common top navigation containers (legacy)
    const selectors = [
      "header nav",
      ".top-nav",
      ".navbar",
      ".header-links",
      ".top-links",
      "header .links",
      "header .menu",
    ];
    selectors.forEach((sel) => $$(sel).forEach((el) => el.remove()));
  }

  function makeLogoClickable() {
    // Tries multiple selectors (works even if HTML differs a bit)
    const logo =
      $("#logo") ||
      $(".logo") ||
      $('img[alt*="Bible"]') ||
      $('img[alt*="Bíblia"]') ||
      $('img[alt*="LaBible"]') ||
      $('img[alt*="LSG"]');

    if (!logo) return;

    // If already inside a link, do nothing
    if (logo.closest("a")) return;

    const link = document.createElement("a");
    link.href = "index.html";
    link.setAttribute("aria-label", "Retour à l’accueil");
    link.className = "logo-link";

    // Wrap logo
    const parent = logo.parentNode;
    parent.insertBefore(link, logo);
    link.appendChild(logo);
  }

  function injectFooter() {
    if ($("footer.site-footer")) return;

    const footer = document.createElement("footer");
    footer.className = "site-footer";

    footer.innerHTML = `
      <nav class="footer-inner" aria-label="Navigation">
        <a class="footer-link" href="index.html">Accueil</a>
        <a class="footer-link" href="plan.html">Plan</a>
        <a class="footer-link" href="a-propos.html">À propos</a>
        <a class="footer-link" href="contact.html">Contact</a>
        <a class="footer-link" href="mentions-legales.html">Mentions</a>
      </nav>

      <div class="footer-sub" aria-label="Informations">
        <span>LaBible.app</span>
        <span class="dot">•</span>
        <span>LSG 1910</span>
        <span class="dot">•</span>
        <span>${new Date().getFullYear()}</span>
      </div>
    `;

    document.body.appendChild(footer);

    // Add body padding so content is not hidden behind fixed footer
    document.documentElement.style.setProperty("--footer-safe", "92px");
    document.body.classList.add("has-footer");
  }

  function enhanceCopyBehavior() {
    // You asked: "Melhor ser só selecionar o texto e copiar colar."
    // This doesn't block selection; it only adds a tiny UX improvement:
    // double-click on a verse element can auto-select, if you use data-verse.
    // (Safe: does nothing if elements don't exist.)
    $$(".verse,[data-verse]").forEach((el) => {
      el.style.userSelect = "text";
      el.addEventListener("dblclick", () => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      });
    });
  }

  function registerServiceWorker() {
    // Optional: keeps your PWA ready. Safe if sw.js exists.
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("sw.js")
      .catch(() => {
        // silent
      });
  }

  function run() {
    safeRemoveTopNav();
    makeLogoClickable();
    injectFooter();
    enhanceCopyBehavior();
    registerServiceWorker();

    // ---------------------------------------------------------
    // YOUR EXISTING CODE HERE (paste your previous app.js logic)
    // ---------------------------------------------------------
    // Example:
    // if (window.initHome) window.initHome();
    // if (window.initSearch) window.initSearch();
    // ---------------------------------------------------------
  }

  document.addEventListener("DOMContentLoaded", run);
})();
