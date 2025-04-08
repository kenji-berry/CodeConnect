import type { NextApiRequest, NextApiResponse } from 'next';
import { getValidGitHubToken } from '../../../../../../utils/tokenRefresh';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { owner, repo } = req.query;
  
  try {
    // Get valid GitHub token
    const token = await getValidGitHubToken(req, res);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    // Check if the user has access to this repository
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });
    
    // If repository exists but user doesn't have push access
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Repository access error' });
    }
    
    const repoData = await response.json();
    
    // Check if user has push access or is the owner
    if (!repoData.permissions?.push && !repoData.permissions?.admin) {
      return res.status(403).json({ 
        error: 'You do not have write access to this repository' 
      });
    }
    
    // User has appropriate access
    return res.status(200).json({ access: true });
  } catch (error) {
    console.error('Error verifying repository access:', error);
    return res.status(500).json({ error: 'Failed to verify repository access' });
  }
}