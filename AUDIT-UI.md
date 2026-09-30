# Audit UI — fi-hub

Date : 29 septembre 2026. Statut : **réalisé** sur la branche `design/refonte-publique` (non commité, non déployé).
Direction retenue et appliquée : voir [DESIGN.md](DESIGN.md) (direction A, « Relevé »).

## Réalisation (29/09/2026)

### Corrections de cet audit

La relecture du code pendant la réalisation a montré trois erreurs dans la première version de cet audit :
- **Frais et PRU.** Le PRU **n'inclut pas** les frais : `calculatePositionsAtDate` calcule `quantité × prix`. Les frais sont des lignes `FEE` séparées, débitées des liquidités. Les mentions « PRU frais inclus » ont été retirées partout, y compris de trois passages des guides SEO.
- **Indices.** Le benchmark propose **10 indices**, pas 3 : CAC 40, S&P 500, Nasdaq 100, Nasdaq Composite, Dow Jones, Euro Stoxx 50, DAX, FTSE 100, Nikkei 225, Russell 2000. La liste est désormais partagée via `lib/benchmarks.ts`.
- **Export CSV.** Il **n'existe dans aucun écran** : aucune route ni aucun bouton ne l'implémente. Il reste pourtant listé dans l'offre Pro (`lib/plans.ts`). Les nouvelles pages publiques ne l'annoncent plus. Voir « À décider ».

### Décisions appliquées

