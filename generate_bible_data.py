#!/usr/bin/env python3
"""
generate_bible_data.py
======================
Gera os ficheiros JSON da LSG1910 para LaBible.app
a partir da fonte getBible v2 (domínio público, texto limpo).

Estrutura gerada:
  data/bible/books.json          → índice de todos os livros
  data/bible/<slug>.json         → um ficheiro por livro

Uso:
  pip install requests
  python generate_bible_data.py

Os ficheiros são gerados na pasta ./data/bible/ relativa ao script.
"""

import json
import os
import time
import requests

# ── Configuração ──────────────────────────────────────────────────────────────

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data", "bible")

# getBible v2 API — LSG1910 (fr_lsg)
# Documentação: https://getbible.net/docs
GETBIBLE_BASE = "https://api.getbible.net/v2/fr_lsg"

# Lista dos 66 livros com: slug (nome do ficheiro), nome francês, abreviações
BOOKS = [
    # Antigo Testamento
    ("genese",          "Genèse",               ["Gn", "Gen"]),
    ("exode",           "Exode",                ["Ex", "Exo"]),
    ("levitique",       "Lévitique",            ["Lv", "Lev"]),
    ("nombres",         "Nombres",              ["Nb", "Nom"]),
    ("deuteronome",     "Deutéronome",          ["Dt", "Deu"]),
    ("josue",           "Josué",                ["Jos"]),
    ("juges",           "Juges",                ["Jg", "Jug"]),
    ("ruth",            "Ruth",                 ["Rt", "Rut"]),
    ("1samuel",         "1 Samuel",             ["1S", "1Sa"]),
    ("2samuel",         "2 Samuel",             ["2S", "2Sa"]),
    ("1rois",           "1 Rois",               ["1R", "1Ro"]),
    ("2rois",           "2 Rois",               ["2R", "2Ro"]),
    ("1chroniques",     "1 Chroniques",         ["1Ch", "1Cr"]),
    ("2chroniques",     "2 Chroniques",         ["2Ch", "2Cr"]),
    ("esdras",          "Esdras",               ["Esd"]),
    ("nehemie",         "Néhémie",              ["Né", "Neh"]),
    ("esther",          "Esther",               ["Est"]),
    ("job",             "Job",                  ["Jb"]),
    ("psaumes",         "Psaumes",              ["Ps"]),
    ("proverbes",       "Proverbes",            ["Pr", "Pro"]),
    ("ecclesiaste",     "Ecclésiaste",          ["Ec", "Qo"]),
    ("cantique",        "Cantique des cantiques",["Ca", "Ct"]),
    ("esaie",           "Ésaïe",                ["Es", "Esa"]),
    ("jeremie",         "Jérémie",              ["Jr", "Jer"]),
    ("lamentations",    "Lamentations",         ["Lm", "La"]),
    ("ezechiel",        "Ézéchiel",             ["Ez"]),
    ("daniel",          "Daniel",               ["Dn", "Da"]),
    ("osee",            "Osée",                 ["Os"]),
    ("joel",            "Joël",                 ["Jl"]),
    ("amos",            "Amos",                 ["Am"]),
    ("abdias",          "Abdias",               ["Ab"]),
    ("jonas",           "Jonas",                ["Jon"]),
    ("michee",          "Michée",               ["Mi"]),
    ("nahum",           "Nahum",                ["Na"]),
    ("habakuk",         "Habakuk",              ["Ha"]),
    ("sophonie",        "Sophonie",             ["So"]),
    ("aggee",           "Aggée",                ["Ag"]),
    ("zacharie",        "Zacharie",             ["Za"]),
    ("malachie",        "Malachie",             ["Ml", "Mal"]),
    # Nouveau Testament
    ("matthieu",        "Matthieu",             ["Mt"]),
    ("marc",            "Marc",                 ["Mc", "Mr"]),
    ("luc",             "Luc",                  ["Lc"]),
    ("jean",            "Jean",                 ["Jn"]),
    ("actes",           "Actes",                ["Ac", "Act"]),
    ("romains",         "Romains",              ["Rm", "Ro"]),
    ("1corinthiens",    "1 Corinthiens",        ["1Co"]),
    ("2corinthiens",    "2 Corinthiens",        ["2Co"]),
    ("galates",         "Galates",              ["Ga"]),
    ("ephesiens",       "Éphésiens",            ["Ep", "Eph"]),
    ("philippiens",     "Philippiens",          ["Ph", "Phi"]),
    ("colossiens",      "Colossiens",           ["Col"]),
    ("1thessaloniciens","1 Thessaloniciens",    ["1Th"]),
    ("2thessaloniciens","2 Thessaloniciens",    ["2Th"]),
    ("1timothee",       "1 Timothée",           ["1Tm", "1Ti"]),
    ("2timothee",       "2 Timothée",           ["2Tm", "2Ti"]),
    ("tite",            "Tite",                 ["Tt"]),
    ("philemon",        "Philémon",             ["Phm"]),
    ("hebreux",         "Hébreux",              ["He", "Heb"]),
    ("jacques",         "Jacques",              ["Jc", "Ja"]),
    ("1pierre",         "1 Pierre",             ["1P", "1Pi"]),
    ("2pierre",         "2 Pierre",             ["2P", "2Pi"]),
    ("1jean",           "1 Jean",               ["1Jn"]),
    ("2jean",           "2 Jean",               ["2Jn"]),
    ("3jean",           "3 Jean",               ["3Jn"]),
    ("jude",            "Jude",                 ["Jud"]),
    ("apocalypse",      "Apocalypse",           ["Ap", "Apo"]),
]

