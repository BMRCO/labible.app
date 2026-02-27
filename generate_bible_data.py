#!/usr/bin/env python3
"""
generate_bible_data.py — LaBible.app
Fonte: getBible v2 (GitHub raw) — LSG1910 (fr_lsg)
"""

import json, os, time, urllib.request, urllib.error

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "bible")

# URL base do getBible v2 no GitHub (mais fiável que a API)
BASE_URL = "https://raw.githubusercontent.com/getbible/v2/master/bibles/fr_lsg"

BOOKS = [
    ("genese",               "Genèse",                1,  ["Gn","Gen"]),
    ("exode",                "Exode",                 2,  ["Ex","Exo"]),
    ("levitique",            "Lévitique",             3,  ["Lv","Lev"]),
    ("nombres",              "Nombres",               4,  ["Nb","Nom"]),
    ("deuteronome",          "Deutéronome",           5,  ["Dt","Deu"]),
    ("josue",                "Josué",                 6,  ["Jos"]),
    ("juges",                "Juges",                 7,  ["Jg","Jug"]),
    ("ruth",                 "Ruth",                  8,  ["Rt","Rut"]),
    ("1_samuel",             "1 Samuel",              9,  ["1S","1Sa"]),
    ("2_samuel",             "2 Samuel",              10, ["2S","2Sa"]),
    ("1_rois",               "1 Rois",                11, ["1R","1Ro"]),
    ("2_rois",               "2 Rois",                12, ["2R","2Ro"]),
    ("1_chroniques",         "1 Chroniques",          13, ["1Ch","1Cr"]),
    ("2_chroniques",         "2 Chroniques",          14, ["2Ch","2Cr"]),
    ("esdras",               "Esdras",                15, ["Esd"]),
    ("nehemie",              "Néhémie",               16, ["Né","Neh"]),
    ("esther",               "Esther",                17, ["Est"]),
    ("job",                  "Job",                   18, ["Jb"]),
    ("psaumes",              "Psaumes",               19, ["Ps"]),
    ("proverbes",            "Proverbes",             20, ["Pr","Pro"]),
    ("ecclesiaste",          "Ecclésiaste",           21, ["Ec","Qo"]),
    ("cantique_des_cantiques","Cantique des cantiques",22, ["Ca","Ct"]),
    ("esaie",                "Ésaïe",                 23, ["Es","Esa"]),
    ("jeremie",              "Jérémie",               24, ["Jr","Jer"]),
    ("lamentations",         "Lamentations",          25, ["Lm","La"]),
    ("ezechiel",             "Ézéchiel",              26, ["Ez"]),
    ("daniel",               "Daniel",                27, ["Dn","Da"]),
    ("osee",                 "Osée",                  28, ["Os"]),
    ("joel",                 "Joël",                  29, ["Jl"]),
    ("amos",                 "Amos",                  30, ["Am"]),
    ("abdias",               "Abdias",                31, ["Ab"]),
    ("jonas",                "Jonas",                 32, ["Jon"]),
    ("michee",               "Michée",                33, ["Mi"]),
    ("nahum",                "Nahum",                 34, ["Na"]),
    ("habacuc",              "Habacuc",               35, ["Ha"]),
    ("sophonie",             "Sophonie",              36, ["So"]),
    ("aggee",                "Aggée",                 37, ["Ag"]),
    ("zacharie",             "Zacharie",              38, ["Za"]),
    ("malachie",             "Malachie",              39, ["Ml","Mal"]),
    ("matthieu",             "Matthieu",              40, ["Mt"]),
    ("marc",                 "Marc",                  41, ["Mc","Mr"]),
    ("luc",                  "Luc",                   42, ["Lc"]),
    ("jean",                 "Jean",                  43, ["Jn"]),
    ("actes",                "Actes",                 44, ["Ac","Act"]),
    ("romains",              "Romains",               45, ["Rm","Ro"]),
    ("1_corinthiens",        "1 Corinthiens",         46, ["1Co"]),
    ("2_corinthiens",        "2 Corinthiens",         47, ["2Co"]),
    ("galates",              "Galates",               48, ["Ga"]),
    ("ephesiens",            "Éphésiens",             49, ["Ep","Eph"]),
    ("philippiens",          "Philippiens",           50, ["Ph","Phi"]),
    ("colossiens",           "Colossiens",            51, ["Col"]),
    ("1_thessaloniciens",    "1 Thessaloniciens",     52, ["1Th"]),
    ("2_thessaloniciens",    "2 Thessaloniciens",     53, ["2Th"]),
    ("1_timothee",           "1 Timothée",            54, ["1Tm","1Ti"]),
    ("2_timothee",           "2 Timothée",            55, ["2Tm","2Ti"]),
    ("tite",                 "Tite",                  56, ["Tt"]),
    ("philemon",             "Philémon",              57, ["Phm"]),
    ("hebreux",              "Hébreux",               58, ["He","Heb"]),
    ("jacques",              "Jacques",               59, ["Jc","Ja"]),
    ("1_pierre",             "1 Pierre",              60, ["1P","1Pi"]),
    ("2_pierre",             "2 Pierre",              61, ["2P","2Pi"]),
    ("1_jean",               "1 Jean",                62, ["1Jn"]),
    ("2_jean",               "2 Jean",                63, ["2Jn"]),
    ("3_jean",               "3 Jean",                64, ["3Jn"]),
    ("jude",                 "Jude",                  65, ["Jud"]),
    ("apocalypse",           "Apocalypse",            66, ["Ap","Apo"]),
]

