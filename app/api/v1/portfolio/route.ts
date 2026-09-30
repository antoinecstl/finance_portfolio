import { withApiAuth } from '@/lib/public-api/http';
import { getPublicPortfolio } from '@/lib/public-api/data';

export const dynamic = 'force-dynamic';

// GET /api/v1/portfolio : synthèse complète (totaux, comptes, positions).
export const GET = withApiAuth(async (_request, { userId }) => getPublicPortfolio(userId));
