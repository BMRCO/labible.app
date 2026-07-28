#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère les pages SEO par chapitre : labible.app/lsg/{livre}/{chapitre}

Usage : python generate_chapter_pages.py
Lit   : data/lsg1910.json
Écrit : lsg/{livre-slug}/{chapitre}.html  (1 189 fichiers)
        sitemap.xml (mis à jour avec les nouvelles URLs)

Conçu pour tourner via GitHub Actions (workflow_dispatch), mais fonctionne
aussi en local. Ne modifie aucun autre fichier du site.
"""
import json
import os
import re
import unicodedata
from html import escape as _esc

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(ROOT, "data", "lsg1910.json")
OUT_DIR = os.path.join(ROOT, "lsg")
SITEMAP_PATH = os.path.join(ROOT, "sitemap.xml")
BASE_URL = "https://labible.app"


def slugify(name: str) -> str:
    s = unicodedata.normalize("NFD", name)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower().replace(" ", "-")
    s = re.sub(r"[^a-z0-9-]", "", s)
    return s


def load_bible():
    """Retourne (books_order, chapters) où chapters est une liste ordonnée de
    dicts {book, book_slug, chapter, verses: [texte...]}."""
    with open(DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)["verses"]

    books_order = []
    chapters_map = {}  # (book, chapter) -> [texte,...] (index 0 = verset 1)
    for v in data:
        b, c, vn, t = v["book_name"], v["chapter"], v["verse"], v["text"]
        if b not in books_order:
            books_order.append(b)
        key = (b, c)
        lst = chapters_map.setdefault(key, [])
        while len(lst) < vn:
            lst.append(None)
        lst[vn - 1] = t

    chapters = []
    for b in books_order:
        # nombre de chapitres pour ce livre
        chap_nums = sorted({c for (bb, c) in chapters_map if bb == b})
        for c in chap_nums:
            chapters.append({
                "book": b,
                "book_slug": slugify(b),
                "chapter": c,
                "verses": chapters_map[(b, c)],
            })
    return books_order, chapters


def clean_verse(t):
    if t is None:
        return ""
    return str(t).replace("¶", "").strip()


PAGE_TEMPLATE = """<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>{title}</title>
  <meta name="description" content="{description}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="{canonical}" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{description}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="{canonical}" />
  <meta property="og:image" content="https://labible.app/icons/icon-512x512.png" />
  <meta property="og:locale" content="fr_FR" />
  <meta name="theme-color" content="#0b0b0b" />
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="icon" href="/icons/icon-192x192.png">
  <link rel="apple-touch-icon" href="/icons/icon-192x192.png">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="stylesheet" href="/styles.css?v=4" />
  <style>
    .stickyHeader {{ position: sticky; top: 0; z-index: 95; background: var(--bg, #0b0b0b); }}
    .stickyHeader .topbar {{ position: relative !important; }}
    .brandDot {{ color: var(--gold); font-weight: 700; }}
    .pageContent {{ font-family: ui-serif, Georgia, "Times New Roman", serif; line-height: 1.78; }}
    .backLink {{ display:inline-block; font-size: 13px; margin-bottom: 14px; text-decoration:none; }}
    .breadcrumb {{ font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12.5px; color: var(--muted); margin: 0 0 10px; }}
    .breadcrumb a {{ color: var(--muted); text-decoration: none; border-bottom: 1px solid color-mix(in srgb, var(--text) 20%, transparent); }}
    .chapterH1 {{ font-size: 30px; margin: 0 0 16px; }}
    .verses p.verse {{ cursor: default; }}
    .chapNav {{ display:flex; justify-content:space-between; gap:10px; margin: 22px 0 6px; }}
    .chapNav a {{ flex:1; text-align:center; padding: 12px 10px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--text) 10%, transparent); background: color-mix(in srgb, var(--text) 3%, transparent); color: var(--text); text-decoration:none; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 13.5px; font-weight: 700; }}
    .chapNav a:hover {{ border-color: color-mix(in srgb, var(--gold) 40%, transparent); background: color-mix(in srgb, var(--gold) 7%, transparent); }}
    .chapNav .disabled {{ opacity: .35; pointer-events: none; }}
    .ctaRead {{ display:inline-block; margin: 18px 0 4px; padding: 12px 18px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--gold) 40%, transparent); background: color-mix(in srgb, var(--gold) 12%, transparent); color: var(--text); font-weight: 700; text-decoration: none; font-family: ui-sans-serif, system-ui, sans-serif; }}
    .ctaRead:hover {{ background: color-mix(in srgb, var(--gold) 18%, transparent); }}
  </style>
  <script>
    (function(){{ try {{ var t = localStorage.getItem('labible:theme') === 'light' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', t); }} catch(e){{}} }})();
  </script>
  <script src="/footer.js" defer></script>
  <script src="/header.js" defer></script>
  <script type="application/ld+json">
  {jsonld}
  </script>
</head>
<body>

  <div id="lb-topbar"></div>

  <main class="container">
    <article class="card pageContent">
      <p class="breadcrumb"><a href="/">Accueil</a> › <a href="/lsg/{book_slug}/1">{book}</a> › {chapter}</p>
      <a class="backLink muted" href="/#{book_anchor}-{chapter}">← Ouvrir dans l'application</a>

      <h1 class="chapterH1">{book} {chapter}</h1>

      <div class="verses">
{verses_html}
      </div>

      <div class="chapNav">
        <a href="{prev_href}" class="{prev_class}">← {prev_label}</a>
        <a href="{next_href}" class="{next_class}">{next_label} →</a>
      </div>

      <p><a class="ctaRead" href="/#{book_anchor}-{chapter}">📖 Lire dans l'application, avec recherche et favoris</a></p>
    </article>

    <div id="lb-footer"></div>
  </main>

  <script>
    (function(){{
      var btn = document.getElementById('btnTheme');
      function sync(){{ var t = document.documentElement.getAttribute('data-theme') || 'dark'; if (btn) btn.textContent = t === 'light' ? '☀️' : '🌙'; }}
      sync();
      if (btn) btn.addEventListener('click', function(){{
        var cur = document.documentElement.getAttribute('data-theme') || 'dark';
        var nxt = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nxt);
        try {{ localStorage.setItem('labible:theme', nxt); }} catch(e){{}}
        sync();
      }});
    }})();
  </script>
  <script>
    if ('serviceWorker' in navigator) {{ window.addEventListener('load', function () {{ navigator.serviceWorker.register('/sw.js').catch(function(){{}}); }}); }}
  </script>
</body>
</html>
"""


def build_page(entry, prev_entry, next_entry):
    book, chapter, verses = entry["book"], entry["chapter"], entry["verses"]
    book_slug = entry["book_slug"]
    canonical = f"{BASE_URL}/lsg/{book_slug}/{chapter}"

    clean_verses = [clean_verse(t) for t in verses]
    n_verses = sum(1 for t in clean_verses if t)
    first_words = " ".join(clean_verses[0].split()[:16]) if clean_verses and clean_verses[0] else ""
    description = f"Lisez {book} chapitre {chapter} ({n_verses} versets) de la Bible Louis Segond 1910, gratuitement et sans publicité. « {first_words}… »"
    title = f"{book} {chapter} — Bible Louis Segond 1910 | LaBible.app"

    verses_lines = []
    for i, t in enumerate(clean_verses):
        if not t:
            continue
        verses_lines.append(
            f'        <p class="verse"><span class="vnum">{i + 1}</span> {_esc(t)}</p>'
        )
    verses_html = "\n".join(verses_lines)

    if prev_entry:
        prev_href = f"/lsg/{prev_entry['book_slug']}/{prev_entry['chapter']}"
        prev_label = f"{prev_entry['book']} {prev_entry['chapter']}"
        prev_class = ""
    else:
        prev_href = "#"
        prev_label = "Début de la Bible"
        prev_class = "disabled"

    if next_entry:
        next_href = f"/lsg/{next_entry['book_slug']}/{next_entry['chapter']}"
        next_label = f"{next_entry['book']} {next_entry['chapter']}"
        next_class = ""
    else:
        next_href = "#"
        next_label = "Fin de la Bible"
        next_class = "disabled"

    jsonld = json.dumps({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Accueil", "item": BASE_URL + "/"},
            {"@type": "ListItem", "position": 2, "name": book, "item": f"{BASE_URL}/lsg/{book_slug}/1"},
            {"@type": "ListItem", "position": 3, "name": f"{book} {chapter}", "item": canonical},
        ],
    }, ensure_ascii=False)

    # ancre utilisee par le lien profond de l'app (#Livre-Chapitre) ; le nom du
    # livre y est utilise tel quel (avec accents), comme dans app.v2.js.
    book_anchor = book

    return PAGE_TEMPLATE.format(
        title=_esc(title),
        description=_esc(description),
        canonical=canonical,
        book=_esc(book),
        book_slug=book_slug,
        book_anchor=book_anchor,
        chapter=chapter,
        verses_html=verses_html,
        prev_href=prev_href, prev_label=_esc(prev_label), prev_class=prev_class,
        next_href=next_href, next_label=_esc(next_label), next_class=next_class,
        jsonld=jsonld,
    )


INDEX_TEMPLATE = """<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>Lire la Bible par livre et par chapitre — LSG 1910 | LaBible.app</title>
  <meta name="description" content="Tous les livres de la Bible Louis Segond 1910, classes par chapitre. Lisez gratuitement Genese, Psaumes, Jean, Romains et les 66 livres de la Bible en ligne." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="{base_url}/lsg/" />
  <meta property="og:title" content="Lire la Bible par livre et par chapitre — LaBible.app" />
  <meta property="og:description" content="Tous les livres de la Bible Louis Segond 1910, classes par chapitre." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="{base_url}/lsg/" />
  <meta property="og:image" content="https://labible.app/icons/icon-512x512.png" />
  <meta property="og:locale" content="fr_FR" />
  <meta name="theme-color" content="#0b0b0b" />
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="icon" href="/icons/icon-192x192.png">
  <link rel="apple-touch-icon" href="/icons/icon-192x192.png">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="stylesheet" href="/styles.css?v=4" />
  <style>
    .stickyHeader {{ position: sticky; top: 0; z-index: 95; background: var(--bg, #0b0b0b); }}
    .stickyHeader .topbar {{ position: relative !important; }}
    .brandDot {{ color: var(--gold); font-weight: 700; }}
    .pageContent {{ font-family: ui-serif, Georgia, "Times New Roman", serif; line-height: 1.78; }}
    .bookGrid {{ display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 6px 0 4px; }}
    @media (min-width:560px){{ .bookGrid {{ grid-template-columns: 1fr 1fr 1fr; }} }}
    .bookGrid a {{ display:block; padding: 11px 13px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--text) 10%, transparent); background: color-mix(in srgb, var(--text) 3%, transparent); color: var(--text); text-decoration:none; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 14px; font-weight: 600; }}
    .bookGrid a:hover {{ border-color: color-mix(in srgb, var(--gold) 40%, transparent); background: color-mix(in srgb, var(--gold) 7%, transparent); }}
    .testGroup {{ font-family: ui-sans-serif, system-ui, sans-serif; text-transform: uppercase; letter-spacing: .18em; font-size: 12px; font-weight: 700; color: var(--gold); margin: 26px 0 8px; }}
  </style>
  <script>
    (function(){{ try {{ var t = localStorage.getItem('labible:theme') === 'light' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', t); }} catch(e){{}} }})();
  </script>
  <script src="/footer.js" defer></script>
  <script src="/header.js" defer></script>
</head>
<body>

  <div id="lb-topbar"></div>

  <main class="container">
    <article class="card pageContent">
      <a class="backLink muted" href="/" style="display:inline-block;font-size:13px;margin-bottom:14px;text-decoration:none;">← Retour à la lecture</a>

      <h1 style="font-size:30px;margin:0 0 8px;">Lire la Bible par chapitre</h1>
      <p style="color:var(--muted);font-size:15px;margin:0 0 6px;">Les 66 livres de la Bible Louis Segond 1910, chapitre par chapitre. Choisissez un livre pour commencer au chapitre 1.</p>

      <p class="testGroup">Ancien Testament</p>
      <div class="bookGrid">
{ot_links}
      </div>

      <p class="testGroup">Nouveau Testament</p>
      <div class="bookGrid">
{nt_links}
      </div>
    </article>

    <div id="lb-footer"></div>
  </main>

  <script>
    (function(){{
      var btn = document.getElementById('btnTheme');
      function sync(){{ var t = document.documentElement.getAttribute('data-theme') || 'dark'; if (btn) btn.textContent = t === 'light' ? '☀️' : '🌙'; }}
      sync();
      if (btn) btn.addEventListener('click', function(){{
        var cur = document.documentElement.getAttribute('data-theme') || 'dark';
        var nxt = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nxt);
        try {{ localStorage.setItem('labible:theme', nxt); }} catch(e){{}}
        sync();
      }});
    }})();
  </script>
  <script>
    if ('serviceWorker' in navigator) {{ window.addEventListener('load', function () {{ navigator.serviceWorker.register('/sw.js').catch(function(){{}}); }}); }}
  </script>
</body>
</html>
"""

# Les 39 premiers livres de la Bible (dans l'ordre) sont l'Ancien Testament,
# les 27 suivants le Nouveau Testament.
OT_COUNT = 39


def build_index_page(books_order, book_slugs):
    ot = books_order[:OT_COUNT]
    nt = books_order[OT_COUNT:]
    ot_links = "\n".join(
        f'        <a href="/lsg/{book_slugs[b]}/1">{_esc(b)}</a>' for b in ot
    )
    nt_links = "\n".join(
        f'        <a href="/lsg/{book_slugs[b]}/1">{_esc(b)}</a>' for b in nt
    )
    return INDEX_TEMPLATE.format(base_url=BASE_URL, ot_links=ot_links, nt_links=nt_links)


def build_sitemap_entries(chapters):
    urls = [f"  <url><loc>{BASE_URL}/lsg/</loc><changefreq>monthly</changefreq></url>"]
    for e in chapters:
        urls.append(f"  <url><loc>{BASE_URL}/lsg/{e['book_slug']}/{e['chapter']}</loc><changefreq>monthly</changefreq></url>")
    return urls


def main():
    books_order, chapters = load_bible()
    print(f"{len(books_order)} livres, {len(chapters)} chapitres a generer")

    os.makedirs(OUT_DIR, exist_ok=True)
    written = 0
    for i, entry in enumerate(chapters):
        prev_entry = chapters[i - 1] if i > 0 else None
        next_entry = chapters[i + 1] if i < len(chapters) - 1 else None
        html = build_page(entry, prev_entry, next_entry)
        book_dir = os.path.join(OUT_DIR, entry["book_slug"])
        os.makedirs(book_dir, exist_ok=True)
        path = os.path.join(book_dir, f"{entry['chapter']}.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        written += 1

    print(f"{written} pages ecrites dans {OUT_DIR}/")

    # --- page d'index /lsg/ : liste des 66 livres, un lien vers le site ---
    book_slugs = {b: slugify(b) for b in books_order}
    index_html = build_index_page(books_order, book_slugs)
    with open(os.path.join(OUT_DIR, "index.html"), "w", encoding="utf-8") as f:
        f.write(index_html)
    print("page d'index lsg/index.html ecrite (liens vers les 66 livres)")

    # --- sitemap.xml : garde les URLs existantes, ajoute les nouvelles ---
    if os.path.exists(SITEMAP_PATH):
        existing = open(SITEMAP_PATH, encoding="utf-8").read()
        existing_locs = set(re.findall(r"<loc>(.*?)</loc>", existing))
    else:
        existing = None
        existing_locs = set()

    new_urls = build_sitemap_entries(chapters)
    new_locs_added = [u for u in new_urls if re.search(r"<loc>(.*?)</loc>", u).group(1) not in existing_locs]

    if existing and "</urlset>" in existing:
        merged = existing.replace("</urlset>", "\n".join(new_locs_added) + "\n</urlset>")
    else:
        header = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        merged = header + "\n".join(new_urls) + "\n</urlset>\n"

    with open(SITEMAP_PATH, "w", encoding="utf-8") as f:
        f.write(merged)

    total_urls = len(re.findall(r"<loc>", merged))
    print(f"sitemap.xml atualizado: {total_urls} URLs no total ({len(new_locs_added)} novas)")


if __name__ == "__main__":
    main()
