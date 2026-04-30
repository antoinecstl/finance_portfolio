import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getUserSubscription } from '@/lib/subscription';
import { formatPrice, PLANS } from '@/lib/plans';
import { BillingActions } from './BillingActions';
import { Check, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctx = await getUserSubscription(user!.id);
  const pro = PLANS.pro;

  const statusLabel: Record<string, { text: string; color: string }> = {
    active: { text: 'Actif', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
    trialing: { text: 'Essai', color: 'bg-[color:var(--accent-soft)] text-[color:var(--accent)]' },
    past_due: { text: 'Paiement en attente', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
    canceled: { text: 'Annulé', color: 'bg-[color:var(--paper-2)] text-[color:var(--ink-soft)]' },
    paused: { text: 'En pause', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  };
  const badge = ctx.status ? statusLabel[ctx.status] : null;

  return (
    <div>
      <header className="mb-6 pb-6 border-b border-[color:var(--rule)]">
        <h2 className="display text-3xl leading-none text-[color:var(--ink)]">Abonnement</h2>
        <p className="text-sm text-[color:var(--ink-soft)] mt-2">
          Gérez votre plan et vos informations de facturation.
        </p>
      </header>

      <div
        className={`rounded-xl p-6 mb-6 ${
          ctx.planId === 'pro' || ctx.isFounder
            ? 'bg-[color:var(--ink)] text-[color:var(--paper)] border border-[color:var(--ink)]'
            : 'bg-[color:var(--paper-2)] border border-[color:var(--rule)] text-[color:var(--ink)]'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p
                className={`text-xs uppercase tracking-wide font-medium ${
                  ctx.planId === 'pro' || ctx.isFounder ? 'text-[color:var(--paper)] opacity-70' : 'text-[color:var(--ink-soft)]'
                }`}
              >
                Plan actuel
              </p>
              {ctx.isFounder && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-white/20 text-white font-medium">
                  <Sparkles className="h-3 w-3" /> Fondateur
                </span>
              )}
              {badge && !ctx.isFounder && (
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${badge.color}`}>
                  {badge.text}
                </span>
              )}
            </div>
            <p className="text-3xl font-bold">{ctx.plan.name}</p>
            <p
              className={`text-sm mt-1 ${
                ctx.planId === 'pro' || ctx.isFounder ? 'text-[color:var(--paper)] opacity-70' : 'text-[color:var(--ink-soft)]'
              }`}
            >
              {formatPrice(ctx.plan)}
            </p>
          </div>
        </div>

        {ctx.planId === 'pro' && ctx.currentPeriodEnd && (
          <p
            className={`text-sm mt-4 pt-4 border-t ${
              ctx.planId === 'pro' ? 'border-white/20 text-[color:var(--paper)] opacity-70' : 'border-[color:var(--rule)] text-[color:var(--ink-soft)]'
            }`}
          >
            {ctx.cancelAtPeriodEnd ? 'Accès Pro jusqu\u2019au ' : 'Prochain renouvellement le '}
            <span className="font-medium">
              {new Date(ctx.currentPeriodEnd).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </p>
        )}

        {ctx.status === 'past_due' && (
          <div className="mt-4 pt-4 border-t border-white/20 bg-red-500/20 rounded-md px-3 py-2 text-sm">
            Paiement en attente — merci de mettre à jour votre moyen de paiement.
          </div>
        )}
      </div>

      {ctx.planId === 'free' && !ctx.isFounder && (
        <div className="rounded-xl border border-[color:var(--rule)] bg-[color:var(--paper-2)] p-6 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-[color:var(--accent)]" />
            <h3 className="font-semibold text-[color:var(--ink)]">
              Passez Pro pour débloquer tout Fi-Hub
            </h3>
          </div>
          <p className="text-sm text-[color:var(--ink-soft)] mb-4">
            Comptes, transactions et positions illimités, analytics avancées, export CSV, module
            dividendes.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
            {pro.highlights.map((h) => (
              <li
                key={h}
                className="flex items-start gap-2 text-sm text-[color:var(--ink)]"
              >
                <Check className="h-4 w-4 text-[color:var(--accent)] mt-0.5 flex-shrink-0" />
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Suspense fallback={null}>
        <BillingActions
          planId={ctx.planId}
          userId={user!.id}
          email={user!.email ?? ''}
          isFounder={ctx.isFounder}
        />
      </Suspense>
    </div>
  );
}
