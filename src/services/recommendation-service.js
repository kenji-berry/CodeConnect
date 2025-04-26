import { supabase } from '@/supabaseClient';

export async function trackProjectView(userId, projectId) {
  try {
    const numericProjectId = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
    if (isNaN(numericProjectId)) {
      console.error('Invalid projectId for trackProjectView:', projectId);
      return { data: null, error: new Error('Invalid project ID') };
    }

    console.log('Tracking view:', { userId, projectId: numericProjectId });

    const { data, error } = await supabase
      .from('user_interactions')
      .upsert({
        user_id: userId,
        project_id: numericProjectId,
        interaction_type: 'view',
        timestamp: new Date().toISOString()
      }, {
        onConflict: 'user_id,project_id,interaction_type',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Error tracking project view:', error);
    } else {
      console.log('Successfully tracked view for project_id:', numericProjectId);
    }

    return { data, error };
  } catch (e) {
    console.error('Exception in trackProjectView:', e);
    return { data: null, error: e };
  }
}

export async function trackProjectLike(userId, projectId) {
  try {
    const numericProjectId = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
    if (isNaN(numericProjectId)) {
      console.error('Invalid projectId for trackProjectLike:', projectId);
      return { data: null, error: new Error('Invalid project ID') };
    }

    console.log('Tracking like:', { userId, projectId: numericProjectId });

    const { data, error } = await supabase
      .from('user_interactions')
      .upsert({
        user_id: userId,
        project_id: numericProjectId,
        interaction_type: 'like',
        timestamp: new Date().toISOString()
      }, {
        onConflict: 'user_id,project_id,interaction_type',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Error tracking project like:', error);
    } else {
      console.log('Successfully tracked like for project_id:', numericProjectId);
    }

    return { data, error };
  } catch (e) {
    console.error('Exception in trackProjectLike:', e);
    return { data: null, error: e };
  }
}

export async function removeProjectLike(userId, projectId) {
  try {
    const numericProjectId = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
    if (isNaN(numericProjectId)) {
      console.error('Invalid projectId for removeProjectLike:', projectId);
      return { data: null, error: new Error('Invalid project ID') };
    }

    console.log('Removing like:', { userId, projectId: numericProjectId });

    const { data, error } = await supabase
      .from('user_interactions')
      .delete()
      .match({
        user_id: userId,
        project_id: numericProjectId,
        interaction_type: 'like'
      });

    if (error) {
      console.error('Error removing project like:', error);
    } else {
      console.log('Successfully removed like for project_id:', numericProjectId);
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
    .select('project_id, interaction_type')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user interactions:', error);
    return [];
  }

  return (data || []).map(interaction => ({
    ...interaction,
    project_id: typeof interaction.project_id === 'string'
      ? parseInt(interaction.project_id, 10)
      : interaction.project_id
  })).filter(interaction => !isNaN(interaction.project_id));
}

/**
 * Calculate interaction scores for projects based on project_id
 * Like = 1 point, View = 0.5 points
 * @param {string} userId - The user ID to calculate scores for
 * @returns {Object} - Dictionary of scores by project ID
 */
async function calculateInteractionScores(userId) {
  const interactions = await getUserInteractions(userId);
  const scores = {};

  interactions.forEach(interaction => {
    const { project_id, interaction_type } = interaction;

    if (!scores[project_id]) {
      scores[project_id] = 0;
    }

    if (interaction_type === 'like') {
      scores[project_id] += 1;
    } else if (interaction_type === 'view') {
      scores[project_id] += 0.5;
    }
  });

  return scores;
}

async function getUserPreferredTags(userId, debug = false) {
  const interactions = await getUserInteractions(userId);
  if (debug) console.log(`🏷️ [getUserPreferredTags] Found ${interactions.length} interactions for user ${userId}`);

  const interactedProjectIds = [...new Set(interactions.map(i => i.project_id))].filter(id => !isNaN(id));

  if (debug) console.log(`🏷️ [getUserPreferredTags] Extracted ${interactedProjectIds.length} unique project IDs:`, interactedProjectIds);

  if (interactedProjectIds.length === 0) {
    if (debug) console.log(`🏷️ [getUserPreferredTags] No projects interacted with, returning empty array`);
    return [];
  }

  const { data: tagAssociations, error: tagError } = await supabase
    .from('project_tags')
    .select(`
      project_id,
      tags (
        id,
        name
      )
    `)
    .in('project_id', interactedProjectIds);

  if (tagError || !tagAssociations) {
    console.error('Error getting tag preferences:', tagError);
    if (debug) console.log(`🏷️ [getUserPreferredTags] Failed to retrieve tag associations`);
    return [];
  }

  if (debug) {
    const tagsByProject = {};
    tagAssociations.forEach(ta => {
      if (!tagsByProject[ta.project_id]) tagsByProject[ta.project_id] = [];
      if (ta.tags?.name) tagsByProject[ta.project_id].push(ta.tags.name);
    });
    console.log(`🏷️ [getUserPreferredTags] Found tag associations by project ID:`);
    Object.entries(tagsByProject).forEach(([projectId, tags]) => {
      console.log(`  - Project ${projectId}: ${tags.join(', ')}`);
    });
  }

  const tags = tagAssociations.map(ta => ta.tags?.name).filter(Boolean);
  const uniqueTags = [...new Set(tags)];

  if (debug) console.log(`🏷️ [getUserPreferredTags] Inferred ${uniqueTags.length} unique preferred tags:`, uniqueTags.join(', '));
  return uniqueTags;
}

async function getUserPreferredTechnologies(userId, debug = false) {
  const interactions = await getUserInteractions(userId);
  if (debug) console.log(`💻 [getUserPreferredTechnologies] Found ${interactions.length} interactions for user ${userId}`);

  const interactedProjectIds = [...new Set(interactions.map(i => i.project_id))].filter(id => !isNaN(id));
  if (debug) console.log(`💻 [getUserPreferredTechnologies] Extracted ${interactedProjectIds.length} unique project IDs:`, interactedProjectIds);

  if (interactedProjectIds.length === 0) {
    if (debug) console.log(`💻 [getUserPreferredTechnologies] No projects interacted with, returning empty array`);
    return [];
  }

  const { data: techAssociations, error: techError } = await supabase
    .from('project_technologies')
    .select(`
      project_id,
      technologies (
        id,
        name
      )
    `)
    .in('project_id', interactedProjectIds);

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
    console.log(`💻 [getUserPreferredTechnologies] Found technology associations by project ID:`);
    Object.entries(techsByProject).forEach(([projectId, techs]) => {
      console.log(`  - Project ${projectId}: ${techs.join(', ')}`);
    });
  }

  const techs = techAssociations.map(ta => ta.technologies?.name).filter(Boolean);
  const uniqueTechs = [...new Set(techs)];

  if (debug) console.log(`💻 [getUserPreferredTechnologies] Inferred ${uniqueTechs.length} unique preferred technologies:`, uniqueTechs.join(', '));
  return uniqueTechs;
}

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

export async function getRecommendedProjects(userId, limit = 5, debug = false) {
  try {
    if (debug) console.log("🔍 Starting content-based recommendation process for user:", userId);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('difficulty_level')
      .eq('user_id', userId)
      .maybeSingle();
    const userDifficulties = Array.isArray(profile?.difficulty_level) ? profile.difficulty_level.map(String) : [];
    if (debug) console.log("🔍 User difficulty preferences:", userDifficulties);

    const interactions = await getUserInteractions(userId);
    const interactionCount = interactions?.length || 0;
    const hasLimitedInteractions = interactionCount < 3;
    if (debug) console.log(`🔍 Found ${interactionCount} interactions for the user. Limited interactions: ${hasLimitedInteractions}`);

    const interactedProjectIds = [...new Set(interactions.map(i => i.project_id))].filter(id => !isNaN(id));
    if (debug) console.log("🔍 User has interacted with project IDs:", interactedProjectIds);

    const projectScores = {};
    const projectReasons = {};

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
          const numProjectId = typeof item.project_id === 'string' ? parseInt(item.project_id, 10) : item.project_id;
          if (isNaN(numProjectId)) return;

          if (!projectTagCounts[numProjectId]) {
            projectTagCounts[numProjectId] = { explicitMatches: 0, inferredMatches: 0, matchedTags: {} };
          }
          if (explicitTagIds.includes(item.tag_id)) {
            projectTagCounts[numProjectId].explicitMatches++;
            projectTagCounts[numProjectId].matchedTags[item.tag_id] = { name: item.tags?.name, type: 'explicit' };
          }
          if (inferredTagIds.includes(item.tag_id)) {
            projectTagCounts[numProjectId].inferredMatches++;
            if (!projectTagCounts[numProjectId].matchedTags[item.tag_id]) {
               projectTagCounts[numProjectId].matchedTags[item.tag_id] = { name: item.tags?.name, type: 'inferred' };
            }
          }
        });

        Object.entries(projectTagCounts).forEach(([projectIdStr, counts]) => {
          const numId = parseInt(projectIdStr);
          if (interactedProjectIds.includes(numId)) return;
          if (!projectScores[numId]) { projectScores[numId] = 0; projectReasons[numId] = []; }

          const explicitScore = counts.explicitMatches * explicitTagMatchWeight;
          const inferredScore = counts.inferredMatches * inferredTagMatchWeight;
          const diversityBoost = counts.explicitMatches > 0 && counts.inferredMatches > 0 ? tagMatchBoost : 0;
          const totalScore = explicitScore + inferredScore + diversityBoost;
          projectScores[numId] += totalScore;

          Object.entries(counts.matchedTags).forEach(([tagId, tag]) => {
            if (tag.type === 'explicit') {
              projectReasons[numId].push(`Matches your selected tag: ${tag.name || 'unknown'}`);
            } else {
              projectReasons[numId].push(`Similar to tags you like: ${tag.name || 'unknown'}`);
            }
          });
          if (diversityBoost > 0) projectReasons[numId].push(`Matches both your selected and inferred tag preferences`);
        });
      }
    }

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
          const numProjectId = typeof item.project_id === 'string' ? parseInt(item.project_id, 10) : item.project_id;
          if (isNaN(numProjectId)) return;

          if (!projectTechCounts[numProjectId]) {
            projectTechCounts[numProjectId] = { explicitMatches: 0, inferredMatches: 0, matchedTechs: {} };
          }
          if (explicitTechIds.includes(item.technology_id)) {
            projectTechCounts[numProjectId].explicitMatches++;
            projectTechCounts[numProjectId].matchedTechs[item.technology_id] = { name: item.technologies?.name, type: 'explicit' };
          }
          if (inferredTechIds.includes(item.technology_id)) {
            projectTechCounts[numProjectId].inferredMatches++;
             if (!projectTechCounts[numProjectId].matchedTechs[item.technology_id]) {
               projectTechCounts[numProjectId].matchedTechs[item.technology_id] = { name: item.technologies?.name, type: 'inferred' };
            }
          }
        });

        Object.entries(projectTechCounts).forEach(([projectIdStr, counts]) => {
          const numId = parseInt(projectIdStr);
          if (interactedProjectIds.includes(numId)) return;
          if (!projectScores[numId]) { projectScores[numId] = 0; projectReasons[numId] = []; }

          const explicitScore = counts.explicitMatches * explicitTechMatchWeight;
          const inferredScore = counts.inferredMatches * inferredTechMatchWeight;
          const diversityBoost = counts.explicitMatches > 0 && counts.inferredMatches > 0 ? techMatchBoost : 0;
          const totalScore = explicitScore + inferredScore + diversityBoost;
          projectScores[numId] += totalScore;

          Object.entries(counts.matchedTechs).forEach(([techId, tech]) => {
             if (tech.type === 'explicit') {
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
      const rankedProjectsLog = Object.entries(projectScores)
        .sort((a, b) => b[1] - a[1])
        .map(([id, score]) => `Project ${id}: Score ${score.toFixed(2)}, Reasons: ${[...new Set(projectReasons[id] || [])].join(', ')}`);
      console.log("🔍 Ranked projects with scores:", rankedProjectsLog);
    }

    if (Object.keys(projectScores).length > 0) {
      const topProjectIds = Object.entries(projectScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit * 2)
        .map(([id]) => parseInt(id));

      if (debug) console.log("🔍 Top project IDs by combined score (pre-difficulty filter):", topProjectIds);

      const { data: projects, error } = await supabase
        .from('project')
        .select(`
          id, repo_name, repo_owner, description_type, custom_description,
          difficulty_level, created_at, status
        `)
        .in('id', topProjectIds)
        .eq('webhook_active', true);

      if (error) {
        console.error('Error getting project details:', error);
        return [];
      }

      const enrichedProjects = await enrichProjectsWithTagsAndTech(projects || []);

      const recommendedProjects = enrichedProjects.map(project => {
        const projectDifficulties = Array.isArray(project.difficulty_level) ? project.difficulty_level.map(String) : [];
        const matchesDifficulty = userDifficulties.length === 0 || projectDifficulties.some(d => userDifficulties.includes(d));

        let scoreBoost = 0;
        let difficultyReason = "";

        if (matchesDifficulty && userDifficulties.length > 0) {
           scoreBoost = 1.0;
           difficultyReason = "Matches your preferred difficulty level";
        }

        if (projectScores[project.id] !== undefined) {
          projectScores[project.id] += scoreBoost;
        }
        if (!projectReasons[project.id]) projectReasons[project.id] = [];
        if (difficultyReason) projectReasons[project.id].push(difficultyReason);


        return {
          ...project,
          recommendationReason: [...new Set(projectReasons[project.id] || ["Recommended based on your preferences"])]
        };
      });

       const sortedProjects = recommendedProjects
         .sort((a, b) => (projectScores[b.id] || 0) - (projectScores[a.id] || 0))
         .slice(0, limit);


      if (debug) {
        console.log(`🔍 Final content-based recommendations:`);
        sortedProjects.forEach((project, i) => {
          console.log(`Recommendation #${i+1}: ${project.repo_name} (ID: ${project.id})`);
          console.log(`- Tags: ${project.tags?.join(', ') || 'none'}`);
          console.log(`- Technologies: ${project.technologies?.map(t => t.name).join(', ') || 'none'}`);
          console.log(`- Reasons: ${project.recommendationReason.join(', ')}`);
          console.log(`- Score: ${(projectScores[project.id] || 0).toFixed(2)}`);
        });
      }

      if (debug) console.log(`🔍 Returning ${sortedProjects.length} content-based recommendations`);
      return sortedProjects;
    }

    if (debug) console.log("🔍 No content-based recommendations found");
    return [];

  } catch (error) {
    console.error("Error in content-based recommendation engine:", error);
    return [];
  }
}


export async function getCollaborativeRecommendations(userId, limit = 5, debug = false) {
  try {
    if (debug) console.log("👥 Starting collaborative filtering for user:", userId);

    const userInteractions = await getUserInteractions(userId);
    if (!userInteractions || userInteractions.length === 0) {
      if (debug) console.log("👥 No interactions found for collaborative filtering");
      return [];
    }

    const interactedProjectIds = [...new Set(userInteractions.map(i => i.project_id))].filter(id => !isNaN(id));
    if (debug) console.log("👥 User has interacted with project IDs:", interactedProjectIds);

    const { data: similarUserInteractions, error: similarUserError } = await supabase
      .from('user_interactions')
      .select('user_id, project_id, interaction_type')
      .in('project_id', interactedProjectIds)
      .neq('user_id', userId);

    if (similarUserError || !similarUserInteractions || similarUserInteractions.length === 0) {
      if (debug) console.log("👥 No similar users found based on project interactions");
      return [];
    }

    const userSimilarityMap = {};
    const userLikes = new Set(userInteractions.filter(i => i.interaction_type === 'like').map(i => i.project_id));

    similarUserInteractions.forEach(interaction => {
       const numProjectId = typeof interaction.project_id === 'string' ? parseInt(interaction.project_id, 10) : interaction.project_id;
       if (isNaN(numProjectId)) return;

      if (!userSimilarityMap[interaction.user_id]) {
        userSimilarityMap[interaction.user_id] = {
          commonProjects: new Set(),
          interactionMap: {}
        };
      }
      userSimilarityMap[interaction.user_id].commonProjects.add(numProjectId);
      userSimilarityMap[interaction.user_id].interactionMap[numProjectId] = interaction.interaction_type;
    });

    Object.keys(userSimilarityMap).forEach(simUserId => {
      const commonProjects = userSimilarityMap[simUserId].commonProjects;
      const interactionMap = userSimilarityMap[simUserId].interactionMap;

      const minOverlapThreshold = Math.max(2, Math.ceil(interactedProjectIds.length * 0.3));
      if (commonProjects.size < minOverlapThreshold) {
        delete userSimilarityMap[simUserId];
        return;
      }

      let intersectionWeight = 0;
      commonProjects.forEach(projectId => {
        if (userLikes.has(projectId) && interactionMap[projectId] === 'like') intersectionWeight += 2.0;
        else if (userLikes.has(projectId) || interactionMap[projectId] === 'like') intersectionWeight += 1.0;
        else intersectionWeight += 0.5;
      });

      const approxTotalUnique = new Set([...interactedProjectIds, ...Array.from(commonProjects)]).size;
      const similarityScore = intersectionWeight / approxTotalUnique;

      if (similarityScore >= 0.15) {
        userSimilarityMap[simUserId].similarityScore = similarityScore;
      } else {
        delete userSimilarityMap[simUserId];
      }
    });

    const similarUsers = Object.entries(userSimilarityMap)
      .sort((a, b) => b[1].similarityScore - a[1].similarityScore)
      .slice(0, 10)
      .map(([userId]) => userId);

    if (debug && Object.keys(userSimilarityMap).length > 0) {
       console.log("👥 Found similar users with similarity scores:",
        Object.entries(userSimilarityMap)
          .map(([id, data]) => `${id}: ${data.similarityScore?.toFixed(2)}`)
          .join(', ')
      );
    } else if (debug) {
       console.log("👥 No sufficiently similar users found after quality filtering");
    }

    if (similarUsers.length === 0) {
      if (debug) console.log("👥 No sufficiently similar users found");
      return [];
    }

    const { data: recommendations, error: recError } = await supabase
      .from('user_interactions')
      .select('project_id, interaction_type, user_id')
      .in('user_id', similarUsers)
      .not('project_id', 'in', `(${interactedProjectIds.join(',')})`);

    if (recError || !recommendations || recommendations.length === 0) {
       if (debug) console.log("👥 No project recommendations found from similar users or error:", recError);
       return [];
    }
    if (debug) console.log(`👥 Found ${recommendations.length} potential recommendations from similar users`);

    const scoreByProjectId = {};
    recommendations.forEach(item => {
       const numProjectId = typeof item.project_id === 'string' ? parseInt(item.project_id, 10) : item.project_id;
       if (isNaN(numProjectId) || !userSimilarityMap[item.user_id]) return;

      if (!scoreByProjectId[numProjectId]) {
        scoreByProjectId[numProjectId] = 0;
      }
      const interactionWeight = item.interaction_type === 'like' ? 2 : 0.5;
      const similarityWeight = userSimilarityMap[item.user_id].similarityScore;
      scoreByProjectId[numProjectId] += interactionWeight * similarityWeight;
    });

    const topProjectIds = Object.entries(scoreByProjectId)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([projectId]) => parseInt(projectId));

    if (debug) console.log("👥 Top collaborative project IDs with scores:",
      Object.entries(scoreByProjectId)
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.min(5, Object.entries(scoreByProjectId).length))
        .map(([id, score]) => `${id}: ${score.toFixed(2)}`)
        .join(', ')
    );

    if (topProjectIds.length === 0) {
      if (debug) console.log("👥 No top recommendations found after scoring");
      return [];
    }

    const { data: projects, error: projectsError } = await supabase
      .from('project')
      .select(`
        id, repo_name, repo_owner, description_type, custom_description,
        difficulty_level, created_at, status
      `)
      .in('id', topProjectIds)
      .eq('webhook_active', true);

    if (projectsError || !projects || projects.length === 0) {
      if (debug) console.log("👥 Error getting project details for collaborative recs:", projectsError);
      return [];
    }

    const enrichedProjects = await enrichProjectsWithTagsAndTech(projects);
    return enrichedProjects.map(project => ({
      ...project,
      recommendationReason: ["People with similar interests liked this project"]
    }));

  } catch (error) {
    console.error("Error in collaborative filtering:", error);
    return [];
  }
}


