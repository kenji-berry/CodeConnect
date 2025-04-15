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
     try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        setError(error.message);
        return null;
      }
      if (data.session?.provider_token) {
        await storeGitHubToken(data.session.provider_token);
      }
      setSession(data.session);
      return data.session;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setSession(session);
      setLoading(false);
      if (session?.provider_token) {
        storeGitHubToken(session.provider_token);
      }
      if (error) setError(error.message);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      if (_event === 'SIGNED_IN' && session?.provider_token) {
        storeGitHubToken(session.provider_token);
      } else if (_event === 'SIGNED_OUT') {
        clearGitHubTokens();
      }
    });

    const intervalId = setInterval(() => {
      refreshSession();
    }, 50 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, []);

  return { session, loading, error, refreshSession };
}