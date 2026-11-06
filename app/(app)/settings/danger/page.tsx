import Link from 'next/link';
import { DangerZone } from './DangerZone';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Supprimer mon compte' };

export default function DangerPage() {
  return (
    <div>
      <header className="mb-6 pb-6 border-b border-[color:var(--rule)]">
        <h2 className="display text-3xl leading-none text-[color:var(--ink)]">Zone danger</h2>
        <p className="text-sm text-[color:var(--ink-soft)] mt-2">
          Suppression définitive de votre compte. Pour garder une copie de vos données, passez d’abord par{' '}
          <Link href="/settings/exports" className="underline underline-offset-4">Exports et rapports</Link>.
        </p>
      </header>
      <DangerZone />
    </div>
  );
}
