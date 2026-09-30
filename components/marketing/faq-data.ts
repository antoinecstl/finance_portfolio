import { BENCHMARK_LABELS } from '@/lib/benchmarks';
import { MONTHLY_TRIAL_LABEL, PLANS } from '@/lib/plans';

const { maxAccounts, maxTransactions, maxPositions } = PLANS.free;

export const FAQ_ITEMS = [
  {
    q: 'L’import de relevés est-il gratuit ?',
    a: `Non. L’import (CSV, Excel, PDF, capture d’écran ou texte collé) fait partie de l’offre Pro, avec le ${MONTHLY_TRIAL_LABEL.toLowerCase()} en mensuel. Avec le plan Free, vous saisissez vos transactions vous-même.`,
  },
  {
    q: 'Est-ce que Fi-Hub se connecte à ma banque ?',
    a: 'Non. Fi-Hub ne se connecte à aucune banque ni à aucun courtier. Vous saisissez vos opérations, ou vous importez un relevé avec l’offre Pro. Chaque ligne importée est vérifiée par vous avant d’être enregistrée.',
  },
  {
    q: 'À quels indices puis-je comparer mon portefeuille ?',
    a: `À ${BENCHMARK_LABELS.length} indices : ${BENCHMARK_LABELS.join(', ')}. La comparaison porte sur la performance hors apports, sur la même période.`,
  },
  {
    q: 'Les cours sont-ils en temps réel ?',
    a: 'Les cours sont récupérés automatiquement auprès d’un fournisseur de données de marché et gardés en cache une minute. Selon la place de cotation, ils peuvent être différés. Actions et ETF français, européens et américains sont couverts.',
  },
  {
    q: 'Que se passe-t-il si je dépasse les limites du plan Free ?',
    a: `Vous gardez l’accès à tout ce que vous avez saisi. Au-delà de ${maxAccounts} comptes, ${maxTransactions} transactions ou ${maxPositions} positions, l’ajout est bloqué jusqu’au passage à l’offre Pro.`,
  },
  {
    q: 'Mes données sont-elles en sécurité ?',
    a: 'Chaque utilisateur n’a accès qu’à ses propres données : cette séparation est appliquée par la base de données elle-même, à chaque requête. Fi-Hub n’affiche pas de publicité et n’utilise pas de traceur publicitaire. Si vous utilisez l’import, le relevé est envoyé à des prestataires d’analyse de documents pour en extraire les transactions. La politique de confidentialité détaille les données traitées et vos droits.',
  },
  {
    q: 'Puis-je annuler mon abonnement Pro à tout moment ?',
    a: 'Oui, depuis Paramètres → Abonnement. L’accès Pro reste actif jusqu’à la fin de la période en cours.',
  },
  {
    q: 'Puis-je récupérer toutes mes données ?',
    a: 'Oui. Depuis Paramètres → Zone danger, vous téléchargez un export JSON (profil, comptes et transactions, à partir desquels les positions se recalculent) ou un relevé PDF. Vous pouvez aussi y supprimer votre compte.',
  },
] as const;
