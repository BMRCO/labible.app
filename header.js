# LaBible.app — politique de cache (Cloudflare Pages)
#
# Les fichiers statiques VERSIONNÉS (icônes, polices, données JSON, CSS, app.v2.js)
# sont mis en cache 1 an + immutable : moins de requêtes à l'origine, site plus rapide.
#
# Le HTML et le service worker (sw.js) ne sont PAS listés ici : ils gardent le
# comportement par défaut de Pages (revalidation, jamais périmé), pour que la PWA
# se mette à jour immédiatement.
#
# footer.js / header.js sont des composants partagés NON versionnés, faits pour être
# édités (mise à jour de toutes les pages d'un coup). On leur donne donc un cache
# MODÉRÉ (1 jour + revalidation en arrière-plan) au lieu d'immutable.
#
# IMPORTANT : n'utiliser aucun motif large (ex. /*.js) qui toucherait sw.js.

/*.json
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=31536000, immutable

/app.v2.js
  Cache-Control: public, max-age=31536000, immutable

/*.png
  Cache-Control: public, max-age=31536000, immutable

/*.svg
  Cache-Control: public, max-age=31536000, immutable

/*.ico
  Cache-Control: public, max-age=31536000, immutable

/*.woff2
  Cache-Control: public, max-age=31536000, immutable

/*.woff
  Cache-Control: public, max-age=31536000, immutable

/footer.js
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800

/header.js
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800

/manifest.webmanifest
  Cache-Control: public, max-age=86400