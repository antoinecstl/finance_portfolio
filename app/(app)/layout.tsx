import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserSubscription } from '@/lib/subscription';
import { SubscriptionProvider } from '@/lib/subscription-client';
import { ToastProvider } from '@/components/Toast';
import { Onboarding } from '@/components/Onboarding';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', user.id)
    .single();

  if (!profile?.onboarded_at) {
    return <Onboarding email={user.email ?? ''} />;
  }

  const sub = await getUserSubscription(user.id);

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
      <ToastProvider>{children}</ToastProvider>
    </SubscriptionProvider>
  );
}
