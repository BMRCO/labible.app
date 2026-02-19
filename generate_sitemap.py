import json
from datetime import date
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "segond_1910.json"
OUT_PATH = ROOT / "sitemap.xml"

SITE = "https://labible.app"

def normalize(s: str) -> str:
  s = s.lower()
  s = unicodedata.normalize("NFD", s)
  s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
  return s

def slugify_book_name(name: str) -> str:
  s = normalize(name)
  s = s.replace("’", "").replace("'", "")
  s = re.sub(r"[^a-z0-9]+", "-", s)
  s = re.sub(r"-+", "-", s).strip("-")
  return s

def main():
  if not DATA_PATH.exists():
    raise SystemExit(f"Fichier introuvable: {DATA_PATH}")

  DB = json.loads(DATA_PATH.read_text(encoding="utf-8"))

  # book -> book_name
  book_name = {}
  # book -> set(chapters)
  chapters = {}

  for v in DB["verses"]:
    b = int(v["book"])
    c = int(v["chapter"])
    if b not in book_name:
      book_name[b] = v["book_name"]
    chapters.setdefault(b, set()).add(c)

  books = sorted(book_name.keys())
  today = date.today().isoformat()

  urls = []
  # Home + pages "fixas"
  urls.append(("/", "daily", "1.0"))
  urls.append(("/plan-lecture-1-an.html", "weekly", "0.8"))
  urls.append(("/a-propos.html", "monthly", "0.5"))
  urls.append(("/confidentialite.html", "monthly", "0.5"))
  urls.append(("/contact.html", "monthly", "0.5"))

  # Todos os capítulos
  for b in books:
    slug = slugify_book_name(book_name[b])
    for c in sorted(chapters[b]):
      urls.append((f"/{slug}/{c}", "weekly", "0.7"))

  # Gerar XML
  lines = []
  lines.append('<?xml version="1.0" encoding="UTF-8"?>')
  lines.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')

  for path, freq, prio in urls:
    loc = f"{SITE}{path}"
    lines.append("  <url>")
    lines.append(f"    <loc>{loc}</loc>")
    lines.append(f"    <lastmod>{today}</lastmod>")
    lines.append(f"    <changefreq>{freq}</changefreq>")
    lines.append(f"    <priority>{prio}</priority>")
    lines.append("  </url>")

  lines.append("</urlset>")
  OUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")

  print(f"✅ OK: {OUT_PATH} ({len(urls)} URLs)")

if __name__ == "__main__":
  main()