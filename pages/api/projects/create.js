import { supabase } from '../../../src/supabaseClient';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Initialize server-side Supabase client to access auth context
  const supabaseServerClient = createServerSupabaseClient({ req, res });
  
  // Check if user is authenticated
  const { data: { session }, error: authError } = await supabaseServerClient.auth.getSession();
  if (authError || !session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const { repoName, owner, ...otherProjectData } = req.body;
    
    // CRITICAL: Server-side repository access validation
    const githubToken = req.cookies.github_access_token;
    if (!githubToken) {
      return res.status(401).json({ error: 'GitHub authentication required' });
    }
    
    // Verify repository access on the server side
    const accessResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/collaborators`, 
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CodeConnect-App'
        }
      }
    );
    
    // If GitHub returns a non-success status code, user doesn't have access
    if (!accessResponse.ok) {
      return res.status(403).json({ 
        error: 'Repository access denied. You must be a collaborator on this repository.' 
      });
    }
    
    // Proceed with database insertion since access is verified
    const { data, error } = await supabase
      .from('project')
      .insert({
        repo_name: repoName,
        repo_owner: owner,
        user_id: session.user.id,
        repo_name_owner: `${repoName}_${owner}`,
        ...otherProjectData
      })
      .select('id')
      .single();
      
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(200).json({ success: true, projectId: data.id });
  } catch (error) {
    console.error('Project creation error:', error);
    return res.status(500).json({ error: 'Server error during project creation' });
  }
}