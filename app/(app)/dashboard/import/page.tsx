import { ImportWizard } from '@/components/ImportWizard';
import { createClient } from '@/lib/supabase/server';
import { getUserSubscription } from '@/lib/subscription';
import { ArrowLeft, Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Importer des transactions',
};

export default async function ImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const subscription = await getUserSubscription(user.id);
  const hasImportAccess = subscription.plan.features.includes('import_transactions');

  if (!hasImportAccess) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[color:var(--paper)] text-[color:var(--ink)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-[color:var(--ink-soft)] hover:text-[color:var(--accent)] mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au tableau de bord
          </Link>

          <div className="ink-card rounded-2xl pop-shadow p-6 sm:p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent)] mb-4">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="display text-3xl sm:text-4xl leading-none text-[color:var(--ink)]">
              Import reserve aux utilisateurs Pro
            </h1>
            <p className="mt-3 text-sm text-[color:var(--ink-soft)]">
              Passez Pro pour importer des historiques CSV, Excel, PDF ou texte, puis valider les transactions avant insertion.
            </p>
            <Link
              href="/settings/billing"
              className="btn-ink mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm"
            >
              <Sparkles className="h-4 w-4" />
              Passer Pro
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <ImportWizard />;
}
