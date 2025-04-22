import axios from 'axios';

export default async function handler(req, res) {
  const { owner, repo, weeks = 8 } = req.query; 
  
  if (!owner || !repo) {
    return res.status(400).json({ error: 'Owner and repo parameters are required' });
  }
  
  try {
    const githubToken = req.cookies.github_access_token;
    
    if (!githubToken) {
      return res.status(401).json({ error: 'GitHub authentication required' });
    }
    
    // Fetch commit activity using the stats endpoint
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );
    
    // If GitHub returns a 202 (still computing stats)
    if (response.status === 202) {
      return res.status(202).json({ error: 'GitHub is processing statistics. Please try again in a moment.' });
    }
    
    // Process the weekly data
    const weeklyData = response.data
      .slice(-weeks)
      .map(week => {
        const date = new Date(week.week * 1000); // Convert UNIX timestamp to date
        
        // Format the week range
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 6);
        
        const startFormatted = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endFormatted = endDate.toLocaleDateString('en-US', { day: 'numeric' });
        
        return {
          date: `${startFormatted}-${endFormatted}`,
          count: week.total,
          timestamp: week.week * 1000
        };
      });
    
    return res.status(200).json(weeklyData);
  } catch (error) {
    console.error('Error fetching commit activity:', error);
    return res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.message || 'Failed to fetch commit activity' 
    });
  }
}