| # | Décision |
|---|---|
| D1 | Direction A appliquée |
| D2 | Pictogramme redessiné en SVG (`public/icon.svg`, `components/marketing/logo-paths.ts`) |
| D3 | Boutons d'action de l'app en encre (`.btn-ink`) |
| D4 | Survol `.btn-ink` / `.btn-outline` changé globalement |
| D5 | Texture pointillée retirée des pages publiques uniquement |
| D6 | Tarifs ouverts sur « Mensuel » |
| D7 | « Cours actualisés automatiquement » au lieu de « temps réel » (dans `lib/plans.ts`, la FAQ, les métadonnées et l'onboarding) |
| D8 | « Infrastructure européenne » (FAQ) et « Fait en France » (pied de page) retirés faute de confirmation |
| D9 | Le compte proposé contenait des **données réelles**. Aucune capture n'en a été tirée. Les figures sont des composants de l'app rendus avec un portefeuille fictif (DESIGN.md §8) |
| D10 | Section « Excel contre Fi-Hub » supprimée de la landing |

### État des constats

- **A1 (promesses inexactes) : corrigé.** Bandeau de cours et chiffres fictifs non signalés retirés, import étiqueté Pro, FAQ réécrite, « Populaire » retiré, métadonnées réécrites.
- **A2, A3, A4, A5, A6.1–A6.2, A7 : appliqués.**
- **A6.3 (contenu des pages Alternatives) : non traité** (hors périmètre).
- **A8.1 (sous-traitants dans la politique de confidentialité) : non traité.** C'est un texte juridique, qui reste à compléter par vous.
- **B1 à B12 : appliqués.** B7 a été étendu à la virgule décimale du benchmark ; B11 aux titres « Valeur totale », « Portefeuille actions », « Évolution du portefeuille », « Vue d'ensemble des performances », « Performance par position » et « Détail par position ».

### Passe de clôture (29/09/2026)

**Captures de revue :** `docs/refonte-ui/` (voir son README).

**Constats de l'application, vus avec des données de test** (composants réels, réseau simulé) :
- **Défaut préexistant :** la modale de limite affiche « autorise 3 compte » (pluriel manquant).
- **Couleur préexistante :** la notification Pro et les barres de progression de l'onboarding restent rouges (remap `blue→accent` et `--accent`).
- **Casse et virgule décimale restantes, préexistantes :** « Répartition du Portefeuille », « Répartition par Compte », « Performance Annuelle » ; point décimal dans « Performance annuelle » et « Poids ».
- **Conséquence de B4 :** à 390 px, les onglets « Transactions » et « Dividendes » ne sont accessibles qu'en faisant défiler la barre horizontalement. Décision à prendre.

### Passe finale (30/09/2026)

- **Message principal :** « Vos placements réunis. Votre performance en clair. », avec le sous-titre validé.
- **Pages publiques :**
  - deux sections côte à côte (benchmark, dividendes) utilisant les vues mobiles réelles ;
  - un cadre unique pour toutes les captures ;
  - des captures dans le vrai thème sombre de l'application.
- **Onglets mobiles :** les cinq destinations sont visibles à 360 et 390 px.
- **Export CSV :** retiré de l'offre (`lib/plans.ts`), des composants Pro et de l'email d'activation.
  - La clé `csv_export` était lue uniquement depuis le code (`PLANS`, via `hasUserFeature`) ; aucune route ni aucun composant ne la testait. Elle est retirée sans effet sur les droits.
  - La colonne `plans.features` en base contient encore `csv_export`, déposé par la migration du 18/04. Cette colonne n'est lue nulle part : **aucune correction de données n'est nécessaire**, et la migration n'est pas modifiée.
- **Confidentialité :** proposition séparée dans `docs/confidentialite-proposition.md`. La page légale n'est pas modifiée.
- **Corrections mineures :**
  - « autorise 3 comptes » ; « Voir l'année précédente » ;
  - titres en casse de phrase ;
  - virgule décimale dans les graphiques (27 valeurs affichées, précision inchangée) ;
  - espaces avant les deux-points ;
  - notification Pro au style neutre.
- **Toujours préexistant et non traité :** barres de progression rouges de l'onboarding, placeholder rose de `ProBlur`.

**Contrôles :**
- Le build Turbopack échoue de la même façon sur le code non modifié (`os error 1314`, privilège de lien symbolique Windows). C'est **préexistant et lié à l'environnement**.
- Le build webpack passe.
- Le build sur Linux (CI) n'a **pas été vérifié**.

---


## Méthode et limites

- Lecture du dépôt : routes, layouts, `app/globals.css`, `components/marketing/*`, `lib/plans.ts`, `lib/seo-pages.ts`, `lib/import/*`, formulaires d'authentification, écrans connectés, brief `marketing/campagne-lancement-fi-hub.md`.
- **Pages publiques : vérifiées visuellement** en local (`next dev` avec les variables factices de la CI, rendu Edge sans interface) :
  - ordinateur à 1440 px ;
  - mobile émulé à 390 px, avec réduction des mouvements.
  - Aucun débordement horizontal au niveau des pages.
- **Application connectée : non rendue.** Elle nécessite une vraie base Supabase. Les constats de la partie B viennent de la lecture du code et des trois captures de `public/` (mai 2026). Ce ne sont **pas** des vérifications visuelles de l'état actuel.
- Le mode sombre n'a pas été capturé. Ses tokens existent dans `globals.css`.

## Décisions déjà prises (échanges du 29/09/2026)

| Sujet | Décision |
|---|---|
| Public prioritaire | Investisseur particulier actif (PEA/CTO, souvent un tableur), conformément au brief de mai |
| Action principale | Créer un compte **Free**. Pro présenté ensuite, sans mélanger ses fonctions à la promesse gratuite |
| Perception | Outil **précis et honnête** |
| Références | Aucune. Direction A « Relevé » choisie parmi deux propositions |
| Marque conservée | Palette papier/encre, logotype « Fi-Hub » en Fraunces, pictogramme `icon.png` (à nettoyer) |
| Rouge | Retiré comme couleur de marque : réservé aux pertes et aux erreurs |
| Preuves | Aucun chiffre, témoignage ni code promo. Crédibilité par le produit montré et la transparence |
| Import | Ne citer que le vérifié. Mettre en valeur le moteur d'import Fi-Hub (contrôles, mapping, validation) **sans nommer de fournisseur d'IA** sur les pages marketing |
| Périmètre public | Landing + tarifs, Fonctionnalités, Guides et Alternatives, Authentification |

## Ce que le code démontre (base des arguments)

| Fonction | Preuve dans le code | Offre |
|---|---|---|
| Comptes PEA, CTO, Livret A, LDDS, AV, PEL, crypto, autre | `lib/types.ts:3` | Free (3 comptes) |
| Positions et PRU recalculés depuis les transactions (PRU hors frais ; frais débités du cash), multi-devises | `lib/portfolio-calculator.ts`, `lib/position-metrics.ts` | Free (10 positions) |
| Historique jour par jour (cache de snapshots recalculé à chaque modification) | `lib/portfolio-snapshots.ts:6-11` | Free |
| Performance hors apports vs **10 indices** (CAC 40, S&P 500, Nasdaq 100, Euro Stoxx 50, DAX…) | `lib/benchmarks.ts` | Free |
| Projection de patrimoine (scénarios) | `components/PerformanceProjectionChart.tsx` | à confirmer |
| Dividendes, rendement sur coût, évolution annuelle | `components/DividendsTable.tsx` | Pro |
| Import CSV, XLSX, PDF, JPG/PNG/WebP, texte collé | `components/ImportWizard.tsx:597`, `lib/import/file-types.ts` | Pro |
| Lecteurs dédiés : **Boursorama, Trade Republic** (CSV/XLSX) | `lib/import/declarative.ts:211` | Pro |
| Prévisualisation, édition ligne par ligne, détection des doublons, contrôle cash/positions | `lib/import/README.md`, `lib/transaction-duplicates.ts`, `lib/import/cash-preview.ts` | Pro |
| Export JSON complet, export PDF | `app/api/account/export/*` | Free |
| Export CSV | Annoncé dans `lib/plans.ts` (`csv_export`) mais **non implémenté** | Pro (annoncé) |
| Carte de partage d'une position (sans montants par défaut) | `components/share/*` | — |
| Pas de connexion bancaire | FAQ + absence de code d'agrégation | — |

**Absent du code, donc à ne plus affirmer :**
- MSCI World ou « ETF Monde » comme indice de référence ;
- lecteurs dédiés Bourse Direct et Degiro ;
- snapshots « pris chaque jour automatiquement » ;
- la mention « temps réel » reste à confirmer (voir D7).

---

## A. Pages publiques — périmètre principal

Priorités :
- **P0** : information fausse ou trompeuse, à corriger en premier ;
- **P1** : compréhension ou crédibilité fortement dégradées ;
- **P2** : cohérence ;
- **P3** : finition.

### A1. Promesses inexactes (P0)

**A1.1 — Benchmark « MSCI World / ETF Monde »**
- *Où :* `app/(marketing)/page.tsx:385-391` (section Benchmark), `:475` (colonne « Après »).
- *Problème :* le produit propose CAC 40, S&P 500 et Nasdaq 100. MSCI World n'existe pas.
- *Impact :* un utilisateur qui cherche précisément à se comparer à un ETF Monde (cas très courant sur PEA) sera déçu dès sa première session.
- *Remplacement :* « Comparez votre performance, hors apports, au CAC 40, au S&P 500 ou au Nasdaq 100 sur la même période. »

**A1.2 — Import présenté comme gratuit**
- *Où :*
  - `page.tsx:239` (« Importez vos relevés en un clic » dans le hero) ;
  - `:270` (bloc de réassurance « Import en un clic » à côté de « Sans carte bancaire ») ;
  - `:363-367` (« Importer mon premier relevé » puis « Gratuit · aucune carte bancaire ») ;
  - `:501` (étape 02 « collez un relevé broker ») ;
  - `:579` (« Importez votre patrimoine en un clic »).
- *Problème :* l'import est réservé au Pro (`lib/plans.ts`, migration `20260429_import_pro_only.sql`), mais le bouton « Importer mon premier relevé » mène à une inscription Free.
- *Impact :* promesse cassée juste après l'inscription, au pire moment pour la confiance. Risque de perception de pratique trompeuse.
- *Remplacement :* section Import étiquetée « Inclus dans Pro — premier mois gratuit en mensuel ». Le bouton de cette section devient « Voir les offres ». Le hero ne mentionne que ce qui est gratuit.

**A1.3 — FAQ contradictoire**
- *Où :* `components/marketing/faq-data.ts:7-8`.
- *Problème :* « Vous saisissez vos comptes et transactions manuellement », alors que la landing vend l'import.
- *Remplacement :* « Non. Fi-Hub ne se connecte à aucune banque. Vous saisissez vos opérations, ou vous importez un relevé (CSV, Excel, PDF, capture) avec l'offre Pro. Chaque ligne importée est vérifiée par vous avant d'être enregistrée. »

**A1.4 — Courtiers cités sans lecteur dédié**
- *Où :* `page.tsx:241` (Bourse Direct, Degiro), `:329`.
- *Remplacement :* « Relevés CSV, Excel, PDF ou captures d'écran, de n'importe quel courtier. Les exports Boursorama et Trade Republic sont reconnus directement. »

**A1.5 — Bandeau de cours figé qui se présente comme un flux**
- *Où :* `page.tsx:51-62`, `:166-180` ; CSS `app/globals.css:801-811`.
- *Problème :* cotations codées en dur (NVDA 887,40, etc.), animées en boucle comme un flux en direct.
- *Impact :* pour un public qui connaît les cours, un prix faux se voit immédiatement et discrédite la mention « temps réel ». C'est aussi de la décoration sans fonction.
- *Remplacement :* suppression. Pas de substitut.

**A1.6 — Chiffres de performance fictifs non signalés**
- *Où :* `page.tsx:737-751` (142 580,42 €, +12,4 % YTD, « vs CAC 40 +6,8 % ») et `:1024-1049` (alpha +5,6 pts).
- *Problème :* la performance montrée surclasse l'indice sans mention d'exemple. Pour un produit financier, c'est une performance suggérée.
- *Remplacement :* vraies captures d'un compte de démonstration, légendées « Données d'exemple ». Une sous-performance ou un écart modeste est préférable (la capture actuelle `Benchmark_vue.png` montre +0,87 pt, ce qui est crédible).

**A1.7 — « Snapshots quotidiens — une photo chaque jour, automatiquement »**
- *Où :* `page.tsx:428-431`.
- *Problème :* le code recalcule un historique jour par jour à la demande. Aucune tâche planifiée ne photographie le patrimoine.
- *Remplacement :* « Historique jour par jour, reconstruit à partir de vos opérations et des cours passés. »

**A1.8 — Badge « Populaire » sur l'offre Pro**
- *Où :* `components/marketing/PricingCard.tsx:37-44`.
- *Problème :* affirme une popularité non mesurée (aucune preuve disponible).
- *Remplacement :* retirer le badge. L'avantage annuel reste affiché (« 2 mois offerts »).

**A1.9 — Métadonnées**
- *Où :* `page.tsx:30` et `:38` ; `app/layout.tsx` (description, OpenGraph).
- *Problème :* « import en un clic », « benchmark CAC 40 / S&P 500 » à côté de « gratuit pour démarrer », « temps réel ».
- *Remplacement :* réécrire à partir de la même base factuelle que la landing (voir D7). Garder `siteName` et le JSON-LD `WebSite` alignés (règle de CLAUDE.md).

### A2. Structure et hiérarchie de la landing (P1)

**A2.1 — Composition mécanique**
- *Où :* `page.tsx` entier.
- *Constat :* après le hero, la page empile sept blocs de même facture :
  - réassurance en 4 cellules ;
  - Import ;
  - Benchmark ;
  - grille de 5 cellules « Et tout le reste » ;
  - Excel contre Fi-Hub ;
  - « Trois pas » ;
  - appel à l'action intermédiaire ;
  - « Ressources ».
- *Pourquoi ça gêne :* on retrouve partout la même grille à `gap-px` sur fond de filet, avec icône, titre en serif et paragraphe de 2 lignes. Aucune section n'est plus importante qu'une autre. Plusieurs se répètent :
  - la réassurance répète le hero ;
  - « Trois pas » répète la section Import ;
  - l'appel intermédiaire répète l'appel final.
- *Impact :* 11 400 px de hauteur sur mobile. L'information clé (ce que Fi-Hub calcule et qu'un tableur fait mal) est diluée.
- *Remplacement :* structure en 8 blocs décrite dans DESIGN.md §3, construite autour de trois captures réelles.

