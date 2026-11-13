import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Découvrez comment Fi-Hub collecte, utilise et protège vos données personnelles conformément au RGPD.',
  alternates: { canonical: '/legal/confidentialite' },
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <div className="space-y-4 text-zinc-800 dark:text-zinc-200">
      <h1 className="text-3xl font-bold">Politique de confidentialité</h1>
      <p className="text-sm text-zinc-500">Dernière mise à jour : 2026-11-13</p>

      <h2 className="text-xl font-semibold mt-8">1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement est l&apos;éditeur de Fi-Hub (voir{' '}
        <Link href="/legal/mentions-legales">Mentions légales</Link>). Contact :{' '}
        <a href="mailto:contact@subleet.com">contact@subleet.com</a>.
      </p>

      <h2 className="text-xl font-semibold mt-8">2. Données collectées</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Adresse email (obligatoire, pour l&apos;authentification) et mot de passe, stocké haché, jamais en clair.</li>
        <li>Nom (optionnel) et choix de recevoir ou non nos emails d&apos;information.</li>
        <li>
          Données patrimoniales que vous saisissez ou importez : comptes, transactions, positions, titres suivis en
          favoris.
        </li>
        <li>
          Si vous utilisez l&apos;import de relevés : le fichier, la capture ou le texte que vous transmettez, le temps
          de son analyse, puis un extrait limité de son contenu conservé avec l&apos;historique de vos imports.
        </li>
        <li>
          Si vous connectez un assistant (ChatGPT, Claude) ou créez un jeton d&apos;accès : le nom de l&apos;application,
          les dates de création et de dernière utilisation. Seule une empreinte du jeton est conservée.
        </li>
        <li>Journal des modifications de vos comptes et transactions, pour l&apos;intégrité de vos données.</li>
        <li>Données de facturation en cas d&apos;abonnement Pro, gérées par Paddle (vendeur officiel).</li>
        <li>
          Données techniques : adresse IP et journaux de requêtes traités par l&apos;hébergeur, mesure d&apos;audience
          et de performance sans cookie.
        </li>
      </ul>
      <p>Fi-Hub ne se connecte pas à vos banques ou courtiers et ne collecte aucun identifiant bancaire.</p>

      <h2 className="text-xl font-semibold mt-8">3. Finalités</h2>
      <p>
        Les données sont utilisées pour fournir le Service (suivi et calculs de votre patrimoine, import de relevés,
        accès par API), gérer la facturation, assurer la sécurité du Service, mesurer son audience et communiquer
        avec vous au sujet de votre compte. Vos données ne sont ni vendues ni utilisées à des fins publicitaires.
      </p>

      <h2 className="text-xl font-semibold mt-8">4. Base légale</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Exécution du contrat (CGU) : compte, suivi du patrimoine, import, abonnement.</li>
        <li>Intérêt légitime : sécurité du Service, prévention des abus, mesure d&apos;audience sans cookie.</li>
        <li>Consentement : emails d&apos;information, que vous pouvez désactiver à tout moment dans Paramètres.</li>
        <li>Obligation légale : conservation des factures.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8">5. Destinataires et sous-traitants</h2>
      <p>Vos données sont traitées par les prestataires suivants, pour les seuls besoins du Service :</p>
      <ul className="list-disc pl-6 space-y-1">
        <li>
          <strong>Supabase</strong> : base de données et authentification, hébergées dans l&apos;Union européenne
          (Paris).
        </li>
        <li>
          <strong>Vercel</strong> : hébergement de l&apos;application, mesure d&apos;audience et de performance
          (Vercel Analytics, Speed Insights), sans cookie.
        </li>
        <li>
          <strong>Paddle</strong> : paiement, facturation et TVA, en qualité de vendeur officiel (Merchant of Record).
        </li>
        <li>
          <strong>Resend</strong> : envoi des emails liés à votre compte.
        </li>
        <li>
          <strong>Mistral AI</strong> : lecture des relevés PDF et des images que vous importez.
        </li>
        <li>
          <strong>OpenAI</strong> : lecture des tableaux non reconnus et du texte collé lors d&apos;un import, et
          lecture de secours des PDF et images.
        </li>
        <li>
          Un outil de messagerie interne : alerte envoyée à l&apos;éditeur à chaque nouvelle inscription (adresse
          email et date d&apos;inscription).
        </li>
      </ul>
      <p>
        <strong>Import de relevés.</strong> Le document que vous importez est transmis à Mistral AI ou à OpenAI pour
        en extraire les opérations. Fi-Hub n&apos;y joint ni votre adresse email ni votre identifiant de compte, mais
        le document peut lui-même contenir des informations personnelles (nom, numéro de compte). Vous pouvez les
        masquer avant l&apos;import, ou saisir vos opérations à la main : l&apos;import est facultatif.
      </p>
      <p>
        <strong>Assistants connectés.</strong> Si vous reliez Fi-Hub à ChatGPT, à Claude ou à un autre outil, les
        données de votre portefeuille lui sont transmises en lecture seule, à votre demande. Leur traitement relève
        alors des conditions de cet outil. Vous pouvez révoquer l&apos;accès à tout moment dans Paramètres.
      </p>
      <p>
        Les cours et données de marché sont obtenus auprès de fournisseurs de données financières : seuls des codes
        de titres leur sont transmis, jamais d&apos;information sur vous.
      </p>

      <h2 className="text-xl font-semibold mt-8">6. Transferts hors de l&apos;Union européenne</h2>
      <p>
        Vos données patrimoniales sont stockées dans l&apos;Union européenne. Certains prestataires (Vercel, Paddle,
        Resend, OpenAI) sont établis aux États-Unis ou au Royaume-Uni : les transferts correspondants sont encadrés
        par les garanties prévues par le RGPD (décision d&apos;adéquation ou clauses contractuelles types).
      </p>

      <h2 className="text-xl font-semibold mt-8">7. Durée de conservation</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Les données de votre compte sont conservées tant qu&apos;il est actif.</li>
        <li>
          Les fichiers importés ne sont pas stockés par Fi-Hub. L&apos;historique des imports (nom du fichier, statut,
          extrait limité du contenu) est conservé tant que le compte est actif.
        </li>
        <li>
          À la suppression du compte, l&apos;ensemble de ces données est effacé sans délai et l&apos;abonnement en
          cours est résilié.
        </li>
        <li>Les factures sont conservées 10 ans, conformément aux obligations légales.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8">8. Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
        limitation, de portabilité et d&apos;opposition. Depuis Paramètres, vous pouvez exporter vos données, modifier
        votre profil et supprimer votre compte. Pour toute autre demande, écrivez à{' '}
        <a href="mailto:contact@subleet.com">contact@subleet.com</a>. Vous pouvez également introduire une
        réclamation auprès de la CNIL (www.cnil.fr).
      </p>

      <h2 className="text-xl font-semibold mt-8">9. Cookies</h2>
      <p>
        Fi-Hub n&apos;utilise que des cookies strictement nécessaires à la connexion. Aucun cookie publicitaire ni
        traceur tiers. Détail dans la <Link href="/legal/cookies">politique cookies</Link>.
      </p>

      <h2 className="text-xl font-semibold mt-8">10. Sécurité</h2>
      <p>
        Mots de passe stockés hachés, transport HTTPS, isolation stricte des données par utilisateur au niveau de la
        base, jetons d&apos;accès conservés sous forme d&apos;empreinte uniquement.
      </p>

      <h2 className="text-xl font-semibold mt-8">11. Évolution de cette politique</h2>
      <p>
        Cette politique est mise à jour lorsque le Service ou ses prestataires évoluent. La date de dernière mise à
        jour figure en haut de la page.
      </p>
    </div>
  );
}
