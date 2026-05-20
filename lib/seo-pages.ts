export type SeoCollection = 'guides' | 'fonctionnalites' | 'alternatives';

export type SeoSection = {
  heading: string;
  body: string[];
  bullets?: string[];
};

export type SeoPage = {
  collection: SeoCollection;
  slug: string;
  href: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  h1: string;
  intro: string;
  takeaways: string[];
  sections: SeoSection[];
  ctaLabel: string;
  related: string[];
};

export type SeoRoute = {
  href: string;
  lastModified: string;
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
};

export const SEO_LAST_MODIFIED = '2026-05-20';

export const collectionLabels: Record<SeoCollection, string> = {
  guides: 'Guides',
  fonctionnalites: 'Fonctionnalités',
  alternatives: 'Alternatives',
};

export const collectionHrefs: Record<SeoCollection, string> = {
  guides: '/guides',
  fonctionnalites: '/fonctionnalites',
  alternatives: '/alternatives',
};

export const guidePages: SeoPage[] = [
  {
    collection: 'guides',
    slug: 'suivi-portefeuille-boursier',
    href: '/guides/suivi-portefeuille-boursier',
    title: 'Suivi de portefeuille boursier',
    metaTitle: 'Suivi de portefeuille boursier : méthode et outil',
    metaDescription:
      'Comment suivre un portefeuille boursier sans tableur fragile : comptes, transactions, PRU, dividendes, performance et exports.',
    eyebrow: 'Guide pratique',
    h1: 'Suivi de portefeuille boursier : passer du tableur à un vrai journal',
    intro:
      'Un bon suivi de portefeuille ne sert pas seulement à connaître une valeur totale. Il doit expliquer ce qui a bougé, d’où vient la performance, combien vous avez investi et ce que vous pouvez exporter si vous changez d’outil.',
    takeaways: [
      'Séparez les comptes, les transactions et les valorisations pour éviter les erreurs de formule.',
      'Suivez les apports et les retraits à part de la performance de marché.',
      'Gardez un historique exportable pour ne pas dépendre d’un outil fermé.',
    ],
    sections: [
      {
        heading: 'Ce qu’il faut suivre en priorité',
        body: [
          'Le point de départ est simple : chaque compte doit avoir son solde, sa devise, ses mouvements de cash et ses lignes de portefeuille. Pour un PEA ou un CTO, les achats, ventes, frais et dividendes doivent rester lisibles dans le temps.',
          'La plupart des erreurs viennent d’un mélange entre valeur actuelle, montant investi, performance et cash disponible. Fi-Hub isole ces éléments pour que le tableau de bord reste compréhensible même quand le nombre de lignes augmente.',
        ],
        bullets: [
          'Valeur actuelle par compte et par position.',
          'Prix de revient unitaire, frais inclus.',
          'Dividendes reçus et rendement sur coût.',
          'Performance comparée à un indice de référence.',
        ],
      },
      {
        heading: 'Pourquoi Excel atteint vite ses limites',
        body: [
          'Un fichier Excel peut suffire au début, mais il devient fragile dès que vous ajoutez plusieurs comptes, plusieurs devises, des frais ou des dividendes. Chaque nouvelle ligne peut casser une formule ou créer une incohérence invisible.',
          'Un outil dédié évite ce risque en stockant les transactions comme des événements et en recalculant les positions à partir de l’historique. Vous gagnez en fiabilité, surtout si vous importez régulièrement des relevés broker.',
        ],
      },
      {
        heading: 'La méthode recommandée',
        body: [
          'Commencez par importer les transactions les plus récentes, puis complétez les opérations historiques importantes. Vérifiez ensuite les positions calculées par rapport à votre courtier. Une fois la base saine, vous pouvez suivre l’évolution sans reprendre tout le fichier à la main.',
          'Fi-Hub est pensé comme ce journal : chaque mouvement reste traçable, les exports restent disponibles et les indicateurs se recalculent à partir des données source.',
        ],
      },
    ],
    ctaLabel: 'Créer mon suivi gratuitement',
    related: ['/guides/suivi-pea', '/guides/calcul-pru', '/fonctionnalites/import-transactions'],
  },
  {
    collection: 'guides',
    slug: 'suivi-pea',
    href: '/guides/suivi-pea',
    title: 'PEA et positions',
    metaTitle: 'PEA et positions : PRU, dividendes et performance',
    metaDescription:
      'Guide pour suivre un PEA proprement : transactions, espèces, PRU, frais, dividendes et performance face au marché.',
    eyebrow: 'Guide PEA',
    h1: 'PEA et positions : garder une vue claire sur vos lignes et votre performance',
    intro:
      'Le PEA est souvent le cœur d’un patrimoine boursier français. Pour le suivre correctement, il faut distinguer la poche espèces, les positions, les frais, les dividendes et la performance réelle.',
    takeaways: [
      'Un PEA doit être suivi avec une poche cash séparée des titres.',
      'Les frais modifient le PRU et donc la performance réelle.',
      'Comparer le PEA à un indice évite de juger la performance hors contexte.',
    ],
    sections: [
      {
        heading: 'Les données indispensables',
        body: [
          'Chaque achat ou vente doit préciser la date, le ticker, la quantité, le prix, les frais et le compte concerné. Sans ce niveau de détail, il devient difficile de comprendre pourquoi une position est gagnante ou perdante.',
          'Le PEA ajoute une contrainte : les mouvements de cash et les titres doivent rester cohérents. Un achat ne devrait pas créer une poche espèces négative sans que vous le voyiez.',
        ],
        bullets: [
          'Transactions datées et ordonnées.',
          'Frais rattachés à la transaction parente.',
          'Dividendes affectés au bon titre.',
          'Historique complet conservé pour audit personnel.',
        ],
      },
      {
        heading: 'Performance du PEA vs performance globale',
        body: [
          'Un PEA peut progresser parce que vous avez ajouté du cash, pas parce que les titres ont monté. C’est pour cela qu’il faut séparer la variation brute du patrimoine de la performance hors apports.',
          'Fi-Hub permet de garder cette distinction visible et de comparer le PEA à des références comme le CAC 40, le S&P 500 ou un ETF Monde.',
        ],
      },
      {
        heading: 'Quand consolider avec le reste du patrimoine',
        body: [
          'Le PEA ne vit pas seul : Livret A, LDDS, CTO, assurance-vie ou crypto changent la vision globale du risque. Une consolidation multi-comptes aide à voir votre allocation réelle et votre liquidité disponible.',
        ],
      },
    ],
    ctaLabel: 'Structurer mon PEA',
    related: ['/fonctionnalites/positions-pru', '/guides/calcul-pru', '/guides/performance-portefeuille'],
  },
  {
    collection: 'guides',
    slug: 'calcul-pru',
    href: '/guides/calcul-pru',
    title: 'Calcul PRU',
    metaTitle: 'Calcul PRU : méthode avec frais, achats et ventes',
    metaDescription:
      'Comprendre le calcul du prix de revient unitaire avec frais, renforcements, ventes partielles et suivi de performance.',
    eyebrow: 'Méthode',
    h1: 'Calcul PRU : comprendre le prix de revient unitaire sans approximation',
    intro:
      'Le PRU est l’un des indicateurs les plus utiles pour suivre une position. Il devient pourtant vite ambigu si les frais, ventes partielles ou renforcements ne sont pas traités proprement.',
    takeaways: [
      'Les frais d’achat augmentent le coût total de la position.',
      'Une vente partielle ne doit pas réécrire l’historique des achats.',
      'Le PRU sert à lire une position, mais il ne remplace pas une performance globale.',
    ],
    sections: [
      {
        heading: 'Formule de base',
        body: [
          'Le PRU correspond au coût total d’acquisition divisé par la quantité détenue. Dans un suivi sérieux, le coût total inclut les frais de courtage et les taxes rattachées à l’achat.',
          'Si vous achetez 10 actions à 100 € avec 5 € de frais, votre coût total est de 1 005 €, soit un PRU de 100,50 €. C’est ce montant qui sert ensuite à mesurer la plus-value latente.',
        ],
      },
      {
        heading: 'Renforcements et ventes partielles',
        body: [
          'Lors d’un renforcement, le nouveau PRU mélange l’ancien coût restant et le coût du nouvel achat. Lors d’une vente partielle, la quantité baisse, mais l’historique doit rester disponible pour comprendre la trajectoire de la position.',
          'Fi-Hub reconstruit les positions à partir des transactions, ce qui évite de modifier manuellement une cellule de PRU après chaque opération.',
        ],
      },
      {
        heading: 'Limites du PRU',
        body: [
          'Le PRU est utile pour une ligne, mais il ne répond pas à toutes les questions. Pour juger une stratégie, il faut aussi intégrer les dividendes, les apports, les retraits et la comparaison à un benchmark.',
        ],
      },
    ],
    ctaLabel: 'Calculer mes positions',
    related: ['/guides/suivi-portefeuille-boursier', '/guides/suivi-pea', '/fonctionnalites/benchmark'],
  },
  {
    collection: 'guides',
    slug: 'suivi-dividendes',
    href: '/guides/suivi-dividendes',
    title: 'Suivi dividendes',
    metaTitle: 'Suivi dividendes : rendement, historique et revenus passifs',
    metaDescription:
      'Suivre les dividendes reçus par action, par année et par compte avec rendement sur coût et historique exportable.',
    eyebrow: 'Guide dividendes',
    h1: 'Suivi dividendes : mesurer vos revenus sans perdre le contexte',
    intro:
      'Les dividendes ne sont pas seulement une ligne de cash. Ils expliquent une partie du rendement total et permettent de suivre la régularité des revenus par action, par année et par compte.',
    takeaways: [
      'Associez chaque dividende à une position et à un compte.',
      'Suivez le rendement sur coût plutôt qu’un rendement isolé.',
      'Gardez l’historique annuel pour mesurer la progression réelle.',
    ],
    sections: [
      {
        heading: 'Les indicateurs utiles',
        body: [
          'Un bon suivi affiche les dividendes totaux, le nombre de versements, les titres contributeurs et l’évolution annuelle. Cela évite de confondre un paiement ponctuel avec une progression durable des revenus.',
          'Le rendement sur coût est particulièrement utile : il rapporte les dividendes reçus au capital réellement investi sur la position.',
        ],
      },
      {
        heading: 'Dividendes et performance totale',
        body: [
          'Une action peut sembler stagnante en prix mais produire une partie du rendement via les dividendes. À l’inverse, un rendement élevé peut masquer une baisse du capital. Les deux dimensions doivent être suivies ensemble.',
        ],
      },
      {
        heading: 'Centraliser plusieurs comptes',
        body: [
          'Si vous détenez des actions à dividendes dans un PEA et un CTO, un suivi consolidé vous évite de sous-estimer ou doubler certains revenus. Fi-Hub regroupe les versements par compte, titre et période.',
        ],
      },
    ],
    ctaLabel: 'Suivre mes dividendes',
    related: ['/fonctionnalites/dividendes', '/guides/performance-portefeuille', '/guides/suivi-pea'],
  },
  {
    collection: 'guides',
    slug: 'performance-portefeuille',
    href: '/guides/performance-portefeuille',
    title: 'Performance portefeuille',
    metaTitle: 'Performance portefeuille : mesurer hors apports et comparer au marché',
    metaDescription:
      'Méthode pour mesurer la performance réelle d’un portefeuille, distinguer apports et marché, et comparer à un benchmark.',
    eyebrow: 'Performance',
    h1: 'Performance portefeuille : arrêter de confondre apports et rendement',
    intro:
      'Voir son patrimoine augmenter ne signifie pas toujours que l’investissement performe. Les apports, retraits, dividendes et variations de marché doivent être isolés pour lire correctement la performance.',
    takeaways: [
      'La variation brute du patrimoine inclut les apports.',
      'La performance doit être comparée à un benchmark pertinent.',
      'Les périodes de comparaison doivent suivre vos vraies transactions.',
    ],
    sections: [
      {
        heading: 'Performance brute vs performance hors apports',
        body: [
          'Si votre portefeuille passe de 50 000 € à 70 000 € après 15 000 € d’apports, la variation brute est positive, mais elle ne suffit pas à juger vos choix d’investissement. Il faut retirer l’effet des flux entrants et sortants.',
          'C’est cette lecture qui permet de savoir si votre allocation crée réellement de la valeur.',
        ],
      },
      {
        heading: 'Choisir le bon benchmark',
        body: [
          'Un portefeuille majoritairement actions européennes ne se juge pas comme un portefeuille 100 % Nasdaq. Le benchmark doit refléter votre univers d’investissement : CAC 40, S&P 500, MSCI World ou autre référence.',
        ],
      },
      {
        heading: 'Lire la performance dans le temps',
        body: [
          'Une bonne interface doit afficher plusieurs périodes et garder l’historique des snapshots. Vous pouvez ainsi relire une année, un semestre ou une phase précise de marché sans reconstruire les chiffres à la main.',
        ],
      },
    ],
    ctaLabel: 'Mesurer ma performance',
    related: ['/fonctionnalites/benchmark', '/guides/suivi-portefeuille-boursier', '/guides/suivi-dividendes'],
  },
];

