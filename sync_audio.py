#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Recopie les identifiants des videos de la Bible audio dans data/audio.json.

Source : le depot public du bot (BMRCO/bible-telegram-bot), qui ecrit a chaque
publication videos_bible_audio.json ({"marc/1": id}) et
videos_psaumes_audio.json ({"23": id, "119:1-22": id}).

Sortie : data/audio.json = {"marc/1": {"id": "...", "date": "AAAA-MM-JJ"}, ...}
La date est celle du premier passage qui a vu la video (a un jour pres celle
de la publication) ; elle ne change plus ensuite. Elle sert au balisage
VideoObject (uploadDate) des pages /lsg/.

Ne touche a rien d'autre. generate_chapter_pages.py lit ensuite ce fichier.
"""
import datetime
import json
import os
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ROOT, "data", "audio.json")
SRC = "https://raw.githubusercontent.com/BMRCO/bible-telegram-bot/main/"


def lire(nom):
    try:
        with urllib.request.urlopen(SRC + nom, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception as e:
        print(f"⚠️  {nom} illisible : {e}")
        return None


def main():
    bible = lire("videos_bible_audio.json")
    psaumes = lire("videos_psaumes_audio.json")
    if bible is None and psaumes is None:
        raise SystemExit("Aucune source lisible : rien n'est modifie.")

    actuel = json.load(open(SORTIE, encoding="utf-8")) if os.path.exists(SORTIE) else {}
    aujourdhui = datetime.date.today().isoformat()
    vus = {}
    for cle, vid in (bible or {}).items():
        vus[cle] = vid
    for cle, vid in sorted((psaumes or {}).items()):
        num = cle.split(":")[0]                 # « 119:1-22 » : la premiere partie
        vus.setdefault(f"psaumes/{num}", vid)

    nouveau = {}
    for cle, vid in vus.items():
        ancien = actuel.get(cle)
        date = ancien["date"] if ancien and ancien.get("id") == vid else aujourdhui
        nouveau[cle] = {"id": vid, "date": date}
    # Une source momentanement illisible ne doit pas effacer ses entrees.
    for cle, val in actuel.items():
        est_psaume = cle.startswith("psaumes/")
        if cle not in nouveau and ((est_psaume and psaumes is None) or (not est_psaume and bible is None)):
            nouveau[cle] = val

    nouveau = dict(sorted(nouveau.items()))
    if nouveau != actuel:
        with open(SORTIE, "w", encoding="utf-8") as f:
            json.dump(nouveau, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print(f"data/audio.json : {len(nouveau)} chapitres ({len(nouveau) - len(actuel):+d})")
    else:
        print("data/audio.json : inchange")


if __name__ == "__main__":
    main()
