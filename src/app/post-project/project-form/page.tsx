"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/supabaseClient";
import "../../post-project/style.css";
import MultiSelector from "@/app/Components/MultiSelector";
import SingleSelector from "@/app/Components/SingleSelector";
import HighlightableMultiSelector from "@/app/Components/HighlightableMultiSelector";
import LanguageBar from "@/app/Components/LanguageBar";
import DifficultySelector from "@/app/Components/DifficultySelector";
import { 
  fetchRepositoryReadme, 
  extractTagsFromReadme, 
  fetchAvailableTags,
  fetchAvailableTechnologies 
} from '../../../utils/githubUtils';


// Define interfaces for the data structure
interface Tag {
  name: string;
}

interface Technology {
  name: string;
}

interface ContributionType {
  name: string;
}

interface ProjectTag {
  tags: Tag;
  is_highlighted?: boolean;
}

interface ProjectTechnology {
  is_highlighted: boolean;
  technologies: Technology;
}

interface ProjectContributionType {
  contribution_type: ContributionType;
}

interface Project {
  id: number;
  repo_name: string;
  repo_owner: string;
  custom_description?: string;
  description_type?: string;
  difficulty_level?: number;
  status?: string;
  mentorship?: boolean;
  license?: string;
  setup_time?: number;
  image?: string | null;
  links?: Array<{ name: string; url: string }>;
  project_tags: ProjectTag[];
  project_technologies: ProjectTechnology[];
  project_contribution_type: ProjectContributionType[];
}

interface ResourceLink {
  name: string;
  url: string;
  isValid: boolean;
}

function ProjectFormContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const repoName = searchParams ? searchParams.get('repo') : null;
  const owner = searchParams ? searchParams.get('owner') : null;

  const [isEditMode, setIsEditMode] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);

  const [tags, setTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [highlightedTags, setHighlightedTags] = useState<string[]>([]);
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
  const [contributionTypes, setContributionTypes] = useState<string[]>([]);
  const [selectedContributionTypes, setSelectedContributionTypes] = useState<string[]>([]);
  const [mentorship, setMentorship] = useState<string>("No");
  const [license, setLicense] = useState<string>("MIT");
  const [customLicense, setCustomLicense] = useState<string>("");
  const [setupTime, setSetupTime] = useState<number>();
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [bannerImagePreview, setBannerImagePreview] = useState<string | null>(null);
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableTechnologies, setAvailableTechnologies] = useState<string[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [suggestedTechnologies, setSuggestedTechnologies] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);

  const mentorshipOptions = [
    { value: "Yes", tooltip: "Mentorship is available for new contributors." },
    { value: "No", tooltip: "No formal mentorship is available." },
  ];

  const licenseOptions = [
    "MIT",
    "Apache-2.0",
    "GPL-3.0",
    "BSD-3-Clause",
    "Unlicensed",
    "Other"
  ];

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
  };

  const handleHighlightedTagsChange = (highlighted: string[]) => {
    setHighlightedTags(highlighted);
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPEG, PNG, GIF, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    setBannerImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBannerImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const descriptionOptions = ["Use existing description", "Write your Own"];
  const statusOptions = [
    { value: "Active Development", tooltip: "The project is actively being worked on." },
    { value: "Maintenance", tooltip: "The project is in maintenance mode." },
  ];

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Prevent overwriting user edits after initial load
  const [hasPrefilled, setHasPrefilled] = useState(false);

  useEffect(() => {
    // Define fetchAllData inside the useEffect closure
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
            console.log('In fetchAllData, about to set technologies:', 
                        'technologies:', nonRemovableTechnologies,
                        'isEditMode:', isEditMode, 
                        'hasPrefilled:', hasPrefilled);
            
            // Check hasPrefilled again right before setting technologies
            // This ensures not overwrite user's prefilled technologies
            const currentHasPrefilled = isEditMode && hasPrefilled;
            console.log('Current hasPrefilled value:', currentHasPrefilled);
            
            if (!currentHasPrefilled) {
              console.log('Setting technologies from fetchAllData');
              setSelectedTechnologies(nonRemovableTechnologies);
            } else {
              console.log('Skipping technology update - data already loaded');
            }
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

    const fetchExistingProject = async () => {
      if (!repoName || !owner) return;
      console.log('Fetching existing project data...');
      
      try {
        const { data: project, error } = await supabase
          .from('project')
          .select(`
            *,
            project_technologies (
              is_highlighted,
              technologies (
                name
              )
            ),
            project_tags (
              tags (
                name
              ),
              is_highlighted
            ),
            project_contribution_type (
              contribution_type (
                name
              )
            )
          `)
          .eq('repo_name', repoName)
          .eq('repo_owner', owner)
          .single();

        if (project) {
          setIsEditMode(true);
          setProjectId(project.id);
          
          // When editing an existing project, we should have access
          setHasRepoAccess(true);
          
          // Set all project data
          setCustomDescription(project.custom_description || '');
          setDescriptionOption(project.description_type || "Use existing description");
          setDifficulty(project.difficulty_level || 1);
          setProjectStatus(project.status || "Active Development");
          setMentorship(project.mentorship ? "Yes" : "No");
          setLicense(project.license || "MIT");
          setCustomLicense(project.license && !["MIT", "Apache-2.0", "GPL-3.0", "BSD-3-Clause", "Unlicensed"].includes(project.license) ? project.license : "");
          setSetupTime(project.setup_time || undefined);
          
          setSelectedTags((project.project_tags || []).map((pt: ProjectTag) => pt.tags?.name).filter(Boolean));
          
          setHighlightedTags((project.project_tags || [])
            .filter((pt: any) => pt.is_highlighted)
            .map((pt: any) => pt.tags?.name)
            .filter(Boolean));
          
          // Store technologies in a local variable to ensure availability for API calls
          const projectTechs = (project.project_technologies || [])
            .map((pt: ProjectTechnology) => pt.technologies?.name)
            .filter(Boolean);
          console.log('Loading existing technologies from DB:', projectTechs);
          setSelectedTechnologies(projectTechs);
          
          setHighlightedTechnologies((project.project_technologies || [])
            .filter((pt: ProjectTechnology) => pt.is_highlighted)
            .map((pt: ProjectTechnology) => pt.technologies?.name)
            .filter(Boolean));
          
          setResourceLinks(Array.isArray(project.links) ? project.links.map((l: { name: string; url: string }) => ({
            name: l.name,
            url: l.url,
            isValid: !!l.url
          })) : []);
          
          const projectContributionTypes = (project.project_contribution_type || [])
            .map((pct: ProjectContributionType) => pct.contribution_type?.name)
            .filter(Boolean);
      
          setSelectedContributionTypes(projectContributionTypes);
          
          setBannerImage(project.image || null);
          setBannerImagePreview(project.image || null);

          // Wait for all state updates to complete by deferring this
          setTimeout(() => {
            console.log('Setting hasPrefilled to true');
            setHasPrefilled(true); // Prevent further overwrites
          }, 0);
          
          // Return the technologies to prevent later overwrites
          return projectTechs;
        }
        return null;
      } catch (err) {
        console.error('Error fetching existing project:', err);
        return null;
      }
    };
    
    // Initialize project form by checking for existing data first
    const initializeProjectForm = async () => {
      // Get the session regardless of whether we're creating or editing
      const { data: { session: authSession }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Session error:', sessionError.message);
      } else {
        setSession(authSession); // Always set the session
      }

      try {
        
        // Load ALL dropdown options in one batch
        const [tagsResponse, technologiesResponse, contributionTypesResponse] = await Promise.all([
          supabase.from('tags').select('name'),
          supabase.from('technologies').select('name'),
          supabase.from('contribution_type').select('name')
        ]);

        // Process tags
        if (!tagsResponse.error) {
          const tagNames = (tagsResponse.data || [])
            .filter((tag): tag is { name: string } => tag && typeof tag.name === 'string')
            .map(tag => tag.name)
            .filter(name => name.length > 0);
          console.log(`Loaded ${tagNames.length} tags`);
          setTags(tagNames);
          setAvailableTags(tagNames); // Add this line to also set availableTags
        } else {
          console.error('Error loading tags:', tagsResponse.error);
        }

        // Process technologies
        if (!technologiesResponse.error) {
          const techNames = (technologiesResponse.data || [])
            .filter((tech): tech is { name: string } => tech && typeof tech.name === 'string')
            .map(tech => tech.name)
            .filter(name => name.length > 0);
          console.log(`Loaded ${techNames.length} technologies`);
          setTechnologies(techNames);
          setAvailableTechnologies(techNames); // Add this line to also set availableTechnologies
        } else {
          console.error('Error loading technologies:', technologiesResponse.error);
        }

        // Process contribution types
        if (!contributionTypesResponse.error) {
          const contributionTypeNames = (contributionTypesResponse.data || [])
            .filter((type): type is { name: string } => type && typeof type.name === 'string')
            .map(type => type.name)
            .filter(name => name.length > 0);
          console.log(`Loaded ${contributionTypeNames.length} contribution types:`, contributionTypeNames);
          setContributionTypes(contributionTypeNames);
        } else {
          console.error('Error loading contribution types:', contributionTypesResponse.error);
        }
        
      } catch (error) {
        console.error('Error fetching form options:', error);
      }

      // This loads existing project data if we're in edit mode
      console.log('Checking for existing project data...');
      const existingTechs = await fetchExistingProject();
      
      // Only fetch GitHub data if we don't already have project data
      if (!existingTechs) {
        console.log('No existing project data found, fetching from GitHub API');
        fetchAllData();
      } else {
        console.log('Using existing project data, skipping GitHub API fetch');
      }
      
      console.log('Project form initialization complete');
    };
    
    initializeProjectForm();
  }, [repoName, owner]);

  useEffect(() => {
    if (repoName && owner && availableTags.length > 0 && availableTechnologies.length > 0) {
      setIsLoadingSuggestions(true);
      
      fetchRepositoryReadme(owner, repoName)
        .then(readmeContent => {
          const { tags, technologies } = extractTagsFromReadme(
            readmeContent, 
            availableTags, 
            availableTechnologies
          );
          setSuggestedTags(tags);
          setSuggestedTechnologies(technologies);
        })
        .catch(error => {
          console.error("Error processing README:", error);
        })
        .finally(() => {
          setIsLoadingSuggestions(false);
        });
    }
  }, [repoName, owner, availableTags, availableTechnologies]);

  useEffect(() => {
    console.log('selectedTechnologies changed:', selectedTechnologies, 
                'isEditMode:', isEditMode, 
                'hasPrefilled:', hasPrefilled);
  }, [selectedTechnologies]);

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

    if (selectedContributionTypes.length === 0) {
      throw new Error('At least one contribution type is required');
    }

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

      const githubLink = `https://github.com/${owner}/${repoName}`;
      const formData = new FormData();

      formData.append('repoName', repoName ?? '');
      formData.append('owner', owner ?? '');
      formData.append('github_link', githubLink);
      formData.append('description_type', descriptionOption);
      formData.append('custom_description', customDescription);
      formData.append('difficulty_level', String(difficulty));
      formData.append('tags', JSON.stringify(selectedTags));
      formData.append('highlighted_tags', JSON.stringify(highlightedTags));
      formData.append('technologies', JSON.stringify(selectedTechnologies));
      formData.append('highlighted_technologies', JSON.stringify(highlightedTechnologies));
      formData.append('links', JSON.stringify(resourceLinks.filter(link => link.name && link.url && link.isValid).map(link => ({
        name: link.name,
        url: link.url
      }))));
      formData.append('status', projectStatus);
      formData.append('contribution_types', JSON.stringify(selectedContributionTypes));
      formData.append('mentorship', mentorship);
      formData.append('license', license === "Other" ? customLicense : license);
      formData.append('setup_time', String(setupTime ?? ''));
      if (bannerImageFile) {
        formData.append('banner_image', bannerImageFile);
      }
      if (isEditMode && projectId) {
        formData.append('project_id', String(projectId));
      }

      const response = await fetch('/api/projects/create', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save project');
      }

      router.push(`/projects/${result.projectId}`);
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
            <h4>Project Banner Image (Optional):</h4>
            <div className="mt-2 flex flex-col items-center">
              {bannerImagePreview ? (
                <div className="relative w-full aspect-[16/9]">
                  <img 
                    src={bannerImagePreview} 
                    alt="Banner preview" 
                    className="w-full h-full object-cover object-center rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setBannerImage(null);
                      setBannerImagePreview(null);
                      setBannerImageFile(null);
                    }}
                    className="absolute top-2 right-2 bg-gray-800 text-white p-2 rounded-full hover:bg-gray-700"
                    aria-label="Remove image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer w-full">
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 flex flex-col items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-400">Click to upload a banner image</p>
                    <p className="text-xs text-gray-500 mt-1">Recommended: 16:9 aspect ratio (1280×720px or similar)</p>
                    <p className="text-xs text-gray-500">Images will be displayed in 16:9 format</p>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
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
                handleTechnologiesChange(tags);
              }}
              initialTags={selectedTechnologies}
              nonRemovableTags={Object.keys(repoInfo.languages).map(lang => lang.toLowerCase())}
              highlightedTags={highlightedTechnologies}
              onHighlightedTagsChange={(highlighted: string[]) => {
                handleHighlightedTechnologiesChange(highlighted);
              }}
            />
            <LanguageBar languages={repoInfo.languages} />
            
            <div className="mt-3 border-t border-[var(--off-white)] pt-3">
              <div className="flex justify-between items-center mb-2">
                <h5 className="text-sm font-semibold inria-sans-semibold">
                  {isLoadingSuggestions ? 'Analyzing README...' : 'Suggested Technologies:'}
                </h5>
                {!isLoadingSuggestions && suggestedTechnologies.length > 0 && (
                  <button
                    onClick={() => {
                      const newTechnologies = [...selectedTechnologies];
                      suggestedTechnologies.forEach(tech => {
                        if (!newTechnologies.includes(tech)) {
                          newTechnologies.push(tech);
                        }
                      });
                      handleTechnologiesChange(newTechnologies);
                    }}
                    className="text-xs px-2 py-1 bg-[var(--muted-red)] text-[var(--off-white)] rounded hover:bg-[var(--title-red)] transition-colors"
                  >
                    Add All
                  </button>
                )}
              </div>
              {isLoadingSuggestions ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-[var(--title-red)]"></div>
                  <span className="text-sm text-gray-400">Finding technologies in README...</span>
                </div>
              ) : suggestedTechnologies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {suggestedTechnologies.map((tech, index) => (
                    <button
                      key={`tech-${index}`}
                      onClick={() => {
                        if (!selectedTechnologies.includes(tech)) {
                          handleTechnologiesChange([...selectedTechnologies, tech]);
                        }
                      }}
                      className={`px-2 py-1 rounded text-xs border border-[var(--off-white)] 
                        ${selectedTechnologies.includes(tech) 
                          ? 'bg-[var(--muted-red)] text-[var(--off-white)] cursor-default' 
                          : 'bg-transparent hover:bg-[var(--magenta-dark)]'
                        } transition-colors`}
                    >
                      {tech}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No technologies to suggest</p>
              )}
            </div>
          </div>
          <div className="bento-box half-width radial-background">
            <h4>Tags:</h4>
            <HighlightableMultiSelector
              availableTags={tags}
              onTagsChange={handleTagsChange}
              initialTags={selectedTags}
              highlightedTags={highlightedTags}
              onHighlightedTagsChange={handleHighlightedTagsChange}
              nonRemovableTags={[]} // No non-removable tags for this selector
            />
            
            <div className="mt-3 border-t border-[var(--off-white)] pt-3">
              <div className="flex justify-between items-center mb-2">
                <h5 className="text-sm font-semibold inria-sans-semibold">
                  {isLoadingSuggestions ? 'Analyzing README...' : 'Suggested Tags:'}
                </h5>
                {!isLoadingSuggestions && suggestedTags.length > 0 && (
                  <button
                    onClick={() => {
                      const newTags = [...selectedTags];
                      suggestedTags.forEach(tag => {
                        if (!newTags.includes(tag)) {
                          newTags.push(tag);
                        }
                      });
                      handleTagsChange(newTags);
                    }}
                    className="text-xs px-2 py-1 bg-[var(--muted-red)] text-[var(--off-white)] rounded hover:bg-[var(--title-red)] transition-colors"
                  >
                    Add All
                  </button>
                )}
              </div>
              {isLoadingSuggestions ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-[var(--title-red)]"></div>
                  <span className="text-sm text-gray-400">Finding tags in README...</span>
                </div>
              ) : suggestedTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {suggestedTags.map((tag, index) => (
                    <button
                      key={`tag-${index}`}
                      onClick={() => {
                        if (!selectedTags.includes(tag)) {
                          handleTagsChange([...selectedTags, tag]);
                        }
                      }}
                      className={`px-2 py-1 rounded text-xs border border-[var(--off-white)]
                        ${selectedTags.includes(tag) 
                          ? 'bg-[var(--muted-red)] text-[var(--off-white)] cursor-default' 
                          : 'bg-transparent hover:bg-[var(--magenta-dark)]'
                        } transition-colors`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No tags to suggest</p>
              )}
            </div>
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
          <div className="bento-box half-width radial-background">
            <h4>Contribution Types:</h4>
            <MultiSelector
              availableTags={contributionTypes}
              onTagsChange={setSelectedContributionTypes}
              initialTags={selectedContributionTypes}
            />
          </div>
          <div className="bento-box half-width radial-background">
            <h4>Mentorship Available?</h4>
            <SingleSelector
              values={mentorshipOptions.map(opt => opt.value)}
              onValueChange={(selectedValue) => setMentorship(selectedValue || "No")}
              initialValue={mentorship}
              tooltips={Object.fromEntries(mentorshipOptions.map(opt => [opt.value, opt.tooltip]))}
            />
          </div>
          <div className="bento-box half-width radial-background">
            <h4>License:</h4>
            <SingleSelector
              values={licenseOptions}
              onValueChange={(selectedValue) => setLicense(selectedValue || "")}
              initialValue={license}
            />
            {license === "Other" && (
              <input
                type="text"
                className="mt-2 w-full p-2 rounded-lg border border-gray-300 outline-none text-black"
                placeholder="Enter custom license"
                value={customLicense}
                onChange={e => setCustomLicense(e.target.value)}
              />
            )}
          </div>
          <div className="bento-box half-width radial-background">
            <h4>Estimated Setup Time (minutes):</h4>
            <input
              type="number"
              min={1}
              max={240}
              className="w-full p-2 rounded-lg border border-gray-300 outline-none text-black"
              placeholder="Estimated setup time in minutes"
              value={setupTime}
              onChange={e => setSetupTime(Number(e.target.value))}
            />
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
                {isEditMode ? "Updating..." : "Submitting..."}
              </>
            ) : !hasRepoAccess ? (
              "No Repository Access"
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {isEditMode ? "Update Project" : "Post Project"}
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

