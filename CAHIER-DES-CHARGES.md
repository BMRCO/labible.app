# Cahier des charges — LaBible.app

**Version :** 1.2
**Date :** juillet 2026
**Projet :** LaBible.app
**Type de document :** Spécifications fonctionnelles et techniques

> Mise à jour v1.2 — intégration du §4.1 détaillé (fonctions « Expliquer », « Partager en image », liens profonds au verset, pages thématiques, composants partagés) ; ajout de la **méditation thématique** (§4.2 et §7.3) ; **horaires réels** des workflows après compensation du retard GitHub Actions ; ajout des **références croisées** et des **explications de versets** ; retrait de Google Analytics ; **liens courts** et `_headers`. Voir le journal en fin de document.
>
> *Ce document décrit les spécifications du projet. Le suivi opérationnel (état des jetons, avancement des séries, tâches en cours) est tenu séparément.*

---

## 1. Présentation du projet

### 1.1 Contexte
LaBible.app est une application web progressive (PWA) gratuite donnant accès à l'intégralité de la Bible **Louis Segond 1910 (LSG 1910)** en français, accompagnée d'un système automatisé de publication quotidienne de contenu sur les réseaux sociaux.

### 1.2 Mission
Diffuser la Parole de Dieu en français de manière **gratuite, accessible et moderne** — faire grandir une communauté chrétienne francophone et porter la Parole à un nombre croissant de personnes.

**Ce n'est pas un projet de monétisation.** La pérennité prime sur le profit.

### 1.3 Identité
- Simple, sérieux, centré sur la Parole.
- La foi est une certitude, pas une émotion.
- Communication par affirmations déclaratives au présent, **sans clickbait émotionnel**.
- Toute la marque est « LaBible.app » (jamais un nom personnel). Contenu exclusivement en français.

---

## 2. Objectifs

### 2.1 Objectifs généraux
1. Offrir un accès libre, sans friction, à la Bible LSG 1910.
2. Publier automatiquement un contenu biblique de qualité chaque jour, sur plusieurs plateformes.
3. Faire croître une audience chrétienne francophone fidèle.

