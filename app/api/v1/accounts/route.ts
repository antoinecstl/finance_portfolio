import { withApiAuth } from '@/lib/public-api/http';
import { getPublicPortfolio } from '@/lib/public-api/data';

export const dynamic = 'force-dynamic';

// GET /api/v1/accounts : comptes valorisés.
export const GET = withApiAuth(async (_request, { userId }) => {
  const portfolio = await getPublicPortfolio(userId);
  return { base_currency: portfolio.base_currency, as_of: portfolio.as_of, items: portfolio.accounts };
});
