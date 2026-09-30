const STEPS = [
  {
    title: 'Déposez un relevé',
    body: 'CSV, Excel, PDF, capture d’écran ou texte collé, de n’importe quel courtier. Les exports Boursorama et Trade Republic sont reconnus directement.',
  },
  {
    title: 'Vérifiez les lignes proposées',
    body: 'Fi-Hub lit le relevé et propose des transactions : type, date, titre, quantité, prix. Il signale les doublons, les tickers à confirmer et les soldes de liquidités qui deviendraient négatifs.',
  },
  {
    title: 'Validez',
    body: 'Rien n’est enregistré avant votre validation. Chaque ligne reste modifiable ou supprimable jusque-là.',
  },
];

// The import flow, described as it works (parse → review → commit).
export function ImportSteps({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <ol className="border-t border-[color:var(--text)]">
      {STEPS.map((step, i) => (
        <li
          key={step.title}
          className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-[color:var(--border)] py-6"
        >
          <span className="mono text-sm text-[color:var(--text-muted)]" aria-hidden="true">
            {String(i + 1).padStart(2, '0')}
          </span>
          <div>
            <Heading className="text-xl font-semibold leading-[1.3] tracking-[-0.01em] text-[color:var(--text)]">
              {step.title}
            </Heading>
            <p className="mt-2 max-w-[62ch] text-base leading-relaxed text-[color:var(--text-2)]">
              {step.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
