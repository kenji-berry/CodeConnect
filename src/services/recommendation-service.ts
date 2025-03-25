import { supabase } from '@/supabaseClient';

export async function trackProjectView(userId: string, projectId: string | number) {
  try {
    console.log('Tracking view:', { userId, projectId });
    
    // First get the repo_name from project ID if a number was passed
    let repoId = projectId;
    
    if (typeof projectId === 'number') {
      const { data: projectData, error: projectError } = await supabase
        .from('project')
        .select('repo_name')
        .eq('id', projectId)
        .single();
      
      if (projectError || !projectData) {
        console.error('Error fetching repo_name from project ID:', projectError);
        return { data: null, error: projectError };
      }
      
      repoId = projectData.repo_name;
    }
    
    // Now insert into user_interactions with repo_name
    const { data, error } = await supabase
      .from('user_interactions')
      .upsert({
        user_id: userId,
        repo_id: repoId.toString(),
        interaction_type: 'view',
        timestamp: new Date().toISOString()
      }, {
        onConflict: 'user_id,repo_id,interaction_type',
        ignoreDuplicates: false 
      });
    
    if (error) {
      console.error('Error tracking project view:', error);
    } else {
      console.log('Successfully tracked view');
    }
    
    return { data, error };
  } catch (e) {
    console.error('Exception in trackProjectView:', e);
    return { data: null, error: e };
  }
}

export async function trackProjectLike(userId: string, projectId: string | number) {
  try {
    // First get the repo_name from project ID if a number was passed
    let repoId = projectId;
    
    if (typeof projectId === 'number') {
      const { data: projectData, error: projectError } = await supabase
        .from('project')
        .select('repo_name')
        .eq('id', projectId)
        .single();
      
      if (projectError || !projectData) {
        console.error('Error fetching repo_name from project ID:', projectError);
        return { data: null, error: projectError };
      }
      
      repoId = projectData.repo_name;
    }
    
    // Now insert into user_interactions with repo_name
    const { data, error } = await supabase
      .from('user_interactions')
      .upsert({
        user_id: userId,
        repo_id: repoId.toString(),
        interaction_type: 'like',
        timestamp: new Date().toISOString()
      }, {
        onConflict: 'user_id,repo_id,interaction_type',
        ignoreDuplicates: false
      });
    
    if (error) {
      console.error('Error tracking project like:', error);
    } else {
      console.log('Successfully tracked like');
    }
    
    return { data, error };
  } catch (e) {
    console.error('Exception in trackProjectLike:', e);
    return { data: null, error: e };
  }
}

export async function removeProjectLike(userId: string, projectId: string | number) {
  try {
    // First get the repo_name from project ID if a number was passed
    let repoId = projectId;
    
    if (typeof projectId === 'number') {
      const { data: projectData, error: projectError } = await supabase
        .from('project')
        .select('repo_name')
        .eq('id', projectId)
        .single();
      
      if (projectError || !projectData) {
        console.error('Error fetching repo_name from project ID:', projectError);
        return { data: null, error: projectError };
      }
      
      repoId = projectData.repo_name;
    }
    
    // Delete the like interaction
    const { data, error } = await supabase
      .from('user_interactions')
      .delete()
      .match({
        user_id: userId,
        repo_id: repoId.toString(),
        interaction_type: 'like'
      });
    
    if (error) {
      console.error('Error removing project like:', error);
    } else {
      console.log('Successfully removed like');
    }
    
    return { data, error };
  } catch (e) {
    console.error('Exception in removeProjectLike:', e);
    return { data: null, error: e };
  }
}