# Numéros de livros getBible (1=Genèse … 66=Apocalypse)
GETBIBLE_BOOK_NUMBERS = list(range(1, 67))


# ── Fonctions ─────────────────────────────────────────────────────────────────

def fetch_book(book_number: int, retries: int = 3) -> dict:
    """Télécharge un livre depuis l'API getBible v2."""
    url = f"{GETBIBLE_BASE}/{book_number}.json"
    for attempt in range(retries):
        try:
            r = requests.get(url, timeout=30)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            print(f"    ⚠️  Tentative {attempt+1}/{retries} échouée pour livre {book_number}: {e}")
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Impossible de télécharger le livre {book_number}")


def convert_book(raw: dict, slug: str, name: str) -> dict:
    """
    Convertit le format getBible v2 vers le format LaBible.app.

    getBible v2:
      { "name": "Genèse", "chapters": [ { "chapter": 1, "verses": [ {"verse":1,"text":"..."}, ...] }, ...] }

    LaBible.app:
      { "NomLivre": { "1": { "1": "texte", "2": "texte", ... }, "2": {...} } }
    """
    chapters_raw = raw.get("chapters", [])
    chapters_out = {}

    for chap in chapters_raw:
        chap_num = str(chap.get("chapter", 0))
        verses_raw = chap.get("verses", [])
        verses_out = {}
        for v in verses_raw:
            v_num = str(v.get("verse", 0))
            text = str(v.get("text", "")).strip()
            verses_out[v_num] = text
        chapters_out[chap_num] = verses_out

    return {name: chapters_out}


def save_json(path: str, data: dict):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"📁 Dossier de sortie : {OUTPUT_DIR}\n")

    books_index = []
    errors = []

    for i, (slug, name, abbr) in enumerate(BOOKS):
        book_number = GETBIBLE_BOOK_NUMBERS[i]
        out_path = os.path.join(OUTPUT_DIR, f"{slug}.json")

        print(f"[{i+1:02d}/66] {name} (livre getBible #{book_number})...", end=" ", flush=True)

        try:
            raw = fetch_book(book_number)
            converted = convert_book(raw, slug, name)
            save_json(out_path, converted)

            # Compte les chapitres pour l'index
            chap_count = len(converted[name])
            print(f"✅  {chap_count} chapitres")

        except Exception as e:
            print(f"❌  ERREUR: {e}")
            errors.append((slug, name, str(e)))
            # Crée un fichier vide pour ne pas bloquer l'app
            save_json(out_path, {name: {}})

        # Ajoute à l'index
        books_index.append({
            "id": slug,
            "name": name,
            "file": f"{slug}.json",
            "abbr": abbr
        })

        # Pause polie pour ne pas surcharger l'API
        time.sleep(0.3)

    # Écrit books.json
    books_json_path = os.path.join(OUTPUT_DIR, "books.json")
    save_json(books_json_path, books_index)
    print(f"\n📖 books.json écrit avec {len(books_index)} livres.")

    if errors:
        print(f"\n⚠️  {len(errors)} erreur(s) :")
        for slug, name, err in errors:
            print(f"   - {name} ({slug}): {err}")
    else:
        print("\n✅ Tous les livres ont été téléchargés avec succès.")

    print(f"\nDossier : {OUTPUT_DIR}")
    print("Copiez le contenu vers votre dépôt GitHub dans /data/bible/")


if __name__ == "__main__":
    main()