export const featurePages: SeoPage[] = [
  {
    collection: 'fonctionnalites',
    slug: 'positions-pru',
    href: '/fonctionnalites/positions-pru',
    title: 'Positions et PRU',
    metaTitle: 'Positions et PRU Fi-Hub : portefeuille, cash et performance',
    metaDescription:
      'Fi-Hub centralise vos positions : portefeuille, poche espèces, transactions, frais, PRU, dividendes et performance.',
    eyebrow: 'Fonctionnalité',
    h1: 'Positions et PRU : lire votre portefeuille sans tableur',
    intro:
      'Fi-Hub rassemble vos lignes, liquidités, PRU et indicateurs de performance dans un tableau de bord conçu pour les investisseurs particuliers.',
    takeaways: [
      'Positions recalculées à partir des transactions.',
      'Poche cash séparée des titres.',
      'Performance et allocation lisibles sans tableur.',
    ],
    sections: [
      {
        heading: 'Une base transactionnelle',
        body: [
          'Chaque achat, vente, frais ou dividende reste un événement consultable. Cette approche rend le suivi plus fiable qu’un tableau où seul le total est mis à jour.',
        ],
      },
      {
        heading: 'Une lecture investisseur',
        body: [
          'Le tableau de bord met en avant la valeur actuelle, le PRU, les plus-values latentes et l’allocation par compte. Vous voyez rapidement ce qui pèse réellement dans le PEA.',
        ],
      },
    ],
    ctaLabel: 'Voir mes positions',
    related: ['/guides/suivi-pea', '/guides/calcul-pru', '/fonctionnalites/benchmark'],
  },
  {
    collection: 'fonctionnalites',
    slug: 'dividendes',
    href: '/fonctionnalites/dividendes',
    title: 'Module dividendes',
    metaTitle: 'Module dividendes : historique, rendement et revenus par action',
    metaDescription:
      'Suivez les dividendes reçus dans Fi-Hub : historique annuel, rendement sur coût, versements par action et comptes.',
    eyebrow: 'Fonctionnalité',
    h1: 'Module dividendes : suivre vos revenus d’investissement dans le temps',
    intro:
      'Fi-Hub transforme les versements de dividendes en indicateurs exploitables : historique, rendement, contributeurs et évolution annuelle.',
    takeaways: [
      'Historique par année et par valeur.',
      'Rendement sur coût pour chaque position.',
      'Vue consolidée multi-comptes.',
    ],
    sections: [
      {
        heading: 'Des versements reliés aux positions',
        body: [
          'Chaque dividende peut être rattaché au titre concerné, ce qui permet de suivre les revenus par action et d’éviter les lignes de cash anonymes.',
        ],
      },
      {
        heading: 'Une lecture annuelle',
        body: [
          'L’évolution année par année aide à mesurer la progression des revenus passifs et à repérer les valeurs qui contribuent le plus au portefeuille.',
        ],
      },
    ],
    ctaLabel: 'Suivre mes dividendes',
    related: ['/guides/suivi-dividendes', '/guides/performance-portefeuille', '/fonctionnalites/positions-pru'],
  },
  {
    collection: 'fonctionnalites',
    slug: 'benchmark',
    href: '/fonctionnalites/benchmark',
    title: 'Benchmark portefeuille',
    metaTitle: 'Benchmark portefeuille : comparez vos performances au marché',
    metaDescription:
      'Comparez votre portefeuille à des indices comme le CAC 40, le S&P 500 ou un ETF Monde pour lire votre performance.',
    eyebrow: 'Fonctionnalité',
    h1: 'Benchmark portefeuille : savoir si vous battez vraiment le marché',
    intro:
      'Fi-Hub met votre courbe de performance face à un indice de référence pour replacer chaque période dans son contexte de marché.',
    takeaways: [
      'Comparaison visuelle avec des indices.',
      'Lecture de l’écart de performance.',
      'Analyse sur la période qui vous intéresse.',
    ],
    sections: [
      {
        heading: 'Un indicateur plus honnête',
        body: [
          'Une performance positive peut être faible si le marché a beaucoup mieux fait. À l’inverse, une baisse limitée peut être une bonne résistance dans une période difficile.',
        ],
      },
      {
        heading: 'Des périodes comparables',
        body: [
          'L’intérêt du benchmark est de comparer la même fenêtre temporelle. Fi-Hub garde l’historique nécessaire pour relire vos choix dans le bon contexte.',
        ],
      },
    ],
    ctaLabel: 'Comparer mon portefeuille',
    related: ['/guides/performance-portefeuille', '/guides/calcul-pru', '/fonctionnalites/positions-pru'],
  },
  {
    collection: 'fonctionnalites',
    slug: 'import-transactions',
    href: '/fonctionnalites/import-transactions',
    title: 'Import transactions',
    metaTitle: 'Import transactions IA : PDF, CSV, tickers et frais',
    metaDescription:
      'Importez vos transactions de courtier avec l’aide de l’IA : PDF, CSV, reconnaissance de tickers, frais et validation ligne par ligne.',
    eyebrow: 'Fonctionnalité',
    h1: 'Import transactions IA : réduire la saisie manuelle sans perdre le contrôle',
    intro:
      'Fi-Hub utilise l’IA pour transformer un relevé broker en transactions vérifiables, avec reconnaissance des tickers, frais et garde-fous avant import définitif.',
    takeaways: [
      'Extraction assistée par IA depuis relevés PDF, CSV ou texte collé.',
      'Reconnaissance ISIN, tickers, types d’opérations et frais.',
      'Validation ligne par ligne avant commit.',
    ],
    sections: [
      {
        heading: 'Une IA pour préparer, pas pour décider à votre place',
        body: [
          'L’IA lit le relevé, propose les lignes structurées et aide à reconnaître les opérations : achats, ventes, dividendes, conversions ou frais. Elle accélère la saisie tout en gardant une étape de contrôle humain.',
          'Avant l’import définitif, chaque ligne reste modifiable. Vous pouvez corriger un ticker, retirer une ligne ou ajuster un montant si le relevé source est ambigu.',
        ],
      },
      {
        heading: 'Un import contrôlé',
        body: [
          'L’objectif n’est pas de remplir votre historique à l’aveugle. Fi-Hub prépare les lignes, signale les éléments à vérifier et vous laisse valider avant d’écrire les transactions.',
        ],
      },
      {
        heading: 'Des frais traités proprement',
        body: [
          'Les frais de courtage modifient la lecture du PRU et de la performance. Ils sont donc conservés comme des données de transaction, pas comme une note perdue.',
        ],
      },
    ],
    ctaLabel: 'Importer mes transactions',
    related: ['/guides/suivi-portefeuille-boursier', '/guides/calcul-pru', '/fonctionnalites/positions-pru'],
  },
];

