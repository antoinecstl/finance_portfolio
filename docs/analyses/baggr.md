# Analyse concurrentielle — Baggr (baggr.fr)

Octobre 2026. Préparée pour cadrer l'explorateur de marchés de Fi-Hub ([spec](../specs/explorateur-marches.md)).

## Méthode et limites

- **Accès au site :** baggr.fr n'était pas joignable depuis l'environnement de travail (proxy réseau). L'analyse repose sur des sources secondaires : moteur de recherche, centre d'aide et journal des mises à jour de Baggr indexés, avis de blogueurs, publications de Baggr sur X.
- **Fiabilité :** les chiffres annoncés (nombre d'entreprises, d'utilisateurs, prix) sont ceux que Baggr ou ses affiliés publient. Ils ne sont pas vérifiés.
- **À faire :** une session de 30 minutes sur l'essai gratuit (14 jours, sans carte) pour confirmer l'interface, les périodes de graphique et les limites. Plusieurs sources sont des liens affiliés (codes promo), donc favorables.

## Fiche d'identité

| | |
|---|---|
| Éditeur | Société BAGGR (SIREN 995 241 429), fondée par Hugo Vialleix |
| Promesse | « Trouvez et partagez vos meilleures idées d'investissement. » Le nom vient du *10-bagger*, une action qui multiplie la mise par 10 |
| Cible | Investisseur particulier francophone en actions, orienté analyse fondamentale et long terme |
| Couverture annoncée | Plus de 50 000 sociétés cotées, plus de 40 ans d'historique |
| Audience annoncée | Plus de 6 500 investisseurs |
| Plateformes | Web responsive. Pas d'application mobile native |
| Prix | Essai 14 jours sans carte, puis 17 €/mois sans engagement, ou 150 €/an (12,50 €/mois) |

## Fonctionnalités observées

