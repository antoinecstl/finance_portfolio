# Captures de revue — refonte UI fi-hub

Captures du **30/09/2026**, après la dernière passe ciblée. Les captures du 29/09 sont archivées dans `archive-2026-09-29/`.

Ce dossier est hors de `public/` et n'est pas inclus dans le build. Toutes les données sont **fictives**. Aucune capture ne provient d'un compte réel.

## Pages publiques (`pages-publiques/`)

Rendues depuis le **build de production local** (`next build --webpack` puis `next start`). Les fichiers suffixés `2x` ou `3x` sont rendus à haute densité, pour examiner les textes.

| Fichier | Contenu |
|---|---|
| `01-landing-desktop-complete.webp` / `02-landing-mobile-complete.jpg` | Landing complète, 1440 px et 390 px |
| `03-premier-ecran-desktop-2x.png` | Premier écran réel, 1440 × 900 (nouveau titre, bannière cookies d'une première visite) |
| `03b-…-mobile-390-3x.png` / `03c-…-mobile-360-3x.png` | Premier écran à 390 et 360 px |
| `04-section-positions-2x.png` | Section pleine largeur, nouveau cadre des captures |
| `05-section-benchmark-2x.png` | **Section variée** : texte à gauche, vue mobile réelle à droite |
| `06-section-dividendes-2x.png` | **Section variée** : vue mobile à gauche, texte à droite |
| `07-section-benchmark-mobile-2x.png` | Section benchmark sur mobile |
| `08-tarifs-desktop.png` | Tarifs (sans « Export CSV ») |
| `09-fonctionnalite-dividendes-desktop.webp` | Page Fonctionnalités, nouveau cadre |
| `10-connexion-mobile.png`, `11-inscription-mobile.png` | Authentification |
| `12` à `17` (`sombre-…`) | Mode sombre : les captures produit sont rendues dans le **vrai thème sombre** de l'application, avec les mêmes données fictives |
| `18-opengraph.png` | Image de partage régénérée (nouveau titre) |

## Application connectée (`application/`)

Composants réels rendus avec des données fictives (appels réseau simulés, aucune session réelle). Captures faites en serveur de développement : la pastille « N » est l'indicateur de développement de Next.js.

| Fichier | Vérifie |
|---|---|
| `nav-mobile-360.png`, `nav-mobile-390.png`, `nav-mobile-360-sombre.png` | Les cinq onglets visibles, icône et libellé complet, zone tactile d'au moins 72 × 56 px |
| `dashboard-desktop.png` | Onglets bureau inchangés, « Répartition du portefeuille », décimales « 48,1 % » |
| `positions-desktop.webp` | « Performance annuelle », décimales, « Voir l'année précédente » |
| `dividendes-mobile.png` | « Moy. /action : », « Rdt/Coût : » |
| `modale-limite.png` | « Le plan Free autorise 3 comptes » |
| `toast-pro-info.png`, `toast-pro-info-sombre.png` | Notification Pro au style informatif (neutre), et non plus d'erreur |
