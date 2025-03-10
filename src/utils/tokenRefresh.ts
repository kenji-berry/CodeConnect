import { supabase } from '../supabaseClient';

// Interface for stored token data
interface GitHubTokenData {
  token: string;
  expires_at: number; // Unix timestamp in milliseconds
}

// localStorage key
const GITHUB_TOKEN_KEY = 'github_token_data';

// Update the storeGitHubToken function first:

export async function storeGitHubToken(token: string) {
  try {
    console.log('Storing GitHub token in HttpOnly cookie');
    // Store token in HttpOnly cookie via API endpoint
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        access_token: token,
        expires_in: 28800 // 8 hours in seconds
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to store token: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to store GitHub token:', error);
    return false;
  }
}

// Also update getValidGitHubToken to use the cookie-based approach
export async function getValidGitHubToken(): Promise<string | null> {
  try {
    // Test if we can access GitHub API with current cookie
    const response = await fetch('/api/github/user', {
      credentials: 'include'
    });
    
    if (response.ok) {
      // If successful, we have a valid cookie
      return 'valid-cookie'; // We don't need to return the actual token anymore
    }
    
    // If we have a Supabase session with a token, use that
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.provider_token) {
      // Store it in the HttpOnly cookie
      await storeGitHubToken(session.provider_token);
      return 'valid-cookie';
    }
    
    return null;
  } catch (error) {
    console.error('Error checking GitHub token:', error);
    return null;
  }
}

export const clearGitHubTokens = async () => {
  // Clear any legacy localStorage token (if it exists)
  localStorage.removeItem('github_token');
  
  // Call the logout API to clear the HttpOnly cookie
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  });
};