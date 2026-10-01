import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getUserSubscription } from '@/lib/subscription';
import { appOrigin } from '@/lib/public-api/oauth-metadata';
import { ApiTokensManager } from './ApiTokensManager';
import { ConnectGuides } from './ConnectGuides';

export default async function ApiAccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/settings/api');

  const subscription = await getUserSubscription(user.id);
  const hasApiAccess = subscription.plan.features.includes('api_access');

  return (
    <div>
      <header className="mb-6 pb-6 border-b border-[color:var(--rule)]">
        <h2 className="display text-3xl leading-none text-[color:var(--ink)]">Accès API</h2>
        <p className="text-sm text-[color:var(--ink-soft)] mt-2">
          Connectez ChatGPT, Claude ou vos propres outils à votre patrimoine, en lecture seule.
        </p>
      </header>

      {hasApiAccess ? (
        <ApiTokensManager />
      ) : (
        <div className="rounded-xl border border-dashed border-[color:var(--accent)] bg-[color:var(--accent-soft)] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--paper)] text-[color:var(--accent)]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[color:var(--ink)]">Fonctionnalité Pro</p>
              <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
                Posez vos questions sur votre patrimoine à ChatGPT ou Claude : répartition, plus-values, dividendes,
                historique. Vos données restent en lecture seule et vous révoquez l&apos;accès quand vous voulez.
              </p>
              <Link
                href="/settings/billing"
                className="btn-ink mt-4 inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm"
              >
                Passer Pro
              </Link>
            </div>
          </div>
        </div>
      )}

      <ConnectGuides appUrl={appOrigin()} />
    </div>
  );
}
