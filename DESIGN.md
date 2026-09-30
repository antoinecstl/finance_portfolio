# DESIGN — fi-hub

Statut : **appliqué** les 29 et 30/09/2026 (branche `design/refonte-publique`). Constats et suivi : [AUDIT-UI.md](AUDIT-UI.md).
Ce document décrit les **pages publiques** (marketing, SEO, authentification). L'application connectée garde son système (voir §10).

## 1. Intention et marque

**Direction A, « Relevé ».**
- Fi-Hub est un instrument de mesure : on le montre avec de vraies vues du produit, pas avec des slogans.
- Rendu sobre, réglé, composé de filets plutôt que de cartes.

**Perception visée :** outil précis et honnête.
**Public :** investisseur particulier actif (PEA, CTO, souvent un tableur).
**Action principale :** créer un compte Free.

**Marque :**
- **Logo.** Pictogramme redessiné en SVG à partir de `icon.png` (anneau ouvert, point, deux barres), accompagné du logotype « Fi-Hub » en Fraunces.
  - Composants : `components/marketing/Logo.tsx`.
  - Géométrie : `logo-paths.ts`.
- **Favicon.**
  - Fichier source : `public/icon.svg`.
  - Fichiers dérivés : `icon.png` (512 px) et `apple-icon.png` (180 px), encre sur papier, sans dégradé ni ombre.
- **Image de partage.** `app/opengraph-image.tsx` reprend le même pictogramme, sans rouge.
- **Retiré des pages publiques :** le rouge comme couleur de marque, le mot surligné, le grain, les repères « § 01 », les libellés mono en capitales espacées, l'italique décoratif, le bandeau de cours et les maquettes codées.

## 2. Palette et tokens

Déclarés dans `app/globals.css` (`:root`), avec leurs variantes sombres. Ils s'utilisent avec la syntaxe du projet : `bg-[color:var(--action)]`, `text-[color:var(--text-muted)]`… Les remaps Tailwind (`zinc`, `blue`…) de l'application sont intacts.

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `--surface` / `--surface-2` | #f7f2e8 / #efe7d4 | #0c0b0a / #181613 | Fond, tableau tarifaire, bannière |
| `--text` / `--text-2` / `--text-muted` | #0e0c0a / #2a2520 / #5b524a | #f1ead9 / #d8cfb9 / #9a907d | Titres / paragraphes / légendes (6,8:1 sur papier) |
| `--border` | #d8cdb6 | #2a2620 | Filets (décoratifs) |
| `--border-strong` | #b6a98c | #3d362c | Cadre des captures produit |
| `--border-input` | #8a7f6c | #6b6356 | Contour des champs et de la bascule (≥ 3:1) |
| `--action` / `--action-hover` / `--action-fg` | encre / #2a2520 / papier | inversés | Bouton principal |
| `--focus` | encre | encre claire | Contour de focus 2 px, décalage 2 px |
| `--gain` / `--loss` = `--danger` | #047857 / #b91c1c | #34d399 / #ef4444 | Hausse / baisse, erreur, destructif **uniquement** |

**Règles :**
- l'encre est la seule couleur d'action ;
- le vert et le rouge ne portent que des valeurs ou des états.

## 3. Structure appliquée

### Landing (`app/(marketing)/page.tsx`)

| # | Section | Question du visiteur |
|---|---|---|
| 1 | Hero : « Vos placements réunis. Votre performance en clair. », sous-titre, « Créer un compte gratuit », lien « Voir ce que Fi-Hub calcule », rappel Free, capture du tableau de bord | Qu'est-ce que c'est, et est-ce pour moi ? |
| 2 | Positions et PRU · Free — **empilée** : texte, puis capture bureau pleine largeur | Qu'est-ce que je gagne par rapport à mon tableur ? |
| 3 | Performance hors apports et benchmark · Free (10 indices) — **côte à côte** : texte, puis vue mobile à droite | Est-ce que je bats vraiment le marché ? |
| 4 | Dividendes · Pro — **côte à côte inversé** : vue mobile à gauche, texte à droite | Que rapportent mes dividendes ? |
| 5 | Import en 3 étapes · Pro (`ImportSteps`) | Dois-je tout ressaisir ? |
| 6 | Ce que Fi-Hub fait, et ne fait pas | Quelles limites, quelles garanties ? |
| 7 | Tarifs : tableau comparatif Free/Pro à lignes communes, ouvert sur « Mensuel » | Combien ça coûte, qu'est-ce qui est gratuit ? |
| 8 | FAQ (`<details>` natifs) | Objections restantes |
| 9 | Conclusion + bouton | Passer à l'action |

**Appels à l'action :**
- **Principal**, libellé unique « Créer un compte gratuit ». Emplacements : navbar (« Créer un compte » sur mobile), hero, tarifs, conclusion, fin des articles SEO.
- **Secondaire :** « Essayer Pro » ou « Choisir Pro annuel » dans les tarifs, qui mènent tous deux à `/signup` comme avant.
- **Tertiaire :** liens soulignés avec « → ».

### Gabarits