async function getUserInteractions(userId: string) {
  const { data, error } = await supabase
    .from('user_interactions')
    .select('repo_id, interaction_type')
    .eq('user_id', userId);
  
  if (error) {
    console.error('Error fetching user interactions:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Calculate interaction scores for projects
 * Like = 1 point, View = 0.5 points
 */
async function calculateInteractionScores(userId: string) {
  const interactions = await getUserInteractions(userId);
  
  const scores = {};
  interactions.forEach(interaction => {
    const { repo_id, interaction_type } = interaction;
    
    if (!scores[repo_id]) {
      scores[repo_id] = 0;
    }
    
    if (interaction_type === 'like') {
      scores[repo_id] += 1;
    } else if (interaction_type === 'view') {
      scores[repo_id] += 0.5;
    }
  });
  
  return scores;
}

async function getUserPreferredTags(userId: string) {
  // Get user interactions
  const interactions = await getUserInteractions(userId);
  const interactedRepoIds = [...new Set(interactions.map(i => i.repo_id))];
  
  if (interactedRepoIds.length === 0) {
    return [];
  }
  
  // Get projects by repo_id - need to do this to get project IDs
  const { data: projects, error: projectError } = await supabase
    .from('project')
    .select('id, repo_name')
    .in('repo_name', interactedRepoIds);
  
  if (projectError || !projects || projects.length === 0) {
    console.error('Error getting projects for tag preferences:', projectError);
    return [];
  }
  
  const projectIds = projects.map(p => p.id);
  
  // Get tags associated with these projects
  const { data: tagAssociations, error: tagError } = await supabase
    .from('project_assoc')
    .select(`
      project_tag (
        id,
        name
      )
    `)
    .in('project_id', projectIds)
    .eq('type', 'tag');
  
  if (tagError || !tagAssociations) {
    console.error('Error getting tag preferences:', tagError);
    return [];
  }
  
  // Extract tag names and remove duplicates
  const tags = tagAssociations
    .map(ta => ta.project_tag?.name)
    .filter(Boolean);
  
  return [...new Set(tags)];
}

async function getUserPreferredTechnologies(userId: string) {
  // Get user interactions
  const interactions = await getUserInteractions(userId);
  const interactedRepoIds = [...new Set(interactions.map(i => i.repo_id))];
  
  if (interactedRepoIds.length === 0) {
    return [];
  }
  
  // Get projects by repo_id - need to do this to get project IDs
  const { data: projects, error: projectError } = await supabase
    .from('project')
    .select('id, repo_name')
    .in('repo_name', interactedRepoIds);
  
  if (projectError || !projects || projects.length === 0) {
    console.error('Error getting projects for technology preferences:', projectError);
    return [];
  }
  
  const projectIds = projects.map(p => p.id);
  
  // Get technologies associated with these projects
  const { data: techAssociations, error: techError } = await supabase
    .from('project_technologies')
    .select(`
      technologies (
        id,
        name
      )
    `)
    .in('project_id', projectIds);
  
  if (techError || !techAssociations) {
    console.error('Error getting technology preferences:', techError);
    return [];
  }
  
  // Extract technology names and remove duplicates
  const techs = techAssociations
    .map(ta => ta.technologies?.name)
    .filter(Boolean);
  
  return [...new Set(techs)];
}

async function getAlreadyInteractedProjects(userId: string) {
  const interactions = await getUserInteractions(userId);
  return [...new Set(interactions.map(i => i.repo_id))];
}

export async function getRecommendedProjects(userId: string, limit = 5, debug = false) {
  try {
    if (debug) console.log("🔍 Starting recommendation process for user:", userId);
    
    // 1. Get user's interaction data
    const { data: interactions, error: interactionError } = await supabase
      .from('user_interactions')
      .select('repo_id, interaction_type')
      .eq('user_id', userId);
    
    if (interactionError) {
      console.error("Error fetching user interactions:", interactionError);
      return getPopularProjects(limit);
    }
    
    if (debug) console.log(`🔍 Found ${interactions?.length || 0} interactions for the user`);
    
    if (!interactions || interactions.length === 0) {
      if (debug) console.log("🔍 No interactions found, falling back to popular projects");
      return getPopularProjects(limit, debug);
    }
    
    // 2. Calculate scores for interacted projects
    const interactionScores = {};
    interactions.forEach(interaction => {
      if (!interactionScores[interaction.repo_id]) {
        interactionScores[interaction.repo_id] = 0;
      }
      
      // Like = 1 point, View = 0.5 points
      if (interaction.interaction_type === 'like') {
        interactionScores[interaction.repo_id] += 1;
      } else if (interaction.interaction_type === 'view') {
        interactionScores[interaction.repo_id] += 0.5;
      }
    });
    
    if (debug) {
      console.log("🔍 User interaction scores by repo:", interactionScores);
      console.log("🔍 User has interacted with these repos:", Object.keys(interactionScores));
    }
    
    // 3. Get interacted repo names
    const interactedRepoNames = Object.keys(interactionScores);
    
    // 4. Get project IDs from repo names
    const { data: projectsData, error: projectsError } = await supabase
      .from('project')
      .select('id, repo_name')
      .in('repo_name', interactedRepoNames);
    
    if (projectsError) {
      console.error("Error fetching projects from repo names:", projectsError);
      if (debug) console.log("🔍 Error getting project IDs:", projectsError);
      return getPopularProjects(limit, debug);
    }
    
    if (!projectsData || projectsData.length === 0) {
      if (debug) console.log("🔍 No matching projects found in database");
      return getPopularProjects(limit, debug);
    }
    
    const interactedProjectIds = projectsData.map(p => p.id);
    if (debug) console.log("🔍 Project IDs from repo names:", interactedProjectIds);
    
    // 5. Get tags associated with these projects
    const { data: tagAssociations, error: tagError } = await supabase
      .from('project_assoc')
      .select(`
        project_id,
        association_id,
        project_tag!inner (
          id,
          name
        )
      `)
      .in('project_id', interactedProjectIds)
      .eq('type', 'tag');
    
    if (tagError) {
      console.error("Error fetching tags for interacted projects:", tagError);
      if (debug) console.log("🔍 Error getting tags:", tagError);
    }
    
    // 6. Get technologies associated with these projects
    const { data: techAssociations, error: techError } = await supabase
      .from('project_technologies')
      .select(`
        project_id,
        technology_id,
        technologies!inner (
          id,
          name
        )
      `)
      .in('project_id', interactedProjectIds);
    
    if (techError) {
      console.error("Error fetching technologies for interacted projects:", techError);
      if (debug) console.log("🔍 Error getting technologies:", techError);
    }
    
    // Check if we have any preferences to base recommendations on
    if ((!tagAssociations || tagAssociations.length === 0) && 
        (!techAssociations || techAssociations.length === 0)) {
      if (debug) console.log("🔍 No tags or technologies found for user interactions");
      return getPopularProjects(limit, debug);
    }
    
    // 7. Log the tags and technologies user has interacted with
    if (debug) {
      const tagsByProject = {};
      tagAssociations?.forEach(tag => {
        if (!tagsByProject[tag.project_id]) {
          tagsByProject[tag.project_id] = [];
        }
        tagsByProject[tag.project_id].push(tag.project_tag.name);
      });
      
      const techsByProject = {};
      techAssociations?.forEach(tech => {
        if (!techsByProject[tech.project_id]) {
          techsByProject[tech.project_id] = [];
        }
        techsByProject[tech.project_id].push(tech.technologies.name);
      });
      
      console.log("🔍 Tags by interacted project:", tagsByProject);
      console.log("🔍 Technologies by interacted project:", techsByProject);
    }
    
    // 8. Extract unique tag and technology IDs with their names for logging
    const tagMap = {};
    tagAssociations?.forEach(t => {
      tagMap[t.association_id] = t.project_tag.name;
    });
    
    const techMap = {};
    techAssociations?.forEach(t => {
      techMap[t.technology_id] = t.technologies.name;
    });
    
    const tagIds = Object.keys(tagMap).map(Number);
    const techIds = Object.keys(techMap).map(Number);
    
    if (debug) {
      console.log("🔍 User's preferred tags:", Object.values(tagMap));
      console.log("🔍 User's preferred technologies:", Object.values(techMap));
    }
    
    // 9. Find projects with matching tags
    let projectScores = {};
    let projectReasons = {};

    if (tagIds.length > 0) {
      // Create a properly formatted filter for excluding interacted projects
      const query = supabase
        .from('project_assoc')
        .select('project_id, association_id, project_tag!inner(name)')
        .in('association_id', tagIds)
        .eq('type', 'tag');
      
      // Only apply the not-in filter if we have interacted projects
      if (interactedProjectIds.length > 0) {
        // When there's a single value, surround it with parentheses to ensure proper SQL formatting
        query.not('project_id', 'in', `(${interactedProjectIds.join(',')})`);
      }
      
      const { data: tagProjects, error: tagProjectsError } = await query;
      
      // Rest of code stays the same...
      if (tagProjectsError) {
        console.error("Error finding projects with matching tags:", tagProjectsError);
        if (debug) console.log("🔍 Error finding tag matches:", tagProjectsError);
      } else if (tagProjects && tagProjects.length > 0) {
        if (debug) console.log(`🔍 Found ${tagProjects.length} potential projects with matching tags`);
        
        // Score projects by tag matches
        tagProjects.forEach(item => {
          if (!projectScores[item.project_id]) {
            projectScores[item.project_id] = 0;
            projectReasons[item.project_id] = [];
          }
          projectScores[item.project_id] += 1;
          projectReasons[item.project_id].push(`Matches tag: ${item.project_tag.name}`);
        });
        
        if (debug) {
          const projWithTags = {};
          tagProjects.forEach(p => {
            if (!projWithTags[p.project_id]) {
              projWithTags[p.project_id] = [];
            }
            projWithTags[p.project_id].push(p.project_tag.name);
          });
          console.log("🔍 Projects with matching tags:", projWithTags);
        }
      } else {
        if (debug) console.log("🔍 No projects found with matching tags");
      }
    }
    
    // 10. Find projects with matching technologies
    if (techIds.length > 0) {
      // Create a properly formatted filter for excluding interacted projects
      const query = supabase
        .from('project_technologies')
        .select('project_id, technology_id, technologies!inner(name)')
        .in('technology_id', techIds);
      
      // Only apply the not-in filter if we have interacted projects
      if (interactedProjectIds.length > 0) {
        // When there's a single value, surround it with parentheses to ensure proper SQL formatting
        query.not('project_id', 'in', `(${interactedProjectIds.join(',')})`);
      }
      
      const { data: techProjects, error: techProjectsError } = await query;
      
      if (techProjectsError) {
        console.error("Error finding projects with matching technologies:", techProjectsError);
        if (debug) console.log("🔍 Error finding technology matches:", techProjectsError);
      } else if (techProjects && techProjects.length > 0) {
        if (debug) console.log(`🔍 Found ${techProjects.length} potential projects with matching technologies`);
        
        // Score projects by technology matches
        techProjects.forEach(item => {
          if (!projectScores[item.project_id]) {
            projectScores[item.project_id] = 0;
            projectReasons[item.project_id] = [];
          }
          projectScores[item.project_id] += 1;
          projectReasons[item.project_id].push(`Matches technology: ${item.technologies.name}`);
        });
        
        if (debug) {
          const projWithTechs = {};
          techProjects.forEach(p => {
            if (!projWithTechs[p.project_id]) {
              projWithTechs[p.project_id] = [];
            }
            projWithTechs[p.project_id].push(p.technologies.name);
          });
          console.log("🔍 Projects with matching technologies:", projWithTechs);
        }
      } else {
        if (debug) console.log("🔍 No projects found with matching technologies");
      }
    }
    
    // 11. Get top scoring projects
    const projectEntries = Object.entries(projectScores);
    
    if (debug) {
      console.log("🔍 Project scores:", projectScores);
      console.log("🔍 Project recommendation reasons:", projectReasons);
    }
    
    if (projectEntries.length === 0) {
      if (debug) console.log("🔍 No matching projects found, falling back to popular projects");
      return getPopularProjects(limit, debug);
    }
    
    const rankedProjects = projectEntries
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
    
    const projectIds = rankedProjects.map(([id]) => parseInt(id));
    
    if (debug) {
      console.log("🔍 Ranked projects with scores:", 
        rankedProjects.map(([id, score]) => `Project ${id}: Score ${score}, Reasons: ${projectReasons[id]?.join(', ')}`));
    }
    
    // 12. Get full project details
    const { data: recommendedProjects, error: recommendedError } = await supabase
      .from('project')
      .select(`
        id,
        repo_name,
        repo_owner,
        description_type,
        custom_description,
        difficulty_level,
        created_at,
        status
      `)
      .in('id', projectIds);
    
    if (recommendedError) {
      console.error("Error fetching recommended project details:", recommendedError);
      if (debug) console.log("🔍 Error getting recommended project details:", recommendedError);
      return getPopularProjects(limit, debug);
    }
    
    if (!recommendedProjects || recommendedProjects.length === 0) {
      if (debug) console.log("🔍 No recommended projects found after filtering");
      return getPopularProjects(limit, debug);
    }
    
    // 13. Enrich with tags and technologies
    const enrichedProjects = await Promise.all(
      recommendedProjects.map(async project => {
        try {
          // Get tags
          const { data: projectTags, error: projectTagsError } = await supabase
            .from('project_assoc')
            .select(`
              project_tag (
                name
              )
            `)
            .eq('project_id', project.id)
            .eq('type', 'tag');
          
          if (projectTagsError) {
            console.error(`Error fetching tags for project ${project.id}:`, projectTagsError);
            if (debug) console.log(`🔍 Error getting tags for project ${project.id}:`, projectTagsError);
          }
          
          // Get technologies
          const { data: projectTechs, error: projectTechsError } = await supabase
            .from('project_technologies')
            .select(`
              is_highlighted,
              technologies (
                name
              )
            `)
            .eq('project_id', project.id);
          
          if (projectTechsError) {
            console.error(`Error fetching technologies for project ${project.id}:`, projectTechsError);
            if (debug) console.log(`🔍 Error getting technologies for project ${project.id}:`, projectTechsError);
          }
          
          const result = {
            ...project,
            tags: projectTags ? projectTags.map(tag => tag.project_tag.name) : [],
            technologies: projectTechs ? projectTechs.map(tech => ({
              name: tech.technologies.name,
              is_highlighted: tech.is_highlighted
            })) : [],
            recommendationReason: projectReasons[project.id] || ["Based on your interests"]
          };
          
          if (debug) console.log(`🔍 Enriched project ${project.id} (${project.repo_name}) with tags and techs`);
          
          return result;
        } catch (enrichError) {
          console.error(`Error enriching project ${project.id}:`, enrichError);
          if (debug) console.log(`🔍 Error enriching project ${project.id}:`, enrichError);
          return {
            ...project,
            tags: [],
            technologies: [],
            recommendationReason: ["Error retrieving details"]
          };
        }
      })
    );
    
    // 14. Sort by score and return
    const result = projectIds
      .map(id => enrichedProjects.find(p => p.id === id))
      .filter(Boolean);
    
    if (debug) {
      console.log("🔍 Final recommendations:");
      result.forEach((project, index) => {
        console.log(`Recommendation #${index + 1}: ${project.repo_name} (ID: ${project.id})`);
        console.log(`- Tags: ${project.tags.join(', ')}`);
        console.log(`- Technologies: ${project.technologies.map(t => t.name).join(', ')}`);
        console.log(`- Reasons: ${project.recommendationReason.join(', ')}`);
        console.log(`- Score: ${projectScores[project.id]}`);
      });
    }
    
    return result;
  } catch (error) {
    console.error("Error in recommendation engine:", error);
    // Fallback to popular projects in case of any error
    return getPopularProjects(limit, debug);
  }
}

export async function getPopularProjects(limit = 5, debug = false) {
  try {
    if (debug) console.log("🔍 Getting popular projects as fallback");
    
    // Get interaction counts
    const { data: interactions, error: countError } = await supabase
      .from('user_interactions')
      .select('repo_id, interaction_type');
    
    if (countError) {
      console.error('Error getting interaction counts:', countError);
      return getRecentProjects(limit);
    }
    
    // Calculate scores (1 point for likes, 0.5 for views)
    const projectScores = {};
    interactions?.forEach(interaction => {
      if (!projectScores[interaction.repo_id]) {
        projectScores[interaction.repo_id] = 0;
      }
      
      if (interaction.interaction_type === 'like') {
        projectScores[interaction.repo_id] += 1;
      } else if (interaction.interaction_type === 'view') {
        projectScores[interaction.repo_id] += 0.5;
      }
    });
    
    // Get the top project IDs
    const topRepoIds = Object.entries(projectScores)
      .sort((a, b) => b[1] - a[1]) // Sort by score, descending
      .map(([id]) => id)
      .slice(0, limit);
    
    if (topRepoIds.length === 0) {
      return getRecentProjects(limit);
    }
    
    // Get project details
    const { data: projects, error } = await supabase
      .from('project')
      .select(`
        id,
        repo_name,
        repo_owner,
        description_type,
        custom_description,
        difficulty_level,
        created_at,
        status
      `)
      .in('repo_name', topRepoIds);
    
    if (error) {
      console.error('Error getting popular projects:', error);
      return getRecentProjects(limit);
    }
    
    // Get associated tags and technologies for each project
    const projectsWithData = await enrichProjectsWithTagsAndTech(projects || []);
    
    // Sort by popularity score
    return topRepoIds
      .map(repo_name => projectsWithData.find(p => p.repo_name === repo_name))
      .filter(Boolean)
      .slice(0, limit);
    
  } catch (error) {
    console.error('Error getting popular projects:', error);
    return getRecentProjects(limit);
  }
}

export async function getRecentProjects(limit = 5) {
  try {
    const { data: projects, error } = await supabase
      .from('project')
      .select(`
        id,
        repo_name,
        repo_owner,
        description_type,
        custom_description,
        difficulty_level,
        created_at,
        status
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error getting recent projects:', error);
      return [];
    }
    
    // Get associated tags and technologies for each project
    return await enrichProjectsWithTagsAndTech(projects || []);
    
  } catch (error) {
    console.error('Error getting recent projects:', error);
    return [];
  }
}

async function enrichProjectsWithTagsAndTech(projects) {
  if (!projects.length) return [];
  
  return await Promise.all(
    projects.map(async (project) => {
      // Fetch technologies
      const { data: techData } = await supabase
        .from('project_technologies')
        .select(`
          technologies (name),
          is_highlighted
        `)
        .eq('project_id', project.id);

      // Fetch tags
      const { data: tagData } = await supabase
        .from('project_assoc')
        .select(`
          association_id,
          project_tag!inner (
            name
          )
        `)
        .eq('project_id', project.id)
        .eq('type', 'tag');

      return {
        ...project,
        technologies: techData?.map(tech => ({
          name: tech.technologies.name,
          is_highlighted: tech.is_highlighted
        })) || [],
        tags: tagData?.map(tag => tag.project_tag.name) || []
      };
    })
  );
}