export const alternativePages: SeoPage[] = [
  {
    collection: 'alternatives',
    slug: 'finary',
    href: '/alternatives/finary',
    title: 'Alternative à Finary',
    metaTitle: 'Alternative à Finary : Fi-Hub pour le suivi portefeuille',
    metaDescription:
      'Comparez Fi-Hub et Finary pour le suivi de portefeuille : PEA, CTO, dividendes, benchmark, imports et exports.',
    eyebrow: 'Comparatif',
    h1: 'Alternative à Finary : une option centrée sur le suivi portefeuille',
    intro:
      'Finary est connu pour l’agrégation patrimoniale. Fi-Hub prend un angle plus journal de portefeuille : transactions, PRU, dividendes, benchmark et exports.',
    takeaways: [
      'Fi-Hub cible le suivi détaillé des investisseurs particuliers.',
      'L’import et l’export gardent les données maîtrisables.',
      'Le benchmark et les dividendes sont au cœur de l’analyse.',
    ],
    sections: [
      {
        heading: 'Quand Fi-Hub est pertinent',
        body: [
          'Fi-Hub est pertinent si votre priorité est de comprendre vos positions boursières, votre performance hors apports et vos revenus de dividendes plutôt que d’obtenir uniquement une photo globale du patrimoine.',
        ],
      },
      {
        heading: 'Les critères de comparaison',
        body: [
          'Regardez la profondeur du suivi PEA/CTO, la lisibilité des transactions, l’export des données, la gestion des frais et la capacité à comparer votre performance au marché.',
        ],
      },
    ],
    ctaLabel: 'Tester Fi-Hub',
    related: ['/guides/suivi-portefeuille-boursier', '/fonctionnalites/benchmark', '/alternatives/portfolio-performance'],
  },
  {
    collection: 'alternatives',
    slug: 'portfolio-performance',
    href: '/alternatives/portfolio-performance',
    title: 'Alternative à Portfolio Performance',
    metaTitle: 'Alternative à Portfolio Performance : suivi portefeuille en ligne',
    metaDescription:
      'Comparer Portfolio Performance et Fi-Hub pour suivre un portefeuille boursier en ligne, sans installation locale.',
    eyebrow: 'Comparatif',
    h1: 'Alternative à Portfolio Performance : un suivi portefeuille web et plus direct',
    intro:
      'Portfolio Performance est puissant, mais il demande une logique desktop et une prise en main plus technique. Fi-Hub vise un suivi web plus immédiat pour PEA, CTO et comptes français.',
    takeaways: [
      'Aucune installation locale.',
      'Interface web pensée pour une consultation régulière.',
      'Exports conservés pour garder la maîtrise des données.',
    ],
    sections: [
      {
        heading: 'Pour quel usage',
        body: [
          'Si vous aimez configurer finement un outil desktop, Portfolio Performance reste une référence. Si vous voulez saisir, importer et consulter rapidement vos indicateurs dans le navigateur, Fi-Hub peut être plus simple.',
        ],
      },
      {
        heading: 'Points à comparer',
        body: [
          'Comparez la facilité d’import, la lecture mobile, le suivi des comptes français, la sécurité, la sauvegarde et le temps nécessaire pour garder les données à jour.',
        ],
      },
    ],
    ctaLabel: 'Essayer le suivi web',
    related: ['/fonctionnalites/import-transactions', '/guides/suivi-portefeuille-boursier', '/alternatives/finary'],
  },
  {
    collection: 'alternatives',
    slug: 'sharesight',
    href: '/alternatives/sharesight',
    title: 'Alternative à Sharesight',
    metaTitle: 'Alternative à Sharesight : suivi PEA, CTO et dividendes',
    metaDescription:
      'Fi-Hub comme alternative à Sharesight pour les investisseurs français qui suivent PEA, CTO, dividendes et performance.',
    eyebrow: 'Comparatif',
    h1: 'Alternative à Sharesight : un suivi adapté aux enveloppes françaises',
    intro:
      'Sharesight est orienté suivi d’investissements international. Fi-Hub se concentre sur les besoins français : PEA, CTO, livrets, assurance-vie, dividendes et exports.',
    takeaways: [
      'Prise en compte des enveloppes françaises.',
      'Suivi des dividendes et du rendement sur coût.',
      'Vision consolidée du patrimoine financier.',
    ],
    sections: [
      {
        heading: 'Pourquoi comparer',
        body: [
          'Le bon outil dépend de vos comptes, de vos marchés et de votre fréquence de suivi. Un investisseur français avec PEA, livrets et CTO n’a pas toujours les mêmes besoins qu’un investisseur international multi-brokers.',
        ],
      },
      {
        heading: 'Ce que Fi-Hub met en avant',
        body: [
          'Fi-Hub privilégie une lecture simple des comptes, positions, dividendes et performances, avec une logique d’export pour éviter l’enfermement dans l’outil.',
        ],
      },
    ],
    ctaLabel: 'Découvrir Fi-Hub',
    related: ['/guides/suivi-dividendes', '/fonctionnalites/dividendes', '/alternatives/finary'],
  },
];

