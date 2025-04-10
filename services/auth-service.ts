export async function handleGitHubCallback(code: string) {
  try {
    const tokenResponse = await fetchGitHubToken(code);
    
    // Store token in HttpOnly cookie via backend
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        access_token: tokenResponse.access_token,
        expires_in: tokenResponse.expires_in || 28800
      })
    });
    
    // Only store non-sensitive user info in localStorage
    const userData = await fetchUserProfile(tokenResponse.access_token);
    localStorage.setItem('user', JSON.stringify({
      username: userData.login,
      avatar_url: userData.avatar_url,
      name: userData.name
    }));
    
    return { success: true };
  } catch (error) {
    console.error('GitHub authentication error:', error);
    return { success: false, error };
  }
}

// Helper function to fetch user profile directly (will be used during login only)
async function fetchUserProfile(token: string) { 
  const response = await fetch('https://api.github.com/user', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return await response.json();
}

// Function to exchange the code for an access token
async function fetchGitHubToken(code: string) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI
    })
  });
  
  return response.json();
}