import { withApiAuth } from '@/lib/public-api/http';
import { listPublicTransactions } from '@/lib/public-api/data';
import { searchParamsToObject, transactionsQuerySchema } from '@/lib/public-api/schemas';

export const dynamic = 'force-dynamic';

// GET /api/v1/transactions : historique filtrable, pagination par curseur.
export const GET = withApiAuth(async (request, { userId }) => {
  const query = transactionsQuerySchema.parse(searchParamsToObject(new URL(request.url).searchParams));
  return listPublicTransactions(userId, query);
});
