# Spec — Explorateur de marchés

Statut : **v1 implémentée** (branche `claude/explorateur-marches`). Octobre 2026.
Contexte concurrentiel : [analyse de Baggr](../analyses/baggr.md).

## 1. Objectif

Ajouter à Fi-Hub une page d'analyse de marché, dans l'esprit de TradingView mais à la mesure de nos données. L'utilisateur peut explorer n'importe quel titre couvert par notre fournisseur de cours (actions, ETF, indices, cryptos) : graphique, statistiques et dividendes.

Fi-Hub reste un outil de patrimoine. L'explorateur doit donc **relier le marché à la situation de l'utilisateur** : sur un titre qu'il détient, on montre ses opérations, son PRU et sa plus-value.

**Objectifs mesurables (90 jours après la mise en ligne) :**
- 30 % des utilisateurs actifs ouvrent au moins une fiche valeur par mois ;
- une fiche est ouverte par session en moyenne chez les utilisateurs qui ont des positions ;
- aucune hausse des erreurs 429/5xx du fournisseur de cours.

**Non-objectifs v1 :**
- données fondamentales (bilans, ratios de valorisation) ;
- screener ;
- dessin sur graphique ;
- temps réel en continu ;
- alertes ;
- watchlists persistées.

## 2. Utilisateurs et cas d'usage

| # | En tant que… | je veux… | pour… |
|---|---|---|---|
| U1 | investisseur | chercher un titre par nom ou symbole (ISIN selon la couverture du fournisseur) | ouvrir sa fiche |
| U2 | investisseur | voir le cours sur une période, en ligne ou en chandeliers, avec le volume | juger la tendance |
| U3 | investisseur | afficher des moyennes mobiles | repérer une tendance de fond |
| U4 | investisseur | comparer un titre à un indice ou à un autre titre sur la même période | savoir s'il fait mieux que le marché |
| U5 | détenteur du titre | voir mes achats, ventes et dividendes sur la courbe, avec mon PRU | relire mes décisions |
| U6 | investisseur | voir la performance par période, la volatilité, la pire baisse et la distance au plus haut | évaluer le risque |
| U7 | investisseur en dividendes | voir l'historique des dividendes par année et le rendement sur 12 mois | évaluer le revenu |
| U8 | utilisateur | retrouver d'un coup d'œil mes titres et les grands indices | suivre le marché du jour |

## 3. Données disponibles (fournisseur de cours actuel)

| Donnée | Disponible | Remarque |
|---|---|---|
| OHLC + volume | Oui | Intraday (5 min) à mensuel ; historique complet |
| Cours, variation du jour, horaires de séance | Oui | Déjà utilisé (`getStockQuotes`) |
| Plus haut / plus bas 52 semaines | Oui | Métadonnées du graphique |
| Place de cotation, devise, fuseau, type d'instrument | Oui | Métadonnées |
| Dividendes, splits | Oui | Événements du graphique |
| Recherche par nom ou symbole | Oui | Déjà utilisé (`searchStocks`) |
| Bilans, comptes de résultat, ratios, consensus | **Non** (pas de façon fiable) | Nécessite un fournisseur contractuel (v2) |

**Contraintes :**
- **Fournisseur non contractuel :** il peut changer de format ou limiter le débit. Tous les appels passent par nos routes serveur, avec cache, délai maximum et limite par utilisateur. Le nom du fournisseur n'apparaît pas dans l'interface (convention existante).
- **Pas de redistribution des données brutes** hors de l'application.
- **Cours différés selon la place.** On l'indique comme ailleurs : « Fermé · dernière séance », etc.

## 4. Parcours et écrans

### 4.1 Accueil `/marches`

1. **Recherche :** champ large en tête de page ; nom ou symbole (ISIN selon la couverture du fournisseur).
2. **Recherches récentes :** les 6 dernières fiches ouvertes, gardées dans le navigateur.
3. **Vos titres :** les titres actuellement détenus (déduits des transactions), avec cours, variation du jour et courbe sur 1 mois. Masqué s'il n'y en a pas.
4. **Indices et références :** les références du benchmark (`lib/benchmarks.ts`), même présentation.

Chaque ligne ouvre la fiche valeur.

### 4.2 Fiche valeur `/marches/[symbole]`

1. **En-tête :**
   - nom, symbole, place de cotation, devise, type (action, ETF, indice, crypto) ;
   - cours et variation du jour, état de la séance ;
   - rappel du titre détenu (quantité, PRU, plus-value latente), avec un lien vers Positions.
