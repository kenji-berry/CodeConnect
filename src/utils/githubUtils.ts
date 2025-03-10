import { supabase } from '../supabaseClient';
import { getValidGitHubToken, storeGitHubToken } from './tokenRefresh';

export async function fetchWithTokenRefresh(url: string, options: RequestInit = {}) {
  try {
    // Extract the GitHub API path from the full URL
    const apiPath = url.replace('https://api.github.com/', '');
    
    // Make request through proxy API
    const response = await fetch(`/api/github/${apiPath}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // send cookies with request
      body: options.body
    });
    
    // Handle errors
    if (response.status === 401) {
      throw new Error('GitHub authentication required. Please log in again.');
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GitHub API error (${response.status}):`, errorText);
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error in fetchWithTokenRefresh:', error);
    throw error;
  }
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