"use client";

import { useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { storeGitHubToken } from '../../utils/tokenRefresh';

export function AuthStateListener() {
  useEffect(() => {
    // Handle existing session on page load
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.provider_token) {
        console.log('Found existing session - storing GitHub token');
        await storeGitHubToken(session.provider_token);
      }
    };
    
    initializeAuth();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.provider_token) {
          console.log('User signed in - storing GitHub token in HttpOnly cookie');
          await storeGitHubToken(session.provider_token);
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // This component doesn't render anything
  return null;
}