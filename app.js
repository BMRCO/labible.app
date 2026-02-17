function render(bookNum, chapNum, opts = { updateURL: true }) {
  CURRENT.book = bookNum;
  CURRENT.chapter = chapNum;

  const bookObj = books.find(b => b.book === bookNum);
  const bookName = bookObj?.name || "";
  const bookSlug = bookObj?.slug || "";

  $("title").textContent = `${bookName} ${chapNum}`;

  const verses = DB.verses
    .filter(v => v.book === bookNum && v.chapter === chapNum)
    .sort((a, b) => a.verse - b.verse);

  $("content").innerHTML = verses.map(v => {
    const vid = `v${v.verse}`;
    return `
      <p id="${vid}">
        <b>${v.verse}</b>
        ${escapeHTML(v.text)}
        <button class="sharebtn" data-share="${bookSlug}:${chapNum}:${v.verse}" title="Partager">🔗</button>
      </p>
    `;
  }).join("");

  // atualizar URL do capítulo
  if (opts.updateURL) updateUrl(bookNum, chapNum);

  // clique compartilhar
  $("content").querySelectorAll("[data-share]").forEach(btn => {
    btn.onclick = async () => {
      const [slug, c, vv] = btn.getAttribute("data-share").split(":");
      const url = `${location.origin}/${slug}/${c}#v${vv}`;

      try {
        if (navigator.share) {
          await navigator.share({ title: "La Bible", text: `${bookName} ${c}:${vv}`, url });
        } else {
          await navigator.clipboard.writeText(url);
          alert("Lien copié ✅");
        }
      } catch {
        // fallback: copiar
        try {
          await navigator.clipboard.writeText(url);
          alert("Lien copié ✅");
        } catch {
          prompt("Copiez le lien :", url);
        }
      }
    };
  });

  // se vier com hash #vX, rolar para o versículo
  if (location.hash && location.hash.startsWith("#v")) {
    const el = document.querySelector(location.hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
