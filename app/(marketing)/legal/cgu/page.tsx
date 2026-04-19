export const metadata = { title: 'CGU — Fi-Hub' };

export default function CGUPage() {
  return (
    <div className="space-y-4 text-zinc-800 dark:text-zinc-200">
      <h1 className="text-3xl font-bold">Conditions Générales d&apos;Utilisation</h1>
      <p className="text-sm text-zinc-500">Dernière mise à jour : 2026-04-18</p>

      <h2 className="text-xl font-semibold mt-8">1. Objet</h2>
      <p>
        Les présentes CGU régissent l&apos;utilisation du service Fi-Hub (ci-après « le Service »),
        application de suivi de patrimoine personnel accessible à l&apos;adresse fi-hub.fr.
      </p>

      <h2 className="text-xl font-semibold mt-8">2. Acceptation</h2>
      <p>
        En créant un compte, l&apos;utilisateur accepte sans réserve les présentes CGU ainsi que la
        Politique de confidentialité.
      </p>

      <h2 className="text-xl font-semibold mt-8">3. Description du service</h2>
      <p>
        Fi-Hub permet à l&apos;utilisateur de saisir manuellement ses comptes financiers, transactions et
        positions boursières, et d&apos;en visualiser la valorisation à partir de cours fournis par des
        tiers (Yahoo Finance). Le Service ne constitue en aucun cas un conseil en investissement.
      </p>

      <h2 className="text-xl font-semibold mt-8">4. Compte utilisateur</h2>
      <p>
        L&apos;utilisateur est responsable de la confidentialité de ses identifiants. Toute activité
        réalisée depuis son compte est réputée réalisée par lui.
      </p>

      <h2 className="text-xl font-semibold mt-8">5. Abonnement Pro</h2>
      <p>
        Un abonnement payant « Pro » est proposé via Lemon Squeezy. Il est reconductible
        mensuellement jusqu&apos;à résiliation par l&apos;utilisateur depuis son espace Paramètres. Les
        montants sont prélevés TTC.
      </p>

      <h2 className="text-xl font-semibold mt-8">6. Résiliation</h2>
      <p>
        L&apos;utilisateur peut supprimer son compte à tout moment depuis Paramètres &gt; Zone danger.
        Toutes ses données sont alors effacées de nos serveurs.
      </p>

      <h2 className="text-xl font-semibold mt-8">7. Limitation de responsabilité</h2>
      <p>
        Le Service est fourni « en l&apos;état ». Les données affichées (cours, valorisations) peuvent
        présenter des écarts avec la réalité. Fi-Hub ne saurait être tenu responsable d&apos;une décision
        d&apos;investissement prise sur la base des informations affichées.
      </p>

      <h2 className="text-xl font-semibold mt-8">8. Droit applicable</h2>
      <p>Les présentes CGU sont soumises au droit français.</p>
    </div>
  );
}
