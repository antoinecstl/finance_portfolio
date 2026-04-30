'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Upload,
  BarChart2,
  Coins,
  FileDown,
  Wallet,
  ArrowRight,
  Check,
} from 'lucide-react';

type ProAction = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
};

const PRO_ACTIONS: ProAction[] = [
  {
    key: 'import',
    icon: Upload,
    title: 'Importer mes transactions',
    description: 'Reprenez votre historique depuis un fichier CSV de votre courtier.',
    href: '/dashboard/import',
  },
  {
    key: 'accounts',
    icon: Wallet,
    title: 'Ajouter des comptes',
    description: 'PEA, CTO, livrets, AV : centralisez tout votre patrimoine.',
    href: '/dashboard',
  },
  {
    key: 'analytics',
    icon: BarChart2,
    title: 'Voir mes analyses avancées',
    description: 'Performance annuelle, historique complet, comparaison benchmarks.',
    href: '/dashboard',
  },
];

const PRO_FEATURES = [
  { icon: Wallet, label: 'Comptes, transactions et positions illimités' },
  { icon: BarChart2, label: 'Analyses avancées & performance annuelle' },
  { icon: Coins, label: 'Module dividendes' },
  { icon: Upload, label: 'Import CSV depuis votre courtier' },
  { icon: FileDown, label: 'Export CSV de vos données' },
];

export function ProOnboarding({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const total = 2;

  const goTo = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-onboarding-title"
      className="fixed inset-0 z-[101] bg-black/50 backdrop-blur-sm flex items-center justify-center px-4 py-8 overflow-y-auto"
    >
      <div className="ink-card pop-shadow w-full max-w-lg rounded-2xl animate-[popIn_0.4s_ease-out]">
        <div className="flex items-center justify-center gap-2 pt-2 pb-4">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                i <= step ? 'bg-[color:var(--accent)]' : 'bg-[color:var(--rule)]'
              }`}
            />
          ))}
        </div>

        <div className="px-8 pb-8">
          {step === 0 && (
            <div>
              <div className="flex items-center justify-center mb-4">
                <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                  <Sparkles className="w-7 h-7" />
                </span>
              </div>
              <h1
                id="pro-onboarding-title"
                className="display text-3xl leading-none text-[color:var(--ink)] text-center mb-2"
              >
                Bienvenue dans Fi-Hub Pro 🎉
              </h1>
              <p className="text-[color:var(--ink-soft)] text-center mb-6">
                Votre abonnement est actif. Voici tout ce que vous venez de débloquer.
              </p>
              <ul className="space-y-2.5 mb-2">
                {PRO_FEATURES.map((f) => (
                  <li
                    key={f.label}
                    className="flex items-start gap-3 text-sm text-[color:var(--ink)]"
                  >
                    <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-[color:var(--gain-soft)] text-[color:var(--gain)] flex items-center justify-center">
                      <Check className="w-4 h-4" />
                    </span>
                    <span className="pt-1">{f.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 1 && (
            <div>
              <h1 className="display text-3xl leading-none text-[color:var(--ink)] mb-2 text-center">
                Par où commencer ?
              </h1>
              <p className="text-[color:var(--ink-soft)] text-center mb-6">
                Choisissez une action pour tirer parti de votre nouveau plan.
              </p>
              <div className="space-y-3">
                {PRO_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.key}
                      type="button"
                      onClick={() => goTo(action.href)}
                      className="w-full text-left flex items-start gap-3 p-4 rounded-xl border border-[color:var(--rule)] hover:border-[color:var(--accent)] hover:bg-[color:var(--paper-2)] transition-colors group"
                    >
                      <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-[color:var(--accent-soft)] text-[color:var(--accent)] flex items-center justify-center group-hover:bg-[color:var(--accent)] group-hover:text-[color:var(--paper)] transition-colors">
                        <Icon className="w-5 h-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[color:var(--ink)]">
                          {action.title}
                        </p>
                        <p className="text-sm text-[color:var(--ink-soft)]">
                          {action.description}
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-[color:var(--ink-soft)] group-hover:text-[color:var(--accent)] mt-2.5 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"
            >
              Plus tard
            </button>
            {step < total - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as 0 | 1)}
                className="btn-ink inline-flex items-center gap-2 py-2.5 px-5 rounded-lg"
              >
                Continuer <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="btn-ink inline-flex items-center gap-2 py-2.5 px-5 rounded-lg"
              >
                Terminer
              </button>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.92); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
