import type { Metadata } from 'next';
import { ExportsPanel } from './ExportsPanel';

export const metadata: Metadata = { title: 'Exports et rapports' };

export default function ExportsPage() {
  return (
    <div>
      <header className="mb-6 pb-6 border-b border-[color:var(--rule)]">
        <h2 className="display text-3xl leading-none text-[color:var(--ink)]">Exports et rapports</h2>
        <p className="text-sm text-[color:var(--ink-soft)] mt-2">
          Téléchargez vos données ou un rapport de votre patrimoine.
        </p>
      </header>
      <ExportsPanel />
    </div>
  );
}
