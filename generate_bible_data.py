#!/usr/bin/env python3
"""
generate_bible_data.py — LaBible.app
Fonte: https://api.getbible.net/v2/fr_lsg/{book}/{chapter}.json
"""

import json, os, time, urllib.request

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "bible")
API_BASE   = "https://api.getbible.net/v2/fr_lsg"

BOOKS = [
    (1,  "genese",               "Genèse",                ["Gn","Gen"]),
    (2,  "exode",                "Exode",                 ["Ex","Exo"]),
    (3,  "levitique",            "Lévitique",             ["Lv","Lev"]),
    (4,  "nombres",              "Nombres",               ["Nb","Nom"]),
    (5,  "deuteronome",          "Deutéronome",           ["Dt","Deu"]),
    (6,  "josue",                "Josué",                 ["Jos"]),
    (7,  "juges",                "Juges",                 ["Jg","Jug"]),
    (8,  "ruth",                 "Ruth",                  ["Rt","Rut"]),
    (9,  "1_samuel",             "1 Samuel",              ["1S","1Sa"]),
    (10, "2_samuel",             "2 Samuel",              ["2S","2Sa"]),
    (11, "1_rois",               "1 Rois",                ["1R","1Ro"]),
    (12, "2_rois",               "2 Rois",                ["2R","2Ro"]),
    (13, "1_chroniques",         "1 Chroniques",          ["1Ch","1Cr"]),
    (14, "2_chroniques",         "2 Chroniques",          ["2Ch","2Cr"]),
    (15, "esdras",               "Esdras",                ["Esd"]),
    (16, "nehemie",              "Néhémie",               ["Né","Neh"]),
    (17, "esther",               "Esther",                ["Est"]),
    (18, "job",                  "Job",                   ["Jb"]),
    (19, "psaumes",              "Psaumes",               ["Ps"]),
    (20, "proverbes",            "Proverbes",             ["Pr","Pro"]),
    (21, "ecclesiaste",          "Ecclésiaste",           ["Ec","Qo"]),
    (22, "cantique",             "Cantique des cantiques", ["Ca","Ct"]),
    (23, "esaie",                "Ésaïe",                 ["Es","Esa"]),
    (24, "jeremie",              "Jérémie",               ["Jr","Jer"]),
    (25, "lamentations",         "Lamentations",          ["Lm","La"]),
    (26, "ezechiel",             "Ézéchiel",              ["Ez"]),
    (27, "daniel",               "Daniel",                ["Dn","Da"]),
    (28, "osee",                 "Osée",                  ["Os"]),
    (29, "joel",                 "Joël",                  ["Jl"]),
    (30, "amos",                 "Amos",                  ["Am"]),
    (31, "abdias",               "Abdias",                ["Ab"]),
    (32, "jonas",                "Jonas",                 ["Jon"]),
    (33, "michee",               "Michée",                ["Mi"]),
    (34, "nahum",                "Nahum",                 ["Na"]),
    (35, "habacuc",              "Habacuc",               ["Ha"]),
    (36, "sophonie",             "Sophonie",              ["So"]),
    (37, "aggee",                "Aggée",                 ["Ag"]),
    (38, "zacharie",             "Zacharie",              ["Za"]),
    (39, "malachie",             "Malachie",              ["Ml","Mal"]),
    (40, "matthieu",             "Matthieu",              ["Mt"]),
    (41, "marc",                 "Marc",                  ["Mc","Mr"]),
    (42, "luc",                  "Luc",                   ["Lc"]),
    (43, "jean",                 "Jean",                  ["Jn"]),
    (44, "actes",                "Actes",                 ["Ac","Act"]),
    (45, "romains",              "Romains",               ["Rm","Ro"]),
    (46, "1_corinthiens",        "1 Corinthiens",         ["1Co"]),
    (47, "2_corinthiens",        "2 Corinthiens",         ["2Co"]),
    (48, "galates",              "Galates",               ["Ga"]),
    (49, "ephesiens",            "Éphésiens",             ["Ep","Eph"]),
    (50, "philippiens",          "Philippiens",           ["Ph","Phi"]),
    (51, "colossiens",           "Colossiens",            ["Col"]),
    (52, "1_thessaloniciens",    "1 Thessaloniciens",     ["1Th"]),
    (53, "2_thessaloniciens",    "2 Thessaloniciens",     ["2Th"]),
    (54, "1_timothee",           "1 Timothée",            ["1Tm","1Ti"]),
    (55, "2_timothee",           "2 Timothée",            ["2Tm","2Ti"]),
    (56, "tite",                 "Tite",                  ["Tt"]),
    (57, "philemon",             "Philémon",              ["Phm"]),
    (58, "hebreux",              "Hébreux",               ["He","Heb"]),
    (59, "jacques",              "Jacques",               ["Jc","Ja"]),
    (60, "1_pierre",             "1 Pierre",              ["1P","1Pi"]),
    (61, "2_pierre",             "2 Pierre",              ["2P","2Pi"]),
    (62, "1_jean",               "1 Jean",                ["1Jn"]),
    (63, "2_jean",               "2 Jean",                ["2Jn"]),
    (64, "3_jean",               "3 Jean",                ["3Jn"]),
    (65, "jude",                 "Jude",                  ["Jud"]),
    (66, "apocalypse",           "Apocalypse",            ["Ap","Apo"]),
]

def fetch_json(url, retries=4):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "LaBible/1.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None  # capítulo não existe
            print(f"    HTTP {e.code}, tentativa {attempt+1}/{retries}")
        except Exception as e:
            print(f"    erro: {e}, tentativa {attempt+1}/{retries}")
        time.sleep(2 ** attempt)
    return None

def save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Destino: {OUTPUT_DIR}\n")

    books_index = []

    for book_nr, slug, name, abbr in BOOKS:
        out_path = os.path.join(OUTPUT_DIR, f"{slug}.json")
        print(f"[{book_nr:02d}/66] {name}...", end=" ", flush=True)

        chapters = {}
        for chap_num in range(1, 200):
            url = f"{API_BASE}/{book_nr}/{chap_num}.json"
            data = fetch_json(url)
            if data is None:
                break  # sem mais capítulos

            verses = {}
            for v in data.get("verses", []):
                verses[str(v["verse"])] = str(v.get("text", "")).strip()

            if verses:
                chapters[str(chap_num)] = verses

            time.sleep(0.15)

        if chapters:
            save(out_path, {name: chapters})
            print(f"✅ {len(chapters)} capítulos")
        else:
            save(out_path, {name: {}})
            print(f"⚠️  sem dados")

        books_index.append({
            "id": slug,
            "name": name,
            "file": f"{slug}.json",
            "abbr": abbr
        })

    # books.json
    books_path = os.path.join(OUTPUT_DIR, "books.json")
    save(books_path, books_index)
    print(f"\n✅ books.json com {len(books_index)} livros")
    print("✅ Concluído!")

if __name__ == "__main__":
    main()
