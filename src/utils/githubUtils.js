import { supabase } from '@/supabaseClient';

// Helper function for Levenshtein distance calculation
function levenshteinDistance(a, b) {
  const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));
  
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,                   // deletion
        matrix[j - 1][i] + 1,                   // insertion
        matrix[j - 1][i - 1] + substitutionCost // substitution
      );
    }
  }
  
  return matrix[b.length][a.length];
}

export const extractTagsFromReadme = (readmeContent, availableTags = [], availableTechnologies = []) => {
  console.log('Extracting tags from README with fuzzy matching:');
  console.log('- README length:', readmeContent?.length || 0);
  
  if (!readmeContent) return { tags: [], technologies: [] };

  // Convert README to lowercase for case-insensitive matching
  const lowerContent = readmeContent.toLowerCase();
  
  // Extract words and phrases from the README
  const words = lowerContent.split(/[\s,.;:()\[\]{}'"<>\/\\|`~!@#$%^&*+=]+/)
    .filter(word => word.length > 2);  // Filter out short words
    
  // Generate n-grams (phrases of 2-3 words) for better matching
  const ngrams = [];
  for (let i = 0; i < words.length - 1; i++) {
    ngrams.push(words[i] + ' ' + words[i+1]);
    if (i < words.length - 2) {
      ngrams.push(words[i] + ' ' + words[i+1] + ' ' + words[i+2]);
    }
  }
  
  // All terms to check (words + n-grams)
  const terms = [...words, ...ngrams];
  
  // Function to find fuzzy matches with a threshold
  const findFuzzyMatches = (candidates, threshold = 0.25) => {
    const matches = new Map();
    
    candidates.forEach(candidate => {
      const candidateLower = candidate.toLowerCase();
      
      // Exact match has highest priority
      if (lowerContent.includes(candidateLower)) {
        matches.set(candidate, 1.0);
        return;
      }
      
      // Check individual words and n-grams for close matches
      terms.forEach(term => {
        if (Math.abs(term.length - candidateLower.length) > candidateLower.length * threshold) {
          return;
        }
        
        const distance = levenshteinDistance(term, candidateLower);
        const similarity = 1 - (distance / Math.max(term.length, candidateLower.length));
        
        // If similarity is above threshold, count it as a match
        if (similarity >= (1 - threshold)) {
          // Keep the highest similarity score if there are multiple matches
          if (!matches.has(candidate) || similarity > matches.get(candidate)) {
            matches.set(candidate, similarity);
          }
        }
      });
    });
    
    // Sort by similarity score (descending)
    return [...matches.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);
  };
  
  // Find fuzzy matches for technologies and tags
  const technologies = findFuzzyMatches(availableTechnologies);
  const tags = findFuzzyMatches(availableTags);
  
  const result = {
    technologies: [...new Set(technologies)], // Remove duplicates
    tags: [...new Set(tags)]  // Remove duplicates
  };
  
  console.log('Fuzzy matched tag suggestions:', result.tags);
  console.log('Fuzzy matched technology suggestions:', result.technologies);
  
  return result;
};

export async function fetchGitHubApi(url, options = {}) {
  try {
    const apiPath = url.replace('https://api.github.com/', '');
    
    const response = await fetch(`/api/github/${apiPath}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
      body: options.body
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GitHub API error (${response.status}):`, errorText);
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error in fetchGitHubApi:', error);
    throw error;
  }
}

export async function testGitHubAccess() {
  try {
    const userData = await fetchGitHubApi('https://api.github.com/user');
    return { 
      success: true, 
      username: userData.login 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function fetchUserRepositories() {
  try {
    const data = await fetchGitHubApi('https://api.github.com/user/repos', {
      method: 'GET'
    });
    return data;
  } catch (error) {
    console.error("Error fetching user repositories:", error);
    return [];
  }
}

export async function fetchRepositoryContent(owner, repo, path = '') {
  return fetchGitHubApi(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
}

export async function fetchRepositoryLanguages(owner, repo) {
  return fetchGitHubApi(`https://api.github.com/repos/${owner}/${repo}/languages`);
}

export const fetchAvailableTags = async () => {
  try {
    const { data, error } = await supabase
      .from('tags')
      .select('name');
    
    if (error) {
      console.error("Error fetching tags:", error);
      return [];
    }
    
    return data.map(tag => tag.name.toLowerCase());
  } catch (error) {
    console.error("Error in fetchAvailableTags:", error);
    return [];
  }
};

export const fetchAvailableTechnologies = async () => {
  try {
    const { data, error } = await supabase
      .from('technologies')
      .select('name');
    
    if (error) {
      console.error("Error fetching technologies:", error);
      return [];
    }
    
    return data.map(tech => tech.name.toLowerCase());
  } catch (error) {
    console.error("Error in fetchAvailableTechnologies:", error);
    return [];
  }
};

export const fetchRepositoryReadme = async (owner, repo) => {
  try {
    const response = await fetch(`/api/github/repos/${owner}/${repo}/readme`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    if (!response.ok) {
      console.warn(`README not found for ${owner}/${repo}`);
      return "";
    }

    // Get raw content
    const data = await response.json();
    
    // GitHub returns base64 encoded content for README
    if (data.content && data.encoding === 'base64') {
      return atob(data.content.replace(/\n/g, ''));
    }
    
    return "";
  } catch (error) {
    console.error("Error fetching repository README:", error);
    return "";
  }
};