**A2.2 — Appels à l'action en surnombre**
- *Où :* hero, `:363`, `:536`, pricing, `:587`, plus la navbar.
- *Constat :* six boutons noirs « Créer mon compte gratuit » ou équivalents, avec trois libellés différents (« Commencer », « Créer mon compte gratuit », « Importer mon premier relevé »).
- *Remplacement :*
  - un seul libellé primaire partout : « Créer un compte gratuit » ;
  - trois emplacements seulement : navbar, hero, conclusion ;
  - sous les tarifs : « Commencer en Free » et « Essayer Pro ».

**A2.3 — Bloc « Ressources » mal placé**
- *Où :* `page.tsx:542-561`.
- *Constat :* le commentaire indique `PRICING` alors que le bloc contient des liens SEO en pilules. Ils sont insérés entre l'appel intermédiaire et les tarifs, dans une autre typographie (`font-semibold` sans serif).
- *Remplacement :* déplacer ces liens dans le pied de page et dans une ligne « Pour aller plus loin » sous la FAQ.

**A2.4 — Jargon technique vendu comme bénéfice**
- *Où :* `page.tsx:421-444`, `:473`.
- *Exemples :*
  - « Frais de transaction de première classe » ;
  - « Row-Level Security Postgres, transactions atomiques, validation Zod » ;
  - « Triggers Postgres : impossible de casser la séquence » ;
  - « Vos données ne fuient pas » (garantie de sécurité absolue, à proscrire).
