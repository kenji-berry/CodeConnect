"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams } from 'next/navigation';
import { supabase } from "@/supabaseClient";
import "../../post-project/style.css";
import MultiSelector from "../../Components/MultiSelector";
import SingleSelector from "../../Components/SingleSelector";
import ActivityGraph from "../../Components/ActivityGraph";
import LanguageBar from "../../Components/LanguageBar";
import DifficultySelector from "../../Components/DifficultySelector";
import HighlightableMultiSelector from "../../Components/HighlightableMultiSelector";

const statusOptions = [
  {
    value: "Active Development",
    tooltip: "Project is being actively developed with regular updates"
  },
  {
    value: "Stable/Maintenance",
    tooltip: "Project is complete and stable, receiving occasional updates"
  },
  {
    value: "Seeking Contributors",
    tooltip: "Project is actively looking for new contributors"
  },
  {
    value: "Early Stage/Experimental",
    tooltip: "Project is in its early phases with potential for significant changes"
  }
];

interface ResourceLink {
  name: string;
  url: string;
  isValid: boolean;
}

const getReadableError = (error: Error): string => {
  const errorMessage = error.message.toLowerCase();
  
  // Handle specific database errors
  if (errorMessage.includes('unique_repo_name_owner')) {
    return 'This repository has already been posted on the platform.';
  }
  
  if (errorMessage.includes('foreign key constraint')) {
    return 'Invalid reference to associated data. Please check your selections.';
  }

  // Handle specific validation errors
  if (errorMessage.includes('sign in')) {
    return 'Please sign in to submit a project.';
  }

  if (errorMessage.includes('repository information')) {
    return 'Please provide both repository name and owner.';
  }

  if (errorMessage.includes('custom description')) {
    return 'Please provide a description for your project.';
  }

  if (errorMessage.includes('technology')) {
    if (errorMessage.includes('failed to find technology')) {
      return 'One or more selected technologies are not available in our system.';
    }
    return 'Please select at least one technology for your project.';
  }

  if (errorMessage.includes('tag')) {
    if (errorMessage.includes('failed to find tag')) {
      return 'One or more selected tags are not available in our system.';
    }
    return 'Error processing project tags. Please try different tags.';
  }

  if (errorMessage.includes('invalid resource links')) {
    return 'Please ensure all resource links are valid URLs.';
  }

  // Default error message
  return 'An unexpected error occurred. Please try again later.';
};

