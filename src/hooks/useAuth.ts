import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { storeGitHubToken, clearGitHubTokens } from '../utils/tokenRefresh';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to refresh Supabase session
  const refreshSession = async () => {
    console.log('Refreshing Supabase session at:', new Date().toISOString());
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Error refreshing session:', error.message);
        setError(error.message);
        return null;
      }
      
      // Check if we got a GitHub token with this refresh
      if (data.session?.provider_token) {
        console.log('Got GitHub token from session refresh - storing it');
        storeGitHubToken(data.session.provider_token);
      } else {
        console.log('No GitHub token in refreshed session (this is normal)');
      }
      
      setSession(data.session);
      return data.session;
    } catch (err) {
      console.error('Exception refreshing session:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  };

  useEffect(() => {
    // Get initial session when component mounts
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setSession(session);
      setLoading(false);
      
      // Store GitHub token if available in initial session
      if (session?.provider_token) {
        console.log('Initial session has GitHub token - storing it');
        storeGitHubToken(session.provider_token);
      }
      
      if (error) setError(error.message);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      
      // Handle GitHub token when auth state changes
      if (_event === 'SIGNED_IN' && session?.provider_token) {
        console.log('User signed in with GitHub token - storing it');
        storeGitHubToken(session.provider_token);
      } else if (_event === 'SIGNED_OUT') {
        console.log('User signed out - clearing GitHub token');
        clearGitHubTokens();
      }
    });

    // Set up periodic session refresh
    const intervalId = setInterval(() => {
      refreshSession();
    }, 50 * 60 * 1000); // 50 minutes

    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, []);

  return {
    session,
    loading,
    error,
    refreshSession,
  };
}