- *Impact :* incompréhensible pour le public cible. La dernière phrase est une promesse de sécurité qu'aucun service ne peut tenir.
- *Remplacement :*
  - « Chaque achat garde ses frais : votre PRU les inclut. »
  - « Vos données sont isolées par compte utilisateur au niveau de la base. Vous pouvez les exporter ou les supprimer à tout moment. »

**A2.5 — Titres interchangeables**
- *Exemples :*
  - « Saisissez moins, suivez plus. » (`:310`) ;
  - « Et tout le reste, fait sérieusement. » (`:404`) ;
  - « Trois pas, et puis c'est plié. » (`:487`) ;
  - « Tarifs simples » (`PricingSection.tsx`).
- *Problème :* ces titres ne disent rien de spécifique à Fi-Hub et fonctionneraient pour n'importe quel SaaS.
- *Remplacement :* des titres qui nomment le calcul ou la fonction (exemples avant/après en DESIGN.md §9).

### A3. Traitements visuels génériques (P1–P2)

**A3.1 — Motif « éditorial IA » (P1)**
- *Où :*
  - `globals.css:750-768` (`.ink-mark`, le mot surligné en rouge incliné) ;
  - `:770-784` (`.grain`) ;
  - repères « § 01 — Import » ;
  - petits intitulés mono de 10-11 px en capitales espacées (`.eyebrow`, `page.tsx:190`, `:314`, etc.) ;
  - italiques Fraunces « WONK » sur un mot par titre.