### 2.2 Objectifs spécifiques
- Maintenir un site rapide, installable et utilisable hors-ligne.
- Automatiser la création et la diffusion d'images, de reels et de méditations.
- Optimiser le référencement naturel (SEO) pour capter le trafic organique de Google.
- Garantir un contenu sans réclamation de droits d'auteur (musique, textes).
- **Ne collecter aucune donnée personnelle** (aucun outil d'analyse tiers).

### 2.3 Principe directeur
> Gratuit · Sans publicité · Sans compte · Sans collecte de données.

---

## 3. Public cible
- Chrétiens francophones de tous âges cherchant à lire et méditer la Bible.
- Personnes en recherche spirituelle ou en quête d'un verset quotidien.
- Audiences déjà présentes sur les réseaux sociaux, à convertir vers la Parole.

---

## 4. Périmètre fonctionnel

### 4.1 Application web (PWA) — dépôt `BMRCO/labible.app`

#### Lecture
- Bible **Louis Segond 1910 complète** (31 102 versets).
- Sélecteurs **Livre / Chapitre / Verset** côte à côte ; navigation **Précédent / Suivant**.
- Les sélecteurs ne s'affichent **que dans l'onglet Lecture** (classe `body.viewRead` + `MutationObserver`) ; les autres vues disposent ainsi d'un en-tête compact.
- **Verset du jour**.
- **Liens profonds** par ancre : `#Livre-Chapitre` **ou `#Livre-Chapitre:Verset`**. Dans le second cas, l'application défile jusqu'au verset et le met en évidence (contour doré). Utilisé par les pages thématiques et le partage.

#### Recherche
- Barre de recherche globale persistante, par **mot-clé** ou par **référence**.
- Renvoie **tous les résultats** dans l'ordre biblique, avec pagination (« Afficher plus »).

#### Navigation
- Onglets **Lecture · Plan · Bibliothèque · Versets** intégrés à la **barre fixe supérieure** (`.tabsWrap`), sous la recherche. Ils restent visibles au défilement.
- Les pages de contenu reprennent exactement la même barre via `header.js` (§4.1 « Composants partagés »), sans rupture visuelle d'une vue à l'autre.

#### Actions par verset (barre inline)
- **Favori** — enregistré sur l'appareil.
- **Copier** — texte du verset + référence + lien.
- **Partager (texte)** — via le partage natif de l'appareil, avec repli sur la copie.
- **Partager en image** — génère un visuel **1080×1080** aux couleurs du livre (Psaumes = bleu nuit, Évangiles = noir & or, Proverbes/Sagesse = ambre, Prophètes + Apocalypse = pourpre, autres = marine & or), avec la référence, la typographie française et le filigrane « LaBible.app · LSG 1910 ». Partage natif avec le lien en légende, ou téléchargement en repli. Généré côté client (canvas), sans serveur, fonctionne hors ligne.
- **💡 Expliquer** — pour les versets couverts, un panneau affiche une explication **sobre et fidèle**, centrée sur le sens (pré-écrite, `data/explications.json` — **310 versets**, couvrant 100 % des versets cités dans les pages thématiques).
- **🔗 Références** — liste les versets liés (renvois croisés), chacun cliquable en lien profond. Source : `data/crossrefs.json` (**225 053 références sur 29 325 versets**, top 10 par votes), attribution « OpenBible.info · CC BY » en pied de panneau.

#### Plan de lecture 365 jours
- Un parcours quotidien ; **chaque lecture du jour est cliquable** individuellement.
- Progression **enregistrée sur l'appareil** ; boutons « Ouvrir » / « Marquer lu », réinitialisation et saut à un jour précis.

#### Bibliothèque
- **Favoris** + **historique** de lecture.

#### Versets par thème (SEO)
- **16 pages** `/versets/{thème}` : protection, guérison, paix, amour, espérance, prière, promesses, pardon, peur, confiance, force, famille, gratitude, combat, solitude, deuil — plus une page d'index `/versets`.
- Chaque page : icône SVG dorée, intro courte, versets cliquables ouvrant **le chapitre au verset exact**, CTA « Lisez la Bible complète ».
- **350 liens de versets** au total.

#### Page de liens
- **`labible.app/liens`** (link-in-bio) : accès à la lecture, à l'installation et à tous les réseaux via les liens courts `labible.app/<réseau>`.

#### Mode hors-ligne et installation
- **Service worker versionné** (cache) ; la version est incrémentée à chaque mise à jour significative.
- **Installation** sur Android, iPhone et PC (bouton natif `beforeinstallprompt`, avec repli vers `/installer.html`).

#### Composants partagés
- `header.js` — topbar, recherche et onglets, identiques à ceux de l'application. Édition unique → mise à jour de toutes les pages de contenu.
- `footer.js` — pied de page standard : icônes des réseaux (**WhatsApp inclus**) et liens (dont « Installer »).

#### Confidentialité
- **Aucun outil d'analyse** : Google Analytics (GA4) a été retiré des 27 pages HTML. La politique de confidentialité indique l'absence de collecte de données.

#### Identité
- Noir `#0b0b0b` + or `#e2c57a` / `#c9a640`, texte crème `#f0ead8`.
- **EB Garamond** (serif) + **DM Sans** (UI). Feuille de style `/styles.css?v=4`.

### 4.2 Système d'automatisation (bot) — dépôt `BMRCO/bible-telegram-bot`
- **Pipeline image** : images carrées 1080×1080 (Pillow), plusieurs palettes, sélection par hash.
- **Pipeline reel** : reels verticaux 1080×1920, cascade ligne par ligne en fondu, vignette à mi-vidéo.
- **Méditations des Psaumes** (`psaume_meditation.py`) : vidéos horizontales 1920×1080 d'un Psaume complet (verset par verset, fondu lent), rotation de 4 palettes par numéro de Psaume, musique douce filtrée anti-Content-ID.
- **Méditations thématiques** (`thematic_meditation.py`) : format **vertical 9:16**, **5 versets** par vidéo (durée < 60 s pour rester éligible aux Shorts), couleur propre à chaque thème, rotation automatique de **20 thèmes** (un par jour, cycle complet de 20 jours), sélection musicale variée sans répétition (« sac » de pistes). Publication sur **YouTube, Telegram, Facebook, Instagram (Reel) et Threads**.
- **Paraboles** : vidéos longues multi-versets avec titre et final (21 entrées).
- **Captions** : appel au partage, hashtags et titres SEO par catégorie ; CTA « Suivez @labible.app » uniquement sur Instagram.
- **Nettoyage de texte** : correction typographique (Éternel, cœur), suppression des rubriques/superscriptions des Psaumes (en tête uniquement).
- **Filtre de plateforme** (`ONLY_PLATFORM`) : permet de publier sur une seule plateforme pour les tests.
- **Persistance d'état** : `progress.json` (rotation des catégories), `progress_meditation.json` (Psaume suivant), `progress_thematic.json` (thème, décalages par thème, historique musical).
- **Sécurité** : aucun identifiant dans le code ; tous les jetons proviennent de **GitHub Secrets** via variables d'environnement (dépôt vérifié).

---

## 5. Contenu

### 5.1 Source
Bible Louis Segond 1910 — fichier `data/lsg1910.json` (**31 102 versets**, structure `{book_name, book, chapter, verse, text}` sous la clé `verses`), chargé en mémoire via un index `livre → chapitre → verset` et filtré à la demande.

> **Nom de livre des Psaumes** : la PWA utilise **« Psaumes » (pluriel)**. Le fichier source du bot utilise « Psaume » (singulier) ; le bot dispose d'un `BOOK_NAME_MAP` qui convertit les deux graphies. Toute référence saisie manuellement doit respecter le pluriel côté PWA.

### 5.2 Catégories thématiques

**Catégories du bot principal** (rotation de `publish.yml`) :

| Catégorie | Fichier | Entrées | Emoji | Palette |
|-----------|---------|---------|-------|---------|
| Promesses | promesses_curated.json | 45 | 🌿 | Vert profond |
| Paroles de Jésus | jesus_curated.json | 150 | ✝️ | Navy |
| Psaumes | psaumes_curated.json | 109 | 🎵 | Bleu nuit |
| Proverbes / Sagesse | proverbes_curated.json | 134 | 💡 | Ocre / doré |
| Prophéties | propheties_curated.json | 233 | 📯 | Pourpre |
| Protection | protection_curated.json | 66 | 🛡️ | Bordeaux |

**Ensembles thématiques** (utilisés par la méditation thématique) :

| Catégorie | Entrées | | Catégorie | Entrées |
|-----------|---------|---|-----------|---------|
| Guérison | 21 | | Gratitude | 16 |
| Paix | 20 | | Confiance | 19 |
| Espérance | 20 | | Deuil | 17 |
| Prière | 20 | | Amour | 15 |
| Peur | 20 | | Force | 13 |
| Pardon | 20 | | Combat | 13 |
| Famille | 13 | | Solitude | 12 |

Plus **Paraboles** (21, vidéos longues).

> Format des fichiers curés : liste de triplets `["Livre", chapitre, verset]`.

### 5.3 Principe de curation
Chaque verset doit être **complet et intelligible isolément** :
- pas de lamentation seule ni de verset purement sombre sans résolution ;
- pas de fragment coupé ni de phrase commençant en minuscule (continuation) ;
- pas de question rhétorique sans réponse, ni de reproche personnel hors contexte ;
- règle « Israël » : ne retirer que les références **nationales/historiques isolées** (Jacob, Juda, Sion, Jérusalem ne sont pas concernés en tant que tels) ;
- la « Promesse » est une promesse de Dieu qui encourage seule (présence, provision, pardon, vie) — l'eschatologie reste en « Prophéties ».

### 5.4 Principe de rédaction des explications
Les explications (`data/explications.json`) suivent la même ligne éditoriale que le reste du projet :
- **sobres et fidèles au texte** : elles expliquent le sens, elles ne prêchent pas ;
- elles **corrigent les malentendus fréquents** plutôt que d'amplifier l'émotion (ex. : « rendre grâces *en* toutes choses n'est pas rendre grâces *pour* tout ») ;
- sur les passages souvent détournés (Psaume 91, promesses de prospérité, guérison), elles **s'en tiennent à ce que le texte affirme réellement** ;
- longueur cible : **100 à 250 caractères**, typographie française (apostrophes courbes, guillemets « »).

### 5.5 Types de contenu produits
- Images de verset (quotidiennes).
- Reels animés (quotidiens).
- Méditations de Psaumes (série séquentielle 1 → 150).
- Méditations thématiques (rotation de 20 thèmes).
- Paraboles de Jésus (vidéos longues).
- Séries spéciales (ex. Semaine Sainte).

---

## 6. Plateformes de diffusion

| Plateforme | Compte / canal | Publication |
|-----------|----------------|-------------|
| Telegram | @appbible | Automatique |
| WhatsApp | Canal LaBible.app | Manuelle (même contenu que Telegram, sans hashtags) |
| Facebook | Page LaBible.app | Automatique |
| Instagram | @labible.app | Automatique |
| YouTube | @LaBible-app | Automatique (Shorts + vidéos + méditations) |
| Threads | @labible.app | Automatique |
| Pinterest | LaBible.app | Automatique |
| TikTok | @labible.app | **Manuelle** (API refusée) |

> Les jetons Pinterest et Threads ont une durée de validité limitée (§11.2) : leur renouvellement conditionne la continuité de la publication automatique sur ces deux réseaux.

**Liens courts** (`_redirects`) : `labible.app/telegram`, `/whatsapp`, `/facebook`, `/instagram`, `/youtube`, `/pinterest`, `/tiktok`, `/threads`. Le lien YouTube inclut `?sub_confirmation=1`.

---

## 7. Planning de publication

> **Principe** : les horaires cron sont volontairement **avancés d'environ 1 h 30 à 3 h** par rapport à l'heure de diffusion souhaitée, afin de compenser le retard structurel de GitHub Actions (§7.4). Les horaires ci-dessous sont les crons **réels** ; la colonne « diffusion réelle » indique l'heure observée.

### 7.1 Bot principal (`publish.yml`)
6 publications par jour.

| Cron (UTC) | Diffusion réelle (UTC) | Heure FR | Format | Catégorie |
|-----------|------------------------|----------|--------|-----------|
| 03h07 | ~06h05 | ~08h05 | reel | Protection |
| 05h09 | ~07h42 | ~09h42 | reel / image | Promesses |
| 08h07 | ~10h29 | ~12h29 | image / reel | Proverbes |
| 11h45 | ~13h07 | ~15h07 | reel / image | Jésus |
| 15h41 | ~17h13 | ~19h13 | image / reel | Prophéties |
| 17h08 | ~18h47 | ~20h47 | reel | Psaumes |

- Calendrier hybride : toujours **4 reels + 2 images** par jour (fixes : Protection en reel le matin, Psaumes en reel le soir ; alternance jour pair/impair sur les 4 créneaux du milieu via `10#$DAY % 2`).
- La catégorie est imposée par `BOT_CATEGORY` (sortie de l'étape `schedule`), donc un retard n'altère pas la catégorie publiée.
- Un **groupe de concurrence par horaire** (`verses-post-<schedule>`) évite qu'une exécution retardée soit annulée par la suivante.

### 7.2 Méditations des Psaumes (`meditation.yml`)
- Cron **04h11 UTC** → diffusion observée **~06h38 UTC (08h38 France)**.
- Séquence Psaume 1 → 150, vers YouTube + Telegram + Facebook.
- Groupe de concurrence distinct (`meditation-post-…`), `git pull --rebase --autostash` avant le commit de progression.
- Déclenchement manuel possible (`workflow_dispatch`) avec choix du Psaume et de la plage de versets.

### 7.3 Méditations thématiques (`thematic_meditation.yml`)
- Cron **16h13 UTC** → diffusion observée **~17h53 UTC (19h53 France)**.
- Rotation de 20 thèmes, un par jour ; 5 versets par vidéo ; décalage mémorisé par thème pour ne pas répéter les mêmes versets.
- Groupe de concurrence distinct (`thematic-post-…`).
- Déclenchement manuel possible avec choix du thème.

### 7.4 Note GitHub Actions
Les workflows planifiés (cron) sont « best-effort » : ils peuvent être retardés (**1 h 30 à 3 h en pratique**, le pire dans la fenêtre UTC du matin) ou abandonnés en période de forte charge. Mitigations appliquées :
- horaires **avancés** pour que la diffusion réelle tombe à l'heure voulue ;
- minutes décalées du `:00` ;
- un **groupe de concurrence par horaire** ;
- `git pull --rebase` avant le commit de progression ;
- un `push` sur la branche par défaut resynchronise les planifications.

---

## 8. Identité visuelle (charte graphique)

### 8.1 Couleurs (PWA)
- Fond : **noir `#0b0b0b`**.
- Accents : **or `#e2c57a` / `#c9a640`**.
- Texte : crème `#f0ead8`.
- `theme-color` : `#0b0b0b`. Feuille de style partagée : `/styles.css?v=4`.

### 8.2 Palettes du bot
- **Méditations de Psaumes** (rotation par n° de Psaume mod 4) : Bleu nuit, Navy + or, Pourpre, Teal.
- **Méditations thématiques** : une couleur propre par thème.
- **Catégories** : Protection → Bordeaux · Promesse → Vert profond · Sagesse/Proverbe → Ocre/doré · Jésus → Navy · Prophétie → Pourpre · Psaume → Bleu nuit.

### 8.3 Typographie
- PWA : **EB Garamond** (serif, corps/marque) + **DM Sans** (UI).
- Images du bot : DejaVu Serif / DejaVu Serif Bold / DejaVu Sans.

### 8.4 Iconographie
- Icônes SVG **dorées** en trait fin pour les thèmes (hub `/versets` et pages thématiques).
- **Contrainte** : le trait fin devient illisible sous 22 px — utiliser des **silhouettes pleines** dans les petits formats (ex. colombe de la page Paix).
- Les couleurs de marque des réseaux sociaux au pied de page sont **volontairement conservées**.

### 8.5 Ton éditorial
- Sérieux, contemplatif, respectueux (vouvoiement).
- Pas de clickbait, pas d'émotion forcée.
- Filigrane « LaBible.app » + mention « LSG 1910 » sur tous les visuels.

### 8.6 Appels à l'action types
- « 👇 Partage ce verset avec quelqu'un qui en a besoin 🙏 »
- « 📖 Lisez la Bible gratuitement → labible.app »
- « 🔔 Suivez @labible.app pour un verset chaque jour 🙏 » (Instagram uniquement).
- CTA propres à TikTok, définis par catégorie (publication manuelle).

---

## 9. Spécifications techniques

### 9.1 Architecture
- **Front PWA** : HTML / CSS / JavaScript (`app.v2.js`), données chargées depuis un JSON unique, service worker pour le cache et le hors-ligne (versionné). Composants partagés `header.js` / `footer.js`.
- **Bot** : Python (`bot.py`, `psaume_meditation.py`, `thematic_meditation.py` ; Pillow pour les visuels, ffmpeg pour les vidéos), orchestré par GitHub Actions selon un planning cron.

### 9.2 Stack et services
- **Hébergement** : Cloudflare Pages.
- **CI/CD** : GitHub Actions.
- **Hébergement médias** : Cloudinary (Instagram, Threads), ImgBB (Pinterest).
- **APIs** : Telegram Bot API, Meta Graph API (Facebook/Instagram), YouTube Data API v3 (OAuth2), Pinterest API v5, Threads API.

### 9.3 Données
| Fichier | Emplacement | Contenu |
|---------|-------------|---------|
| `lsg1910.json` | `data/` | 31 102 versets |
| `crossrefs.json` | **`data/`** | 225 053 références croisées sur 29 325 versets (OpenBible.info, CC BY) |
| `explications.json` | **`data/`** | 310 explications de versets |

> ⚠️ `crossrefs.json` et `explications.json` **doivent** se trouver dans `/data/`. Un dépôt à la racine provoque une erreur 404.

### 9.4 Nettoyage du texte (`strip_rubric` / `clean_text`)
- Les rubriques et superscriptions des Psaumes (« Au chef des chantres », « Psaume de David », « Cantique des degrés », dédicaces « Sur… », notes historiques « Lorsqu'il… ») sont retirées **uniquement en tête du verset**, segment par segment ; les notes historiques ne sont retirées qu'**après** un en-tête déjà reconnu.
- Aucune suppression de phrases en milieu/fin de verset.
- `clean_text` corrige la typographie (Éternel, cœur, apostrophes), retire « Pause »/« Sélah » et un tiret résiduel en fin, et garantit une ponctuation finale.
- Validation : 31 102 versets — 0 sur-suppression, 0 rubrique résiduelle.
- Évolution prévue : espace fine insécable avant `;` `:` `?` `!`, à valider sur l'ensemble des versets avant déploiement.

### 9.5 Performance et cache
- Fichier **`_headers`** déployé (cache long + `immutable` sur les ressources statiques).
- Purge Cloudflare (« Purge Everything ») requise après toute mise à jour du PWA.

### 9.6 Bonnes pratiques techniques (acquises)
- Catégorie imposée par `BOT_CATEGORY` (fiable malgré le retard du cron) ; à défaut, repli sur l'heure UTC.
- Calcul du jour en base 10 (`10#$DAY`) pour éviter le bug octal des jours 008/009.
- Instagram : passer par Cloudinary + boucle d'attente du conteneur avant publication.
- Service worker : **incrémenter la version à chaque livraison** — l'oubli est la cause d'échec la plus fréquente.
- Sitemap : URLs sans extension `.html`.
- Un groupe de concurrence **par horaire** (jamais un groupe unique partagé).
- Aucun identifiant en clair dans le code : uniquement des GitHub Secrets.

### 9.7 Protocole de déploiement
1. Édition et **validation** des fichiers (contrôle de syntaxe Python / Node, vérification des références bibliques).
2. Livraison des **fichiers complets** (jamais d'extraits).
3. Téléversement manuel via l'interface web GitHub — **toujours en tant que fichier**, jamais par copier-coller (le collage sur mobile corrompt accents et emojis).
4. Pour toute modification du PWA : téléverser également `sw.js` avec la version de cache incrémentée.
5. Cloudflare « Purge Everything » + rechargement forcé (deux rechargements peuvent être nécessaires pour renouveler le service worker).
6. Après modification d'un workflow, **pousser un commit** sur la branche par défaut pour resynchroniser les planifications.

---

## 10. SEO

### 10.1 En place
- Meta tags, Open Graph, données structurées (WebSite, WebApplication, Organization), balises hreflang.
- **16 pages thématiques** `/versets/*` + index, avec liens profonds au verset exact.
- `sitemap.xml` : **25 URLs**.
- Titres et descriptions optimisés par catégorie sur YouTube et Pinterest.
- Liens courts vers les réseaux.

### 10.2 À développer
- **URLs par chapitre** : `labible.app/lsg/{livre}/{chapitre}` (noms en français), rendu du chapitre complet, méta-tags par chapitre, sitemap porté à **~1 200 URLs**. Inspiration : saintebible.com/lsg/. *Principal levier de trafic organique restant.*
- Concordance biblique française (index mot → versets), à l'étude.

---

## 11. Contraintes

### 11.1 Droits d'auteur
- **Textes** : LSG 1910 dans le domaine public.
- **Références croisées** : OpenBible.info, licence CC BY — **attribution obligatoire et affichée**.
- **Musique** : uniquement des pistes libres de Content ID (format Pixabay : minuscules, sans espaces ni parenthèses). Sécurité maximale : bibliothèque audio native de YouTube. Des réclamations (claims, pas strikes) restent possibles même depuis des sources réputées sûres.

### 11.2 Gestion des tokens
- **Pinterest** : ~30 jours, renouvellement manuel (OAuth, script local).
- **Threads** : token long 60 jours (`th_exchange_token`), à rafraîchir avant expiration.
- Tokens stockés en **GitHub Secrets**.

### 11.3 Limites de plateformes / infrastructure
- **TikTok** : pas de publication automatique (API refusée) → manuelle.
- **GitHub** : 25 Mo/fichier via le web. Cron planifié non garanti à l'heure exacte (voir §7.4).
- **Travail exclusivement sur mobile** via l'interface web GitHub : toute livraison doit être un fichier téléversable.

---

## 12. Exploitation et maintenance
- Surveiller les logs GitHub Actions après chaque évolution (succès / échec / annulé).
- Renouveler les tokens Pinterest (~30 j) et Threads (~60 j) avant expiration.
- Incrémenter la version du service worker après chaque mise à jour du PWA.
- Vérifier les réclamations de droits d'auteur sur YouTube.
- Maintenir les ensembles de versets curés selon le principe de curation (§5.3) et les explications selon le §5.4.
- Après modification d'un workflow, pousser un commit sur la branche par défaut.

---

## 13. Indicateurs de succès (KPIs)
- Croissance des abonnés par plateforme.
- Trafic organique vers labible.app (Google Search Console).
- Rétention et vues sur YouTube (Shorts et méditations).
- Installations du PWA.
- Taux de partage du contenu.
- Taux de cache Cloudflare (cible 80–90 %+).

---

## 14. Roadmap (évolutions futures)

### 14.1 Court terme
- Uniformiser les dernières pages support sur `header.js` / `footer.js`.
- Auto-ajout des Shorts aux playlists YouTube par catégorie.
- Compléter l'arborescence des playlists YouTube (Psaumes du Jour, Verset du Matin, Paix, Amour, Prière).
- QR code (style YouVersion) partageable.

### 14.2 Moyen terme
- **URLs SEO par chapitre** (`/lsg/{livre}/{chapitre}`) et sitemap étendu.
- Espace fine insécable dans `clean_text()`.
- Brancher davantage d'ensembles thématiques dans `bot.py`.
- Hooks/captions automatiques via l'API Claude (Instagram / Facebook / Threads).
- Panneau d'administration v2.
- Étendre les explications au-delà des versets des pages thématiques.

### 14.3 Long terme
- Applications natives : **Google Play** (TWA via PWABuilder — `assetlinks.json` indispensable ; 12 testeurs × 14 jours en test fermé pour un compte développeur personnel) + **App Store iOS**.
- Page discrète `/soutenir` (Ko-fi, dons libres, sans pop-up ni pression).
- Narration TTS (différée — la voix lit les références bibliques comme des heures).
- Google AdSense sur le PWA (différé ; à désactiver en mode TWA).
- Concordance biblique française.

---

## 15. Budget et modèle
- Projet **non lucratif**. Coûts limités aux services gratuits ou peu coûteux (Cloudflare Pages, GitHub Actions, Cloudinary/ImgBB en formules gratuites).
- Soutien éventuel et facultatif via Ko-fi, sans publicité ni mise en avant agressive.
- Outils SEO payants (TubeBuddy / VidIQ) écartés : sans intérêt pour un bot automatisé sans miniatures personnalisées. Priorité aux outils gratuits (YouTube Studio, VidIQ free, Google Trends).

---

## Journal des modifications

**v1.2 (juillet 2026)**
- §2.2 / §2.3 / §4.1 : **retrait de Google Analytics** — aucune collecte de données.
- §4.1 : section entièrement refondue — onglets dans la barre fixe, sélecteurs limités à la vue Lecture, **liens profonds au verset** (`#Livre-Chapitre:Verset`), « Partager en image », « Expliquer » (310 versets), « Références » (225 053 renvois croisés), 16 pages thématiques, page `/liens`, composants partagés `header.js` / `footer.js`.
- §4.2 : ajout des **méditations thématiques** (20 thèmes, format vertical, 5 versets, 5 plateformes) ; note de sécurité sur les GitHub Secrets.
- §5.2 : comptages réels des 20 ensembles curés ; format des fichiers précisé ; Promesses corrigé (45).
- §5.4 : **nouveau** — principe de rédaction des explications.
- §6 : ajout des liens courts vers les réseaux.
- §7 : **horaires réels** de tous les workflows, avec l'heure de diffusion observée ; principe d'avance sur cron documenté ; ajout de §7.3 (méditation thématique) ; §7.4 précisé (retard réel de 1 h 30 à 3 h).
- §8.4 : **nouveau** — iconographie et contrainte du trait fin sous 22 px.
- §9.3 : **nouveau** — tableau des fichiers de données et emplacement obligatoire `/data/`.
- §9.5 / §9.7 : **nouveau** — `_headers` déployé ; protocole de déploiement formalisé.
- §10.1 : état des optimisations SEO en place.
- §11.1 : attribution CC BY d'OpenBible.info.
- §14 : roadmap réordonnée ; retrait des éléments achevés (`_headers`, WhatsApp au pied de page, ensembles thématiques, versets viraux).

**v1.1 (juin 2026)**
- §5.1 : précision « Psaume » (singulier) dans la source + `BOOK_NAME_MAP`.
- §5.2 : catégories et comptages réels ; séparation catégories actives / ensembles additionnels.
- §5.3 : ajout du principe de curation. `promesses_curated.json` reconstruit.
- §7.1 : minutes décalées + un groupe de concurrence **par horaire**.
- §7.2 : méditation déplacée hors du `:00`.
- §7.3 : note sur la fiabilité du cron GitHub Actions.
- §8 : identité visuelle corrigée — **noir `#0b0b0b` + or**, EB Garamond + DM Sans.
- §9.3 : nouvelle section nettoyage du texte (`strip_rubric` réécrit, validé sur 31 102 versets).

**v1.0 (juin 2026)** — version initiale.

---

*Document évolutif — à mettre à jour au fil du projet.*