2. **Graphique :**
   - **Périodes :** 1J, 5J, 1M, 6M, YTD, 1A, 5A, Max. Par défaut 1A.
   - **Affichage :** ligne (aire) ou chandeliers ; volume en bas.
   - **Moyennes mobiles :** MM 20, 50 et 200 jours, activables séparément, calculées sur l'historique précédant la période (pas de trou au début).
   - **Comparaison :** jusqu'à 3 titres ou indices, raccourcis CAC 40, S&P 500 et MSCI World. Courbes en % depuis le début de la période. Pas disponible en 1J et 5J.
   - **Vos opérations :** achats, ventes et dividendes du titre, avec les couleurs de la légende des positions. En mode cours, à partir de 1M.
   - **Info-bulle :** date (heure en intraday, dans le fuseau de la place), ouverture, plus haut, plus bas, clôture, volume, moyennes affichées.
3. **Statistiques :**
   - performance du cours sur 1S, 1M, 3M, 6M, YTD, 1A, 3A et 5A ;
   - volatilité annualisée sur 1 an ;
   - pire baisse sur 1 an ;
   - plus haut et plus bas sur 52 semaines, avec la position du cours ;
   - volume moyen sur 3 mois.

   Chaque indicateur a une phrase d'explication.
4. **Dividendes** (titres qui en versent) :
   - total par année sur 5 ans ;
   - rendement sur 12 mois glissants ;
   - derniers versements ;
   - splits éventuels.

### 4.3 Navigation

- **Barre latérale** (≥ 1280 px) : nouvelle section « Analyse » avec l'entrée « Marchés ».
- **Mobile :** icône « Marchés » dans la barre du haut, à côté des paramètres.
- **Depuis Positions :** le détail d'une position propose « Voir la fiche ».
- **Accès :** page réservée aux utilisateurs connectés, comme le reste de l'application.

## 5. Exigences fonctionnelles v1

| ID | Exigence | Critère d'acceptation |
|---|---|---|
| F1 | Recherche | Saisie de 2 caractères ou plus → suggestions en 300 ms après la frappe. Entrée ouvre la première ; flèches haut/bas pour naviguer. Les recherches vides ou en échec affichent un message, pas d'erreur bloquante |
| F2 | Recherches récentes | La fiche ouverte est ajoutée en tête (sans doublon, 6 max). Absent si le stockage du navigateur est indisponible |
| F3 | Vos titres | Liste des symboles avec quantité > 0 sur un compte ; cours, variation du jour, sparkline 1M ; clic → fiche |
| F4 | Indices | Les 13 références du benchmark, même rendu |
| F5 | En-tête de fiche | Données de la séance ; « Titre introuvable » si le symbole ne renvoie rien, avec retour à la recherche |
| F6 | Périodes | Changement de période sans rechargement de la page ; la période est gardée dans l'URL (`?p=1A`) |
| F7 | Ligne / chandeliers | Bascule conservée pendant la consultation de la fiche ; volume sous le graphique dans les deux modes |
| F8 | Moyennes mobiles | MM 20/50/200 jours ; sur les périodes hebdo/mensuelles, longueur convertie (≈ 5 séances par semaine, 21 par mois) ; indisponibles en intraday |
| F9 | Comparaison | Jusqu'à 3 symboles ; base 0 % au premier point affiché ; séries alignées par date ; retirer une série en un clic |
| F10 | Vos opérations | Marqueurs aux dates des transactions BUY/SELL/DIVIDEND du titre ; liste de légende avec le nombre d'opérations |
| F11 | Statistiques | Valeurs calculées selon §6 ; « — » si l'historique est trop court |
| F12 | Dividendes | Historique sur 5 ans, total par année civile, rendement 12 mois ; section masquée sans dividende |
| F13 | États | Squelettes pendant le chargement ; message d'erreur avec « Réessayer » ; aucune page blanche |
| F14 | Mobile | Utilisable à 360 px : graphique pleine largeur, contrôles en lignes défilantes, pas de défilement horizontal de page |
| F15 | Sombre / clair | Tokens de l'application, lisible dans les deux thèmes |

## 6. Définitions de calcul

- **Performance d'une période :** `cours actuel / clôture de référence − 1`. La clôture de référence est la dernière clôture au plus tard à la date de début (aujourd'hui − 7 j, 1 mois, 3 mois, 6 mois, 1 an, 3 ans, 5 ans ; 31 décembre précédent pour YTD). Si le premier point disponible est postérieur de plus de 7 jours à la date de début → non disponible. Le dividende n'est pas inclus.
- **Volatilité annualisée (1 an) :** écart-type des rendements logarithmiques quotidiens sur un an × √252, ou × √365 pour les cryptos (cotation continue). Au moins 20 rendements.
- **Pire baisse (1 an) :** plus forte baisse entre un plus haut et un plus bas ultérieur, sur les clôtures quotidiennes de l'année écoulée.
- **Moyenne mobile N jours :** moyenne arithmétique des N dernières clôtures ; vide tant que N clôtures ne sont pas disponibles.
- **Distance au plus haut 52 semaines :** `cours / plus haut − 1`.
- **Rendement sur 12 mois :** somme des dividendes versés sur les 365 derniers jours / cours actuel.
- **Comparaison :** pour chaque série, `clôture / clôture du premier point affiché − 1`. Les dates sans cotation pour une série reprennent sa dernière valeur connue.

