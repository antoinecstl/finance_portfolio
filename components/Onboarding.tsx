'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Wallet,
  PieChart,
  BarChart2,
  ArrowRight,
  Loader2,
  Check,
} from 'lucide-react';

export function Onboarding({ email }: { email: string }) {
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const total = 3;

  const handleFinish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/account/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, marketingOptIn: marketing }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Erreur' }));
        throw new Error(data.error ?? 'Erreur');
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white dark:from-blue-950/30 dark:via-zinc-950 dark:to-zinc-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white">
            <TrendingUp className="w-5 h-5" />
          </span>
          <span className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Fi-Hub</span>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                i <= step ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-800'
              }`}
            />
          ))}
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-8">
          {step === 0 && (
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                Bienvenue sur Fi-Hub 👋
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                Votre compte <span className="font-medium">{email}</span> est prêt. Prenons 30
                secondes pour le personnaliser.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Comment vous appelle-t-on ?{' '}
                    <span className="text-zinc-400 font-normal">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="w-full px-3 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <label className="flex items-start gap-2 text-sm cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Je souhaite recevoir des emails occasionnels sur les nouveautés produit.
                  </span>
                </label>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                Comment ça marche ?
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                Trois briques à connaître pour suivre tout votre patrimoine.
              </p>
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                    <Wallet className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      1. Ajoutez vos comptes
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      PEA, CTO, Livret A, LDDS, assurance-vie… Regroupez toutes vos enveloppes.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      2. Saisissez vos positions et transactions
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Vos titres sont valorisés en temps réel via Yahoo Finance.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center">
                    <PieChart className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      3. Suivez votre progression
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Répartition, historique, dividendes : tout au même endroit.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                Démarrage inclus
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                Le plan Free est gratuit et vous permet de tester tranquillement.
              </p>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 mb-4">
                <p className="font-medium text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-600" /> Plan Free
                </p>
                <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> 1 compte
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> 50 transactions
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> 5 positions
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" /> Graphiques essentiels
                  </li>
                </ul>
              </div>
              <p className="text-sm text-zinc-500">
                Vous pourrez passer Pro à tout moment pour des suivis illimités et des analyses
                avancées.
              </p>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || submitting}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-0"
            >
              Retour
            </button>

            {step < total - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-2 py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
              >
                Suivant <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className="inline-flex items-center gap-2 py-2.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Accéder à mon dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
