export const metadata = { title: 'Politique de confidentialité — Fi-Hub' };

export default function PrivacyPage() {
  return (
    <div className="space-y-4 text-zinc-800 dark:text-zinc-200">
      <h1 className="text-3xl font-bold">Politique de confidentialité</h1>
      <p className="text-sm text-zinc-500">Dernière mise à jour : 2026-04-18</p>

      <h2 className="text-xl font-semibold mt-8">1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement est l&apos;éditeur de Fi-Hub (voir Mentions légales). Contact :
        contact@fi-hub.fr.
      </p>

      <h2 className="text-xl font-semibold mt-8">2. Données collectées</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Adresse email (obligatoire, pour authentification)</li>
        <li>Mot de passe (chiffré, jamais stocké en clair)</li>
        <li>Nom, URL d&apos;avatar (optionnels)</li>
        <li>Données patrimoniales saisies : comptes, transactions, positions</li>
        <li>Données de facturation en cas d&apos;abonnement Pro, gérées par Lemon Squeezy</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8">3. Finalités</h2>
      <p>
        Les données sont utilisées exclusivement pour fournir le Service, gérer la facturation et
        communiquer avec l&apos;utilisateur au sujet de son compte.
      </p>

      <h2 className="text-xl font-semibold mt-8">4. Base légale</h2>
      <p>
        Exécution du contrat (CGU), intérêt légitime (sécurité du Service), consentement (emails
        marketing opt-in).
      </p>

      <h2 className="text-xl font-semibold mt-8">5. Destinataires</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Supabase (hébergement base de données, infrastructure UE)</li>
        <li>Lemon Squeezy (paiement, Merchant of Record)</li>
        <li>Resend (envoi d&apos;emails transactionnels)</li>
        <li>Vercel (hébergement de l&apos;application)</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8">6. Durée de conservation</h2>
      <p>
        Les données sont conservées tant que le compte est actif. En cas de suppression de compte,
        elles sont effacées sans délai. Les factures sont conservées 10 ans conformément aux
        obligations légales.
      </p>

      <h2 className="text-xl font-semibold mt-8">7. Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
        portabilité et d&apos;opposition. Vous pouvez exercer ces droits depuis votre espace Paramètres
        ou en écrivant à contact@fi-hub.fr. Vous pouvez également introduire une réclamation auprès
        de la CNIL (www.cnil.fr).
      </p>

      <h2 className="text-xl font-semibold mt-8">8. Sécurité</h2>
      <p>
        Mots de passe stockés chiffrés, transport HTTPS, Row Level Security activée sur toutes les
        tables, isolation stricte par utilisateur.
      </p>
    </div>
  );
}
