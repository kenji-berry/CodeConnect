export default async function handler(req, res) {
  const { path } = req.query;
  const githubToken = req.cookies.github_access_token;
  
  if (!githubToken) {
    return res.status(401).json({ error: 'GitHub authentication required' });
  }

  try {
    // Reconstruct the GitHub API URL
    const url = `https://api.github.com/${Array.isArray(path) ? path.join('/') : path}`;
    
    // Enhanced security: Log access attempts for repository operations
    if (path[0] === 'repos' && path.length >= 3) {
      const [, owner, repo] = path;
      console.log(`Repository access attempt: ${owner}/${repo} from ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);
    }
    
    // Forward the request to GitHub API with the token
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'CodeConnect-App'
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });
    
    // Get response data
    const data = await (response.headers.get('content-type')?.includes('application/json') 
      ? response.json() 
      : response.text());
    
    // Forward GitHub's response code and data
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error proxying to GitHub API:', error);
    res.status(500).json({ error: 'Failed to communicate with GitHub API' });
  }
}