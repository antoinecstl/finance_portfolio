'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const ITEMS = [
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
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="max-w-3xl mx-auto px-4 py-16">
      <h2 className="text-3xl font-bold text-center text-zinc-900 dark:text-zinc-100 mb-10">
        Questions fréquentes
      </h2>
      <div className="space-y-2">
        {ITEMS.map((it, i) => (
          <div
            key={it.q}
            className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900"
          >
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{it.q}</span>
              <ChevronDown
                className={`h-4 w-4 text-zinc-500 transition-transform ${open === i ? 'rotate-180' : ''}`}
              />
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-sm text-zinc-600 dark:text-zinc-400">{it.a}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
