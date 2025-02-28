import { supabase } from '../supabaseClient';
import { getValidGitHubToken, storeGitHubToken } from './tokenRefresh';

export async function fetchWithTokenRefresh(url: string, options: RequestInit = {}) {
  // Get token from storage
  const githubToken = await getValidGitHubToken();
  
  if (!githubToken) {
    throw new Error('No GitHub access token found. Please log in again with GitHub to reconnect.');
  }
  
  // Prepare headers with token
  const headers = {
    'Authorization': `Bearer ${githubToken}`,
    'Accept': 'application/vnd.github.v3+json',
    ...options.headers,
  };
  
  // Make the request
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // Handle 401 errors
  if (response.status === 401) {
    // Token is invalid or expired
    localStorage.removeItem('github_token_data');
    throw new Error('GitHub access token expired. Please log in again with GitHub.');
  }
  
  // Handle other errors
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`GitHub API error (${response.status}):`, errorBody);
    throw new Error(`GitHub API error: ${response.status}`);
  }
  
  return response.json();
}

export async function testGitHubAccess() {
  try {
    const userData = await fetchWithTokenRefresh('https://api.github.com/user');
    return { 
      success: true, 
      username: userData.login 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function fetchUserRepositories() {
  return fetchWithTokenRefresh('https://api.github.com/user/repos?sort=updated&per_page=100');
}


export async function fetchRepositoryContent(owner: string, repo: string, path: string = '') {
  return fetchWithTokenRefresh(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
}