export const metadata = { title: 'Politique cookies — Fi-Hub' };

export default function CookiesPage() {
  return (
    <div className="space-y-4 text-zinc-800 dark:text-zinc-200">
      <h1 className="text-3xl font-bold">Politique cookies</h1>
      <p className="text-sm text-zinc-500">Dernière mise à jour : 2026-04-18</p>

      <h2 className="text-xl font-semibold mt-8">Cookies utilisés</h2>
      <p>
        Fi-Hub n&apos;utilise que des cookies strictement nécessaires au fonctionnement du Service. Aucun
        cookie publicitaire, aucun tracker tiers.
      </p>

      <h2 className="text-xl font-semibold mt-8">Liste</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>
          <strong>sb-access-token / sb-refresh-token</strong> — cookies d&apos;authentification Supabase.
          Durée : 1 semaine. Indispensables.
        </li>
        <li>
          <strong>fihub_cookie_dismissed</strong> — stockage local, mémorise que vous avez fermé la
          bannière.
        </li>
      </ul>

      <h2 className="text-xl font-semibold mt-8">Consentement</h2>
      <p>
        Comme nous n&apos;utilisons que des cookies techniques strictement nécessaires, aucun
        consentement préalable n&apos;est requis (article 82 Loi Informatique et Libertés). La bannière
        affichée est purement informative.
      </p>
    </div>
  );
}
