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
    <div className="min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <span className="display text-4xl leading-none text-[color:var(--ink)]">Fi&#8209;Hub</span>
          <p className="mono mt-2 text-xs uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
            Configuration
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                i <= step ? 'bg-[color:var(--accent)]' : 'bg-[color:var(--rule)]'
              }`}
            />
          ))}
        </div>

        <div className="ink-card rounded-2xl pop-shadow p-8">
          {step === 0 && (
            <div>
              <h1 className="display text-3xl leading-none text-[color:var(--ink)] mb-2">
                Bienvenue sur Fi-Hub 👋
              </h1>
              <p className="text-[color:var(--ink-soft)] mb-6">
                Votre compte <span className="font-medium">{email}</span> est prêt. Prenons 30
                secondes pour le personnaliser.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-[color:var(--ink)] mb-1">
                    Comment vous appelle-t-on ?{' '}
                    <span className="text-[color:var(--ink-soft)] font-normal">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="w-full px-3 py-2.5 border border-[color:var(--rule)] rounded-lg bg-[color:var(--paper)] text-[color:var(--ink)] focus:ring-2 focus:ring-[color:var(--accent)] focus:border-transparent"
                  />
                </div>
                <label className="flex items-start gap-2 text-sm cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="mt-0.5 rounded border-[color:var(--rule)] text-[color:var(--accent)] focus:ring-[color:var(--accent)]"
                  />
                  <span className="text-[color:var(--ink-soft)]">
                    Je souhaite recevoir des emails occasionnels sur les nouveautés produit.
                  </span>
                </label>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h1 className="display text-3xl leading-none text-[color:var(--ink)] mb-2">
                Comment ça marche ?
              </h1>
              <p className="text-[color:var(--ink-soft)] mb-6">
                Trois briques à connaître pour suivre tout votre patrimoine.
              </p>
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-[color:var(--accent-soft)] text-[color:var(--accent)] flex items-center justify-center">
                    <Wallet className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="font-medium text-[color:var(--ink)]">
                      1. Ajoutez vos comptes
                    </p>
                    <p className="text-sm text-[color:var(--ink-soft)]">
                      PEA, CTO, Livret A, LDDS, assurance-vie… Regroupez toutes vos enveloppes.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-[color:var(--gain-soft)] text-[color:var(--gain)] flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="font-medium text-[color:var(--ink)]">
                      2. Saisissez vos positions et transactions
                    </p>
                    <p className="text-sm text-[color:var(--ink-soft)]">
                      Vos titres sont valorisés en temps réel via Yahoo Finance.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-[color:var(--paper-2)] text-[color:var(--ink)] flex items-center justify-center">
                    <PieChart className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="font-medium text-[color:var(--ink)]">
                      3. Suivez votre progression
                    </p>
                    <p className="text-sm text-[color:var(--ink-soft)]">
                      Répartition, historique, dividendes : tout au même endroit.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="display text-3xl leading-none text-[color:var(--ink)] mb-2">
                Démarrage inclus
              </h1>
              <p className="text-[color:var(--ink-soft)] mb-6">
                Le plan Free est gratuit et vous permet de tester tranquillement.
              </p>
              <div className="rounded-lg border border-[color:var(--rule)] bg-[color:var(--paper-2)] p-4 mb-4">
                <p className="font-medium text-[color:var(--ink)] mb-2 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[color:var(--accent)]" /> Plan Free
                </p>
                <ul className="text-sm text-[color:var(--ink-soft)] space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[color:var(--gain)]" /> 1 compte
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[color:var(--gain)]" /> 50 transactions
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[color:var(--gain)]" /> 5 positions
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[color:var(--gain)]" /> Graphiques essentiels
                  </li>
                </ul>
              </div>
              <p className="text-sm text-[color:var(--ink-soft)]">
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
              className="text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] disabled:opacity-0"
            >
              Retour
            </button>

            {step < total - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="btn-ink inline-flex items-center gap-2 py-2.5 px-5 rounded-lg"
              >
                Suivant <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className="btn-ink inline-flex items-center gap-2 py-2.5 px-5 rounded-lg disabled:opacity-50"
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
