import { withApiAuth } from '@/lib/public-api/http';
import { getPublicPortfolio } from '@/lib/public-api/data';
import { positionsQuerySchema, searchParamsToObject } from '@/lib/public-api/schemas';

export const dynamic = 'force-dynamic';

// GET /api/v1/positions?account_id= : positions ouvertes valorisées.
export const GET = withApiAuth(async (request, { userId }) => {
  const query = positionsQuerySchema.parse(searchParamsToObject(new URL(request.url).searchParams));
  const portfolio = await getPublicPortfolio(userId);
  const items = query.account_id
    ? portfolio.positions.filter((position) => position.account_id === query.account_id)
    : portfolio.positions;
  return { base_currency: portfolio.base_currency, as_of: portfolio.as_of, items };
});