const Page = () => {
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>([]);
  const [highlightedTechnologies, setHighlightedTechnologies] = useState<string[]>([]);
  const [descriptionOption, setDescriptionOption] = useState<string>("Use existing description");
  const [session, setSession] = useState<any>(null);
  const [projectStatus, setProjectStatus] = useState<string>("Active Development");
  const [difficulty, setDifficulty] = useState<number>(1);
  const [resourceLinks, setResourceLinks] = useState<ResourceLink[]>([]);
  const [customDescription, setCustomDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
  };

  const handleTechnologiesChange = (technologies: string[]) => {
    setSelectedTechnologies(technologies);
  };

  const handleHighlightedTechnologiesChange = (highlighted: string[]) => {
    // Prevent default form submission behavior
    setHighlightedTechnologies(highlighted);
  };

  const handleDescriptionOptionChange = (option: string) => {
    setDescriptionOption(option);
  };

  const handleStatusChange = (status: string | null) => {
    setProjectStatus(status);
  };

  const handleDifficultyChange = (level: number) => {
    console.log(level)
    setDifficulty(level);
  };

  const descriptionOptions = ["Use existing description", "Write your Own"];

  const printDescription = () => {
    console.log(descriptionOption);
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const searchParams = useSearchParams();
  const repoName = searchParams.get('repo');
  const owner = searchParams.get('owner');
  
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
        // 1. Fetch session
        const { data: { session: authSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw new Error(sessionError.message);
        setSession(authSession);
  
        // 2. Parallel fetch for tags and technologies
        const [tagsResponse, technologiesResponse] = await Promise.all([
          supabase.from('project_tag').select('name'),
          supabase.from('technologies').select('name')
        ]);
  
        // Handle tags response
        if (tagsResponse.error) throw new Error(tagsResponse.error.message);
        const tagNames = (tagsResponse.data || [])
          .filter((tag): tag is { name: string } => tag && typeof tag.name === 'string')
          .map(tag => tag.name)
          .filter(name => name.length > 0);
        setTags(tagNames);
        console.log('Fetched tags:', tagNames);
  
        // Handle technologies response
        if (technologiesResponse.error) throw new Error(technologiesResponse.error.message);
        const techNames = (technologiesResponse.data || [])
          .filter((tech): tech is { name: string } => tech && typeof tech.name === 'string')
          .map(tech => tech.name)
          .filter(name => name.length > 0);
        setTechnologies(techNames);
        console.log('Fetched technologies:', techNames);
  
        // 3. Fetch GitHub repo data if we have repo name, owner, and token
        if (repoName && owner && authSession?.provider_token) {
          const [
            repoResponse,
            languagesResponse,
            contributorsResponse,
            issuesResponse,
            commitsResponse
          ] = await Promise.all([
            fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
              headers: { Authorization: `Bearer ${authSession.provider_token}` },
            }),
            fetch(`https://api.github.com/repos/${owner}/${repoName}/languages`, {
              headers: { Authorization: `Bearer ${authSession.provider_token}` },
            }),
            fetch(`https://api.github.com/repos/${owner}/${repoName}/contributors?per_page=1`, {
              headers: { Authorization: `Bearer ${authSession.provider_token}` },
            }),
            fetch(`https://api.github.com/repos/${owner}/${repoName}/issues?state=open`, {
              headers: { Authorization: `Bearer ${authSession.provider_token}` },
            }),
            fetch(`https://api.github.com/repos/${owner}/${repoName}/commits?per_page=1`, {
              headers: { Authorization: `Bearer ${authSession.provider_token}` },
            })
          ]);
  
          const [repoData, languagesData, , issuesData, commitsData] = await Promise.all([
            repoResponse.json(),
            languagesResponse.json(),
            null, // placeholder for contributorsResponse
            issuesResponse.json(),
            commitsResponse.json(),
          ]);
  
          const contributorsCount = contributorsResponse.headers.get('link')
            ? parseInt(contributorsResponse.headers.get('link')?.match(/page=(\d+)>; rel="last"/)?.[1] || '1')
            : 1;
  
          setRepoInfo({
            owner: repoData.owner.login,
            license: repoData.license?.name || 'No license',
            languages: languagesData,
            size: repoData.size,
            stars: repoData.stargazers_count,
            forks: repoData.forks_count,
            contributors: contributorsCount,
            openIssues: repoData.open_issues_count,
            goodFirstIssues: issuesData.filter(issue => 
              issue.labels.some(label => label.name === 'good first issue')).length,
            pullRequests: issuesData.filter(issue => 'pull_request' in issue).length,
            latestCommit: commitsData[0]?.commit?.message || 'No commits',
          });

          const nonRemovableTechnologies = Object.keys(languagesData).map(lang => lang.toLowerCase());
          console.log(nonRemovableTechnologies);
          setSelectedTechnologies(nonRemovableTechnologies);
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


  function printstuff(){
    console.log(highlightedTechnologies)
  }

  const handleSubmitProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  
    // Reset error state
    setSubmissionError(null);
  
    const validateSubmission = () => {
      if (!session?.user?.id) {
        throw new Error('Please sign in to submit a project');
      }
    
      if (!repoName || !owner) {
        throw new Error('Repository information is missing');
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
  
    try {
      validateSubmission();
      setIsSubmitting(true);
  
      // Session check with more detailed error
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('Authentication required: Please sign in to submit a project');
      }
  
      // Validate project data
      if (!repoName || !owner) {
        throw new Error('Missing repository information: Repository name and owner are required');
      }
  
      // Check technologies
      if (selectedTechnologies.length === 0) {
        throw new Error('At least one technology must be selected');
      }
  
      // Insert project with detailed error logging
      const { data: project, error: projectError } = await supabase
        .from('project')
        .insert({
          repo_name: repoName,
          repo_owner: owner,
          description_type: descriptionOption,
          custom_description: customDescription,
          difficulty_level: difficulty,
          user_id: session.user.id,
          repo_name_owner: `${repoName}_${owner}`,
          links: resourceLinks.filter(link => link.name && link.url && link.isValid).map(link => link.url),
          status: projectStatus // Add this line to store status directly
        })
        .select('id')
        .single();
  
      if (projectError) {
        console.error('Project insertion error:', projectError);
        throw new Error(`Project insertion failed: ${projectError.message}`);
      }
  
      if (!project?.id) {
        throw new Error('Project created but no ID returned');
      }
  
      // Log successful project creation
      console.log('Project created with ID:', project.id);
  
      // Technologies insertion with validation
      if (selectedTechnologies.length > 0) {
        try {
          // First get technology IDs from the technologies table
          const techPromises = selectedTechnologies.map(async techName => {
            const { data: techData, error: techLookupError } = await supabase
              .from('technologies')
              .select('id')
              .eq('name', techName.toLowerCase())
              .single();
      
            if (techLookupError) {
              throw new Error(`Failed to find technology "${techName}": ${techLookupError.message}`);
            }
      
            return {
              project_id: project.id,
              technology_id: techData.id,
              is_highlighted: highlightedTechnologies.includes(techName)
            };
          });
      
          const techRows = await Promise.all(techPromises);
          
          // Insert into project_technologies table
          const { error: techAssocError } = await supabase
            .from('project_technologies')
            .insert(techRows);
      
          if (techAssocError) {
            console.error('Technology association error:', techAssocError);
            throw new Error(`Failed to associate technologies: ${techAssocError.message}`);
          }
      
          console.log('Successfully inserted technologies:', techRows);
        } catch (error) {
          console.error('Technology insertion error:', error);
          throw new Error(
            error instanceof Error 
              ? `Technology insertion failed: ${error.message}`
              : 'Failed to add technologies: Unknown error'
          );
        }
      }
  
      // Tags insertion with validation
      if (selectedTags.length > 0) {
        try {
          const tagPromises = selectedTags.map(async tag => {
            const { data: tagData, error: tagError } = await supabase
              .from('project_tag')
              .select('id')
              .eq('name', tag)
              .single();
      
            if (tagError) {
              throw new Error(`Failed to find tag "${tag}": ${tagError.message}`);
            }
      
            return {
              project_id: project.id,
              association_id: tagData.id,
              type: 'tag'
            };
          });
      
          const tagRows = await Promise.all(tagPromises);
          
          // Insert into project_assoc table
          const { error: tagAssocError } = await supabase
            .from('project_assoc')
            .insert(tagRows);
      
          if (tagAssocError) {
            throw new Error(`Failed to associate tags: ${tagAssocError.message}`);
          }
        } catch (tagError) {
          console.error('Tag association error:', tagError);
          throw new Error(`Failed to process tags: ${tagError.message}`);
        }
      }
  
    } catch (error) {
      console.error('Detailed submission error:', error);
      setSubmissionError(
        error instanceof Error 
          ? getReadableError(error)
          : 'An unexpected error occurred. Please try again later.'
      );
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
              onTagsChange={(tags) => {
                // Prevent form submission when changing tags
                handleTechnologiesChange(tags);
              }}
              initialTags={selectedTechnologies}
              nonRemovableTags={Object.keys(repoInfo.languages).map(lang => lang.toLowerCase())}
              highlightedTags={highlightedTechnologies}
              onHighlightedTagsChange={(highlighted) => {
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
            <button onClick={printstuff}>fff</button>
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
            disabled={isSubmitting}
            className={`px-8 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors duration-200 
              ${isSubmitting 
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
};

export default Page;
