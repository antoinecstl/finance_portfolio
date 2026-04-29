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
      <div className="min-h-[calc(100vh-4rem)] bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au tableau de bord
          </Link>

          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white mb-4">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              Import reserve aux utilisateurs Pro
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Passez Pro pour importer des historiques CSV, Excel, PDF ou texte, puis valider les transactions avant insertion.
            </p>
            <Link
              href="/settings/billing"
              className="mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
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
