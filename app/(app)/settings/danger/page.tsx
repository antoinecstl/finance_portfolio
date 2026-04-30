import { DangerZone } from './DangerZone';

export default function DangerPage() {
  return (
    <div>
      <header className="mb-6 pb-6 border-b border-[color:var(--rule)]">
        <h2 className="display text-3xl leading-none text-[color:var(--ink)]">Zone danger</h2>
        <p className="text-sm text-[color:var(--ink-soft)] mt-2">
          Export et suppression de vos données personnelles.
        </p>
      </header>
      <DangerZone />
    </div>
  );
}
