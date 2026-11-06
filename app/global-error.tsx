'use client';

// Dernier recours quand la mise en page racine elle-même échoue : page
// autonome (sans les styles de l'app), en français.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f7f2e8', color: '#0e0c0a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <main style={{ maxWidth: 440, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, margin: '0 0 12px' }}>Un problème est survenu</h1>
          <p style={{ color: '#5b524a', margin: '0 0 24px' }}>Fi-Hub n’a pas pu s’afficher. Vos données ne sont pas modifiées.</p>
          <button type="button" onClick={reset} style={{ background: '#0e0c0a', color: '#f7f2e8', border: 0, borderRadius: 8, padding: '10px 18px', fontSize: 15, cursor: 'pointer' }}>
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
