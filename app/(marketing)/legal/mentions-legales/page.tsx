export const metadata = { title: 'Mentions légales — Fi-Hub' };

export default function MentionsLegalesPage() {
  return (
    <div className="space-y-4 text-zinc-800 dark:text-zinc-200">
      <h1 className="text-3xl font-bold">Mentions légales</h1>

      <h2 className="text-xl font-semibold mt-8">Éditeur</h2>
      <p>
        Fi-Hub est édité par <strong>[À RENSEIGNER — nom / raison sociale]</strong>
        <br />
        Adresse : [À RENSEIGNER]
        <br />
        SIREN / SIRET : [À RENSEIGNER]
        <br />
        Directeur de la publication : [À RENSEIGNER]
        <br />
        Contact : contact@fi-hub.fr
      </p>

      <h2 className="text-xl font-semibold mt-8">Hébergeur</h2>
      <p>
        Vercel Inc.
        <br />
        440 N Barranca Ave #4133, Covina, CA 91723, USA
        <br />
        vercel.com
      </p>
      <p>
        Base de données : Supabase, Inc. (infrastructure UE via AWS eu-central-1). supabase.com
      </p>

      <h2 className="text-xl font-semibold mt-8">Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble du site, marque, logo et contenus sont la propriété de l&apos;éditeur. Toute
        reproduction non autorisée est interdite.
      </p>
    </div>
  );
}
