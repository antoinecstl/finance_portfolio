# Spec — Explorateur de marchés v2 : une fiche qui s'adapte à l'actif

Statut : **plan + implémentation** (branche `claude/marches-v2`). Octobre 2026.
Suite de la [v1](explorateur-marches.md). Référence concurrente : carrousel « LVMH, l'action en chiffres » de Baggr (cours sur 10 ans, CA et marge nette, ventes par métier, trésorerie et dette, dividende et taux de distribution, free cash flow, PER historique avec médiane, plus haut et plus bas).

## 1. Constat

La fiche v1 affiche la même chose pour tous les titres : cours, statistiques, dividendes, puis un bloc « Analyse fondamentale » réservé aux actions. Trois limites :

1. **Pas d'adaptation au type d'actif.** Une crypto, un ETF ou un indice reçoivent les mêmes sections qu'une action, souvent vides (« Aucun dividende versé »), et rien de ce qui compte pour eux (offre en circulation, frais d'un ETF, composition…).
2. **Une photo, pas une histoire.** Les fondamentaux tiennent dans un tableau de 5 exercices et des ratios du jour. On ne voit ni l'évolution des marges, ni la dette dans le temps, ni si le PER actuel est cher par rapport à l'historique du titre.
3. **Une seule source, fragile.** Tout vient d'un fournisseur non contractuel. Une panne vide la fiche.

## 2. Principes

- **Une fiche, des modules.** Chaque module déclare les types d'actifs qu'il sert et les données dont il a besoin. Il ne s'affiche que si ces données existent. Jamais de section vide.
- **D'abord ce qu'on peut calculer nous-mêmes.** L'historique de cours (disponible pour tout actif) donne déjà beaucoup : performances annuelles, rendement dividendes réinvestis, saisonnalité, pertes depuis le plus haut, régularité de la tendance.
- **Les sources officielles avant les autres.** Quand une source officielle et gratuite existe (comptes déposés auprès de la SEC pour les sociétés américaines), elle prime ; le fournisseur de cours complète.
- **Résilience :** délai maximum, une nouvelle tentative, disjoncteur par source, cache persistant et dernière copie valide servie en cas de panne. Chaque module échoue seul.
- **Lisible :** une phrase d'explication par indicateur, pas de signal d'achat, pas de jugement « sous-évalué ». Mention « à titre informatif » conservée.
- **Graphiques sobres :** une seule échelle par graphique (pas de double axe). Deux grandeurs d'unités différentes → deux petits graphiques côte à côte, ou une base 100 commune.

## 3. Types d'actifs et onglets

Le type vient des métadonnées de cotation (`instrumentType`), ramené à une classe :

| Classe | Types source | Onglets |
|---|---|---|
| Action | EQUITY | Aperçu · Performance · Finances · Valorisation · Profil |
| ETF / fonds | ETF, MUTUALFUND | Aperçu · Performance · Composition |
| Crypto | CRYPTOCURRENCY | Aperçu · Performance · Marché |
| Indice | INDEX | Aperçu · Performance |
| Devise, matière première, autre | CURRENCY, FUTURE, … | Aperçu · Performance |

