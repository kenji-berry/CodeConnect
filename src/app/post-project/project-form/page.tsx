"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams } from 'next/navigation';
import { supabase } from "@/supabaseClient";
import "../../post-project/style.css";

interface ResourceLink {
  name: string;
  url: string;
  isValid: boolean;
}

const Page = () => {
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>([]);
  const [highlightedTechnologies, setHighlightedTechnologies] = useState<string[]>([]);
  const [descriptionOption, setDescriptionOption] = useState<string>("Use existing description");
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [projectStatus, setProjectStatus] = useState<string>("Active Development");
  const [difficulty, setDifficulty] = useState<number>(1);
  const [resourceLinks, setResourceLinks] = useState<ResourceLink[]>([]);
  const [customDescription, setCustomDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [hasRepoAccess, setHasRepoAccess] = useState<boolean>(false);

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
  };

  const handleTechnologiesChange = (technologies: string[]) => {
    setSelectedTechnologies(technologies);
  };

  const handleHighlightedTechnologiesChange = (highlighted: string[]) => {
    setHighlightedTechnologies(highlighted);
  };

  const handleDescriptionOptionChange = (option: string) => {
    setDescriptionOption(option);
  };

  const handleStatusChange = (status: string | null) => {
    setProjectStatus(status || "Active Development");
  };

  const handleDifficultyChange = (level: number) => {
    setDifficulty(level);
  };

  const descriptionOptions = ["Use existing description", "Write your Own"];

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const searchParams = useSearchParams();
  const repoName = searchParams ? searchParams.get('repo') : null;
  const owner = searchParams ? searchParams.get('owner') : null;
  
  const [repoInfo, setRepoInfo] = useState({
    owner: '',
    license: '',
    languages: {},
    size: 0,
    stars: 0,
    forks: 0,
    contributors: 0,
    openIssues: 0,
    goodFirstIssues: 0,
    pullRequests: 0,
    latestCommit: '',
  });

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const { data: { session: authSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw new Error(sessionError.message);
        setSession(authSession);
  
        const [tagsResponse, technologiesResponse] = await Promise.all([
          supabase.from('tags').select('name'),
          supabase.from('technologies').select('name')
        ]);
  
        if (tagsResponse.error) throw new Error(tagsResponse.error.message);
        const tagNames = (tagsResponse.data || [])
          .filter((tag): tag is { name: string } => tag && typeof tag.name === 'string')
          .map(tag => tag.name)
          .filter(name => name.length > 0);
        setTags(tagNames);
  
        if (technologiesResponse.error) throw new Error(technologiesResponse.error.message);
        const techNames = (technologiesResponse.data || [])
          .filter((tech): tech is { name: string } => tech && typeof tech.name === 'string')
          .map(tech => tech.name)
          .filter(name => name.length > 0);
        setTechnologies(techNames);
  
        if (repoName && owner) {
          try {
            const repoAccessResponse = await fetch(`/api/github/repos/${owner}/${repoName}/collaborators`, {
              credentials: 'include'
            });
            
            if (!repoAccessResponse.ok) {
              if (repoAccessResponse.status === 403) {
                setSubmissionError("You don't have sufficient permissions to post this repository.");
                setHasRepoAccess(false);
                return;
              } else {
                throw new Error(`GitHub API error: ${repoAccessResponse.status}`);
              }
            }
            
            setHasRepoAccess(true);

            const [
              repoResponse,
              languagesResponse,
              contributorsResponse,
              issuesResponse,
              commitsResponse
            ] = await Promise.all([
              fetch(`/api/github/repos/${owner}/${repoName}`, {
                credentials: 'include'
              }),
              fetch(`/api/github/repos/${owner}/${repoName}/languages`, {
                credentials: 'include' 
              }),
              fetch(`/api/github/repos/${owner}/${repoName}/contributors?per_page=1`, {
                credentials: 'include'
              }),
              fetch(`/api/github/repos/${owner}/${repoName}/issues?state=open`, {
                credentials: 'include'
              }),
              fetch(`/api/github/repos/${owner}/${repoName}/commits?per_page=1`, {
                credentials: 'include'
              })
            ]);
        
            if (!repoResponse.ok || !languagesResponse.ok) {
              throw new Error(`GitHub API error: ${repoResponse.status}`);
            }
            
            const [repoData, languagesData, , issuesData, commitsData] = await Promise.all([
              repoResponse.json(),
              languagesResponse.json(),
              null,
              issuesResponse.ok ? issuesResponse.json() : [],
              commitsResponse.ok ? commitsResponse.json() : [],
            ]);
        
            const contributorsCount = contributorsResponse.headers.get('link')
              ? parseInt(contributorsResponse.headers.get('link')?.match(/page=(\d+)>; rel="last"/)?.[1] || '1')
              : 1;
        
            setRepoInfo({
              owner: repoData?.owner?.login || owner,
              license: repoData?.license?.name || 'No license',
              languages: languagesData || {},
              size: repoData?.size || 0,
              stars: repoData?.stargazers_count || 0,
              forks: repoData?.forks_count || 0,
              contributors: contributorsCount || 0,
              openIssues: repoData?.open_issues_count || 0,
              goodFirstIssues: Array.isArray(issuesData) 
                ? issuesData.filter(issue => 
                  issue.labels?.some((label: { name: string; }) => label.name === 'good first issue')).length
                : 0,
              pullRequests: Array.isArray(issuesData)
                ? issuesData.filter(issue => issue.pull_request).length
                : 0,
              latestCommit: Array.isArray(commitsData) && commitsData[0]?.commit?.message 
                ? commitsData[0].commit.message 
                : 'No commits',
            });
        
            const nonRemovableTechnologies = Object.keys(languagesData || {}).map(lang => lang.toLowerCase());
            setSelectedTechnologies(nonRemovableTechnologies);
          } catch (error) {
            console.error('Error fetching GitHub repository data:', error);
            setSubmissionError(error instanceof Error 
              ? `GitHub repository fetch failed: ${error.message}`
              : 'Failed to retrieve repository data');
            setHasRepoAccess(false);
          }
        }
      } catch (error) {
        console.error('Error in fetchAllData:', error);
      }
    };
  
    fetchAllData();
  }, [repoName, owner]);

  useEffect(() => {
    const nonRemovableTechnologies = Object.keys(repoInfo.languages).map(lang => lang.toLowerCase());
    setSelectedTechnologies(nonRemovableTechnologies);
  }, [repoInfo.languages]);

  const validateSubmission = () => {
    if (!session?.user?.id) {
      throw new Error('Please sign in to submit a project');
    }
  
    if (!repoName || !owner) {
      throw new Error('Repository information is missing');
    }
    
    if (!hasRepoAccess) {
      throw new Error('You do not have permission to post this repository');
    }
  
    if (descriptionOption === "Write your Own" && !customDescription.trim()) {
      throw new Error('Custom description is required when not using GitHub description');
    }
  
    if (selectedTechnologies.length === 0) {
      throw new Error('At least one technology is required');
    }
  
    if (!projectStatus) {
      throw new Error('Project status must be selected');
    }
  
    const invalidLinks = resourceLinks.filter(link => link.url && !link.isValid);
    if (invalidLinks.length > 0) {
      throw new Error(`Invalid resource links found: ${invalidLinks.map(l => l.name).join(', ')}`);
    }
  };

  const handleSubmitProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmissionError(null);
    
    try {
      validateSubmission();
      setIsSubmitting(true);
      
      const response = await fetch('/api/projects/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          repoName,
          owner,
          description_type: descriptionOption,
          custom_description: customDescription,
          difficulty_level: difficulty,
          links: resourceLinks.filter(link => link.name && link.url && link.isValid).map(link => link.url),
          status: projectStatus,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create project');
      }
    } catch (err) {
      setSubmissionError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center">
      {/* Form content */}
    </div>
  );
};

export default Page;
