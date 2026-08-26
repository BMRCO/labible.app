/* =========================================================
   LaBible.app — topbar partilhada das páginas de conteúdo
   Cada página de conteúdo tem apenas: <div id="lb-topbar"></div>
   Editar este ficheiro = atualizar a topbar (logo, etc.) em
   TODAS as páginas de conteúdo ao mesmo tempo.
   (A homepage tem a sua própria topbar — não usa este ficheiro.)
   ========================================================= */
(function () {
  var CSS =
    '.stickyHeader{position:sticky;top:0;z-index:95;background:var(--bg,#0b0b0b);}' +
    '.stickyHeader .topbar{position:relative !important;}' +
    '.brandDot{color:var(--gold);font-weight:700;}' +
    '.topActions .chip{padding:7px 12px;font-size:12.5px;border-radius:10px;}' +
    /* barre de recherche partagée — identique à la page principale */
    '.lbSearch{padding:8px 16px 6px;border-bottom:1px solid color-mix(in srgb,var(--text) 8%,transparent);}' +
    '.lbSearchInner{position:relative;display:flex;gap:8px;align-items:center;}' +
    '.lbSearchInner .gsIcon{position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px;opacity:.35;pointer-events:none;}' +
    '.lbSearchInner input{flex:1;padding:9px 36px;background:color-mix(in srgb,var(--text) 6%,transparent);' +
      'border:1px solid color-mix(in srgb,var(--gold) 30%,transparent);border-radius:10px;color:var(--text);' +
      'font-size:13px;font-family:inherit;outline:none;transition:border-color .2s;}' +
    '.lbSearchInner input:focus{border-color:color-mix(in srgb,var(--gold) 55%,transparent);}' +
    '.lbSearchInner input::placeholder{color:var(--muted2);}' +
    '.lbSearchInner button{padding:9px 16px;border-radius:10px;border:none;cursor:pointer;font-family:inherit;' +
      'font-weight:700;font-size:13px;background:var(--accent,#c9a640);color:var(--accentText,#0b0b0b);white-space:nowrap;flex-shrink:0;}' +
    /* onglets partagés — même enveloppe que la page principale (.tabsWrap) */
    '.tabsWrap{padding:8px 14px;background:var(--bg,#0b0b0b);border-bottom:1px solid rgba(226,197,122,0.12);}' +
    '.tabsWrap .tabs{max-width:980px;margin:6px auto 0;box-shadow:none;}' +
    '.stickyHeader .tabs{overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;}' +
    '.stickyHeader .tabs::-webkit-scrollbar{display:none;}' +
    '.stickyHeader .tab{flex:1 0 auto;white-space:nowrap;text-align:center;text-decoration:none;' +
      'display:flex;align-items:center;justify-content:center;}';

  var HTML = '' +
  '<div class="stickyHeader">' +
    '<header class="topbar">' +
      '<a class="brand" href="/" title="Accueil">' +
        '<img src="/icons/icon-512x512.png" class="brandIcon" width="44" height="44" alt="LaBible.app" style="border-radius:9px;object-fit:cover;width:44px;height:44px;min-width:44px;max-width:44px;" />' +
        '<div class="brandText">' +
          '<div class="brandTitle">LaBible<span class="brandDot">.app</span></div>' +
          '<div class="brandSub">LSG 1910</div>' +
        '</div>' +
      '</a>' +
      '<div class="topActions">' +
        '<button id="btnTheme" class="iconBtn" title="Thème" aria-label="Changer de thème"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/></svg></button>' +
      '</div>' +
    '</header>' +
    '<div class="lbSearch"><div class="lbSearchInner">' +
      '<span class="gsIcon">\uD83D\uDD0D</span>' +
      '<input id="lbSearchInput" type="text" placeholder="Rechercher un verset, mot clé\u2026 (ex : Jean 3:16)" autocomplete="off" />' +
      '<button id="lbSearchBtn" type="button">Rechercher</button>' +
    '</div></div>' +
    '<div class="tabsWrap">' +
    '<nav class="tabs" aria-label="Navigation">' +
      '<a class="tab" href="/">Lecture</a>' +
      '<a class="tab" href="/#plan">Plan</a>' +
      '<a class="tab" href="/#bibliotheque">Biblioth\u00e8que</a>' +
      '<a class="tab" id="lbTabVersets" href="/versets">Versets</a>' +
    '</nav>' +
    '</div>' +
  '</div>';

  function mount() {
    if (!document.getElementById('lb-topbar-css')) {
      var st = document.createElement('style');
      st.id = 'lb-topbar-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    var slot = document.getElementById('lb-topbar');
    if (slot) {
      slot.innerHTML = HTML;
      /* hauteur reservee en CSS pour eviter le CLS : liberee une fois
         la barre injectee, pour ne pas laisser d'espace superflu. */
      slot.style.minHeight = '0';
    }

    /* recherche : renvoie vers la page de lecture qui exécute la requête */
    var sInput = document.getElementById('lbSearchInput');
    var sBtn = document.getElementById('lbSearchBtn');
    function go() {
      var q = (sInput && sInput.value || '').trim();
      if (!q) return;
      window.location.href = '/#q=' + encodeURIComponent(q);
    }
    if (sBtn) sBtn.addEventListener('click', go);
    if (sInput) sInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });

    /* onglet actif selon la page */
    if (location.pathname.indexOf('/versets') === 0) {
      var tv = document.getElementById('lbTabVersets');
      if (tv) tv.classList.add('active');
    }

    var btn = document.getElementById('btnTheme');
    function sync(){ var t = document.documentElement.getAttribute('data-theme') || 'dark'; if (btn) btn.innerHTML = t === 'light' ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/></svg>'; }
    sync();
    if (btn) btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') || 'dark';
      var nxt = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nxt);
      try { localStorage.setItem('labible:theme', nxt); } catch (e) {}
      sync();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