export async function getHybridRecommendations(userId, limit = 5, debug = false, context = 'web') {
  try {
    if (debug) console.log("🔄 Starting hybrid recommendation process");

    const interactions = await getUserInteractions(userId);
    const interactionCount = interactions?.length || 0;
    const isNewUser = interactionCount < 5;
    if (debug) console.log(`🔄 User interaction count: ${interactionCount}, isNewUser: ${isNewUser}`);

    let recentlyRecommendedIds = [];
    let recentRecs = [];
    if (context === 'email') {
       const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('user_recommendation_history')
        .select('project_id, sent_at')
        .eq('user_id', userId)
        .gte('sent_at', oneWeekAgo);

      if (error) console.error("Error fetching recent recommendations:", error);
      recentRecs = data || [];
      recentlyRecommendedIds = recentRecs.map(r => r.project_id).filter(id => !isNaN(id));
    }

    if (interactionCount === 0) {
       const userTagIds = await getUserTagPreferences(userId, debug);
       const userTechIds = await getUserTechnologyPreferences(userId, debug);
       if (userTagIds.length > 0 || userTechIds.length > 0) {
         if (debug) console.log("🔄 New user with explicit preferences, using content-based");
         let contentRecommendations = await getRecommendedProjects(userId, limit * 3, debug);
         if (contentRecommendations && contentRecommendations.length > 0) {
           let fresh = contentRecommendations;
           if (context === 'email') {
             fresh = contentRecommendations.filter(p => !recentlyRecommendedIds.includes(p.id));
             if (fresh.length < limit) {
               const stale = contentRecommendations
                 .filter(p => recentlyRecommendedIds.includes(p.id))
                 .slice(0, limit - fresh.length);
               fresh = fresh.concat(stale);
             }
           }
           return fresh.slice(0, limit);
         }
       }
       console.warn("No interactions or useful explicit preferences found. Returning empty array.");
       return [];
    }


    const requestLimit = Math.max(limit * 3, limit + 10);
    const contentRecommendations = await getRecommendedProjects(userId, requestLimit, debug) || [];
    const collabRecommendations = await getCollaborativeRecommendations(userId, requestLimit, debug) || [];

    if (debug) {
      console.log(`🔄 Content recommendations count: ${contentRecommendations.length}`);
      console.log(`🔄 Collaborative recommendations count: ${collabRecommendations.length}`);
    }
    if (!contentRecommendations.length && !collabRecommendations.length) {
      console.warn("No recommendations found from either method. Returning empty array.");
      return [];
    }

    const allRecommendations = [];
    const includedProjectIds = new Set();
    const addUniqueRecommendations = (recommendations, source, weight = 1) => {
      for (const project of recommendations) {
        if (isNaN(project.id) || includedProjectIds.has(project.id)) continue;
        includedProjectIds.add(project.id);
        allRecommendations.push({ ...project, weight });
      }
    };

    const contentWeight = isNewUser ? 1.2 : 1.0;
    const collabWeight = isNewUser ? 0.8 : 1.0;
    addUniqueRecommendations(contentRecommendations, 'content', contentWeight);
    addUniqueRecommendations(collabRecommendations, 'collab', collabWeight);

    let finalRecommendations = [];
    if (context === 'email') {
      let freshRecommendations = allRecommendations.filter(p => !recentlyRecommendedIds.includes(p.id));
      if (freshRecommendations.length >= limit) {
        finalRecommendations = freshRecommendations.sort((a, b) => b.weight - a.weight).slice(0, limit);
      } else {
        const staleRecommendations = allRecommendations
          .filter(p => recentlyRecommendedIds.includes(p.id))
          .sort((a, b) => {
            const aRec = recentRecs?.find(r => r.project_id === a.id);
            const bRec = recentRecs?.find(r => r.project_id === b.id);
            return new Date(aRec?.sent_at || 0) - new Date(bRec?.sent_at || 0);
          });
        finalRecommendations = freshRecommendations.concat(staleRecommendations.slice(0, limit - freshRecommendations.length));
      }
    } else {
      finalRecommendations = allRecommendations.sort((a, b) => b.weight - a.weight).slice(0, limit);
    }

    if (debug) {
      console.log(`🔄 Final recommendations count: ${finalRecommendations.length}/${limit}`);
      if (finalRecommendations.length < limit) console.log(`🔄 Could only find ${finalRecommendations.length} unique recommendations`);
      else console.log(`🔄 Successfully found ${limit} unique recommendations`);
    }

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
        id, repo_name, repo_owner, description_type, custom_description,
        difficulty_level, created_at, status
      `)
      .order('created_at', { ascending: false })
      .eq('webhook_active', true)
      .limit(limit);

    if (error) {
      console.error('Error getting recent projects:', error);
      return [];
    }
    return await enrichProjectsWithTagsAndTech(projects || []);
  } catch (error) {
    console.error('Error getting recent projects:', error);
    return [];
  }
}

async function enrichProjectsWithTagsAndTech(projects) {
  if (!projects || !projects.length) return [];

  const projectIds = projects.map(p => p.id).filter(id => !isNaN(id));
  if (projectIds.length === 0) return projects;

  const [techRes, tagRes] = await Promise.all([
    supabase.from('project_technologies').select(`project_id, technologies (name), is_highlighted`).in('project_id', projectIds),
    supabase.from('project_tags').select(`project_id, tags:tag_id(name)`).in('project_id', projectIds)
  ]);

  const techsByProjectId = (techRes.data || []).reduce((acc, item) => {
    if (!acc[item.project_id]) acc[item.project_id] = [];
    if (item.technologies) {
       acc[item.project_id].push({ name: item.technologies.name, is_highlighted: item.is_highlighted });
    }
    return acc;
  }, {});

  const tagsByProjectId = (tagRes.data || []).reduce((acc, item) => {
    if (!acc[item.project_id]) acc[item.project_id] = [];
     if (item.tags) {
       acc[item.project_id].push(item.tags.name);
     }
    return acc;
  }, {});

  return projects.map(project => ({
    ...project,
    technologies: techsByProjectId[project.id] || [],
    tags: tagsByProjectId[project.id] || []
  }));
}