- *Problème :* cette combinaison (papier crème + serif à contraste + surligneur + grain + numérotation de section) est aujourd'hui un gabarit très reconnaissable de page générée. Elle ne dit rien de fi-hub.
- *Remplacement :* on garde le papier et l'encre, on retire le surligneur, le grain, les « § » et l'italique décoratif. Les titres passent en Geist 600, Fraunces reste réservé au logotype.

**A3.2 — Maquettes codées à la place du produit (P1)**
- *Où :* `page.tsx:698-1112` (`PortfolioMockup`, `ImportMockup`, `BenchmarkMockup`).
- *Problème :* ces maquettes ne ressemblent pas à l'application réelle (voir `public/Benchmark_vue.png`). Les boutons de période sont de faux `<button>` désactivés (`:1093-1107`). La carte « patrimoine » est couverte d'un grain qui la rend grisâtre sur écran (constaté en rendu).
- *Remplacement :* captures réelles recadrées (voir DESIGN.md §8).

**A3.3 — Maquette d'import coupée sur mobile (P1)**
- *Où :* `page.tsx:888`, `:901`.
- *Constat en rendu 390 px :* la grille à colonnes fixes (`44px 56px 1fr 44px 88px 92px`) dépasse de son conteneur. La colonne « Statut » est masquée, et « Importer ✓ » passe sur deux lignes.
- *Remplacement :* capture réelle, ou tableau réduit à 3 colonnes sur mobile.

**A3.4 — Animations sans garde de réduction des mouvements (P2)**
- *Où :* `globals.css:816-828` (`.spark-path`, `.pop-in`).
- *Problème :* seul le bandeau de cours respecte `prefers-reduced-motion`.
- *Remplacement :* suppression. Voir la règle de mouvement dans DESIGN.md §7.

