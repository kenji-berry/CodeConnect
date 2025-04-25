import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  await supabase.auth.getSession();

  const { data: { session } } = await supabase.auth.getSession();

  const publicPaths = [
    '/',
    '/login',
    '/about',
    '/onboarding',
    '/auth-required',
    '/auth/callback',
    '/api/auth',
    '/settings',
    '/trending',
    '/popular',
    '/newest',
    '/beginner',
    '/projects'
  ];

  const path = req.nextUrl.pathname;

  const isPublicPath = publicPaths.some(publicPath =>
    path === publicPath || (publicPath !== '/' && path.startsWith(publicPath))
  );

  if (!session && !isPublicPath) {
    const returnUrl = new URL('/auth-required', req.url);
    returnUrl.searchParams.set('returnTo', path);
    console.log(`[Middleware] No session, redirecting to: ${returnUrl.toString()}`);
    return NextResponse.redirect(returnUrl);
  }

  if (session) {
    console.log('\n==================================');
    console.log('🔑 [Middleware] Session found for user:', session.user.id);

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_changed, display_name, onboarding_step')
      .eq('user_id', session.user.id)
      .single();

    console.log('👤 [Middleware] Profile data:', JSON.stringify(profile, null, 2));
    if (error) {
      console.error('❌ [Middleware] Profile query error:', error.message);
    }
    const needsOnboarding = !profile || (profile && profile.onboarding_step < 6);
    const currentOnboardingStep = profile?.onboarding_step ?? 1;

    console.log(`🚀 [Middleware] Needs onboarding? ${needsOnboarding} (Current Step: ${currentOnboardingStep})`);
    console.log(`🌐 [Middleware] Current path: ${path}`);

    if (needsOnboarding && !path.startsWith('/onboarding')) {
      const onboardingUrl = new URL('/onboarding', req.url);
      onboardingUrl.searchParams.set('step', currentOnboardingStep.toString());
      console.log(`🔄 [Middleware] Redirecting to onboarding: ${onboardingUrl.toString()}`);
      console.log('==================================\n');
      return NextResponse.redirect(onboardingUrl);
    }

    if (profile && profile.onboarding_step >= 6 && path.startsWith('/onboarding')) {
      console.log(`✅ [Middleware] Onboarding complete, redirecting from /onboarding to /`);
      console.log('==================================\n');
      return NextResponse.redirect(new URL('/', req.url));
    }

    console.log('✅ [Middleware] Access granted.');
    console.log('==================================\n');
  } else {
    console.log('[Middleware] No session, allowing access to public path:', path);
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|assets|favicon.ico|public/CodeConnectLogo.svg|CodeConnectLogo.svg).*)',
  ],
};