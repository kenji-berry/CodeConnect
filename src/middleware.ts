import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
  // Check if user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  
  // Public paths that don't require authentication checks
  const publicPaths = ['/', '/login', '/about', '/onboarding'];
  const path = req.nextUrl.pathname;
  
  if (!session && !publicPaths.includes(path)) {
    // No session, redirect to home
    return NextResponse.redirect(new URL('/', req.url));
  }
  
  if (session) {
    // User is logged in, check if they've completed onboarding
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_changed')
      .eq('id', session.user.id)
      .single();
    
    const needsOnboarding = !profile || profile.is_changed === false;
    
    if (needsOnboarding && path !== '/onboarding') {
      // User needs onboarding and is not on onboarding page, redirect
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }
  }
  
  return res;
}

// Specify the paths this middleware should run on
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};