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
    trialing: { text: 'Essai', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
    past_due: { text: 'Paiement en attente', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
    canceled: { text: 'Annulé', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
    paused: { text: 'En pause', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  };
  const badge = ctx.status ? statusLabel[ctx.status] : null;

  return (
    <div>
      <header className="mb-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Abonnement</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Gérez votre plan et vos informations de facturation.
        </p>
      </header>

      <div
        className={`rounded-xl p-6 mb-6 ${
          ctx.planId === 'pro' || ctx.isFounder
            ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
            : 'bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p
                className={`text-xs uppercase tracking-wide font-medium ${
                  ctx.planId === 'pro' || ctx.isFounder ? 'text-blue-100' : 'text-zinc-500'
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
                ctx.planId === 'pro' || ctx.isFounder ? 'text-blue-100' : 'text-zinc-500'
              }`}
            >
              {formatPrice(ctx.plan)}
            </p>
          </div>
        </div>

        {ctx.planId === 'pro' && ctx.currentPeriodEnd && (
          <p
            className={`text-sm mt-4 pt-4 border-t ${
              ctx.planId === 'pro' ? 'border-white/20 text-blue-100' : 'border-zinc-200 text-zinc-500'
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
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-6 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Passez Pro pour débloquer tout Fi-Hub
            </h3>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Comptes, transactions et positions illimités, analytics avancées, export CSV, module
            dividendes.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
            {pro.highlights.map((h) => (
              <li
                key={h}
                className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
              >
                <Check className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      <BillingActions
        planId={ctx.planId}
        userId={user!.id}
        email={user!.email ?? ''}
        isFounder={ctx.isFounder}
      />
    </div>
  );
}
