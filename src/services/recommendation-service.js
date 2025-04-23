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
 * @param {string} userId - The user ID to calculate scores for
 * @returns {Object} - Dictionary of scores by repo ID
 */
async function calculateInteractionScores(userId) {
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
    .in('repo_name', interactedRepoIds)
    .eq('webhook_active', true);
  
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

// Function to get explicitly selected tag preferences for a user
async function getUserTagPreferences(userId, debug = false) {
  try {
    if (!userId) {
      console.warn("getUserTagPreferences called with no userId");
      return [];
    }

    const { data, error } = await supabase
      .from('user_tag_preferences')
      .select('tag_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user tag preferences:', error);
      return [];
    }

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

async function getUserTechnologyPreferences(userId, debug = false) {
  try {
    if (!userId) {
      console.warn("getUserTechnologyPreferences called with no userId");
      return [];
    }

    const { data, error } = await supabase
      .from('user_technology_preferences')
      .select('technology_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user technology preferences:', error);
      return [];
    }

    const techIds = (data || [])
      .filter(item => item && typeof item === 'object')
      .map(item => item.technology_id)
      .filter(id => id !== undefined && id !== null);

    if (debug) console.log(`💻 Found ${techIds.length} explicit technology preferences for user ${userId}`);

    return techIds;
  } catch (error) {
    console.error('Exception in getUserTechnologyPreferences:', error);
    return [];
  }
}

async function getUserPreferredTechnologies(userId, debug = false) {
  const interactions = await getUserInteractions(userId);
  if (debug) console.log(`💻 [getUserPreferredTechnologies] Found ${interactions.length} interactions for user ${userId}`);

  const interactedRepoIds = [...new Set(interactions.map(i => i.repo_id))];
  if (debug) console.log(`💻 [getUserPreferredTechnologies] Extracted ${interactedRepoIds.length} unique repository IDs:`, interactedRepoIds);

  if (interactedRepoIds.length === 0) {
    if (debug) console.log(`💻 [getUserPreferredTechnologies] No repositories to analyze, returning empty array`);
    return [];
  }

  const { data: projects, error: projectError } = await supabase
    .from('project')
    .select('id, repo_name')
    .in('repo_name', interactedRepoIds)
    .eq('webhook_active', true);

  if (projectError || !projects || projects.length === 0) {
    console.error('Error getting projects for technology preferences:', projectError);
    if (debug) console.log(`💻 [getUserPreferredTechnologies] Failed to retrieve projects or none found`);
    return [];
  }
  if (debug) console.log(`💻 [getUserPreferredTechnologies] Found ${projects.length} projects:`, projects.map(p => `${p.id} (${p.repo_name})`).join(', '));

  const projectIds = projects.map(p => p.id);

  const { data: techAssociations, error: techError } = await supabase
    .from('project_technologies')
    .select(`
      project_id,
      technologies (
        id,
        name
      )
    `)
    .in('project_id', projectIds);

  if (techError || !techAssociations) {
    console.error('Error getting technology preferences:', techError);
    if (debug) console.log(`💻 [getUserPreferredTechnologies] Failed to retrieve technology associations`);
    return [];
  }

  if (debug) {
    const techsByProject = {};
    techAssociations.forEach(ta => {
      if (!techsByProject[ta.project_id]) techsByProject[ta.project_id] = [];
      if (ta.technologies?.name) techsByProject[ta.project_id].push(ta.technologies.name);
    });
    console.log(`💻 [getUserPreferredTechnologies] Found technology associations by project:`);
    Object.entries(techsByProject).forEach(([projectId, techs]) => {
      const projectName = projects.find(p => p.id === parseInt(projectId))?.repo_name || 'unknown';
      console.log(`  - Project ${projectId} (${projectName}): ${techs.join(', ')}`);
    });
  }

  const techs = techAssociations.map(ta => ta.technologies?.name).filter(Boolean);
  const uniqueTechs = [...new Set(techs)];

  if (debug) console.log(`💻 [getUserPreferredTechnologies] Inferred ${uniqueTechs.length} unique preferred technologies:`, uniqueTechs.join(', '));

  return uniqueTechs;
}

export async function getRecommendedProjects(userId, limit = 5, debug = false) {
  try {
    if (debug) console.log("🔍 Starting recommendation process for user:", userId);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('difficulty_level')
      .eq('user_id', userId)
      .maybeSingle();

    const userDifficulties = Array.isArray(profile?.difficulty_level)
      ? profile.difficulty_level.map(String)
      : [];

    if (debug) console.log("🔍 User difficulty preferences:", userDifficulties);

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

    const interactedRepoNames = interactions ? [...new Set(interactions.map(i => i.repo_id))] : [];
    let interactedProjectIds = [];
    const projectScores = {};
    const projectReasons = {};

    if (interactedRepoNames.length > 0) {
      const { data: projectsData, error: projectsError } = await supabase
        .from('project')
        .select('id, repo_name')
        .in('repo_name', interactedRepoNames)
        .eq('webhook_active', true);

      if (!projectsError && projectsData) {
        interactedProjectIds = projectsData.map(p => p.id);
        if (debug) console.log("🔍 Project IDs from repo names:", interactedProjectIds);
      }
    }

    // --- TAG PREFERENCES ---
    const explicitTagIds = await getUserTagPreferences(userId, debug);
    const inferredTagNames = await getUserPreferredTags(userId, debug);
    if (debug) console.log(`🏷️ Tag preferences: ${explicitTagIds.length} explicit, ${inferredTagNames.length} inferred`);

    let allTagIds = [];
    let inferredTagIds = [];
    if (explicitTagIds.length > 0 || inferredTagNames.length > 0) {
      if (inferredTagNames.length > 0) {
        const { data: tagData, error: tagError } = await supabase.from('tags').select('id, name').in('name', inferredTagNames);
        if (!tagError && tagData) inferredTagIds = tagData.map(tag => tag.id);
      }
      allTagIds = [...new Set([...explicitTagIds, ...inferredTagIds])];
      if (debug) console.log(`🏷️ Combined tag IDs for recommendations: ${allTagIds.length} unique tags`, allTagIds);

      const { data: tagProjects, error: tagProjectsError } = await supabase
        .from('project_tags')
        .select('project_id, tag_id, tags:tag_id(name)')
        .in('tag_id', allTagIds);

      if (!tagProjectsError && tagProjects && tagProjects.length > 0) {
        if (debug) console.log(`🏷️ Found ${tagProjects.length} projects matching user's combined tag preferences`);
        const explicitTagMatchWeight = hasLimitedInteractions ? 1.2 : 0.9;
        const inferredTagMatchWeight = hasLimitedInteractions ? 0.8 : 0.5;
        const tagMatchBoost = 0.3;

        const projectTagCounts = {};
        tagProjects.forEach(item => {
          if (!projectTagCounts[item.project_id]) {
            projectTagCounts[item.project_id] = { explicitMatches: 0, inferredMatches: 0, matchedTags: {} };
          }
          if (explicitTagIds.includes(item.tag_id)) {
            projectTagCounts[item.project_id].explicitMatches++;
            projectTagCounts[item.project_id].matchedTags[item.tag_id] = { name: item.tags?.name, type: 'explicit' };
          }
          if (inferredTagIds.includes(item.tag_id)) {
            projectTagCounts[item.project_id].inferredMatches++;
            projectTagCounts[item.project_id].matchedTags[item.tag_id] = { name: item.tags?.name, type: 'inferred' };
          }
        });

        Object.entries(projectTagCounts).forEach(([projectId, counts]) => {
          const numId = parseInt(projectId);
          if (interactedProjectIds.includes(numId)) return;
          if (!projectScores[numId]) { projectScores[numId] = 0; projectReasons[numId] = []; }

          const explicitScore = counts.explicitMatches * explicitTagMatchWeight;
          const inferredScore = counts.inferredMatches * inferredTagMatchWeight;
          const diversityBoost = counts.explicitMatches > 0 && counts.inferredMatches > 0 ? tagMatchBoost : 0;
          const totalScore = explicitScore + inferredScore + diversityBoost;
          projectScores[numId] += totalScore;

          Object.entries(counts.matchedTags).forEach(([tagId, tag]) => {
            if (explicitTagIds.includes(parseInt(tagId))) {
              projectReasons[numId].push(`Matches your selected tag: ${tag.name || 'unknown'}`);
            } else {
              projectReasons[numId].push(`Similar to tags you like: ${tag.name || 'unknown'}`);
            }
          });
          if (diversityBoost > 0) projectReasons[numId].push(`Matches both your selected and inferred tag preferences`);
        });
      }
    }

    // --- TECHNOLOGY PREFERENCES ---
    const explicitTechIds = await getUserTechnologyPreferences(userId, debug);
    const inferredTechNames = await getUserPreferredTechnologies(userId, debug);
    if (debug) console.log(`💻 Technology preferences: ${explicitTechIds.length} explicit, ${inferredTechNames.length} inferred`);

    let allTechIds = [];
    let inferredTechIds = [];
    if (explicitTechIds.length > 0 || inferredTechNames.length > 0) {
      if (inferredTechNames.length > 0) {
        const { data: techData, error: techError } = await supabase.from('technologies').select('id, name').in('name', inferredTechNames);
        if (!techError && techData) inferredTechIds = techData.map(tech => tech.id);
      }
      allTechIds = [...new Set([...explicitTechIds, ...inferredTechIds])];
      if (debug) console.log(`💻 Combined technology IDs for recommendations: ${allTechIds.length} unique technologies`, allTechIds);

      const { data: techProjects, error: techProjectsError } = await supabase
        .from('project_technologies')
        .select('project_id, technology_id, technologies:technology_id(name)')
        .in('technology_id', allTechIds);

      if (!techProjectsError && techProjects && techProjects.length > 0) {
        if (debug) console.log(`💻 Found ${techProjects.length} projects matching user's combined technology preferences`);
        const explicitTechMatchWeight = hasLimitedInteractions ? 1.1 : 0.8;
        const inferredTechMatchWeight = hasLimitedInteractions ? 0.7 : 0.4;
        const techMatchBoost = 0.25;

        const projectTechCounts = {};
        techProjects.forEach(item => {
          if (!projectTechCounts[item.project_id]) {
            projectTechCounts[item.project_id] = { explicitMatches: 0, inferredMatches: 0, matchedTechs: {} };
          }
          if (explicitTechIds.includes(item.technology_id)) {
            projectTechCounts[item.project_id].explicitMatches++;
            projectTechCounts[item.project_id].matchedTechs[item.technology_id] = { name: item.technologies?.name, type: 'explicit' };
          }
          if (inferredTechIds.includes(item.technology_id)) {
            projectTechCounts[item.project_id].inferredMatches++;
            projectTechCounts[item.project_id].matchedTechs[item.technology_id] = { name: item.technologies?.name, type: 'inferred' };
          }
        });

        Object.entries(projectTechCounts).forEach(([projectId, counts]) => {
          const numId = parseInt(projectId);
          if (interactedProjectIds.includes(numId)) return;
          if (!projectScores[numId]) { projectScores[numId] = 0; projectReasons[numId] = []; }

          const explicitScore = counts.explicitMatches * explicitTechMatchWeight;
          const inferredScore = counts.inferredMatches * inferredTechMatchWeight;
          const diversityBoost = counts.explicitMatches > 0 && counts.inferredMatches > 0 ? techMatchBoost : 0;
          const totalScore = explicitScore + inferredScore + diversityBoost;
          projectScores[numId] += totalScore;

          Object.entries(counts.matchedTechs).forEach(([techId, tech]) => {
            if (explicitTechIds.includes(parseInt(techId))) {
              projectReasons[numId].push(`Uses your selected technology: ${tech.name || 'unknown'}`);
            } else {
              projectReasons[numId].push(`Uses technology you like: ${tech.name || 'unknown'}`);
            }
          });
          if (diversityBoost > 0) projectReasons[numId].push(`Matches both your selected and inferred technology preferences`);
        });
      }
    }

    if (debug) {
      console.log("🔍 Project scores after incorporating combined tag and technology preferences:", projectScores);
      const rankedProjects = Object.entries(projectScores)
        .sort((a, b) => b[1] - a[1])
        .map(([id, score]) => `Project ${id}: Score ${score.toFixed(2)}, Reasons: ${[...new Set(projectReasons[id])].join(', ')}`);
      console.log("🔍 Ranked projects with scores:", rankedProjects);
    }

    if (Object.keys(projectScores).length > 0) {
      const topProjectIds = Object.entries(projectScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => parseInt(id));

      if (debug) console.log("🔍 Top project IDs by combined score:", topProjectIds);

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
        .in('id', topProjectIds)
        .eq('webhook_active', true);

      if (error) {
        console.error('Error getting project details:', error);
        return [];
      }

      const enrichedProjects = await enrichProjectsWithTagsAndTech(projects || []);

      const recommendedProjects = enrichedProjects.map(project => {
        const projectDifficulties = Array.isArray(project.difficulty_level)
          ? project.difficulty_level.map(String)
          : [];
        const matchesDifficulty = userDifficulties.length > 0 &&
          projectDifficulties.some(d => userDifficulties.includes(d));

        if (matchesDifficulty && projectScores[project.id] !== undefined) {
          projectScores[project.id] += 1.0;
          if (!projectReasons[project.id]) projectReasons[project.id] = [];
          projectReasons[project.id].push("Matches your preferred difficulty level");
        }

        return {
          ...project,
          recommendationReason: [...new Set(projectReasons[project.id] || ["Recommended based on your preferences"])]
        };
      });

      const sortedProjects = topProjectIds
        .map(id => recommendedProjects.find(p => p.id === id))
        .filter(Boolean);

      if (debug) {
        console.log(`🔍 Final recommendations with combined approach:`);
        sortedProjects.forEach((project, i) => {
          console.log(`Recommendation #${i+1}: ${project.repo_name} (ID: ${project.id})`);
          console.log(`- Tags: ${project.tags?.join(', ') || 'none'}`);
          console.log(`- Technologies: ${project.technologies?.map(t => t.name).join(', ') || 'none'}`);
          console.log(`- Reasons: ${project.recommendationReason.join(', ')}`);
          console.log(`- Score: ${projectScores[project.id].toFixed(2)}`);
        });
      }

      if (debug) console.log(`🔍 Returning ${sortedProjects.length} recommendations using combined approach`);
      return sortedProjects;
    }

    if (debug) console.log("🔍 No tag or technology-based recommendations found with combined approach");
    return [];

  } catch (error) {
    console.error("Error in recommendation engine:", error);
    return [];
  }
}

export async function getHybridRecommendations(userId, limit = 5, debug = false, context = 'web') {
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

    // Only fetch recent recommendations if context is 'email'
    let recentlyRecommendedIds = [];
    let recentRecs = [];
    if (context === 'email') {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('user_recommendation_history')
        .select('project_id, sent_at')
        .eq('user_id', userId)
        .gte('sent_at', oneWeekAgo);

      if (error) {
        console.error("Error fetching recent recommendations:", error);
      }
      recentRecs = data || [];
      recentlyRecommendedIds = recentRecs.map(r => r.project_id);
    }

    // Check for tag preferences before falling back
    if (interactionCount === 0) {
      // Get user tag preferences
      const userTagIds = await getUserTagPreferences(userId, debug);

      if (debug) console.log(`🏷️ Found ${userTagIds.length} tag preferences for user with no interactions`);

      // If user has tag preferences, use them for recommendations
      if (userTagIds.length > 0) {
        if (debug) console.log("🏷️ Using tag preferences to recommend projects for new user");

        // Use content-based recommendations which will incorporate tag preferences
        let contentRecommendations = await getRecommendedProjects(userId, limit * 3, debug);
        if (contentRecommendations && contentRecommendations.length > 0) {
          let fresh = contentRecommendations;
          if (context === 'email') {
            // Filter out stale recommendations only for email
            fresh = contentRecommendations.filter(
              p => !recentlyRecommendedIds.includes(p.id)
            );
            if (fresh.length < limit) {
              // Not enough fresh, fill with least stale
              const stale = contentRecommendations
                .filter(p => recentlyRecommendedIds.includes(p.id))
                .slice(0, limit - fresh.length);
              fresh = fresh.concat(stale);
            }
          }
          return fresh.slice(0, limit);
        }
      }

      console.warn("No interactions or useful tag preferences found. Returning an empty array.");
      return [];
    }

    // Request MORE recommendations than needed to account for duplicates
    const bufferMultiplier = 3; // Increase buffer to ensure we have enough unique recommendations
    const requestLimit = Math.max(limit * bufferMultiplier, limit + 10);

    // Fetch content-based and collaborative recommendations with buffer
    const contentRecommendations = await getRecommendedProjects(userId, requestLimit, debug) || [];
    const collabRecommendations = await getCollaborativeRecommendations(userId, requestLimit, debug) || [];

    if (debug) {
      console.log(`🔄 Content recommendations count: ${contentRecommendations.length}`);
      console.log(`🔄 Collaborative recommendations count: ${collabRecommendations.length}`);
    }

    if (!contentRecommendations.length && !collabRecommendations.length) {
      console.warn("No recommendations found. Returning an empty array.");
      return [];
    }

    // IMPROVED APPROACH: Combine all recommendations and prioritize by quality
    const allRecommendations = [];
    const includedProjectIds = new Set();

    // Helper function to safely add unique recommendations
    const addUniqueRecommendations = (recommendations, source, weight = 1) => {
      for (const project of recommendations) {
        if (includedProjectIds.has(project.id)) continue;

        includedProjectIds.add(project.id);
        allRecommendations.push({
          ...project,
          weight: weight // Store a quality weight for sorting
        });
      }
    };

    // Add all unique recommendations with appropriate weights
    // For new users, prioritize content-based recommendations
    const contentWeight = isNewUser ? 1.2 : 1.0;
    const collabWeight = isNewUser ? 0.8 : 1.0;

    addUniqueRecommendations(contentRecommendations, 'content', contentWeight);
    addUniqueRecommendations(collabRecommendations, 'collab', collabWeight);

    let finalRecommendations = [];

    if (context === 'email') {
      // --- Filter out stale recommendations for email only ---
      let freshRecommendations = allRecommendations.filter(
        p => !recentlyRecommendedIds.includes(p.id)
      );

      if (freshRecommendations.length >= limit) {
        // Enough fresh recommendations
        finalRecommendations = freshRecommendations
          .sort((a, b) => b.weight - a.weight)
          .slice(0, limit);
      } else {
        // Not enough fresh, fill with least stale
        const staleRecommendations = allRecommendations
          .filter(p => recentlyRecommendedIds.includes(p.id))
          // Sort by how long ago they were last recommended (oldest first)
          .sort((a, b) => {
            const aRec = recentRecs?.find(r => r.project_id === a.id);
            const bRec = recentRecs?.find(r => r.project_id === b.id);
            return new Date(aRec?.sent_at || 0) - new Date(bRec?.sent_at || 0);
          });
        finalRecommendations = freshRecommendations.concat(
          staleRecommendations.slice(0, limit - freshRecommendations.length)
        );
      }
    } else {
      // For web or other contexts, do not filter out stale recommendations
      finalRecommendations = allRecommendations
        .sort((a, b) => b.weight - a.weight)
        .slice(0, limit);
    }

    if (debug) {
      console.log(`🔄 Final recommendations count: ${finalRecommendations.length}/${limit}`);
      if (finalRecommendations.length < limit) {
        console.log(`🔄 Could only find ${finalRecommendations.length} unique recommendations`);
      } else {
        console.log(`🔄 Successfully found ${limit} unique recommendations`);
      }
    }

    // Remove the weight property before returning
    return finalRecommendations.map(({ weight, ...project }) => project);
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
      .eq('webhook_active', true)
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
      .in('repo_name', topRepoIds)
      .eq('webhook_active', true);

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