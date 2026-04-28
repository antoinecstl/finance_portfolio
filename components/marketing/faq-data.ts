export const FAQ_ITEMS = [
  {
    q: 'Mes données sont-elles en sécurité ?',
    a: "Vos données sont stockées sur Supabase (infrastructure européenne) avec Row Level Security : chaque ligne est strictement isolée par utilisateur. Fi-Hub ne partage jamais vos données avec des tiers et vous pouvez les exporter ou les supprimer à tout moment.",
  },
  {
    q: 'Est-ce que Fi-Hub se connecte à ma banque ?',
    a: "Non, pas dans la version actuelle. Vous saisissez vos comptes et transactions manuellement. L'agrégation bancaire automatique est à l'étude.",
  },
  {
    q: "D'où viennent les cours boursiers ?",
    a: "Les cours en temps réel et l'historique proviennent de Yahoo Finance via une API interne. Actions françaises, européennes, américaines, ETFs.",
  },
  {
    q: "Puis-je annuler mon abonnement Pro à tout moment ?",
    a: "Oui, depuis votre espace Paramètres → Abonnement. L'accès Pro reste actif jusqu'à la fin de la période en cours.",
  },
  {
    q: "Puis-je récupérer toutes mes données ?",
    a: "Oui. Via Paramètres → Zone danger → Télécharger l'export JSON, vous obtenez un fichier complet (comptes, transactions, positions, profil).",
  },
] as const;