def fetch(url, retries=4):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "LaBible/1.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            print(f"    tentativa {attempt+1}/{retries} falhou: {e}")
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Impossível descarregar: {url}")

def convert(raw, slug, name):
    """
    getBible v2 formato por capítulo:
    { "book_nr": 1, "book_name": "Genesis", "chapter": 1,
      "verses": [{"chapter":1,"verse":1,"text":"..."},...] }
    """
    chapters = {}
    for chap_num in range(1, 300):
        url = f"{BASE_URL}/{chap_num}/{chap_num}.json"
        # Só tentamos se o capítulo existir — paramos ao primeiro 404
        try:
            chap_data = fetch(url)
        except Exception:
            break

        actual_chap = chap_data.get("chapter", chap_num)
        verses = {}
        for v in chap_data.get("verses", []):
            verses[str(v["verse"])] = str(v.get("text", "")).strip()
        if verses:
            chapters[str(actual_chap)] = verses

    return {name: chapters}

def save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Destino: {OUTPUT_DIR}\n")

    books_index = []
    errors = []

    for slug, name, book_nr, abbr in BOOKS:
        out_path = os.path.join(OUTPUT_DIR, f"{slug}.json")
        print(f"[{book_nr:02d}/66] {name}...", end=" ", flush=True)

        # URL base deste livro
        global BASE_URL
        book_base = f"https://raw.githubusercontent.com/getbible/v2/master/bibles/fr_lsg/{book_nr}"
        # Temporariamente redirecionar BASE_URL para este livro
        old_base = BASE_URL

        try:
            # Ler todos os capítulos do livro
            chapters = {}
            for chap_num in range(1, 200):
                url = f"{book_base}/{chap_num}.json"
                try:
                    chap_data = fetch(url)
                except Exception:
                    break  # Sem mais capítulos

                verses = {}
                for v in chap_data.get("verses", []):
                    verses[str(v["verse"])] = str(v.get("text", "")).strip()
                if verses:
                    chapters[str(chap_num)] = verses

            if not chapters:
                raise RuntimeError("Nenhum capítulo encontrado")

            data = {name: chapters}
            save(out_path, data)
            print(f"✅ {len(chapters)} capítulos")

        except Exception as e:
            print(f"❌ {e}")
            errors.append((slug, name, str(e)))
            save(out_path, {name: {}})

        books_index.append({
            "id": slug,
            "name": name,
            "file": f"{slug}.json",
            "abbr": abbr
        })

        time.sleep(0.2)

    # books.json
    books_path = os.path.join(OUTPUT_DIR, "books.json")
    save(books_path, books_index)
    print(f"\n✅ books.json com {len(books_index)} livros")

    if errors:
        print(f"\n⚠️  {len(errors)} erros:")
        for s, n, e in errors:
            print(f"   - {n}: {e}")
    else:
        print("✅ Todos os livros gerados com sucesso!")

if __name__ == "__main__":
    main()
