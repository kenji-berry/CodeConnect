"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import { supabase } from "@/supabaseClient";
import "../../post-project/style.css";
import MultiSelector from "@/app/Components/MultiSelector";
import SingleSelector from "@/app/Components/SingleSelector";
import HighlightableMultiSelector from "@/app/Components/HighlightableMultiSelector";
import LanguageBar from "@/app/Components/LanguageBar";
import DifficultySelector from "@/app/Components/DifficultySelector";

interface ResourceLink {
  name: string;
  url: string;
  isValid: boolean;
}

function ProjectFormContent() {
  const searchParams = useSearchParams();
  const repoName = searchParams ? searchParams.get('repo') : null;
  const owner = searchParams ? searchParams.get('owner') : null;

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
  const statusOptions = [
    { value: "Active Development", tooltip: "The project is actively being worked on." },
    { value: "Maintenance", tooltip: "The project is in maintenance mode." },
    { value: "Completed", tooltip: "The project is completed and no longer actively developed." },
  ];

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

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

  const validateSubmission = async () => {
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

    // Profanity check for customDescription
    if (descriptionOption === "Write your Own") {
      const profanityResponse = await fetch('/api/check-profanity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: customDescription }),
      });
      const profanityData = await profanityResponse.json();
      if (profanityData.isProfane) {
        throw new Error('Custom description contains inappropriate language. Please revise.');
      }
    }

    // Profanity check for resource links
    for (const link of resourceLinks) {
      if (link.name.trim()) {
        const profanityResponse = await fetch('/api/check-profanity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: link.name }),
        });
        const profanityData = await profanityResponse.json();
        if (profanityData.isProfane) {
          throw new Error(`Resource link name "${link.name}" contains inappropriate language. Please revise.`);
        }
      }
    }
  };

  const handleSubmitProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmissionError(null);
    
    try {
      await validateSubmission();
      setIsSubmitting(true);
      
      // Construct the full GitHub repository URL
      const githubLink = `https://github.com/${owner}/${repoName}`;
      
      const response = await fetch('/api/projects/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          repoName,
          owner,
          github_link: githubLink,
          description_type: descriptionOption,
          custom_description: customDescription,
          difficulty_level: difficulty,
          tags: selectedTags,
          technologies: selectedTechnologies,
          highlighted_technologies: highlightedTechnologies,
          links: resourceLinks.filter(link => link.name && link.url && link.isValid).map(link => ({
            name: link.name,
            url: link.url
          })),
          status: projectStatus,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create project');
      }
      
      window.location.href = `/projects/${result.projectId}`;
      
    } catch (err) {
      setSubmissionError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center">
      <h1 className="my-1 text-4xl font-bold flex items-center group">
        <a 
          href={`https://github.com/${owner}/${repoName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 relative text-white hover:text-red-500 transition-colors duration-300"
        >
          {repoName}
          <div className="relative">
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-500 transform scale-x-0 transition-transform duration-300 group-hover:scale-x-100" />
          </div>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-6 w-6 transform transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M10 6H6a2 2  0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
            />
          </svg>
        </a>
      </h1>
      
      <form onSubmit={handleSubmitProject} className="w-full">
        <div className="bento-container w-full inria-sans-regular">
          <div className="bento-box full-width radial-background">
            <div className="flex items-center">
              <span className="mr-2 inria-sans-semibold">
                Write your own project description or use existing description?
              </span>
              <SingleSelector
                values={descriptionOptions}
                onValueChange={(value) =>
                  handleDescriptionOptionChange(value || "")
                }
                initialValue={descriptionOption}
              />
            </div>
              {descriptionOption === "Write your Own" && (
              <textarea
                name="customDescription"
                className="w-full mt-2 p-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-black resize-y min-h-[2.6rem]"
                placeholder="Write your project description here..."
                rows={3}
                style={{ resize: 'vertical' }}
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
              />
              )}
          </div>
          <div className="bento-box half-width radial-background">
            <h4>Technologies and Languages:</h4>
            <HighlightableMultiSelector
              availableTags={technologies}
              onTagsChange={(tags: string[]) => {
                // Prevent form submission when changing tags
                handleTechnologiesChange(tags);
              }}
              initialTags={selectedTechnologies}
              nonRemovableTags={Object.keys(repoInfo.languages).map(lang => lang.toLowerCase())}
              highlightedTags={highlightedTechnologies}
              onHighlightedTagsChange={(highlighted: string[]) => {
                // Prevent event propagation
                handleHighlightedTechnologiesChange(highlighted);
              }}
            />
            <LanguageBar languages={repoInfo.languages} />
          </div>
          <div className="bento-box half-width radial-background">
            <h4>Tags:</h4>
            <MultiSelector
              availableTags={tags}
              onTagsChange={handleTagsChange}
              initialTags={selectedTags}
            />
          </div>
          <div className="bento-box half-width radial-background">
            <h4>Project Status:</h4>
            <SingleSelector
              values={statusOptions.map(opt => opt.value)}
              onValueChange={handleStatusChange}
              initialValue={projectStatus}
              tooltips={Object.fromEntries(statusOptions.map(opt => [opt.value, opt.tooltip]))}
            />
          </div>
          <div className="bento-box half-width radial-background">
            <h4>Beginner Friendliness:</h4>
            <div className="mt-4 flex items-center justify-center">
              <DifficultySelector
                onDifficultyChange={handleDifficultyChange}
                initialDifficulty={difficulty}
              />
            </div>
          </div>
          <div className="bento-box full-width radial-background">
            <h4>Resource Links:</h4>
            <div className="flex flex-col gap-2 mt-2">
              {resourceLinks.map((link, index) => (
                <div key={index} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={link.name}
                      onChange={(e) => {
                        const newLinks = [...resourceLinks];
                        newLinks[index] = { ...newLinks[index], name: e.target.value };
                        setResourceLinks(newLinks);
                      }}
                      className="w-1/6 p-2 rounded-lg border border-gray-300 outline-none text-black"
                      placeholder="Resource name..."
                    />
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => {
                        const newLinks = [...resourceLinks];
                        const isValid = isValidUrl(e.target.value);
                        newLinks[index] = { 
                          ...newLinks[index], 
                          url: e.target.value,
                          isValid 
                        };
                        setResourceLinks(newLinks);
                      }}
                      className={`w-5/6 p-2 rounded-lg border ${
                        link.url && !link.isValid 
                          ? 'border-red-500' 
                          : 'border-gray-300'
                      } outline-none text-black`}
                      placeholder="Enter resource link..."
                    />
                    <button
                      onClick={() => {
                        const newLinks = resourceLinks.filter((_, i) => i !== index);
                        setResourceLinks(newLinks);
                      }}
                      className="p-2 text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                  {link.url && !link.isValid && (
                    <span className="text-red-500 text-sm ml-1">
                      Please enter a valid URL (e.g., https://example.com)
                    </span>
                  )}
                </div>
              ))}
              <button
                onClick={() => setResourceLinks([...resourceLinks, { name: '', url: '', isValid: false }])}
                className="w-fit px-4 py-2 bg-[color:--muted-red] text-white rounded-lg hover:bg-red-700 
                  transition-colors duration-200 flex items-center gap-2"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" 
                    clipRule="evenodd" 
                  />
                </svg>
                Add Resource Link
              </button>
            </div>
          </div>
        </div>
        
        {submissionError && (
          <div className="w-full max-w-2xl mx-auto mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <p className="font-medium">Error</p>
            <p>{submissionError}</p>
          </div>
        )}
        
        <div className="w-full flex justify-center mt-8 mb-12">
          <button
            type="submit"
            disabled={isSubmitting || !hasRepoAccess}
            className={`px-8 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors duration-200 
              ${isSubmitting || !hasRepoAccess
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-[color:--muted-red] hover:bg-red-700 text-white'}`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </>
            ) : !hasRepoAccess ? (
              "No Repository Access"
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Post Project
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// Main page component that provides Suspense boundary
const Page = () => {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen w-full radial-background">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
          </div>
          <h1 className="inria-sans-bold text-xl text-off-white">Loading Project Form</h1>
        </div>
      </div>
    }>
      <ProjectFormContent />
    </Suspense>
  );
};

export default Page;