## 7. API

Toutes les routes exigent une session et sont limitées à 60 requêtes par minute et par utilisateur. Les erreurs du fournisseur sont converties en 502 avec `error: 'provider_unavailable'`.

### `GET /api/market/chart?symbol=CW8.PA&period=1A`

- `period` ∈ `1J, 5J, 1M, 6M, YTD, 1A, 5A, MAX`.
- Le serveur demande au fournisseur un historique plus long que la période (préchauffage des moyennes mobiles) et indique où commence l'affichage.

```json
{
  "symbol": "CW8.PA", "period": "1A", "interval": "1d", "intraday": false,
  "currency": "EUR", "timezone": "Europe/Paris", "displayFrom": 1759622400,
  "points": [{ "t": 1728000000, "o": 512.1, "h": 515.0, "l": 510.2, "c": 514.3, "v": 12345 }]
}
```

### `GET /api/market/overview?symbol=CW8.PA`

Données de la fiche, hors graphique : identité, séance, statistiques (§6) et dividendes.

```json
{
  "symbol": "CW8.PA", "name": "Amundi MSCI World", "exchange": "Paris", "currency": "EUR",
  "instrumentType": "ETF", "price": 596.4, "change": 4.1, "changePercent": 0.69,
  "previousClose": 592.3, "dayHigh": 597, "dayLow": 590, "volume": 12000,
  "regularMarketStart": 1791183600, "regularMarketEnd": 1791214200,
  "fiftyTwoWeekHigh": 610, "fiftyTwoWeekLow": 480, "averageVolume3M": 15000,
  "performance": { "1S": 0.01, "1M": 0.02, "3M": null },
  "volatility1Y": 0.14, "maxDrawdown1Y": -0.12,
  "dividends": [{ "date": "2026-05-14", "amount": 3.5 }],
  "dividendsByYear": [{ "year": 2026, "total": 3.5 }],
  "trailingYield": 0.006, "splits": [{ "date": "2024-06-10", "ratio": "10:1" }]
}
```

Les recherches et les sparklines réutilisent `/api/stocks/search`, `/api/stocks/quotes` et `/api/stocks/history`.

## 8. Offre

- **v1 accessible à tous (Free et Pro).** L'explorateur sert l'acquisition et la rétention : il donne une raison d'ouvrir Fi-Hub chaque jour, sans opération à saisir.
- **Décision ouverte (v1.1) :** réserver à Pro la comparaison à plusieurs titres et les fonctions v2 (watchlists illimitées, alertes). Hypothèse à valider avec les premiers chiffres d'usage.

## 9. Qualité

- **Performance :**
  - une fiche fait 2 appels serveur (graphique et vue d'ensemble), plus 1 par série comparée ;
  - les réponses du fournisseur sont mises en cache 60 s (intraday) et 1 h (quotidien et plus) ;
  - le graphique reste fluide jusqu'à environ 2 600 points.
- **Accessibilité :**
  - contrôles nommés (`aria-pressed` sur les bascules, `aria-current` sur la période) ;
  - le graphique a un résumé textuel (période, variation, plus haut, plus bas) ;
  - les couleurs ne sont jamais la seule information.
- **Tests :**
  - unitaires sur les calculs (§6), le découpage des périodes et la lecture de la réponse du fournisseur ;
  - parcours vérifié sur mobile et ordinateur, en clair et en sombre.

## 10. Hors périmètre v1 et suite

| Version | Contenu |
|---|---|
| v1.1 | Watchlists persistées (table `watchlist_items`, RLS) ; mode *Total Return* (cours ajusté des dividendes) ; « Voir la fiche » depuis chaque ligne de transaction |
| v2 | Alertes de cours par email (cron) ; RSI, MACD ; éligibilité PEA (liste ISIN) |
| v3 | Fondamentaux et ratios, screener : choisir un fournisseur contractuel (coût, couverture Europe, licence d'affichage) |
| Transverse | « Demander à Claude » depuis la fiche, via la connexion MCP existante |

## 11. Risques

| Risque | Effet | Parade |
|---|---|---|
| Changement ou limitation du fournisseur | Fiches vides | Cache, limite par utilisateur, message d'erreur clair, lecture tolérante de la réponse ; à moyen terme, fournisseur contractuel |
| Coût en appels sur des pages très consultées | 429 du fournisseur | Cache serveur, sparklines groupées en un appel |
| Confusion avec un conseil en investissement | Juridique | Aucune recommandation ni signal d'achat ; indicateurs descriptifs ; mention « Données de marché fournies à titre informatif » |
