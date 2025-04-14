import { supabase } from '../../../src/supabaseClient';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Initialize server-side Supabase client with explicit URL and key
  const supabaseServerClient = createPagesServerClient({ 
    req, 
    res,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_KEY 
  });
  
  // Check if user is authenticated
  const { data, error: authError } = await supabaseServerClient.auth.getSession();
  console.log("Auth session check:", data ? "Session exists" : "No session", 
              "Error:", authError ? authError.message : "None");
              
  if (authError || !data.session) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      details: authError ? authError.message : 'No active session found'
    });
  }
  
  try {
    const { 
      repoName, 
      owner, 
      technologies, 
      highlighted_technologies,
      tags,
      links,
      ...otherProjectData 
    } = req.body;
    
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
    
    // Use a transaction for atomic operations
    const { data: project, error: projectError } = await supabase
      .from('project')
      .insert({
        repo_name: repoName,
        repo_owner: owner,
        github_link: `https://github.com/${owner}/${repoName}`,
        user_id: session.user.id,
        repo_name_owner: `${repoName}_${owner}`,
        ...otherProjectData
      })
      .select('id')
      .single();
      
    if (projectError) {
      return res.status(400).json({ error: projectError.message });
    }
    
    // Insert technologies
    if (technologies && technologies.length > 0) {
      // First, get technology IDs
      const { data: techData } = await supabase
        .from('technologies')
        .select('id, name')
        .in('name', technologies);
        
      const techMap = techData.reduce((map, tech) => {
        map[tech.name.toLowerCase()] = tech.id;
        return map;
      }, {});
      
      // Insert project_technologies entries
      const techInserts = technologies.map(tech => ({
        project_id: project.id,
        technology_id: techMap[tech.toLowerCase()],
        is_highlighted: highlighted_technologies.includes(tech)
      }));
      
      const { error: techError } = await supabase
        .from('project_technologies')
        .insert(techInserts);
        
      if (techError) {
        console.error('Error inserting technologies:', techError);
      }
    }
    
    // Insert tags
    if (tags && tags.length > 0) {
      // Get tag IDs
      const { data: tagData } = await supabase
        .from('tags')
        .select('id, name')
        .in('name', tags);
        
      const tagMap = tagData.reduce((map, tag) => {
        map[tag.name.toLowerCase()] = tag.id;
        return map;
      }, {});
      
      // Insert project_tags entries
      const tagInserts = tags.map(tag => ({
        project_id: project.id,
        tag_id: tagMap[tag.toLowerCase()]
      }));
      
      const { error: tagError } = await supabase
        .from('project_tags')
        .insert(tagInserts);
        
      if (tagError) {
        console.error('Error inserting tags:', tagError);
      }
    }
    
    // Insert project links
    if (links && links.length > 0) {
      const linkInserts = links.map(link => ({
        project_id: project.id,
        name: link.name,
        url: link.url
      }));
      
      const { error: linkError } = await supabase
        .from('project_links')
        .insert(linkInserts);
        
      if (linkError) {
        console.error('Error inserting links:', linkError);
      }
    }
    
    return res.status(200).json({ success: true, projectId: project.id });
  } catch (error) {
    console.error('Project creation error:', error);
    return res.status(500).json({ error: 'Server error during project creation' });
  }
}