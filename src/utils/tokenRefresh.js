export async function storeGitHubToken(token, expiresIn = 2628000) {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        access_token: token,
        expires_in: expiresIn,
      }),
    });
    if (!response.ok) throw new Error(`Failed to store token: ${response.status}`);
    return true;
  } catch (error) {
    console.error('Failed to store GitHub tokens:', error);
    return false;
  }
}

export async function getValidGitHubToken(req, res) {
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
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
};