export async function storeGitHubToken(token: string, refreshToken?: string, expiresIn: number = 2628000) {
  try {
    // Store token in HttpOnly cookie via API endpoint
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        access_token: token,
        expires_in: expiresIn,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to store token: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Failed to store GitHub tokens:', error);
    return false;
  }
}

export async function getValidGitHubToken(): Promise<string | null> {
  try {
    // Test if we can access GitHub API with current cookie
    const response = await fetch('/api/github/user', {
      credentials: 'include',
    });

    if (response.ok) {
      return 'valid-cookie';
    }

    // Token is invalid, attempt to refresh
    const refreshed = await refreshGitHubToken();
    if (refreshed) {
      // If refresh succeeded, we should now have a valid token
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
    credentials: 'include',
  });
};