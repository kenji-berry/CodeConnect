import { supabase } from '../supabaseClient';

// Interface for stored token data
interface GitHubTokenData {
  token: string;
  expires_at: number; // Unix timestamp in milliseconds
}

// localStorage key
const GITHUB_TOKEN_KEY = 'github_token_data';

export function storeGitHubToken(token: string) {
  try {
    // GitHub user-to-server tokens typically last 8 hours
    const tokenData: GitHubTokenData = {
      token: token,
      expires_at: Date.now() + (8 * 60 * 60 * 1000) // 8 hours from now
    };
    localStorage.setItem(GITHUB_TOKEN_KEY, JSON.stringify(tokenData));
    console.log('GitHub token stored with expiry:', new Date(tokenData.expires_at).toISOString());
    return true;
  } catch (error) {
    console.error('Failed to store GitHub token:', error);
    return false;
  }
}

export async function getValidGitHubToken(): Promise<string | null> {
  try {
    // First check current session for a fresh provider token
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.provider_token) {
      // Always store the most recent token
      storeGitHubToken(session.provider_token);
      return session.provider_token;
    }
    
    // If no token in session, try localStorage
    const storedData = localStorage.getItem(GITHUB_TOKEN_KEY);
    if (!storedData) {
      return null;
    }
    
    // Parse and validate stored token
    const tokenData: GitHubTokenData = JSON.parse(storedData);
    
    // Check if token is expired (with 5 min buffer)
    if (tokenData.expires_at - Date.now() < 5 * 60 * 1000) {
      console.warn('GitHub token expired or about to expire');
      localStorage.removeItem(GITHUB_TOKEN_KEY);
      return null;
    }
    
    // Token is still valid
    const minutesRemaining = Math.floor((tokenData.expires_at - Date.now()) / (60 * 1000));
    console.log(`Using stored GitHub token - expires in ${minutesRemaining} minutes`);
    return tokenData.token;
  } catch (error) {
    console.error('Error retrieving GitHub token:', error);
    return null;
  }
}

export function clearGitHubTokens() {
  localStorage.removeItem(GITHUB_TOKEN_KEY);
  console.log('GitHub token cleared from storage');
}