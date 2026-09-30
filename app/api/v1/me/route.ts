import { withApiAuth } from '@/lib/public-api/http';
import { getPublicProfile } from '@/lib/public-api/data';

export const dynamic = 'force-dynamic';

// GET /api/v1/me : identité du propriétaire du jeton.
export const GET = withApiAuth(async (_request, { token, scopes }) => ({
  ...(await getPublicProfile(token)),
  token_scopes: scopes,
}));
