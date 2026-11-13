import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Mentions légales de Fi-Hub : éditeur, hébergeur, propriété intellectuelle et responsabilités.',
  alternates: { canonical: '/legal/mentions-legales' },
  robots: { index: false },
};

export default function MentionsLegalesPage() {
  return (
    <div className="space-y-4 text-zinc-800 dark:text-zinc-200">
      <h1 className="text-3xl font-bold">Mentions légales</h1>

      <h2 className="text-xl font-semibold mt-8">Éditeur</h2>
      <p>
        Fi-Hub est édité par <strong>SUBLEET</strong>, société par actions simplifiée (SAS) au capital de
        1 000 €
        <br />
        Immatriculée au RCS de Paris sous le numéro 105 008 031
        <br />
        Siège social : 173 rue de Courcelles, 75017 Paris, France
        <br />
        Directeur de la publication : le représentant légal de SUBLEET
        <br />
        Contact : <a href="mailto:contact@subleet.com">contact@subleet.com</a>
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
        Base de données : Supabase, Inc. (infrastructure UE via AWS eu-west-3, Paris). supabase.com
      </p>

      <h2 className="text-xl font-semibold mt-8">Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble du site, marque, logo et contenus sont la propriété de l&apos;éditeur. Toute
        reproduction non autorisée est interdite.
      </p>
    </div>
  );
}