- L'onglet actif est dans l'URL (`?vue=finances`), à côté de la période du graphique (`?p=`).
- **Aperçu** = la fiche v1 (cours, détention, graphique, statistiques, dividendes s'il y en a, actualités).
- Un onglet ne charge ses données qu'à l'ouverture : pas d'appel inutile au fournisseur.
- En-tête (cours, variation, « Dans votre patrimoine ») visible sur tous les onglets.

## 4. Modules

### 4.1 Performance (tous les actifs) — calculée par Fi-Hub à partir des cours

| Module | Contenu | Données |
|---|---|---|
| Chiffres clés long terme | Croissance annuelle moyenne (5 ans, 10 ans, depuis l'origine), régularité de la tendance (R² de la droite de régression sur le cours en échelle log), volatilité 3 ans, plus forte baisse sur 10 ans, plus haut historique et écart actuel | Cours quotidiens 10 ans + mensuels depuis l'origine |
| Performance par année civile | Barres par année, avec bascule **cours seul / dividendes réinvestis** (actions, ETF) | Clôtures ajustées des dividendes et splits |
| Saisonnalité | Tableau année × mois des variations, couleur gain/perte d'intensité proportionnelle ; ligne « moyenne » et « % d'années positives » par mois | Clôtures mensuelles 10 ans |
| Pertes depuis le plus haut | Courbe « sous l'eau » : écart au plus haut atteint jusque-là ; plus longue période de récupération | Clôtures quotidiennes 10 ans |

Crypto : volatilité annualisée sur 365 jours (cotation continue).

### 4.2 Finances (actions) — l'histoire des comptes

Petits graphiques à une seule échelle, chacun avec sa croissance annuelle moyenne :

1. Chiffre d'affaires ; marges brute, opérationnelle et nette (graphique séparé en %).
2. Résultat net et BPA dilué.
3. Free cash flow et marge FCF.
4. Trésorerie et dette financière (barres groupées, même unité) ; dette nette / EBITDA (graphique séparé).
5. Dividende par action (versements de l'année) et taux de distribution.
6. Nombre d'actions (rachats ou dilution).
7. Rentabilité des capitaux propres (ROE).

**Graphique personnalisé :** l'utilisateur choisit jusqu'à 4 indicateurs parmi ceux disponibles. Même unité → un graphique ; unités différentes → un petit graphique par indicateur, années alignées ; option **base 100** pour comparer des croissances sur une seule échelle.

Le tableau des comptes annuels reste en dessous (vue tableau des graphiques).

### 4.3 Valorisation (actions)

- **Ratios du jour** (v1.1, inchangés).
- **Multiples dans le temps :** PER, cours / FCF, cours / CA, VE / EBITDA, cours / actif net et rendement du dividende, chaque semaine sur l'historique disponible, avec **médiane, plus haut et plus bas** de la période et le rang du multiple actuel (« plus bas que 80 % des semaines depuis 2016 »). Le multiple d'une semaine utilise les comptes du dernier exercice publié (clôture + 2 mois), puis les 12 derniers mois pour la dernière valeur.
- **Repères de valorisation :** ce que vaudrait l'action selon plusieurs méthodes, sur un axe avec le cours actuel :
  - PER médian historique × BPA 12 mois ;
  - cours / FCF médian × FCF par action ;
  - cours / CA médian × CA par action ;
  - simulateur DCF (valeurs par défaut) ;
  - nombre de Graham ;
  - objectif moyen des analystes.
  Méthodes sans objet (bénéfice négatif…) masquées. Présenté comme des repères pédagogiques, jamais comme une recommandation.
- **Simulateur DCF** et **consensus des analystes** (v1.1).

### 4.4 Profil (actions)

Description, secteur, pays, effectifs, site, actionnariat (initiés, institutions, vente à découvert), prochaines dates (résultats, détachement).

### 4.5 Composition (ETF et fonds)

- **Identité :** catégorie, émetteur, frais courants (TER), encours, date de création, rendement distribué.
- **Principales lignes** (10 au plus, avec poids ; lien vers la fiche si la ligne est cotée).
- **Secteurs** et **répartition** (actions, obligations, liquidités, autres).
- **Multiples du portefeuille** (PER, P/B… publiés pour l'ETF).
- **Risque publié** sur 3, 5 et 10 ans (volatilité, bêta, ratio de Sharpe) quand il existe.

### 4.6 Marché (cryptos)

- Capitalisation, volume sur 24 h et ratio volume / capitalisation.
- **Offre :** en circulation, maximum, part déjà émise (jauge), capitalisation entièrement diluée.
- **Plus haut historique** (date, écart actuel) et ancienneté de l'actif.
- **Corrélation** des variations quotidiennes sur 1 an avec le bitcoin (avec le S&P 500 pour le bitcoin lui-même).
- Description et algorithme quand ils sont publiés.

## 5. Données : ce qui est récupérable

| Donnée | Source | Couverture | Fiabilité |
|---|---|---|---|
| Cours quotidiens, mensuels, clôtures ajustées, dividendes, splits | Fournisseur de cours (endpoint « chart ») | Tous actifs, depuis l'origine | Bonne ; déjà en production |
| Comptes annuels (≈ 4 exercices), trimestriels récents, 12 mois glissants | Fournisseur (séries temporelles, sans jeton) | Actions mondiales | Correcte |
| Comptes annuels sur 10-15 ans | **SEC EDGAR** (`companyfacts`, données XBRL des 10-K) | Sociétés américaines déposant en US GAAP | **Officielle**, gratuite, sans clé, 10 req/s ; impose un `User-Agent` avec contact |
| Profil, consensus, actionnariat | Fournisseur (module « résumé », cookie + jeton) | Actions | Fragile ; mis en cache, facultatif |
| Composition, frais, risque d'un ETF | Fournisseur (« résumé » : `fundProfile`, `topHoldings`, `fundPerformance`) | ETF, fonds ; couverture inégale en Europe | Fragile ; module masqué si vide |
| Capitalisation, offre, volume 24 h, description d'une crypto | Fournisseur (« résumé » : `summaryDetail`, `summaryProfile`) | Principales cryptos | Fragile ; facultatif |
| Plus haut historique, corrélations, saisonnalité | **Calculés par Fi-Hub** à partir des cours | Tous actifs | Aussi fiable que les cours |

**Sources étudiées et écartées pour l'instant :**

| Source | Intérêt | Pourquoi pas maintenant |
|---|---|---|
| CoinGecko | Rang, offre totale, plus haut historique daté, catégories | L'offre gratuite impose d'afficher la source ; notre convention est de ne pas nommer les fournisseurs de données. À décider |
| Comptes ESEF européens (filings.xbrl.org + LEI GLEIF) | Comptes officiels des sociétés européennes depuis 2020 | Correspondance symbole → LEI non triviale, format xBRL-JSON lourd. Bon candidat v3 pour remplacer le fournisseur sur l'Europe |
| Financial Modeling Prep, EOD, Twelve Data | Historiques longs mondiaux, segments, géographies | Payants pour l'Europe ; à envisager si l'usage le justifie (fournisseur contractuel, cf. spec v1 §10) |
| Ventes par métier ou par zone (graphique Baggr 4/9) | — | Aucune source gratuite structurée. Écarté |

## 6. Consolidation des comptes

Pour une société américaine (symbole sans suffixe de place, cotation en USD) :

1. **Ticker → CIK** via la table officielle `company_tickers.json` (cache 7 jours).
2. **Faits XBRL** des 10-K : pour chaque poste, liste ordonnée de concepts US GAAP (ex. CA : `Revenues`, puis `RevenueFromContractWithCustomerExcludingAssessedTax`, puis `SalesRevenueNet`), choisie **exercice par exercice** car les sociétés changent de concept dans le temps. Flux : périodes de 330 à 400 jours ; bilan : valeur à la date de clôture. Pour une même clôture, la valeur déposée le plus récemment l'emporte (retraitements).
3. **Fusion :** la SEC fournit la série d'un poste quand elle l'a ; le fournisseur comble les exercices manquants et donne les 12 mois glissants.
4. **Contrôle croisé :** si les deux sources ont le CA d'un même exercice et divergent de plus de 5 %, on garde la SEC et on journalise l'écart (côté serveur).
5. Les sociétés étrangères (20-F, IFRS) restent sur le fournisseur : pas de mélange de devises ni de ratio ADR.

## 7. Résilience

| Mécanisme | Détail |
|---|---|
| Délai maximum | 5 à 10 s selon l'appel |
| Nouvelle tentative | Une seule, sur erreur réseau, 429 ou 5xx, après 300-800 ms |
| Disjoncteur par source | 5 échecs consécutifs → la source est mise en pause 60 s : réponse immédiate depuis le cache plutôt qu'une attente |
| Cache persistant | Table `market_data_cache` (service role uniquement) : résultats **déjà calculés et compacts** (quelques Ko), pas les réponses brutes |
| Copie de secours | Si la source échoue, la dernière copie valide est servie (jusqu'à 30-90 jours selon la donnée), marquée « données du JJ/MM » |
| Requêtes simultanées | Une seule requête en vol par clé (les visiteurs d'une même fiche la partagent) |
| Isolation | Chaque onglet et chaque module échoue seul, avec « Réessayer » |

| Donnée | Fraîche | Secours |
|---|---|---|
| Table ticker → CIK | 7 j | 90 j |
| Comptes SEC | 24 h | 90 j |
| Séries du fournisseur | 6 h | 30 j |
| Composition ETF, données crypto | 6 h | 30 j |
| Performance, valorisation calculées | 6 h | 7 j |

Sans la table (migration non appliquée), tout fonctionne avec le cache en mémoire seul.

## 8. API

Mêmes règles que la v1 : session obligatoire, 60 requêtes par minute et par utilisateur, 502 `provider_unavailable` si rien n'est disponible.

| Route | Contenu |
|---|---|
| `GET /api/market/overview` | v1 + `assetClass` |
| `GET /api/market/performance?symbol=` | `{ stats, annualReturns, monthlyReturns, drawdown, asOf, stale }` |
| `GET /api/market/fundamentals?symbol=` | v1.1 + `history` (exercices fusionnés, 15 au plus), `sources` |
| `GET /api/market/valuation?symbol=` | `{ multiples: { per: { points, median, high, low, current, percentile } … }, references, currency }` |
| `GET /api/market/details?symbol=` | `{ assetClass, etf?, crypto? }` |

## 9. Phases

| Phase | Contenu | Statut |
|---|---|---|
| 1 | Couche de données résiliente, cache persistant, fiche à onglets par type d'actif, onglet Performance | Cette branche |
| 2 | Finances historiques (fournisseur + SEC), graphique personnalisé | Cette branche |
| 3 | Valorisation historique, repères de valorisation | Cette branche |
| 4 | Composition des ETF, marché des cryptos | Cette branche |
| 5 | Comptes européens officiels (ESEF), éligibilité PEA, watchlists, alertes | Plus tard |

## 10. Décisions ouvertes

- **Offre Pro :** réserver au plan Pro les historiques au-delà de 5 ans, le graphique personnalisé et les repères de valorisation ? Hypothèse : laisser tout ouvert le temps de mesurer l'usage.
- **CoinGecko :** accepter d'afficher sa mention pour enrichir l'onglet Marché des cryptos ?
- **`SEC_USER_AGENT`** : la SEC demande un nom et un email de contact dans l'en-tête (ex. `Fi-Hub contact@domaine.fr`). Variable d'environnement à renseigner sur Vercel.

## 11. Tests

- Unitaires sur toutes les fonctions pures : performances, saisonnalité, pertes depuis le plus haut, R², lecture des faits SEC, fusion, multiples et leurs statistiques, repères de valorisation, lecture ETF et crypto, disjoncteur, cache.
- Routes testées avec des réponses de source enregistrées au format documenté.
- Parcours vérifié sur mobile et ordinateur, en clair et en sombre.
- **Limite :** l'environnement de développement n'a pas accès aux sources réelles. La lecture des réponses suit leurs formats documentés ; à vérifier sur un déploiement de prévisualisation avant fusion (fiches AAPL, MC.PA, CW8.PA, BTC-USD, ^FCHI).
