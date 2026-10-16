'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { PLANS, type Feature, type ImportAccess, type Plan, type PlanId } from '@/lib/plans';

export type SubscriptionSnapshot = {
  planId: PlanId;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isFounder: boolean;
  /** Import de relevés : illimité en Pro, premier lot offert en Free. */
  importAccess: ImportAccess;
};

type SubscriptionContextValue = SubscriptionSnapshot & {
  plan: Plan;
  isPro: boolean;
  isFree: boolean;
  hasFeature: (feature: Feature) => boolean;
  /** À appeler après la validation de l'import offert : boutons et menus se ferment sans recharger. */
  consumeOfferedImport: () => void;
  limits: {
    maxAccounts: number;
    maxTransactions: number;
    maxPositions: number;
  };
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({
  initial,
  children,
}: {
  initial: SubscriptionSnapshot;
  children: ReactNode;
}) {
  const [offeredImportUsed, setOfferedImportUsed] = useState(false);
  const value = useMemo<SubscriptionContextValue>(() => {
    const plan = PLANS[initial.planId];
    return {
      ...initial,
      importAccess: offeredImportUsed && initial.importAccess.offered ? { allowed: false, offered: false } : initial.importAccess,
      consumeOfferedImport: () => setOfferedImportUsed(true),
      plan,
      isPro: initial.planId === 'pro',
      isFree: initial.planId === 'free',
      hasFeature: (feature: Feature) => plan.features.includes(feature),
      limits: {
        maxAccounts: plan.maxAccounts,
        maxTransactions: plan.maxTransactions,
        maxPositions: plan.maxPositions,
      },
    };
  }, [initial, offeredImportUsed]);

  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
}
