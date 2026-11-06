import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Dashboard } from '@/components';
import { DASHBOARD_TABS, parseDashboardTab } from '@/components/app-shell/navigation';

type Props = { searchParams: Promise<{ tab?: string | string[] }> };

// Titre de l'onglet du navigateur selon la section ouverte (« Positions · Fi-Hub »).
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { tab } = await searchParams;
  const id = parseDashboardTab(Array.isArray(tab) ? tab[0] ?? null : tab ?? null);
  return { title: DASHBOARD_TABS.find((t) => t.id === id)?.title ?? 'Vue d’ensemble' };
}

export default function DashboardPage() {
  // Dashboard lit l'onglet actif depuis useSearchParams.
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
