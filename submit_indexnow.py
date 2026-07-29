#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Soumet toutes les URLs de sitemap.xml a IndexNow (Bing, Yandex, Naver, Seznam, Yep).
Google ne participe pas a ce protocole ; il continue de dependre du sitemap
classique + Search Console (deja en place separement).

Usage : python submit_indexnow.py
Lit   : sitemap.xml (a la racine du depot)
Envoie: un seul appel POST groupe vers l'API IndexNow (jusqu'a 10 000 URLs
        par appel ; le site en a ~1 215, largement dans la limite).

A relancer manuellement apres tout ajout important de pages (ex : si de
nouvelles pages editoriales sont creees plus tard). Resoumettre des URLs
deja connues n'a pas d'effet negatif.
"""
import re
import sys
import json
import urllib.request

HOST = "labible.app"
KEY = "7036b347e312f5ca36f334c95425767c"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"
SITEMAP_PATH = "sitemap.xml"
ENDPOINT = "https://api.indexnow.org/indexnow"


def load_urls_from_sitemap(path):
    xml = open(path, encoding="utf-8").read()
    return re.findall(r"<loc>(.*?)</loc>", xml)


def submit(urls):
    if not urls:
        print("Aucune URL a soumettre.")
        return
    payload = {
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_LOCATION,
        "urlList": urls,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT, data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"IndexNow -> HTTP {resp.status} ({len(urls)} URLs soumises)")
    except urllib.error.HTTPError as e:
        # 200/202 = accepte ; 400/403/422/429 = erreur documentee par le protocole
        print(f"IndexNow -> HTTP {e.code} : {e.read().decode(errors='replace')[:300]}")
        sys.exit(1)


def main():
    urls = load_urls_from_sitemap(SITEMAP_PATH)
    print(f"{len(urls)} URLs trouvees dans {SITEMAP_PATH}")
    # L'API accepte jusqu'a 10 000 URLs par appel ; on decoupe par securite
    # si jamais le site depasse cette limite un jour.
    CHUNK = 10000
    for i in range(0, len(urls), CHUNK):
        submit(urls[i:i + CHUNK])


if __name__ == "__main__":
    main()
