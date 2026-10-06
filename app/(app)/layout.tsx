import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserSubscription } from '@/lib/subscription';
import { SubscriptionProvider } from '@/lib/subscription-client';
import { ToastProvider } from '@/components/Toast';
import { LimitReachedProvider } from '@/components/LimitReachedModal';
import { Onboarding } from '@/components/Onboarding';
import { AppShell } from '@/components/app-shell/AppShell';
import { isAdminEmail } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('onboarded_at, terms_accepted_at, full_name, marketing_opt_in')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[app/layout] profile fetch failed', profileError);
  }

  const sub = await getUserSubscription(user.id);

  // Tunnel d'onboarding tant qu'il n'est pas terminé. Il reprend à la bonne
  // étape selon ce que l'utilisateur a déjà créé (profil, compte, opération).
  if (!profile?.onboarded_at) {
    const [{ data: accounts }, { count: transactionCount }] = await Promise.all([
      supabase
        .from('accounts')
        .select('id, name, type, currency, supports_positions')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);
    return (
      <Onboarding
        email={user.email ?? ''}
        initialProfile={{
          fullName: profile?.full_name ?? '',
          marketingOptIn: Boolean(profile?.marketing_opt_in),
          saved: Boolean(profile?.terms_accepted_at),
        }}
        initialAccounts={accounts ?? []}
        initialTransactionCount={transactionCount ?? 0}
        hasImportAccess={sub.plan.features.includes('import_transactions')}
      />
    );
  }

  return (
    <SubscriptionProvider
      initial={{
        planId: sub.planId,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        isFounder: sub.isFounder,
      }}
    >
      <ToastProvider>
        <LimitReachedProvider>
          <AppShell email={user.email ?? ''} isAdmin={isAdminEmail(user.email)}>
            {children}
          </AppShell>
        </LimitReachedProvider>
      </ToastProvider>
    </SubscriptionProvider>
  );
}