- **`SeoArticlePage`** :
  - fil d'Ariane ;
  - libellé « Fonctionnalité · Offre Pro » ou « · Inclus dans l'offre Free » (liste `PRO_FEATURE_SLUGS` dans `product-facts.ts`) ;
  - H1 et introduction ;
  - figure sur toute la largeur ;
  - colonne de texte de 68 caractères environ, « En bref » en liste à filets ;
  - conclusion adaptée à la collection ;
  - « À lire aussi ».
- **`SeoIndexPage`** : liste à filets, sans grille de cartes.
- **Authentification** (`app/(auth)/layout.tsx`) :
  - colonne de 400 px et logo ;
  - `h1` réel, libellés associés, `autoComplete`, bascule du mot de passe annoncée ;
  - erreurs en `role="alert"` ;
  - rappel Free sur l'inscription.
  - Les pages mot de passe oublié et réinitialisation sont seulement alignées (titre, conteneur, libellés).

## 4. Typographie

Aucune nouvelle police. **Geist** pour tout le texte, **Fraunces** pour le logotype seulement, **JetBrains Mono** pour les numéros d'étapes.

| Rôle | Mobile / ≥ 640 / ≥ 1024 px | Graisse, interligne, approche |
|---|---|---|
| H1 landing (deux phrases, une par ligne) | 34 (< 380 px) / 40 / 56 / 68 px | 600 · 1,04 · −0,03 em |
| H1 articles | 40 / 40 / 48 px | 600 · 1,05 · −0,025 em |
| H2 | 28 / 28 / 36 px | 600 · 1,15 · −0,02 em |
| H3 | 20 px | 600 · 1,3 |
| Introduction | 18 / 18 / 19 px | 400 · 1,55 · `--text-2` |
| Corps | 15 à 17 px | 400 · 1,6 |
| Légende, libellé | 13 px | 500 · `--text-muted`, casse normale |

**Typographie française :** espace insécable avant `: ; ? ! %`, virgule décimale, `CAC 40` et `S&P 500` insécables dans les titres.

## 5. Mise en page

- **Conteneur :** `max-w-6xl`, `px-5` / `lg:px-8`.
- **Colonnes :** texte en `max-w-[62ch]` à `[68ch]`. Grille de 12 colonnes à partir de 1024 px (titre sur 5, texte sur 6).
- **Sections :** `py-16` / `lg:py-24`, séparées par un filet `--border`.
- **Arrondis :**
  - 4 px : bascule ;
  - 6 px : boutons, champs ;
  - 8 px : figures, tableau tarifaire, bannière.

## 6. Composants et classes

| Classe | Rôle |
|---|---|
| `.public-shell` | Portée des pages publiques : fond uni, focus encre, sélection, réduction des mouvements. Posée sur les layouts marketing et auth |
| `.btn-primary` / `.btn-secondary` / `.btn-sm` | 44 px (36 px en petit), 6 px d'arrondi, survol par changement de fond uniquement |
| `.link` | Soulignement 1 px décalé de 3 px, couleur `--border-input`, puis `--text` au survol |
| `.field-input` | Champ 44 px, 16 px de texte, bordure `--border-input`, `aria-invalid` en `--danger`. L'app garde `.input` |
| `.figure-frame` | Passe-partout identique pour toutes les captures : fond `--surface-2`, bordure 1 px `--border-strong`, marge intérieure de 8 px (12 px dès 640 px), arrondi de 10 px, sans ombre |

- **`.btn-ink` / `.btn-outline` (partagés avec l'app) :** survol global changé (D4), sans translation ni ombre rouge.
- **Icônes :** `lucide-react`, `strokeWidth={1.75}`. Utilisées pour les flèches de lien, les coches et tirets du tableau, l'œil du mot de passe et l'accordéon. Jamais `Sparkles`.

## 7. Mouvement

- **Transitions :** couleur et fond en 120 ms ; rotation du chevron de la FAQ en 200 ms.
- **Défilement doux** vers les ancres, seulement si `prefers-reduced-motion: no-preference`.
- **Réduction des mouvements :** toutes les transitions de `.public-shell` sont neutralisées. Il n'y a plus d'animation d'entrée ni de boucle.

## 8. Montrer le produit

- **Source :** composants réels de l'application (`PortfolioStats`, `PortfolioHistoryChart`, `PositionPerformanceChart`, `BenchmarkComparisonChart`, `DividendsTable`), rendus localement avec un **portefeuille fictif**.
  - Portefeuille : PEA, CTO, Livret A.
  - Titres : CW8, SU, OR, SAN, ESE, SAP.
  - Une ligne en perte, et un portefeuille qui **sous-performe** le CAC 40.
- **Aucune donnée de compte réel.** Les anciennes captures `Page_Position.png`, `Dividende_page.png` et `Benchmark_vue.png`, qui provenaient d'un compte réel, ont été supprimées de `public/`.
- **Thème :** chaque capture existe en clair et en **sombre**, rendue dans le vrai thème sombre de l'application (pas de filtre d'inversion). `<picture>` choisit selon `prefers-color-scheme`.
- **Variantes :** `wide`, avec la capture bureau à partir de 640 px ; `narrow`, avec la vue mobile à toutes les tailles (sections côte à côte, 380 px maximum).
- **Fichiers :** `public/marketing/*.webp` (suffixe `-sombre` pour le thème sombre).
  - Capture à 2x ; version bureau de 1152 px CSS, version mobile de 390 px.
  - Recadrée sur la carte, entre 41 et 96 Ko.
  - Déclarée dans `FIGURES` (`ProductFigure.tsx`).
