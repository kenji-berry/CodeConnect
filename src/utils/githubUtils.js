export async function fetchGitHubApi(url, options = {}) {
  try {
    const apiPath = url.replace('https://api.github.com/', '');
    console.log(`Making GitHub API request to ${apiPath}`);
    
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