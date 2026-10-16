import { ImportWizard } from '@/components/ImportWizard';
import { createClient } from '@/lib/supabase/server';
import { getImportAccess } from '@/lib/subscription';
import { Lock } from 'lucide-react';
import { PageContainer } from '@/components/app-shell/PageLayout';
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

  const access = await getImportAccess(user.id);

  if (!access.allowed) {
    return (
      <main className="py-5 text-[color:var(--ink)] sm:py-8">
        <PageContainer>
          <div className="mx-auto max-w-2xl ink-card rounded-2xl pop-shadow p-6 sm:p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent)] mb-4">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="display text-3xl sm:text-4xl leading-none text-[color:var(--ink)]">
              Import offert déjà utilisé
            </h1>
            <p className="mt-3 text-sm text-[color:var(--ink-soft)]">
              Votre premier import est enregistré. Vous pouvez continuer à ajouter vos opérations à la main, ou passer Pro pour importer autant de relevés que vous voulez (CSV, Excel, PDF, captures ou texte collé).
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Link
                href="/dashboard?tab=transactions"
                className="btn-outline inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm"
              >
                Saisir une opération
              </Link>
              <Link
                href="/settings/billing"
                className="btn-ink inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm"
              >
                Voir l’offre Pro
              </Link>
            </div>
          </div>
        </PageContainer>
      </main>
    );
  }

  return <ImportWizard offered={access.offered} />;
}
