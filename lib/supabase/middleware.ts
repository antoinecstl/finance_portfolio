import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const AUTH_ROUTES = ['/login', '/signup', '/forgot-password'];
const PROTECTED_PREFIXES = ['/dashboard', '/settings'];
const POST_LOGIN_REDIRECT = '/dashboard';

export async function updateSession(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Intercept Supabase auth tokens that landed on the wrong route (email
  // templates often have `redirect_to=<site>/dashboard` baked in). Any URL
  // carrying `?code=` (PKCE) or `?token_hash=&type=` (OTP) is rerouted to
  // /auth/callback so the code can be exchanged for a session.
  // /auth/confirm intentionally holds the token without consuming it (the
  // user clicks a button that POSTs to /auth/callback) — never reroute it.
  if (pathname !== '/auth/callback' && pathname !== '/auth/confirm') {
    const code = searchParams.get('code');
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type');
    if (code || (tokenHash && type)) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/callback';
      // Recovery and invite flows must land on the password-set page; other
      // flows keep whatever `next` was already set, falling back to the
      // originally requested path.
      if (type === 'recovery' || type === 'invite') {
        url.searchParams.set('next', '/reset-password');
      } else if (!url.searchParams.has('next')) {
        url.searchParams.set('next', pathname === '/' ? '/dashboard' : pathname);
      }
      return NextResponse.redirect(url);
    }
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = POST_LOGIN_REDIRECT;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
