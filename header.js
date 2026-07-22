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
    '.topActions .chip{padding:7px 12px;font-size:12.5px;border-radius:10px;}';

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
        '<a class="chip" href="/" title="Lecture">📖 Lire</a>' +
        '<button id="btnTheme" class="iconBtn" title="Thème" aria-label="Changer de thème"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"/></svg></button>' +
      '</div>' +
    '</header>' +
  '</div>';

  function mount() {
    if (!document.getElementById('lb-topbar-css')) {
      var st = document.createElement('style');
      st.id = 'lb-topbar-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    var slot = document.getElementById('lb-topbar');
    if (slot) slot.innerHTML = HTML;

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
