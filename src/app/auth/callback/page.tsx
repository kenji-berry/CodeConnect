"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();
  
  useEffect(() => {
    // Handle the hash fragment
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Redirect to onboarding or wherever needed
        router.push('/onboarding');
      }
    });
  }, [router]);
  
  return <div>Completing login...</div>;
}