**A3.5 — Bouton : survol avec ombre rouge décalée (P2)**
- *Où :* `globals.css:622-647` (`.btn-ink:hover`, `.btn-outline:hover`).
- *Problème :* translation et ombre dure rouge. Effet « néo-brutaliste » et rouge d'accent utilisé hors de son sens.
- *Remplacement :* changement de fond seulement (voir D4, cette classe est aussi utilisée dans l'application).

**A3.6 — Rouge polyvalent (P1)**
- *Où :* `--accent` = `--loss` = `#b91c1c` (`globals.css:39-46`). Le remap Tailwind `blue-*` pointe aussi vers `--accent` (`:370-381`).
- *Problème :* la même couleur signale la marque, les liens, la sélection, le focus, les boutons, les badges « Nouveau » et les pertes.
- *Impact :* dans un outil financier, un rouge qui n'est pas une perte crée une lecture fausse.
- *Remplacement :* tokens sémantiques `--action`, `--focus`, `--note` (DESIGN.md §2). Le rouge est limité à `--loss` et `--danger` sur les pages publiques.

**A3.7 — Trois marques différentes (P2)**
- *Où :* logotype texte (`Navbar.tsx:11`), `public/icon.png` (glyphe noir sur dégradé gris avec ombre portée, sans lien avec la palette), `app/opengraph-image.tsx:36-48` (carré rouge « ↗ » + « sans Excel. » en rouge).
- *Remplacement :*
  - pictogramme redessiné en SVG, encre sur papier, sans dégradé ni ombre ;
  - le pictogramme et le logotype Fraunces s'utilisent ensemble dans la navbar, l'image OpenGraph, l'authentification et l'onboarding ;
  - `icon.png` régénéré depuis ce SVG.

**A3.8 — Petits textes (P2)**
- *Où :* libellés mono de 10-11 px en capitales espacées sur toute la page (navbar `Navbar.tsx:16-43`, légendes, en-têtes).
- *Impact :* lecture pénible sur mobile. La navigation en capitales espacées ralentit le repérage.
- *Remplacement :* 12 px minimum. Liens de navigation en Geist 14 px, casse normale.

**A3.9 — Texture pointillée sur le `body` (P3)**
- *Où :* `globals.css:568-583`.
- *Remplacement :* fond uni sur `.marketing-shell`. L'application garde la texture (décision D5).

### A4. Tarifs et FAQ (P1–P2)

- **A4.1 Libellés numérotés « 01 / 02 » (P2)**
  - *Où :* `PricingCard.tsx:48-50`.
  - Numérotation décorative, sans fonction.
  - *Remplacement :* retirer.
- **A4.2 Comparaison difficile (P1)**
  - *Où :* `lib/plans.ts` (`highlights`).
  - Les deux listes ne sont pas alignées. Free liste 6 éléments, Pro en liste 5 différents, et on ne voit pas ce que Free n'a pas (import, dividendes, export CSV).
  - *Remplacement :* un tableau comparatif à lignes communes (Comptes, Transactions, Positions, Historique et analyses, Benchmark, Dividendes, Import, Export CSV, Export JSON/PDF), alimenté par `PLANS` et `hasFeature`. Les libellés restent centralisés dans `lib/plans.ts`.
- **A4.3 Bascule mensuel/annuel ouverte sur « annuel » (P2)**
  - *Où :* `PricingSection.tsx:13`.
  - Masque « Premier mois gratuit », l'argument d'essai le plus fort.
  - Voir décision D6.
- **A4.4 FAQ (P1)**
  - *Où :* `faq-data.ts`.
  - Il manque les questions décisives pour ce public :
    - Que fait l'import et est-il gratuit ?
    - Quels indices de comparaison ?
    - Les cours sont-ils en temps réel ?
    - Que se passe-t-il au-delà de 3 comptes ?
  - « Infrastructure européenne » (`:4`) est à confirmer (région du projet Supabase).
  - « Toutes vos données exportables » est exact (JSON).

### A5. Pages Fonctionnalités (P1)

- **A5.1 Captures illisibles**
  - *Où :* `components/marketing/FeatureMockups.tsx:22-70` et `:218-252`.
  - *Constat en rendu :*
    - `Dividende_page.png` (1920 px) est affichée dans environ 620 px sur ordinateur ;
    - `Benchmark_vue.png` est affichée dans environ 330 px sur mobile ;
    - chiffres et libellés deviennent illisibles.
  - La capture est enfermée dans trois cadres : carte, bandeau « Capture produit », fond papier, puis bordure.
  - *Remplacement :* recadrages ciblés à l'échelle 1:1 ou 2x, une figure sans cadre superflu et une légende dessous. Un recadrage spécifique pour mobile via `<picture>` / `sizes`.
- **A5.2 Gabarit à cartes**
  - *Où :* `components/marketing/SeoArticlePage.tsx:58-94`.
  - « À retenir » est une carte et les puces d'une section sont chacune une carte (`rounded-xl border`).
  - Les titres mélangent `display` et `font-semibold`.
  - *Remplacement :* liste simple avec filets ; hiérarchie H1/H2/H3 unique (DESIGN.md §4).
- **A5.3 Appel à l'action identique sur les 12 pages**
  - *Où :* `SeoArticlePage.tsx:98-112`.
  - Le texte est le même partout, dans un bloc noir plein.
  - *Remplacement :* bloc discret sous filet, texte adapté par collection. Pour les pages Pro (dividendes, import), l'offre est indiquée.
- **A5.4 Maquette de secours inatteignable (P3)**
  - *Où :* `FeatureMockups.tsx:255-271`.
  - « Vue de démonstration » avec des chiffres fictifs ; aucun slug n'y mène aujourd'hui.
  - *Remplacement :* supprimer.

### A6. Guides, Alternatives, index (P2)

- **A6.1 Index en grille de cartes identiques**
  - *Où :* `components/marketing/SeoIndexPage.tsx:57-78`.
  - Cartes identiques qui s'élèvent au survol.
  - *Remplacement :* liste éditoriale (titre, une ligne, lien) séparée par des filets.
- **A6.2 Largeur de lecture**
  - *Où :* `SeoArticlePage.tsx:43`.
  - `max-w-5xl` avec colonne latérale.
  - *Remplacement :* colonne de texte de 68 caractères environ, pages liées en fin d'article sur mobile.
- **A6.3 Pages Alternatives sans tableau comparatif**
  - *Où :* `lib/seo-pages.ts:415-520`.
  - Contenu mince (2 sections de 1 paragraphe).
  - Hors périmètre de refonte visuelle (pas de réécriture SEO de fond), mais signalé. Un comparatif doit rester factuel et daté, sans prix concurrents non vérifiés.

### A7. Authentification (P1)

- **A7.1 Libellés non associés aux champs (accessibilité)**
  - *Où :* `app/(auth)/login/LoginForm.tsx:50`, `:66` ; `app/(auth)/signup/SignupForm.tsx` (champs e-mail et mot de passe).
  - Les `<label>` n'ont pas de `htmlFor` et n'enveloppent pas le champ.
  - Il manque les attributs `autoComplete` (`email`, `current-password` / `new-password`).
  - Le bouton afficher/masquer n'a pas d'`aria-label`.
  - *Impact :* lecteurs d'écran, gestionnaires de mots de passe, remplissage automatique sur mobile.
- **A7.2 Titres de page**
  - *Où :* `LoginForm.tsx:43`.
  - Le `h1` est le logo « Fi-Hub » ; le vrai titre (« Connexion ») est un petit libellé mono.
  - *Remplacement :* logo en lien, `h1` « Se connecter » / « Créer un compte ».
- **A7.3 Inscription sans rappel de l'offre**
  - *Où :* `SignupForm.tsx`.
  - Rien ne rappelle ce que contient le compte gratuit au moment de s'inscrire.
  - *Remplacement :* 3 lignes issues de `PLANS.free` (3 comptes, 100 transactions, 10 positions, sans carte bancaire).
- **A7.4 Liens en rouge (P2)**
  - *Où :* « Oublié ? », « Se connecter », CGU.
  - *Remplacement :* passer au style de lien encre souligné.

### A8. Hors design, mais bloquant pour la crédibilité (P0)

- **A8.1 Sous-traitants de l'import**
  - *Où :* `app/(marketing)/legal/confidentialite/page.tsx`.
  - Les relevés importés sont envoyés à des services d'IA tiers (OCR pour PDF/images, modèle de langage pour CSV non reconnus, texte collé et secours) (`lib/import/ocr.ts`, `lib/import/llm.ts`). La politique de confidentialité ne les mentionne pas.
  - Conformément à la décision « ne nommer aucun fournisseur sur le marketing », ils doivent en revanche être listés dans la politique de confidentialité (RGPD, sous-traitants).
  - À traiter séparément de la refonte.

---

## B. Application connectée — retouches légères uniquement

Aucune refonte d'architecture, de parcours ou d'écran. Constats issus du code et des captures de mai, **non vérifiés en rendu**.

**Écrans laissés tels quels** (cohérents, rien à proposer) :
- paramètres (`app/(app)/settings/*`) ;
- structure du dashboard et des onglets ;
- tableaux de positions et de transactions ;
- modales d'ajout et d'édition ;
- assistant d'import ;
- administration ;
- partage de position ;
- palette des graphiques, hors B8.

| # | Où | Constat | Impact | Correction proposée | Prio. |
|---|---|---|---|---|---|
| B1 | `components/Onboarding.tsx:172-178` | Le plan Free affiche « 1 compte, 50 transactions, 5 positions » ; la réalité est 3 / 100 / 10 (`lib/plans.ts`) | Information fausse dès le premier écran | Lire `PLANS.free` (`maxAccounts`, `maxTransactions`, `maxPositions`) | P0 |
| B2 | `components/ProBlur.tsx:74-82` | Prix « 4,99 € / mois » écrit en dur ; texte « Analyses avancées, historique complet, export CSV… » alors que les analyses avancées et l'historique sont gratuits | Argument Pro faux ; prix non centralisé (règle CLAUDE.md) | `formatPrice(PLANS.pro)` ; texte selon la fonction verrouillée (dividendes, import, export CSV) | P1 |
| B3 | `components/ProOnboarding.tsx:48-53` | « Analyses avancées & performance annuelle » présenté comme débloqué par Pro ; « Import CSV » alors que PDF et images sont acceptés | Liste de bénéfices inexacte | Aligner sur `PLANS.pro.highlights` | P1 |
| B4 | `components/Dashboard.tsx:312` | Onglets mobiles tronqués par `label.slice(0, 4)` : « Dash », « Comp », « Posi », « Tran », « Divi » | Libellés illisibles sur mobile | Libellé complet en 12 px ; la barre défile déjà (`overflow-x-auto`) | P1 |
| B5 | `Dashboard.tsx:435, 465, 482, 494, 608` ; `AccountList.tsx:351` | Boutons « Ajouter… » et filtres actifs en `bg-blue-600`, remappé vers le rouge d'accent | Action principale de la couleur des pertes | `btn-ink` (encre). Voir D3 | P2 |
| B6 | `components/UsageMeter.tsx:37-55` | Jauge normale en `bg-blue-500` (donc rouge), avertissement ambre, plein rouge ; texte « illimité·e·s » | Une jauge à 10 % paraît déjà en alerte | Jauge encre, ambre à 80 %, rouge à 100 % ; « Comptes illimités avec Pro » | P2 |
| B7 | `components/DividendsTable.tsx:347-357, 396-403, 474-478, 526-530` | Rendement sur coût en `text-blue-600` (rendu rouge, visible sur la capture) et en violet ; pourcentages `toFixed(2)` avec point décimal (« 5.82% ») | Un rendement positif lu comme une perte ; typographie non française | Encre neutre ; `formatPercent` existant (`lib/utils.ts:62`) | P2 |
| B8 | `components/BenchmarkComparisonChart.tsx:15` | S&P 500 tracé en `--chart-4` (rouge), en pointillés | L'indice est lu comme une courbe de perte | `--chart-3` (safran) ou `--ink-soft` en pointillés | P2 |
| B9 | `ProBlur`, `ProGate`, `UsageMeter`, `LimitReachedModal`, `ProOnboarding`, `Toast.tsx:70`, `PerformanceProjectionChart.tsx:70` | Icône `Sparkles` pour tout ce qui est Pro, et pour une projection statistique | Connote la « magie IA », sans rapport avec la fonction | `Lock` pour les fonctions verrouillées, `TrendingUp` pour la projection, rien ailleurs | P3 |
| B10 | `Onboarding.tsx` (« Bienvenue sur Fi-Hub 👋 »), `ProOnboarding.tsx:97` (« 🎉 ») | Emojis dans les titres | Ton décalé avec « précis et honnête » | Retirer | P3 |
| B11 | `Dashboard.tsx:254` ; titres `Dashboard.tsx:375, 400, 431, 454` ; capture Dividendes | « Mis à jour: » ; « Mes Comptes », « Dernières Transactions », « Mes Positions », « Mes Dividendes » | Typographie et casse anglaises | « Mis à jour : » (espace insécable) ; casse de phrase | P3 |
| B12 | `LimitReachedModal.tsx` (badge « Recommandé » `bg-blue-600`) | Badge rouge | Même confusion que B5 | Encre | P3 |

---

## Plan de modification proposé (après validation)

1. **Lot 0 — corrections factuelles.**
   - A1.x, A7.1, B1, B2, B3 ;
   - la mention des sous-traitants (A8.1) est traitée à part.
   - Petits changements, aucun changement visuel structurant.
2. **Lot 1 — fondations.**
   - Tokens sémantiques dans `globals.css` (sans casser les remaps utilisés par l'application) ;
   - classes `btn-*`, `link`, `.input` ;
   - pictogramme SVG ;
   - favicon et image OpenGraph.
3. **Lot 2 — captures.**
   - Compte de démonstration avec données fictives ;
   - captures à 1440 px (desktop) et 390 px (mobile) : synthèse, positions/PRU, benchmark, dividendes, aperçu d'import ;
   - export en WebP ou AVIF, légende « Données d'exemple ».
4. **Lot 3 — landing et tarifs.**
   - Nouvelle structure (DESIGN.md §3), FAQ, navbar, pied de page, métadonnées et JSON-LD alignés.
5. **Lot 4 — gabarits SEO.**
   - `SeoArticlePage`, `SeoIndexPage`, `FeatureMockups` ;
   - URLs, slugs, métadonnées et `sitemap` inchangés.
6. **Lot 5 — authentification.**
   - Titres, accessibilité, rappel de l'offre Free.
7. **Lot 6 — retouches de l'application.**
   - B4 à B12, selon ce que vous validez.

Chaque lot : `npx tsc --noEmit` et `npm run lint` ; `npm run build` et `npm test` à partir du lot 1 ; captures avant/après à 1440 px et 390 px.

## Décisions à valider

| # | Question | Recommandation |
|---|---|---|
| D1 | Valider la direction A et DESIGN.md | — |
| D2 | Redessiner le pictogramme en SVG fidèle (cercle ouvert, point, deux barres), encre sur papier | Oui |
| D3 | Boutons d'action de l'application (B5, B12) : encre au lieu du rouge ? | Oui, changement limité aux boutons |
| D4 | Nouveau survol de `.btn-ink` / `.btn-outline` (sans ombre rouge) : global, ou pages publiques seulement ? | Global : changement mineur et plus cohérent |
| D5 | Texture pointillée du `body` : retirer partout, ou seulement sur les pages publiques ? | Pages publiques seulement |
| D6 | Bascule tarifaire ouverte sur « mensuel » (premier mois gratuit visible) ou « annuel » ? | Mensuel |
| D7 | Mention « temps réel » : les cours viennent d'une API de marché mise en cache 60 s, dont certaines places peuvent être différées | « Cours actualisés automatiquement », sauf confirmation du temps réel |
| D8 | Mention « infrastructure européenne » (FAQ) et « Fait en France » (pied de page) : confirmez-vous ? | Retirer ce qui n'est pas confirmé |
| D9 | Qui produit les captures du compte de démonstration : vous, ou moi avec un compte de test que vous fournissez ? | Compte de test dédié, données fictives |
| D10 | Faut-il garder une section « Excel contre Fi-Hub » ? | Non sur la landing. L'angle Excel vit déjà dans les guides SEO |
