import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { PLANS, type Plan, type PlanId, type Feature } from '@/lib/plans';

type UserSubscriptionContext = {
  plan: Plan;
  planId: PlanId;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isFounder: boolean;
};

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

export async function getUserSubscription(userId: string): Promise<UserSubscriptionContext> {
  const admin = await createAdminClient();

  const [{ data: sub }, { data: profile }] = await Promise.all([
    admin
      .from('subscriptions')
      .select('plan_id, status, current_period_end, cancel_at_period_end')
      .eq('user_id', userId)
      .maybeSingle(),
    admin.from('profiles').select('is_founder').eq('id', userId).maybeSingle(),
  ]);

  const isFounder = Boolean(profile?.is_founder);

  const rawPlanId = (sub?.plan_id ?? 'free') as PlanId;
  const status = sub?.status ?? 'active';
  const effectivePlanId: PlanId =
    isFounder || (rawPlanId === 'pro' && ACTIVE_STATUSES.has(status)) ? 'pro' : 'free';

  return {
    plan: PLANS[effectivePlanId],
    planId: effectivePlanId,
    status,
    currentPeriodEnd: sub?.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(sub?.cancel_at_period_end),
    isFounder,
  };
}

export async function isPro(userId: string): Promise<boolean> {
  const ctx = await getUserSubscription(userId);
  return ctx.planId === 'pro';
}

export async function hasUserFeature(userId: string, feature: Feature): Promise<boolean> {
  const ctx = await getUserSubscription(userId);
  return ctx.plan.features.includes(feature);
}

export async function getLimits(userId: string) {
  const ctx = await getUserSubscription(userId);
  return {
    maxAccounts: ctx.plan.maxAccounts,
    maxTransactions: ctx.plan.maxTransactions,
    maxPositions: ctx.plan.maxPositions,
    planId: ctx.planId,
  };
}
