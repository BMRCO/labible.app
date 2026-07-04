# LaBible.app â€” politique de cache (Cloudflare Pages)
#
# Les fichiers statiques VERSIONNÃ‰S (icÃ´nes, polices, donnÃ©es JSON, CSS, app.v2.js)
# sont mis en cache 1 an + immutable : moins de requÃªtes Ã  l'origine, site plus rapide.
#
# Le HTML et le service worker (sw.js) ne sont PAS listÃ©s ici : ils gardent le
# comportement par dÃ©faut de Pages (revalidation, jamais pÃ©rimÃ©), pour que la PWA
# se mette Ã  jour immÃ©diatement.
#
# footer.js / header.js sont des composants partagÃ©s NON versionnÃ©s, faits pour Ãªtre
# Ã©ditÃ©s (mise Ã  jour de toutes les pages d'un coup). On leur donne donc un cache
# MODÃ‰RÃ‰ (1 jour + revalidation en arriÃ¨re-plan) au lieu d'immutable : la taux de
# cache monte, mais une modification se propage en ~1 jour (ou purge du cache pour
# l'appliquer tout de suite).
#
# IMPORTANT : Cloudflare Pages CUMULE les rÃ¨gles qui se chevauchent pour un mÃªme
# en-tÃªte. On n'utilise donc aucun motif large (ex. /*.js) qui toucherait sw.js,
# et les extensions ci-dessous ne se recouvrent pas entre elles.
#
# Si vous modifiez un fichier immutable, changez sa version/son nom (ex. ?v=5,
# app.v3.js) ou purgez le cache Cloudflare, sinon l'ancienne version reste servie.

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