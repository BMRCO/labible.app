# LaBible.app — PWA

Application web gratuite de la Bible Louis Segond 1910 (LSG 1910), domaine public.
Hébergement Cloudflare Pages, déploiement à chaque push sur `main`.

## Règle absolue

**Ne JAMAIS modifier le contenu biblique.** `data/lsg1910.json` (31 102 versets) ne se
réécrit, ne se corrige, ne se modernise et ne se « nettoie » pas.

## Règles techniques

- Les pages `/lsg/*` et `sitemap.xml` sont **générées** : modifier `generate_chapter_pages.py`,
  jamais les pages à la main.
- Modifier `app.v2.js` ou `styles.css` : monter le `?v=` dans `index.html` **et** dans les
  `STATIC_ASSETS` de `sw.js`. La clé de cache est l'URL complète, query string comprise.
- **Ne pas monter `CACHE_NAME`** pour du HTML, du JS ou du CSS : chaque lecteur installé
  retéléchargerait tout le précache. Il ne monte que si la liste des données change.
- Ne pas retirer `if (await cache.match(url)) return` dans `sw.js`.
- Les pages HTML passent en `networkFirst` : elles se mettent à jour seules, sans toucher à `sw.js`.
- `sitemap.xml` : un `<lastmod>` ne change que si la page a réellement changé.
- `/api/contact` répond en 4xx à un GET : c'est voulu (formulaire en POST).
- Le dépôt est **public** : aucune adresse e-mail, aucun secret, aucun nom personnel dans un fichier.
- Commits avec l'adresse `noreply` de BMRCO.
- Après chaque push, vérifier sur le dépôt distant, par le contenu et non par le message du commit.
