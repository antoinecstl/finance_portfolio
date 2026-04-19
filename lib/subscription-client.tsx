'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { PLANS, type Feature, type Plan, type PlanId } from '@/lib/plans';

export type SubscriptionSnapshot = {
  planId: PlanId;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isFounder: boolean;
};

type SubscriptionContextValue = SubscriptionSnapshot & {
  plan: Plan;
  isPro: boolean;
  isFree: boolean;
  hasFeature: (feature: Feature) => boolean;
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
  const value = useMemo<SubscriptionContextValue>(() => {
    const plan = PLANS[initial.planId];
    return {
      ...initial,
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
  }, [initial]);

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
