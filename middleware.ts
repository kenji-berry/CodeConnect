import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
  // Check if user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  
  const publicPaths = [
    '/', 
    '/login', 
    '/about', 
    '/onboarding', 
    '/auth-required',
    '/auth/callback',
    '/api/auth'
  ];
  
  const path = req.nextUrl.pathname;
  
  // Check if the current path starts with any of the public paths
  const isPublicPath = publicPaths.some(publicPath => 
    path === publicPath || path.startsWith(`${publicPath}/`)
  );
  
  if (!session && !isPublicPath) {
    // No session, redirect to auth-required page with returnTo parameter
    const returnUrl = new URL('/auth-required', req.url);
    returnUrl.searchParams.set('returnTo', path);
    return NextResponse.redirect(returnUrl);
  }
  
  if (session) {
    console.log('\n==================================');
    console.log('🔑 Session found for user:', session.user.id);
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_changed, display_name')
      .eq('user_id', session.user.id)
      .single();
    
    console.log('👤 Profile data:', JSON.stringify(profile, null, 2));
    console.log('❌ Profile query error:', error?.message);
    
    const needsOnboarding = !profile || profile.is_changed === false;
    console.log('🚀 Needs onboarding?', needsOnboarding);
    console.log('🌐 Current path:', path);
    
    if (needsOnboarding && path !== '/onboarding') {
      console.log('🔄 Redirecting to onboarding...');
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }
    console.log('==================================\n');
  }
  
  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|assets|favicon.ico).*)'],
};