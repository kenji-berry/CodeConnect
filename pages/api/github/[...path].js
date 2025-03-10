export default async function handler(req, res) {
  const { path } = req.query;
  const githubToken = req.cookies.github_token;
  
  if (!githubToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const apiPath = Array.isArray(path) ? path.join('/') : path;
    const response = await fetch(`https://api.github.com/${apiPath}`, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: req.method !== 'GET' && req.body ? JSON.stringify(req.body) : undefined
    });
    
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to proxy request' });
  }
}