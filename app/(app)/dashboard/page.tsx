import { Suspense } from 'react';
import { Dashboard } from '@/components';

export default function DashboardPage() {
  // Dashboard lit l'onglet actif depuis useSearchParams.
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
