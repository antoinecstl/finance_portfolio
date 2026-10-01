import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getUserSubscription } from '@/lib/subscription';
import { buildRedirectUrl } from '@/lib/public-api/oauth';
import { resolveAuthorizationRequest } from '@/lib/public-api/oauth-server';
import { ConsentForm } from './ConsentForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Autoriser une application',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <p className="display text-3xl text-center mb-6">Fi&#8209;Hub</p>
        <div className="ink-card rounded-2xl pop-shadow p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}

export default async function AuthorizePage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') params[key] = value;
  }

  const resolved = await resolveAuthorizationRequest(params);
  // Pas de redirection automatique sur erreur : l'enregistrement de clients est
  // ouvert, une redirection sans action de l'utilisateur servirait de redirection ouverte.
  if (resolved.kind !== 'ok') {
    return (
      <Shell>
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[color:var(--loss)]" />
          <div>
            <h1 className="text-lg font-semibold">Demande d&apos;autorisation invalide</h1>
            <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
              {resolved.kind === 'fatal'
                ? resolved.message
                : "Paramètres de connexion incorrects. Relancez la connexion depuis l'assistant."}
            </p>
          </div>
        </div>
      </Shell>
    );
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const next = `/oauth/authorize?${new URLSearchParams(params).toString()}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const { client, request } = resolved;
  const redirectHost = new URL(request.redirect_uri).host;
  const subscription = await getUserSubscription(user.id);
  const denyUrl = buildRedirectUrl(request.redirect_uri, {
    error: 'access_denied',
    error_description: "L'utilisateur a refusé l'accès",
    state: request.state,
  });

  if (!subscription.plan.features.includes('api_access')) {
    return (
      <Shell>
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent)] mb-4">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold">Connexion réservée à l&apos;offre Pro</h1>
          <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
            Passez Pro pour connecter <strong className="text-[color:var(--ink)]">{client.client_name}</strong> à votre
            patrimoine, puis relancez la connexion depuis l&apos;assistant.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/settings/billing" className="btn-ink rounded-lg px-4 py-2.5 text-sm">
              Passer Pro
            </Link>
            <a href={denyUrl} className="rounded-lg px-4 py-2.5 text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]">
              Annuler
            </a>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <ConsentForm
        clientName={client.client_name}
        redirectHost={redirectHost}
        email={user.email ?? ''}
        params={params}
      />
    </Shell>
  );
}
