import { supabase } from '@/supabaseClient';

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

export const extractTagsFromReadme = (readmeContent, availableTags = [], availableTechnologies = []) => {
  console.log('Extracting tags from README:');
  console.log('- README length:', readmeContent?.length || 0);
  console.log('- Available tags:', availableTags);
  console.log('- Available technologies:', availableTechnologies);
  
  if (!readmeContent) return { tags: [], technologies: [] };

  // Convert README to lowercase for case-insensitive matching
  const lowerContent = readmeContent.toLowerCase();
  
  // Extract technologies that appear in the README
  const technologies = availableTechnologies.filter(tech => {
    // Use more robust regex escaping to handle special characters
    const cleanedTech = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${cleanedTech}\\b`, 'i');
    return regex.test(lowerContent);
  });
  
  // Extract tags that appear in the README
  const tags = availableTags.filter(tag => {
    // Use more robust regex escaping to handle special characters
    const cleanedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${cleanedTag}\\b`, 'i');
    return regex.test(lowerContent);
  });
  
  const result = {
    technologies: [...new Set(technologies)], // Remove duplicates
    tags: [...new Set(tags)]  // Remove duplicates
  };
  
  console.log('Extracted tag suggestions:', result.tags);
  console.log('Extracted technology suggestions:', result.technologies);
  
  return result;
};