export const seoPages = [...guidePages, ...featurePages, ...alternativePages];

export function getSeoPage(href: string) {
  return seoPages.find((page) => page.href === href);
}

export function getRelatedPages(page: SeoPage) {
  return page.related
    .map((href) => getSeoPage(href))
    .filter((relatedPage): relatedPage is SeoPage => Boolean(relatedPage));
}

export function getPageBySlug(collection: SeoCollection, slug: string) {
  return seoPages.find((page) => page.collection === collection && page.slug === slug);
}

export const indexableMarketingRoutes: SeoRoute[] = [
  { href: '/', lastModified: SEO_LAST_MODIFIED, changeFrequency: 'weekly', priority: 1 },
  { href: '/signup', lastModified: SEO_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.55 },
  { href: '/guides', lastModified: SEO_LAST_MODIFIED, changeFrequency: 'weekly', priority: 0.85 },
  { href: '/fonctionnalites', lastModified: SEO_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.8 },
  { href: '/alternatives', lastModified: SEO_LAST_MODIFIED, changeFrequency: 'monthly', priority: 0.8 },
  ...guidePages.map((page) => ({
    href: page.href,
    lastModified: SEO_LAST_MODIFIED,
    changeFrequency: 'monthly' as const,
    priority: 0.72,
  })),
  ...featurePages.map((page) => ({
    href: page.href,
    lastModified: SEO_LAST_MODIFIED,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  })),
  ...alternativePages.map((page) => ({
    href: page.href,
    lastModified: SEO_LAST_MODIFIED,
    changeFrequency: 'monthly' as const,
    priority: 0.68,
  })),
];
