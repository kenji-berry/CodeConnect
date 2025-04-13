import { supabase } from '@/supabaseClient';

export async function trackProjectView(userId, projectId) {
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

export async function trackProjectLike(userId, projectId) {
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

export async function removeProjectLike(userId, projectId) {
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

async function getUserInteractions(userId) {
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

async function calculateInteractionScores(userId: string) {
  const interactions = await getUserInteractions(userId);
  
  
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
 */

const scores = {};
async function getUserPreferredTags(userId, debug = false) {
  // Get user interactions
  const interactions = await getUserInteractions(userId);
  
  if (debug) console.log(`🏷️ [getUserPreferredTags] Found ${interactions.length} interactions for user ${userId}`);
  
  const interactedRepoIds = [...new Set(interactions.map(i => i.repo_id))];
  
  if (debug) console.log(`🏷️ [getUserPreferredTags] Extracted ${interactedRepoIds.length} unique repository IDs:`, interactedRepoIds);
  
  if (interactedRepoIds.length === 0) {
    if (debug) console.log(`🏷️ [getUserPreferredTags] No repositories to analyze for user ${userId}, returning empty array`);
    return [];
  }
  
  // Get projects by repo_id - need to do this to get project IDs
  const { data: projects, error: projectError } = await supabase
    .from('project')
    .select('id, repo_name')
    .in('repo_name', interactedRepoIds);
  
  if (projectError || !projects || projects.length === 0) {
    console.error('Error getting projects for tag preferences:', projectError);
    if (debug) console.log(`🏷️ [getUserPreferredTags] Failed to retrieve projects or none found for the repositories`);
    return [];
  }
  
  if (debug) {
    console.log(`🏷️ [getUserPreferredTags] Found ${projects.length} projects:`, 
      projects.map(p => `${p.id} (${p.repo_name})`).join(', '));
  }
  
  const projectIds = projects.map(p => p.id);
  
  // Get tags associated with these projects
  const { data: tagAssociations, error: tagError } = await supabase
    .from('project_tags')
    .select(`
      project_id,
      tags (
        id,
        name
      )
    `)
    .in('project_id', projectIds);
  
  if (tagError || !tagAssociations) {
    console.error('Error getting tag preferences:', tagError);
    if (debug) console.log(`🏷️ [getUserPreferredTags] Failed to retrieve tag associations`);
    return [];
  }
  
  if (debug) {
    const tagsByProject = {};
    tagAssociations.forEach(ta => {
      if (!tagsByProject[ta.project_id]) {
        tagsByProject[ta.project_id] = [];
      }
      if (ta.tags?.name) {
        tagsByProject[ta.project_id].push(ta.tags.name);
      }
    });
    
    console.log(`🏷️ [getUserPreferredTags] Found tag associations by project:`);
    Object.entries(tagsByProject).forEach(([projectId, tags]) => {
      const projectName = projects.find(p => p.id === parseInt(projectId))?.repo_name || 'unknown';
      console.log(`  - Project ${projectId} (${projectName}): ${tags.join(', ')}`);
    });
  }
  
  // Extract tag names and remove duplicates
  const tags = tagAssociations
    .map(ta => ta.tags?.name)
    .filter(Boolean);
  
  const uniqueTags = [...new Set(tags)];
  
  if (debug) {
    console.log(`🏷️ [getUserPreferredTags] Inferred ${uniqueTags.length} unique preferred tags for user ${userId}:`, uniqueTags.join(', '));
  }
  
  return uniqueTags;
}
/**


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
 */

// Fix the getUserTagPreferences function to be more robust
async function getUserTagPreferences(userId, debug = false) {
  try {
    // Validate input
    if (!userId) {
      console.warn("getUserTagPreferences called with no userId");
      return [];
    }

    // Get user tag preferences
    const { data, error } = await supabase
      .from('user_tag_preferences')
      .select('tag_id')
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error fetching user tag preferences:', error);
      return [];
    }
    
    // Safely extract tag IDs, with better type checking
    const tagIds = (data || [])
      .filter(item => item && typeof item === 'object')
      .map(item => item.tag_id)
      .filter(id => id !== undefined && id !== null);
    
    if (debug) console.log(`🏷️ Found ${tagIds.length} explicit tag preferences for user ${userId}`);
    
    return tagIds;
  } catch (error) {
    console.error('Exception in getUserTagPreferences:', error);
    return [];
  }
}

// Add additional detailed debugging to getRecommendedProjects
export async function getRecommendedProjects(userId, limit = 5, debug = false) {
  try {
    if (debug) console.log("🔍 Starting recommendation process for user:", userId);
    
    // 1. Get user's interaction data
    const { data: interactions, error: interactionError } = await supabase
      .from('user_interactions')
      .select('repo_id, interaction_type')
      .eq('user_id', userId);
    
    if (interactionError) {
      console.error("Error fetching user interactions:", interactionError);
      return [];
    }
    
    const hasLimitedInteractions = !interactions || interactions.length < 3;
    if (debug) console.log(`🔍 Found ${interactions?.length || 0} interactions for the user. Limited interactions: ${hasLimitedInteractions}`);
    
    // Calculate interaction scores by repo
    if (debug && interactions && interactions.length > 0) {
      const scores = {};
      interactions.forEach(interaction => {
        const { repo_id, interaction_type } = interaction;
        if (!scores[repo_id]) scores[repo_id] = 0;
        if (interaction_type === 'like') scores[repo_id] += 1;
        else if (interaction_type === 'view') scores[repo_id] += 0.5;
      });
      console.log("🔍 User interaction scores by repo:", scores);
    }
    
    // Track which projects the user has already interacted with
    const interactedRepoNames = interactions ? [...new Set(interactions.map(i => i.repo_id))] : [];
    let interactedProjectIds = [];
    const projectScores = {};
    const projectReasons = {};
    
    // Get project IDs from repo names if we have any interactions
    if (interactedRepoNames.length > 0) {
      const { data: projectsData, error: projectsError } = await supabase
        .from('project')
        .select('id, repo_name')
        .in('repo_name', interactedRepoNames);
      
      if (!projectsError && projectsData) {
        interactedProjectIds = projectsData.map(p => p.id);
        if (debug) console.log("🔍 Project IDs from repo names:", interactedProjectIds);
      }
    }
    
    // 2. Get BOTH explicit and inferred tag preferences
    // Get explicit tag preferences (from user_tag_preferences table)
    const explicitTagIds = await getUserTagPreferences(userId, debug);
    
    // Get inferred tag preferences (from user interactions)
    const inferredTagNames = await getUserPreferredTags(userId, debug);
    
    if (debug) {
      console.log(`🏷️ Combined tag preferences approach: ${explicitTagIds.length} explicit, ${inferredTagNames.length} inferred`);
    }
    
    // If we have either type of preferences, proceed with recommendation
    if (explicitTagIds.length > 0 || inferredTagNames.length > 0) {
      // 3. Get tag IDs for the inferred tag names
      let inferredTagIds = [];
      if (inferredTagNames.length > 0) {
        const { data: tagData, error: tagError } = await supabase
          .from('tags')
          .select('id, name')
          .in('name', inferredTagNames);
          
        if (!tagError && tagData) {
          inferredTagIds = tagData.map(tag => tag.id);
          if (debug) console.log(`🏷️ Mapped inferred tag names to IDs:`, 
            tagData.map(tag => `${tag.name} (ID: ${tag.id})`).join(', '));
        }
      }
      
      // 4. Combine both sets of tag IDs (removing duplicates)
      const allTagIds = [...new Set([...explicitTagIds, ...inferredTagIds])];
      
      if (debug) {
        console.log(`🏷️ Combined tag IDs for recommendations: ${allTagIds.length} unique tags`, allTagIds);
      }
      
      // 5. Find projects with any of these tags
      const { data: tagProjects, error: tagProjectsError } = await supabase
        .from('project_tags')
        .select('project_id, tag_id, tags:tag_id(name)')
        .in('tag_id', allTagIds);
      
      if (tagProjectsError) {
        console.error("Error finding projects with combined tag preferences:", tagProjectsError);
      } else if (tagProjects && tagProjects.length > 0) {
        if (debug) console.log(`🏷️ Found ${tagProjects.length} projects matching user's combined tag preferences`);
        
        // Show matching projects and tags
        if (debug) {
          const projectTagMatches = {};
          tagProjects.forEach(item => {
            if (!projectTagMatches[item.project_id]) {
              projectTagMatches[item.project_id] = [];
            }
            projectTagMatches[item.project_id].push(item.tags?.name || 'unknown');
          });
          console.log("🏷️ Projects with matching tags:", projectTagMatches);
        }
        
        // 6. Score projects based on tag matches
        // - Higher weight for explicit tag matches
        // - Lower weight for inferred tag matches
        // - Boost if a project matches both explicit and inferred tags
        const explicitTagMatchWeight = hasLimitedInteractions ? 1.2 : 0.9;
        const inferredTagMatchWeight = hasLimitedInteractions ? 0.8 : 0.5;
        const tagMatchBoost = 0.3; // Bonus for matching multiple tag types
        
        // Group projects by their ID so we can count tags per project
        const projectTagCounts = {};
        tagProjects.forEach(item => {
          if (!projectTagCounts[item.project_id]) {
            projectTagCounts[item.project_id] = {
              explicitMatches: 0,
              inferredMatches: 0,
              matchedTags: {} // Keep track of which tags were matched
            };
          }
          
          if (explicitTagIds.includes(item.tag_id)) {
            projectTagCounts[item.project_id].explicitMatches++;
            projectTagCounts[item.project_id].matchedTags[item.tag_id] = {
              name: item.tags?.name,
              type: 'explicit'
            };
          }
          
          if (inferredTagIds.includes(item.tag_id)) {
            projectTagCounts[item.project_id].inferredMatches++;
            projectTagCounts[item.project_id].matchedTags[item.tag_id] = {
              name: item.tags?.name,
              type: 'inferred'
            };
          }
        });
        
        // 7. Calculate final scores and reasons
        Object.entries(projectTagCounts).forEach(([projectId, counts]) => {
          const numId = parseInt(projectId);
          
          // Skip projects user has already interacted with
          if (interactedProjectIds.includes(numId)) {
            return;
          }
          
          if (!projectScores[numId]) {
            projectScores[numId] = 0;
            projectReasons[numId] = [];
          }
          
          // Calculate the score for this project
          const explicitScore = counts.explicitMatches * explicitTagMatchWeight;
          const inferredScore = counts.inferredMatches * inferredTagMatchWeight;
          
          // Apply boost if project matches both explicit and inferred tags
          const diversityBoost = 
            counts.explicitMatches > 0 && counts.inferredMatches > 0 ? tagMatchBoost : 0;
          
          const totalScore = explicitScore + inferredScore + diversityBoost;
          projectScores[numId] += totalScore;
          
          // Add reasons for recommendation
          Object.entries(counts.matchedTags).forEach(([tagId, tag]) => {
            // Check if it's actually in the explicit tag preferences
            if (explicitTagIds.includes(parseInt(tagId))) {
              projectReasons[numId].push(`Matches your selected tag: ${tag.name || 'unknown'}`);
            } else {
              projectReasons[numId].push(`Similar to tags you like: ${tag.name || 'unknown'}`);
            }
          });
          
          if (diversityBoost > 0) {
            projectReasons[numId].push(`Matches both your selected and inferred preferences`);
          }
        });
        
        if (debug) {
          console.log("🏷️ Project scores after incorporating combined tag preferences:", projectScores);
          const rankedProjects = Object.entries(projectScores)
            .sort((a, b) => b[1] - a[1])
            .map(([id, score]) => `Project ${id}: Score ${score.toFixed(2)}, Reasons: ${projectReasons[id].join(', ')}`);
          console.log("🔍 Ranked projects with scores:", rankedProjects);
        }
        
        // 8. Get the top scored projects
        if (Object.keys(projectScores).length > 0) {
          // Get project IDs sorted by score
          const topProjectIds = Object.entries(projectScores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([id]) => parseInt(id));
          
          if (debug) console.log("🏷️ Top project IDs by score:", topProjectIds);
          
          // Get full project details
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
            .in('id', topProjectIds);
          
          if (error) {
            console.error('Error getting project details:', error);
            return [];
          }
          
          // Get associated tags and technologies for each project
          const enrichedProjects = await enrichProjectsWithTagsAndTech(projects || []);
          
          // Add recommendation reasons and sort by original score
          const recommendedProjects = enrichedProjects.map(project => ({
            ...project,
            recommendationReason: projectReasons[project.id] || ["Recommended based on your preferences"]
          }));
          
          // Sort according to original score order
          const sortedProjects = topProjectIds
            .map(id => recommendedProjects.find(p => p.id === id))
            .filter(Boolean);
          
          // Add detailed result logging
          if (debug) {
            console.log(`🔍 Final recommendations with combined tag approach:`);
            sortedProjects.forEach((project, i) => {
              console.log(`Recommendation #${i+1}: ${project.repo_name} (ID: ${project.id})`);
              console.log(`- Tags: ${project.tags?.join(', ') || 'none'}`);
              console.log(`- Technologies: ${project.technologies?.map(t => t.name).join(', ') || 'none'}`);
              console.log(`- Reasons: ${project.recommendationReason.join(', ')}`);
              console.log(`- Score: ${projectScores[project.id].toFixed(2)}`);
            });
          }
          
          if (debug) console.log(`🏷️ Returning ${sortedProjects.length} recommendations using combined tag approach`);
          return sortedProjects;
        }
      }
    }
    
    if (debug) console.log("🔍 No tag-based recommendations found with combined approach");
    return [];
    
  } catch (error) {
    console.error("Error in recommendation engine:", error);
    return [];
  }
}

export async function getHybridRecommendations(userId, limit = 5, debug = false) {
  try {
    if (debug) console.log("🔄 Starting hybrid recommendation process");

    // Check if user is new (has few interactions)
    const { data: interactions, error: interactionError } = await supabase
      .from('user_interactions')
      .select('repo_id')
      .eq('user_id', userId);

    if (interactionError) {
      console.error("Error fetching user interactions:", interactionError);
      return [];
    }

    const interactionCount = interactions?.length || 0;
    const isNewUser = interactionCount < 5;

    if (debug) console.log(`🔄 User interaction count: ${interactionCount}, isNewUser: ${isNewUser}`);

    // Check for tag preferences before falling back
    if (interactionCount === 0) {
      // Get user tag preferences
      const userTagIds = await getUserTagPreferences(userId, debug);

      if (debug) console.log(`🏷️ Found ${userTagIds.length} tag preferences for user with no interactions`);

      // If user has tag preferences, use them for recommendations
      if (userTagIds.length > 0) {
        if (debug) console.log("🏷️ Using tag preferences to recommend projects for new user");

        // Use content-based recommendations which will incorporate tag preferences
        const contentRecommendations = await getRecommendedProjects(userId, limit, debug);
        if (contentRecommendations && contentRecommendations.length > 0) {
          return contentRecommendations;
        }
      }

      console.warn("No interactions or useful tag preferences found. Returning an empty array.");
      return []; 
    }

    // Fetch content-based and collaborative recommendations
    const contentRecommendations = await getRecommendedProjects(userId, limit, debug) || [];
    const collabRecommendations = await getCollaborativeRecommendations(userId, limit, debug) || [];

    if (debug) {
      console.log(`🔄 Content recommendations count: ${contentRecommendations.length}`);
      console.log(`🔄 Collaborative recommendations count: ${collabRecommendations.length}`);
    }

    if (!contentRecommendations.length && !collabRecommendations.length) {
      console.warn("No recommendations found. Returning an empty array.");
      return []; 
    }

    // Combine recommendations with weighted logic
    const contentRatio = isNewUser ? 0.8 : 0.6;
    let contentCount = Math.max(1, Math.round(limit * contentRatio));
    let collabCount = limit - contentCount;

    // Adjust counts if there are not enough collaborative recommendations
    if (collabRecommendations.length < collabCount) {
      const availableCollab = collabRecommendations.length;
      contentCount = Math.min(contentRecommendations.length, limit - availableCollab);
      collabCount = availableCollab;
    }

    if (debug) {
      console.log(`🔄 Content ratio: ${contentRatio}, taking ${contentCount} content recommendations`);
      console.log(`🔄 Taking ${collabCount} collaborative recommendations`);
    }

    const combinedRecommendations = [
      ...(contentRecommendations || []).slice(0, contentCount),
      ...(collabRecommendations || []).slice(0, collabCount),
    ];

    if (debug) {
      console.log(`🔄 Final recommendations count: ${combinedRecommendations.length}`);
    }

    return combinedRecommendations.slice(0, limit);
  } catch (error) {
    console.error("Error in hybrid recommendations:", error);
    return [];
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
        .from('project_tags')
        .select(`
          tag_id,
          tags:tag_id(name)
        `)
        .eq('project_id', project.id);

      return {
        ...project,
        technologies: techData?.map(tech => ({
          name: tech.technologies.name,
          is_highlighted: tech.is_highlighted
        })) || [],
        tags: tagData?.map(tag => tag.tags.name) || []
      };
    })
  );
}

// Fix the not.in filter syntax in the collaborative recommendations function
export async function getCollaborativeRecommendations(userId, limit = 5, debug = false) {
  try {
    if (debug) console.log("👥 Starting collaborative filtering for user:", userId);

    // 1. Get user interactions
    const { data: userInteractions, error: userInteractionError } = await supabase
      .from('user_interactions')
      .select('repo_id, interaction_type, timestamp')
      .eq('user_id', userId);

    if (userInteractionError || !userInteractions || userInteractions.length === 0) {
      if (debug) console.log("👥 No interactions found for collaborative filtering");
      return [];
    }

    // 2. Get interacted project IDs
    const interactedRepoIds = userInteractions.map(i => i.repo_id);
    if (debug) console.log("👥 User has interacted with repos:", interactedRepoIds);

    // 3. Find other users who interacted with at least one of the same projects
    const { data: similarUserInteractions, error: similarUserError } = await supabase
      .from('user_interactions')
      .select('user_id, repo_id, interaction_type')
      .in('repo_id', interactedRepoIds)
      .neq('user_id', userId);

    if (similarUserError || !similarUserInteractions || similarUserInteractions.length === 0) {
      if (debug) console.log("👥 No similar users found");
      return [];
    }

    // Calculate meaningful similarity scores
    const userSimilarityMap = {};

    // Group interactions by user
    similarUserInteractions.forEach(interaction => {
      if (!userSimilarityMap[interaction.user_id]) {
        userSimilarityMap[interaction.user_id] = {
          commonProjects: new Set(),
          interactionMap: {} // Store interaction types for each project
        };
      }

      userSimilarityMap[interaction.user_id].commonProjects.add(interaction.repo_id);
      userSimilarityMap[interaction.user_id].interactionMap[interaction.repo_id] = interaction.interaction_type;
    });

    // Create a set of the current user's interactions by type
    const userLikes = new Set();
    const userViews = new Set();

    userInteractions.forEach(interaction => {
      if (interaction.interaction_type === 'like') {
        userLikes.add(interaction.repo_id);
      } else if (interaction.interaction_type === 'view') {
        userViews.add(interaction.repo_id);
      }
    });

    // Calculate similarity scores that factor in interaction overlap quality
    Object.keys(userSimilarityMap).forEach(simUserId => {
      const commonProjects = userSimilarityMap[simUserId].commonProjects;
      const interactionMap = userSimilarityMap[simUserId].interactionMap;

      // Minimum meaningful overlap requirement (30% or at least 2 projects)
      const minOverlapThreshold = Math.max(2, Math.ceil(interactedRepoIds.length * 0.3));

      if (commonProjects.size < minOverlapThreshold) {
        delete userSimilarityMap[simUserId];
        return;
      }

      // Calculate weighted Jaccard similarity
      let intersectionWeight = 0;

      // Weight the intersection by interaction type match
      commonProjects.forEach(repoId => {
        // Higher weight if both users liked the same project
        if (userLikes.has(repoId) && interactionMap[repoId] === 'like') {
          intersectionWeight += 2.0;
        }
        // Lower weight if one liked and one viewed or both viewed
        else if (userLikes.has(repoId) || interactionMap[repoId] === 'like') {
          intersectionWeight += 1.0;
        } else {
          intersectionWeight += 0.5;
        }
      });

      // Calculate total projects in the union
      const totalUnique = new Set([...interactedRepoIds, ...Array.from(commonProjects)]).size;

      // Calculate similarity score
      const similarityScore = intersectionWeight / totalUnique;

      // Only keep users with meaningful similarity
      if (similarityScore >= 0.15) {
        userSimilarityMap[simUserId].similarityScore = similarityScore;
      } else {
        delete userSimilarityMap[simUserId];
      }
    });

    // Get top similar users
    const similarUsers = Object.entries(userSimilarityMap)
      .sort((a, b) => b[1].similarityScore - a[1].similarityScore)
      .slice(0, 5) // Limit to top 5 most similar users
      .map(([userId]) => userId);

    if (Object.keys(userSimilarityMap).length > 0) {
      if (debug) console.log("👥 Found similar users with similarity scores:",
        Object.entries(userSimilarityMap)
          .map(([id, data]) => `${id}: ${data.similarityScore?.toFixed(2)}`)
          .join(', ')
      );
    } else {
      if (debug) console.log("👥 No sufficiently similar users found after quality filtering");
    }

    if (similarUsers.length === 0) {
      if (debug) console.log("👥 No sufficiently similar users found");
      return [];
    }

    // 5. Find what projects these similar users interacted with that the current user hasn't
    const recommendationPromises = [];
    
    if (debug) console.log("👥 Looking for recommendations from similar users:", similarUsers);
    
    // Get recommendations from each similar user separately to avoid filter syntax issues
    for (const simUserId of similarUsers) {
      const promise = supabase
        .from('user_interactions')
        .select('repo_id, interaction_type, user_id')
        .eq('user_id', simUserId)
        .then(({ data, error }) => {
          if (error) {
            if (debug) console.log(`👥 Error getting interactions for user ${simUserId}:`, error);
            return [];
          }
          
          // Filter out projects the current user has already interacted with
          return (data || []).filter(item => !interactedRepoIds.includes(item.repo_id));
        });
        
      recommendationPromises.push(promise);
    }
    
    // Combine all recommendations
    const recommendationsArrays = await Promise.all(recommendationPromises);
    const recommendations = recommendationsArrays.flat();
    
    if (debug) console.log(`👥 Found ${recommendations.length} potential recommendations from similar users`);

    if (!recommendations || recommendations.length === 0) {
      if (debug) console.log("👥 No collaborative recommendations found");
      return [];
    }

    // 6. Score recommendations based on user similarity and interaction type
    const scoreByRepo = {};
    recommendations.forEach(item => {
      if (!scoreByRepo[item.repo_id]) {
        scoreByRepo[item.repo_id] = 0;
      }

      // Weight by interaction type and user similarity
      const interactionWeight = item.interaction_type === 'like' ? 2 : 0.5;
      const similarityWeight = userSimilarityMap[item.user_id].similarityScore;

      scoreByRepo[item.repo_id] += interactionWeight * similarityWeight;
    });

    // 7. Sort by score and get top repos
    const topRepoIds = Object.entries(scoreByRepo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([repoId]) => repoId);

    if (debug) console.log("👥 Top collaborative repo IDs with scores:",
      Object.entries(scoreByRepo)
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.min(5, Object.entries(scoreByRepo).length))
        .map(([id, score]) => `${id}: ${score.toFixed(2)}`)
        .join(', ')
    );

    if (topRepoIds.length === 0) {
      if (debug) console.log("👥 No top recommendations found after scoring");
      return [];
    }

    // 8. Get full project details
    const { data: projects, error: projectsError } = await supabase
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

    if (projectsError || !projects || projects.length === 0) {
      if (debug) console.log("👥 Error getting project details:", projectsError);
      return [];
    }

    // 9. Enrich with tags and technologies
    const enrichedProjects = await enrichProjectsWithTagsAndTech(projects);

    // Add collaborative reason
    return enrichedProjects.map(project => ({
      ...project,
      recommendationReason: ["People with similar interests liked this project"]
    }));

  } catch (error) {
    console.error("Error in collaborative filtering:", error);
    return [];
  }
}