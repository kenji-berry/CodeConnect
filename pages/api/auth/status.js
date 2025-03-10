export default async function handler(req, res) {
  const githubToken = req.cookies.github_token;
  
  if (!githubToken) {
    return res.status(200).json({ authenticated: false });
  }
  
  try {
    // Verify token is valid by making a simple GitHub API request
    const response = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${githubToken}` }
    });
    
    if (response.ok) {
      return res.status(200).json({ authenticated: true });
    } else {
      // Token is invalid or expired
      return res.status(200).json({ authenticated: false });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Failed to check authentication status' });
  }
}