- **Affichage :** `<picture>` avec une source mobile, `next/image` en qualité 75, `alt` descriptif. Légende systématique « Données d'exemple, portefeuille fictif. ».
- **Règles :**
  - figure sur toute la largeur du conteneur, jamais réduite sous environ 90 % de sa largeur CSS d'origine ;
  - pas de faux navigateur, pas de maquette d'appareil.
- **Regénérer les captures :**
  1. Créer une page temporaire qui rend ces composants avec des données fictives, en simulant `/api/stocks/history`.
  2. Capturer l'élément à 2x, en 1200 px puis 390 px.
  3. Recadrer sur la carte et exporter en WebP (qualité 84, avec `sharp`).
  4. Supprimer la page temporaire.
  5. Les séries fictives dépendent de la date du jour : générer le thème clair et le thème sombre **le même jour**, sinon les chiffres diffèrent.
  6. Vider `.next/**/cache/images` avant de vérifier le rendu, car l'optimiseur d'images sert sinon d'anciennes versions.

## 9. Ton rédactionnel

**Principes :**
- vouvoiement, phrases courtes ;
- nommer le calcul (PRU, hors apports, Dietz modifiée, rendement sur coût) ;
- indiquer l'offre de chaque fonction ;
- dire ce qui n'existe pas ;
- aucune promesse de rendement ni de sécurité absolue ;
- aucun fournisseur d'IA nommé sur le marketing.

**Faits dérivés du code, jamais saisis à la main :** limites Free (`PLANS`), nombre et liste d'indices (`lib/benchmarks.ts`), libellés d'essai (`MONTHLY_TRIAL_LABEL`, `YEARLY_VALUE_LABEL`).

| Emplacement | Avant | Après |
|---|---|---|
| H1 | Suivez tout votre patrimoine, sans Excel. | Vos placements réunis. Votre performance en clair. |
| Sous-titre | PEA, CTO, livrets, assurance-vie et dividendes réunis dans un tableau de bord unique — valorisé en temps réel et toujours comparé au marché. | Retrouvez vos PEA, CTO et livrets au même endroit. Distinguez vos versements de vos gains et comparez la performance de votre portefeuille à un indice. |
| Sous le bouton | Gratuit, sans carte bancaire · 3 comptes & 100 transactions offerts · … | Gratuit jusqu'à 3 comptes, 100 transactions et 10 positions. Sans carte bancaire. |
| Positions | Frais de transaction de première classe | Chaque position recalculée à partir de vos transactions. |
| Benchmark | Battre le marché ? Vraiment ? (+ MSCI World) | Votre performance hors apports, face à un indice. (10 indices réels) |
| Dividendes | Le DRIP n'est plus un mystère. | Ce que vos dividendes rapportent, rapporté à votre prix d'achat. |
| Import | Import en un clic, tickers reconnus pour vous. (présenté comme gratuit) | Importez un relevé, vérifiez chaque ligne, puis validez. (Offre Pro) |
| Sécurité | Vos données ne fuient pas. | Vos données sont isolées par utilisateur au niveau de la base de données. |
| Tarifs | Tarifs simples | Free pour suivre. Pro pour importer et analyser vos dividendes. |
| Conclusion | Le prochain dimanche soir, vous n'ouvrirez pas Excel. | Commencez avec vos comptes actuels. |

## 10. Pages publiques et application

| Élément | Pages publiques | Application connectée |
|---|---|---|
| Palette, polices, focus | Tokens §2, focus encre | Inchangés (focus rouge `--accent`) |
| Titres | Geist 600 | Inchangés (Fraunces en paramètres et onboarding) |
| Fond | Uni (`.public-shell`) | Texture pointillée conservée (D5) |
| Boutons d'action | `.btn-primary` | `bg-blue-600` (rendu rouge) remplacé par `.btn-ink` sur les boutons « Ajouter… » et les filtres actifs (D3) |
| Survol `.btn-ink` / `.btn-outline` | Fond seulement | Idem (D4, global) |
| Onglets du tableau de bord | — | Sous 640 px : cinq colonnes égales, icône au-dessus du libellé complet (11 px, zone tactile d'au moins 72 × 56 px à 360 px). Bureau inchangé |
| Notification Pro (toast `upsell`) | — | Style neutre et informatif ; le rouge est réservé aux erreurs |
| Couleurs d'information (gain/perte, catégories de comptes, graphiques) | — | Conservées, sauf le rendement sur coût (rouge devenu encre) et la courbe S&P 500 (rouge devenue safran) |