| Domaine | Ce que propose Baggr |
|---|---|
| Fiche valeur | Onglets Résumé, Quantitatif, Évaluation, Finances. Le résumé montre la qualité de l'entreprise « en un coup d'œil » ; des dizaines de graphiques d'analyse quantitative depuis la refonte |
| Graphique de cours | Modes Cours et *Total Return* (cours ajusté des dividendes réinvestis), *Fair Value*, comparaison de plusieurs cours superposés |
| Données financières | Bilans, comptes de résultat, flux de trésorerie, présentés de façon homogène d'une société à l'autre |
| Ratios | Ratios de valorisation quotidiens (P/E, Forward P/E, PEG) et leur évolution ; ratios de qualité (ROE, ROIC, marges) |
| Valorisation | Calculateur de prix juste (sur BPA, FCF ou chiffre d'affaires) avec marge de sécurité ; DCF ; « Score Q » |
| Screener | Filtres sur ROE, ROIC, marge opérationnelle, marge FCF, P/E, P/FCF, croissance du CA, dette nette / EBITDA… Filtre **éligibilité PEA** en un clic, filtre « cotation active » |
| Watchlists | Illimitées (offre payante), avec prix juste, rendement et marge calculés automatiquement quand l'utilisateur n'a pas saisi d'hypothèses |
| Portefeuille | Arrivé en juin 2024 : TWR, MWR/TRI, comparaison aux indices (S&P 500, CAC 40, MSCI World), dividendes par action et calendrier des dividendes, import depuis plusieurs courtiers |
| Super-investisseurs | Portefeuilles de Buffett, Marks, Terry Smith, Ackman, Burry… mis à jour chaque trimestre depuis les déclarations 13F, avec une courbe de performance TWR |
| Communauté | Thèses d'investissement publiées par les membres, commentaires, concours mensuel (200 € pour la meilleure thèse) |
| Alertes | Absentes d'après un avis de 2026 |

## Forces

- **Profondeur des données fondamentales :** états financiers et ratios historisés sur des décennies, homogènes d'une société à l'autre. C'est le cœur du produit et ce qui justifie 17 €/mois.
- **Pensé pour la France :** interface en français et filtre PEA, rare sur les outils américains.
- **Contenu et communauté :** thèses, super-investisseurs et concours créent une raison de revenir sans même avoir de portefeuille.
- **Rythme de mises à jour élevé :** journal public des nouveautés, refonte terminée en février 2025.
- **Distribution par affiliation :** les créateurs finance (X, Substack, YouTube) diffusent des codes promo.

## Faiblesses et angles morts

- **Suivi de patrimoine limité aux actions :** pas de livrets, PEL, assurance-vie en fonds euros ni vue de patrimoine global. Le portefeuille est arrivé tard et reste centré sur les titres.
- **Prix d'entrée élevé :** 17 €/mois, sans offre gratuite durable après l'essai.
- **Pas d'application native ni d'alertes de cours.**
- **Positionnement expert :** ratios, DCF, screener. Le produit est moins accessible à l'épargnant qui veut juste savoir où il en est.

## Ce que cela veut dire pour Fi-Hub

| | Fi-Hub | Baggr |
|---|---|---|
| Question centrale | « Où en est mon patrimoine, et ai-je bien fait ? » | « Quelle action acheter ? » |
| Enveloppes | PEA, CTO, livrets, PEL, assurance-vie, crypto | Titres |
| Saisie | Manuelle, import de relevés par IA (Pro) | Import courtiers |
| Performance | Hors apports (Dietz), benchmark, projection | TWR, MWR, indices |
| Analyse de marché | Courbe par position seulement | Fiche valeur complète, screener, ratios |
| IA | Connexion Claude / ChatGPT en lecture seule (Pro) | Non observé |
| Prix | Free, puis Pro à 4,99 €/mois | Essai, puis 17 €/mois |

**Recouvrement :** le suivi de portefeuille (performance, indices, dividendes, import) est désormais commun. Baggr y entre par l'analyse ; Fi-Hub doit défendre ce terrain par la vue patrimoine complète et la simplicité.

**Opportunité pour l'explorateur de marchés.** Ne pas copier Baggr sur les fondamentaux en v1 : notre fournisseur de cours n'en fournit pas de façon fiable, et c'est un chantier de données coûteux. Se différencier sur ce que Baggr ne fait pas :

1. **Relier marché et patrimoine.** Sur la fiche d'un titre détenu : vos achats, ventes et dividendes sur la courbe, votre PRU, votre plus-value. Le titre est vu à travers votre histoire avec lui.
2. **Tout le monde y a accès, gratuitement.** L'exploration de cours sert l'acquisition et la rétention : on revient consulter un titre sans avoir d'opération à saisir.
3. **Lisible pour l'épargnant :** périodes simples, performance par période, volatilité et pire baisse expliquées en une phrase, dividendes par année.
4. **Pont vers l'IA :** la connexion Claude / ChatGPT existe déjà. À terme, on pourra demander « explique-moi ce titre » depuis la fiche, à partir des données de Fi-Hub.

**À reprendre de Baggr plus tard (v2+), si les données le permettent :**
- watchlists ;
- comparaison de cours ;
- *Total Return* ;
- filtre PEA ;
- fondamentaux et screener, avec un fournisseur contractuel.

## Sources

- [baggr.fr — page d'accueil (titre indexé)](https://baggr.fr/)
- [Centre d'aide Baggr — Screener](https://baggr.fr/aide/screener)
- [Baggr — 24/06/09 : le portefeuille est arrivé](https://baggr.fr/aide/mises-a-jour-2024/24-06-09-le-portefeuille-est-arrive)
- [Baggr — 24/12/16 : le calcul de prix juste évolue](https://baggr.fr/aide/mises-a-jour-2024/24-12-16-le-calcul-de-prix-juste-evolue)
- [Baggr — 25/02/03 : refonte terminée](https://help.baggr.fr/fr/articles/10501987-25-02-03-refonte-terminee)
- [Baggr sur X — grosse mise à jour (ratios, graphiques, super-investisseurs, screener)](https://x.com/Baggr_fr/status/2072269436971610282)
- [Passiv Invest — « L'outil que j'utilise tous les jours pour analyser mes actions »](https://passivinvest.substack.com/p/baggr)
- [Clean Your Finance — Avis Baggr (2026)](https://www.cleanyourfinance.com/p/141-avis-baggr-2026-loutil-ultime)
- [Annuaire des entreprises — BAGGR](https://annuaire-entreprises.data.gouv.fr/entreprise/baggr-995241429)
- [GregInvest sur X — essai 14 jours](https://x.com/GregInvestFr/status/2045543112123265209)
