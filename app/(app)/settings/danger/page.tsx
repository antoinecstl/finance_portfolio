import { DangerZone } from './DangerZone';

export default function DangerPage() {
  return (
    <div>
      <header className="mb-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Zone danger</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Export et suppression de vos données personnelles.
        </p>
      </header>
      <DangerZone />
    </div>
  );
}
