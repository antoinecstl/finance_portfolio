import { PricingCard } from '@/components/marketing/PricingCard';
import { PLANS } from '@/lib/plans';

export const metadata = {
  title: 'Tarifs — Fi-Hub',
  description: 'Plan Free gratuit et plan Pro pour un suivi illimité de votre patrimoine.',
};

export default function PricingPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-center text-zinc-900 dark:text-zinc-100 mb-4">
        Tarifs
      </h1>
      <p className="text-center text-zinc-600 dark:text-zinc-400 mb-12">
        Gratuit pour tester. Pro pour un suivi illimité.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <PricingCard plan={PLANS.free} />
        <PricingCard plan={PLANS.pro} highlight />
      </div>
      <p className="mt-12 text-center text-sm text-zinc-500">
        Paiement sécurisé via Lemon Squeezy (TVA incluse pour l&apos;UE). Annulation possible à tout moment.
      </p>
    </div>
  );
}
