import { createClient } from '@/lib/supabase/server';
import { getUserSubscription } from '@/lib/subscription';
import { formatPrice, PLANS } from '@/lib/plans';
import { BillingActions } from './BillingActions';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ctx = await getUserSubscription(user!.id);
  const pro = PLANS.pro;

  return (
    <>
      <h2 className="text-lg font-semibold mb-6">Abonnement</h2>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm text-zinc-500">Plan actuel</p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {ctx.plan.name}
              {ctx.isFounder && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                  Fondateur
                </span>
              )}
            </p>
          </div>
          <span className="text-sm text-zinc-500">{formatPrice(ctx.plan)}</span>
        </div>

        {ctx.planId === 'pro' && ctx.currentPeriodEnd && (
          <p className="text-sm text-zinc-500">
            {ctx.cancelAtPeriodEnd ? 'Se termine le ' : 'Renouvellement le '}
            {new Date(ctx.currentPeriodEnd).toLocaleDateString('fr-FR')}
          </p>
        )}

        {ctx.status === 'past_due' && (
          <p className="text-sm text-red-600 mt-2">
            Paiement en attente — merci de mettre à jour votre moyen de paiement.
          </p>
        )}
      </div>

      {ctx.planId === 'free' && !ctx.isFounder && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/10 p-5 mb-6">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Passer Pro</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
            Comptes, transactions et positions illimités, analytics avancées, export CSV, module
            dividendes.
          </p>
          <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1 mb-4">
            {pro.highlights.map((h) => (
              <li key={h}>• {h}</li>
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
    </>
  );
}
