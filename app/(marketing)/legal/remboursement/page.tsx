import type { Metadata } from 'next';
import { PLANS, formatPriceFor } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Politique de remboursement',
  description: 'Conditions de remboursement de Fi-Hub : délais, procédure et exceptions applicables aux abonnements Pro.',
  alternates: { canonical: '/legal/remboursement' },
  robots: { index: false },
};

export default function RefundPage() {
  return (
    <div className="space-y-4 text-zinc-800 dark:text-zinc-200">
      <h1 className="text-3xl font-bold">Politique de remboursement</h1>
      <p className="text-sm text-zinc-500">Dernière mise à jour : 2026-11-13</p>

      <h2 className="text-xl font-semibold mt-8">Vendeur</h2>
      <p>
        Les abonnements Fi-Hub sont vendus par Paddle, vendeur officiel (Merchant of Record), qui encaisse les
        paiements, émet les factures et gère la TVA. Les remboursements sont effectués par Paddle, sur le moyen de
        paiement utilisé.
      </p>

      <h2 className="text-xl font-semibold mt-8">Premier mois gratuit</h2>
      <p>
        L&apos;abonnement Pro mensuel commence par un mois gratuit. Aucun montant n&apos;est prélevé pendant ce
        mois. Si vous résiliez avant sa fin, vous n&apos;êtes pas débité. Sans résiliation, le premier prélèvement
        intervient à la fin du mois gratuit, au tarif {formatPriceFor(PLANS.pro, 'month')}.
      </p>

      <h2 className="text-xl font-semibold mt-8">Abonnement Pro mensuel</h2>
      <p>
        L&apos;abonnement Pro est proposé sans engagement, résiliable à tout moment depuis Paramètres &gt;
        Abonnement. La résiliation prend effet à la fin de la période en cours ; aucun remboursement
        au prorata n&apos;est accordé pour les jours non utilisés.
      </p>

      <h2 className="text-xl font-semibold mt-8">Abonnement Pro annuel</h2>
      <p>
        L&apos;abonnement annuel ({formatPriceFor(PLANS.pro, 'year')}) est prélevé en une fois pour douze mois. Il
        est résiliable à tout moment depuis Paramètres &gt; Abonnement : vous conservez l&apos;accès Pro jusqu&apos;à
        la fin de la période payée, et l&apos;abonnement n&apos;est pas renouvelé. Aucun remboursement au prorata
        n&apos;est accordé pour les mois non utilisés.
      </p>

      <h2 className="text-xl font-semibold mt-8">Suppression du compte</h2>
      <p>
        La suppression de votre compte résilie immédiatement l&apos;abonnement en cours et met fin à l&apos;accès
        Pro, sans remboursement de la période entamée.
      </p>

      <h2 className="text-xl font-semibold mt-8">Droit de rétractation</h2>
      <p>
        Conformément à l&apos;article L221-28 du Code de la consommation, le droit de rétractation de
        14 jours ne s&apos;applique pas aux contenus numériques dont l&apos;exécution a commencé avec
        l&apos;accord exprès du consommateur, qui a renoncé à son droit de rétractation lors de la
        souscription.
      </p>
      <p>
        En souscrivant à l&apos;abonnement Pro, vous acceptez que le Service démarre immédiatement et
        reconnaissez renoncer à votre droit de rétractation.
      </p>

      <h2 className="text-xl font-semibold mt-8">Erreur de facturation</h2>
      <p>
        En cas d&apos;erreur de facturation avérée (double prélèvement, montant incorrect), contactez-nous
        à <a href="mailto:contact@subleet.com" className="underline">contact@subleet.com</a> dans un
        délai de 30 jours. Nous procéderons au remboursement dans les meilleurs délais via Paddle.
      </p>

      <h2 className="text-xl font-semibold mt-8">Contact</h2>
      <p>
        Pour toute question relative à votre abonnement ou à une facturation :{' '}
        <a href="mailto:contact@subleet.com" className="underline">contact@subleet.com</a>
      </p>
    </div>
  );
}
