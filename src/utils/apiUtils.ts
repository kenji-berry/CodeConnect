import { supabase } from '../supabaseClient';

// Helper function to ensure a fresh token before API calls
export async function withFreshToken<T>(apiCall: () => Promise<T>): Promise<T> {
  // First check if we're close to expiration (within 5 minutes)
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  
  if (session) {
    // If session exists but is about to expire, refresh it
    // Check if expiry time is within 5 minutes
    const expiresAt = session.expires_at;
    const isExpiringSoon = expiresAt && (expiresAt * 1000 - Date.now() < 5 * 60 * 1000);
    
    if (isExpiringSoon) {
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Error refreshing token:', error.message);
      }
    }
  }
  
  // Now make the actual API call with the fresh token
  return apiCall();
}