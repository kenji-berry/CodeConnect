"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/supabaseClient";
import "../../post-project/style.css";
import MultiSelector from "@/app/Components/MultiSelector";
import SingleSelector from "@/app/Components/SingleSelector";
import HighlightableMultiSelector from "@/app/Components/HighlightableMultiSelector";
import DifficultySelector from "@/app/Components/DifficultySelector";
import ProjectPreview from "@/app/Components/ProjectPreview";

import { 
  fetchRepositoryReadme, 
  extractTagsFromReadme, 
  fetchAvailableTags,
  fetchAvailableTechnologies 
} from '../../../utils/githubUtils';

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

  const [isPreviewVisible, setIsPreviewVisible] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);

  const [tags, setTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [highlightedTags, setHighlightedTags] = useState<string[]>([]);
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>([]);
  const [highlightedTechnologies, setHighlightedTechnologies] = useState<string[]>([]);
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  const [hasPrefilled, setHasPrefilled] = useState(false);

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
            const userResponse = await fetch('/api/github/user', {
              credentials: 'include'
            });
            
            if (!userResponse.ok) {
              throw new Error(`Failed to fetch user data: ${userResponse.status}`);
            }
            
            const userData = await userResponse.json();
            
            // If user is the owner, they definitely have permission
            if (userData.login && userData.login.toLowerCase() === owner.toLowerCase()) {
              setHasRepoAccess(true);
            } else {
              // Otherwise, check if they are a collaborator with admin access
              const permissionsResponse = await fetch(`/api/github/repos/${owner}/${repoName}/collaborators/${userData.login}/permission`, {
                credentials: 'include'
              });
              
              if (!permissionsResponse.ok) {
                if (permissionsResponse.status === 403) {
                  setSubmissionError("You don't have sufficient permissions to post this repository.");
                  setHasRepoAccess(false);
                  return;
                } else {
                  throw new Error(`GitHub API error: ${permissionsResponse.status}`);
                }
              }
              
              // Check if they have admin access
              const permissionsData = await permissionsResponse.json();
              
              if (permissionsData.permission === 'admin') {
                setHasRepoAccess(true);
              } else {
                setSubmissionError("Only repository owners or admins can post projects.");
                setHasRepoAccess(false);
                return;
              }
            }

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
          
          setHasRepoAccess(true);
          
          setCustomDescription(project.custom_description || '');
          setDifficulty(project.difficulty_level || 1);
          setProjectStatus(project.status || "Active Development");
          setMentorship(project.mentorship ? "Yes" : "No");
          setLicense(project.license || "MIT");
          setSetupTime(project.setup_time || undefined);
          
          setSelectedTags((project.project_tags || []).map((pt: ProjectTag) => pt.tags?.name).filter(Boolean));
          
          setHighlightedTags((project.project_tags || [])
            .filter((pt: ProjectTag) => pt.is_highlighted)
            .map((pt: ProjectTag) => pt.tags?.name)
            .filter(Boolean));
          
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

          setTimeout(() => {
            console.log('Setting hasPrefilled to true');
            setHasPrefilled(true);
          }, 0);
          
          return projectTechs;
        }
        return null;
      } catch (err) {
        console.error('Error fetching existing project:', err);
        return null;
      }
    };
    
    const initializeProjectForm = async () => {
      const { data: { session: authSession }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Session error:', sessionError.message);
      } else {
        setSession(authSession);
      }

      try {
        
        const [tagsResponse, technologiesResponse, contributionTypesResponse] = await Promise.all([
          supabase.from('tags').select('name'),
          supabase.from('technologies').select('name'),
          supabase.from('contribution_type').select('name')
        ]);

        if (!tagsResponse.error) {
          const tagNames = (tagsResponse.data || [])
            .filter((tag): tag is { name: string } => tag && typeof tag.name === 'string')
            .map(tag => tag.name)
            .filter(name => name.length > 0);
          console.log(`Loaded ${tagNames.length} tags`);
          setTags(tagNames);
          setAvailableTags(tagNames);
        } else {
          console.error('Error loading tags:', tagsResponse.error);
        }

        if (!technologiesResponse.error) {
          const techNames = (technologiesResponse.data || [])
            .filter((tech): tech is { name: string } => tech && typeof tech.name === 'string')
            .map(tech => tech.name)
            .filter(name => name.length > 0);
          console.log(`Loaded ${techNames.length} technologies`);
          setTechnologies(techNames);
          setAvailableTechnologies(techNames);
        } else {
          console.error('Error loading technologies:', technologiesResponse.error);
        }

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

      console.log('Checking for existing project data...');
      const existingTechs = await fetchExistingProject();
      
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
    setFieldErrors({});
    const errors: Record<string, string> = {};
    
    if (!session?.user?.id) {
      throw new Error('Please sign in to submit a project');
    }
  
    if (!repoName || !owner) {
      throw new Error('Repository information is missing');
    }
    
    if (!hasRepoAccess) {
      throw new Error('You do not have permission to post this repository');
    }

    if (!bannerImageFile && !bannerImage) {
      errors.bannerImage = 'Project banner image is required';
    }
  
    if (!customDescription.trim()) {
      errors.customDescription = 'Custom description is required';
    }
  
    if (selectedTechnologies.length === 0) {
      errors.technologies = 'At least one technology is required';
    }

    if (highlightedTechnologies.length === 0) {
      errors.highlightedTechnologies = 'At least one highlighted technology is required';
    }

    if (selectedTags.length === 0) {
      errors.tags = 'At least one tag is required';
    }

    if (highlightedTags.length === 0) {
      errors.highlightedTags = 'At least one highlighted tag is required';
    }
  
    if (!projectStatus) {
      errors.status = 'Project status must be selected';
    }
  
    if (typeof setupTime !== "number" || isNaN(setupTime) || setupTime < 1) {
      errors.setupTime = 'Valid setup time (in minutes) is required';
    }
  
    const invalidLinks = resourceLinks.filter(link => link.url && !link.isValid);
    if (invalidLinks.length > 0) {
      errors.resourceLinks = `Invalid resource links found: ${invalidLinks.map(l => l.name).join(', ')}`;
    }

    if (selectedContributionTypes.length === 0) {
      errors.contributionTypes = 'At least one contribution type is required';
    }
    
    if (license === "Other" && !customLicense.trim()) {
      errors.customLicense = 'Custom license name is required';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      throw new Error('Please fix the highlighted errors before submitting');
    }

    if (customDescription) {
      try {
        const profanityResponse = await fetch('/api/check-profanity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: customDescription }),
        });
        const profanityData = await profanityResponse.json();
        if (profanityData.isProfane) {
          errors.customDescription = 'Custom description contains inappropriate language. Please revise.';
        }
      } catch (error) {
        console.error('Error checking profanity:', error);
      }
    }

    for (const link of resourceLinks) {
      if (link.name.trim()) {
        try {
          const profanityResponse = await fetch('/api/check-profanity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: link.name }),
          });
          const profanityData = await profanityResponse.json();
          if (profanityData.isProfane) {
            errors.resourceLinks = `Resource link name "${link.name}" contains inappropriate language. Please revise.`;
            break;
          }
        } catch (error) {
          console.error('Error checking profanity:', error);
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      throw new Error('Please fix the highlighted errors before submitting');
    }
  };

  const handleSubmitProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmissionError(null);
    setFieldErrors({});

    try {
      await validateSubmission();
      setIsSubmitting(true);

      const githubLink = `https://github.com/${owner}/${repoName}`;
      const formData = new FormData();

      formData.append('repoName', repoName ?? '');
      formData.append('owner', owner ?? '');
      formData.append('github_link', githubLink);
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

      if (!response.ok) {
        const result = await response.json();
        
        if (result.error?.includes('banner image')) {
          setFieldErrors(prev => ({...prev, bannerImage: result.error}));
          throw new Error(result.error);
        }
        
        if (result.error?.includes('Image failed moderation')) {
          setFieldErrors(prev => ({...prev, bannerImage: 'Image failed content moderation: contains inappropriate content'}));
          throw new Error('Image failed content moderation. Please select another image.');
        }
        
        throw new Error(result.error || 'Failed to save project');
      }

      const result = await response.json();
      router.push(`/projects/${result.projectId}`);
    } catch (err) {
      setSubmissionError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-2">
      <div className="w-full max-w-[1200px] mx-auto py-10">
        <header className="mb-10">
          <h1 className="text-5xl font-extrabold flex items-center group text-[var(--off-white)] tracking-tight">
            <a
              href={`https://github.com/${owner}/${repoName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 relative text-[var(--off-white)] hover:text-[var(--title-red)] transition-colors duration-300"
            >
              <span className="">{repoName}</span>
              <div className="relative">
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--title-red)] transform scale-x-0 transition-transform duration-300 group-hover:scale-x-100" />
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7 transform transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
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
          <p className="mt-2 text-lg text-gray-400 max-w-2xl">
            Share your project with the CodeConnect community. Fill out the details below to help contributors discover and join your project!
          </p>
        </header>
        
        {submissionError && (
          <div className="rounded-xl bg-[#2A1619] border border-[var(--title-red)] p-4 mb-8 shadow-lg animate-fadeIn">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[var(--title-red)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-[var(--title-red)]">Submission Error</h3>
                <div className="mt-1 text-sm text-[var(--off-white)]">
                  {submissionError}
                  {Object.keys(fieldErrors).length > 0 && (
                    <ul className="list-disc pl-5 mt-2 space-y-1 text-[var(--muted-red)]">
                      {Object.entries(fieldErrors).map(([key, error]) => (
                        <li key={key}>{error}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setSubmissionError(null)} 
                className="flex-shrink-0 ml-4 text-[var(--muted-red)] hover:text-[var(--title-red)]"
              >
                <span className="sr-only">Close</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmitProject} className="space-y-8">
          <div className="flex flex-col gap-8">
            <section className={`rounded-xl shadow-lg bg-[#232323] ${fieldErrors.bannerImage ? 'border-2 border-[var(--title-red)]' : 'border border-[var(--muted-red)]'} p-8 flex flex-col gap-4`}>
              <h2 className="text-2xl font-bold text-[var(--off-white)] mb-1 flex items-center gap-2">
                Project Banner Image <span className="text-[var(--title-red)]">*</span>
              </h2>
              <p className="text-sm text-gray-400 mb-2">
                This image will be shown at the top of your project page. Recommended: 16:9 aspect ratio (1280×720px or similar).
              </p>
              {fieldErrors.bannerImage && (
                <p className="text-sm text-[var(--title-red)] mb-2">
                  {fieldErrors.bannerImage}
                </p>
              )}
              <div className="flex flex-col items-center w-full">
                {bannerImagePreview ? (
                  <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden shadow-md">
                    <img
                      src={bannerImagePreview}
                      alt="Banner preview"
                      className="w-full h-full object-cover object-center rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setBannerImage(null);
                        setBannerImagePreview(null);
                        setBannerImageFile(null);
                      }}
                      className="absolute top-3 right-3 bg-[#18181b] text-white p-2 rounded-full hover:bg-gray-700 shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--title-red)]"
                      aria-label="Remove image"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="w-full">
                    <input
                      type="file"
                      name="banner_image"
                      id="banner_image"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleImageChange}
                      className="sr-only"
                      aria-required="true"
                      ref={(input) => {
                        // Don't require the field if we're in edit mode and already have an image
                        if (input && (bannerImage || isEditMode)) {
                          input.removeAttribute('required');
                        } else if (input) {
                          input.setAttribute('required', 'required');
                        }
                      }}
                    />
                    <label htmlFor="banner_image" className="cursor-pointer block w-full">
                      <div className={`border-2 border-dashed ${fieldErrors.bannerImage ? 'border-[var(--title-red)]' : 'border-[var(--muted-red)]'} rounded-xl p-8 flex flex-col items-center bg-[#1a1a1a] hover:bg-[#232323] transition-colors`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-[var(--off-white)] font-medium">Click to upload a banner image <span className="text-[var(--title-red)]">*</span></p>
                        <p className="text-xs text-gray-400 mt-1">Recommended: 16:9 aspect ratio (1280×720px or similar)</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </section>

            <section className={`rounded-xl shadow-lg bg-[#232323] ${fieldErrors.customDescription ? 'border-2 border-[var(--title-red)]' : 'border border-[var(--muted-red)]'} p-8 flex flex-col gap-4`}>
              <h3 className="text-xl font-bold text-[var(--off-white)] mb-2">
                Project Description <span className="text-[var(--title-red)]">*</span>
              </h3>
              <div className="text-sm text-gray-400 mb-2">
                <p>Write a compelling description of your project and what makes it special.</p>
                <div className="mt-2 text-sm text-gray-400">
                  <span className="font-medium text-[var(--muted-red)]">Note:</span> The first few lines are the most important as they will be shown in project previews.
                </div>
              </div>
              {fieldErrors.customDescription && (
                <p className="text-sm text-[var(--title-red)]">
                  {fieldErrors.customDescription}
                </p>
              )}
              <textarea
                name="customDescription"
                className={`w-full mt-2 p-3 rounded-xl bg-[#18181b] ${
                  fieldErrors.customDescription 
                    ? 'border-2 border-[var(--title-red)]' 
                    : 'border border-[var(--muted-red)]'
                } text-[var(--off-white)] shadow focus:ring-2 focus:ring-[var(--title-red)] focus:border-[var(--title-red)] outline-none resize-y min-h-[100px] transition`}
                placeholder="Describe your project here. Include what problem it solves, who it's for, and why contributors should be excited about it..."
                rows={5}
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                maxLength={1500}
                required
              />
              <div className="text-xs text-gray-400 flex justify-end">
                {customDescription.length}/1500 characters
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className={`rounded-xl shadow-lg bg-[#232323] ${
                fieldErrors.technologies || fieldErrors.highlightedTechnologies 
                  ? 'border-2 border-[var(--title-red)]' 
                  : 'border border-[var(--muted-red)]'
              } p-8 flex flex-col gap-4`}>
                <h3 className="text-xl font-bold text-[var(--off-white)] mb-2">
                  Technologies & Languages <span className="text-[var(--title-red)]">*</span>
                </h3>
                {fieldErrors.technologies && (
                  <p className="text-sm text-[var(--title-red)]">{fieldErrors.technologies}</p>
                )}
                {fieldErrors.highlightedTechnologies && (
                  <p className="text-sm text-[var(--title-red)]">{fieldErrors.highlightedTechnologies}</p>
                )}
                <HighlightableMultiSelector
                  availableTags={technologies}
                  onTagsChange={handleTechnologiesChange}
                  initialTags={selectedTechnologies}
                  nonRemovableTags={Object.keys(repoInfo.languages).map(lang => lang.toLowerCase())}
                  highlightedTags={highlightedTechnologies}
                  onHighlightedTagsChange={handleHighlightedTechnologiesChange}
                />
                <div className="mt-2 text-sm text-gray-400">
                  <span className="font-medium text-[var(--muted-red)]">Note:</span> At least one technology must be highlighted (shown in accent color)
                </div>
                
                {/* Suggested Technologies UI */}
                {suggestedTechnologies.length > 0 || isLoadingSuggestions ? (
                  <div className="mt-4 pt-3 border-t border-gray-700">
                    <div className="flex justify-between items-center mb-3">
                      <h5 className="text-sm font-semibold text-[var(--off-white)]">
                        {isLoadingSuggestions ? 'Analyzing README...' : 'Suggested Technologies:'}
                      </h5>
                      {!isLoadingSuggestions && suggestedTechnologies.length > 0 && (
                        <button
                          type="button"
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
                        {suggestedTechnologies.map((tech) => (
                          <button
                            key={tech}
                            type="button"
                            onClick={() => {
                              if (!selectedTechnologies.includes(tech)) {
                                handleTechnologiesChange([...selectedTechnologies, tech]);
                              }
                            }}
                            disabled={selectedTechnologies.includes(tech)}
                            className={`px-2 py-1 text-xs rounded-md ${
                              selectedTechnologies.includes(tech)
                                ? 'bg-[var(--muted-red)] text-white cursor-default'
                                : 'bg-[#1a1a1a] text-[var(--off-white)] hover:bg-[#2a2a2a]'
                            } transition-colors flex items-center gap-1`}
                          >
                            {!selectedTechnologies.includes(tech) && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            )}
                            {tech}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No technologies suggested from repository</p>
                    )}
                  </div>
                ) : null}
              </section>

              <section className={`rounded-xl shadow-lg bg-[#232323] ${
                fieldErrors.tags || fieldErrors.highlightedTags
                  ? 'border-2 border-[var(--title-red)]' 
                  : 'border border-[var(--muted-red)]'
              } p-8 flex flex-col gap-4`}>
                <h3 className="text-xl font-bold text-[var(--off-white)] mb-2">
                  Tags <span className="text-[var(--title-red)]">*</span>
                </h3>
                {fieldErrors.tags && (
                  <p className="text-sm text-[var(--title-red)]">{fieldErrors.tags}</p>
                )}
                {fieldErrors.highlightedTags && (
                  <p className="text-sm text-[var(--title-red)]">{fieldErrors.highlightedTags}</p>
                )}
                <HighlightableMultiSelector
                  availableTags={tags}
                  onTagsChange={handleTagsChange}
                  initialTags={selectedTags}
                  highlightedTags={highlightedTags}
                  onHighlightedTagsChange={handleHighlightedTagsChange}
                  nonRemovableTags={[]}
                />
                <div className="mt-2 text-sm text-gray-400">
                  <span className="font-medium text-[var(--muted-red)]">Note:</span> At least one tag must be highlighted (shown in accent color)
                </div>
                
                {/* Suggested Tags UI */}
                {suggestedTags.length > 0 || isLoadingSuggestions ? (
                  <div className="mt-4 pt-3 border-t border-gray-700">
                    <div className="flex justify-between items-center mb-3">
                      <h5 className="text-sm font-semibold text-[var(--off-white)]">
                        {isLoadingSuggestions ? 'Analyzing README...' : 'Suggested Tags:'}
                      </h5>
                      {!isLoadingSuggestions && suggestedTags.length > 0 && (
                        <button
                          type="button"
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
                        {suggestedTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              if (!selectedTags.includes(tag)) {
                                handleTagsChange([...selectedTags, tag]);
                              }
                            }}
                            disabled={selectedTags.includes(tag)}
                            className={`px-2 py-1 text-xs rounded-md ${
                              selectedTags.includes(tag)
                                ? 'bg-[var(--muted-red)] text-white cursor-default'
                                : 'bg-[#1a1a1a] text-[var(--off-white)] hover:bg-[#2a2a2a]'
                            } transition-colors flex items-center gap-1`}
                          >
                            {!selectedTags.includes(tag) && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            )}
                            {tag}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No tags suggested from repository</p>
                    )}
                  </div>
                ) : null}
              </section>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className={`rounded-xl shadow-lg bg-[#232323] ${
              fieldErrors.status ? 'border-2 border-[var(--title-red)]' : 'border border-[var(--muted-red)]'
            } p-8 flex flex-col gap-4`}>
              <h3 className="text-xl font-bold text-[var(--off-white)] mb-2">
                Project Status <span className="text-[var(--title-red)]">*</span>
              </h3>
              {fieldErrors.status && (
                <p className="text-sm text-[var(--title-red)]">{fieldErrors.status}</p>
              )}
              <SingleSelector
                values={statusOptions.map(opt => opt.value)}
                onValueChange={handleStatusChange}
                initialValue={projectStatus}
                tooltips={Object.fromEntries(statusOptions.map(opt => [opt.value, opt.tooltip]))}
              />
            </section>
            <section className="rounded-xl shadow-lg bg-[#232323] border border-[var(--muted-red)] p-8 flex flex-col gap-4">
              <h3 className="text-xl font-bold text-[var(--off-white)] mb-2">
                Beginner Friendliness <span className="text-[var(--title-red)]">*</span>
              </h3>
              <div className="flex items-center justify-center">
                <DifficultySelector
                  onDifficultyChange={handleDifficultyChange}
                  initialDifficulty={difficulty}
                />
              </div>
            </section>
            <section className={`rounded-xl shadow-lg bg-[#232323] ${
              fieldErrors.contributionTypes ? 'border-2 border-[var(--title-red)]' : 'border border-[var(--muted-red)]'
            } p-8 flex flex-col gap-4`}>
              <h3 className="text-xl font-bold text-[var(--off-white)] mb-2">
                Contribution Types <span className="text-[var(--title-red)]">*</span>
              </h3>
              {fieldErrors.contributionTypes && (
                <p className="text-sm text-[var(--title-red)]">{fieldErrors.contributionTypes}</p>
              )}
              <MultiSelector
                availableTags={contributionTypes}
                onTagsChange={setSelectedContributionTypes}
                initialTags={selectedContributionTypes}
              />
            </section>
            <section className="rounded-xl shadow-lg bg-[#232323] border border-[var(--muted-red)] p-8 flex flex-col gap-4">
              <h3 className="text-xl font-bold text-[var(--off-white)] mb-2">
                Mentorship Available? <span className="text-[var(--title-red)]">*</span>
              </h3>
              <SingleSelector
                values={mentorshipOptions.map(opt => opt.value)}
                onValueChange={(selectedValue) => setMentorship(selectedValue || "No")}
                initialValue={mentorship}
                tooltips={Object.fromEntries(mentorshipOptions.map(opt => [opt.value, opt.tooltip]))}
              />
            </section>
            <section className={`rounded-xl shadow-lg bg-[#232323] ${
              fieldErrors.customLicense ? 'border-2 border-[var(--title-red)]' : 'border border-[var(--muted-red)]'
            } p-8 flex flex-col gap-4`}>
              <h3 className="text-xl font-bold text-[var(--off-white)] mb-2">
                License <span className="text-[var(--title-red)]">*</span>
              </h3>
              <SingleSelector
                values={licenseOptions}
                onValueChange={(selectedValue) => setLicense(selectedValue || "")}
                initialValue={license}
              />
              {license === "Other" && (
                <>
                  {fieldErrors.customLicense && (
                    <p className="text-sm text-[var(--title-red)]">{fieldErrors.customLicense}</p>
                  )}
                  <input
                    type="text"
                    className={`mt-2 w-full p-3 rounded-xl bg-[#18181b] ${
                      fieldErrors.customLicense ? 'border-2 border-[var(--title-red)]' : 'border border-[var(--muted-red)]'
                    } text-[var(--off-white)] outline-none`}
                    placeholder="Enter custom license"
                    value={customLicense}
                    onChange={e => setCustomLicense(e.target.value)}
                  />
                </>
              )}
            </section>
            <section className={`rounded-xl shadow-lg bg-[#232323] ${
              fieldErrors.setupTime ? 'border-2 border-[var(--title-red)]' : 'border border-[var(--muted-red)]'
            } p-8 flex flex-col gap-4`}>
              <h3 className="text-xl font-bold text-[var(--off-white)] mb-2">
                Estimated Setup Time (minutes) <span className="text-[var(--title-red)]">*</span>
              </h3>
              {fieldErrors.setupTime && (
                <p className="text-sm text-[var(--title-red)]">{fieldErrors.setupTime}</p>
              )}
              <input
                type="number"
                min={1}
                max={240}
                className={`w-full p-3 rounded-xl bg-[#18181b] ${
                  fieldErrors.setupTime ? 'border-2 border-[var(--title-red)]' : 'border border-[var(--muted-red)]'
                } text-[var(--off-white)] outline-none`}
                placeholder="Estimated setup time in minutes"
                value={setupTime ?? ""}
                onChange={e => setSetupTime(e.target.value === "" ? undefined : Number(e.target.value))}
              />
            </section>
          </div>

          <section className={`rounded-xl shadow-lg bg-[#232323] ${
            fieldErrors.resourceLinks ? 'border-2 border-[var(--title-red)]' : 'border border-[var(--muted-red)]'
          } p-8 flex flex-col gap-4`}>
            <h3 className="text-xl font-bold text-[var(--off-white)] mb-2">Resource Links</h3>
            {fieldErrors.resourceLinks && (
              <p className="text-sm text-[var(--title-red)]">{fieldErrors.resourceLinks}</p>
            )}
            <div className="flex flex-col gap-3">
              {resourceLinks.map((link, index) => (
                <div key={index} className="grid grid-cols-5 gap-3 items-center">
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="Link Title"
                      className={`w-full p-2 rounded-lg bg-[#18181b] border ${
                        !link.name.trim() ? 'border-[var(--muted-red)]' : 'border-gray-600'
                      } text-[var(--off-white)] outline-none`}
                      value={link.name}
                      onChange={(e) => {
                        const newLinks = [...resourceLinks];
                        newLinks[index].name = e.target.value;
                        setResourceLinks(newLinks);
                      }}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="url"
                      placeholder="URL (https://...)"
                      className={`w-full p-2 rounded-lg bg-[#18181b] border ${
                        link.url && !link.isValid 
                          ? 'border-[var(--title-red)]' 
                          : 'border-gray-600'
                      } text-[var(--off-white)] outline-none`}
                      value={link.url}
                      onChange={(e) => {
                        const newLinks = [...resourceLinks];
                        newLinks[index].url = e.target.value;
                        newLinks[index].isValid = isValidUrl(e.target.value);
                        setResourceLinks(newLinks);
                      }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const newLinks = [...resourceLinks];
                        newLinks.splice(index, 1);
                        setResourceLinks(newLinks);
                      }}
                      className="p-2 rounded-lg text-[var(--muted-red)] hover:text-[var(--title-red)] hover:bg-[#1a1a1a] transition-colors"
                      aria-label="Remove link"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
              
              <button
                type="button"
                onClick={() => {
                  setResourceLinks([...resourceLinks, { name: '', url: '', isValid: false }]);
                }}
                className="mt-2 flex items-center gap-2 text-[var(--off-white)] hover:text-[var(--title-red)] transition-colors bg-[#1a1a1a] hover:bg-[#232323] p-2 rounded-lg self-start"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Resource Link
              </button>
              
              <p className="text-xs text-gray-400 mt-2">
                Add links to resources like documentation, setup guides, or contribution guidelines.
              </p>
            </div>
          </section>

          <div className="text-sm text-gray-400 italic mt-2">
            <span className="text-[var(--title-red)]">*</span> Required fields
          </div>

          {/* Preview Button and Preview Component */}
          <div className="w-full flex flex-col items-center mt-6 mb-2">
            <button
              type="button"
              onClick={() => setIsPreviewVisible(!isPreviewVisible)}
              className="px-6 py-2 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 
                bg-[#232323] text-[var(--off-white)] hover:bg-[#2a2a2a] border border-[var(--muted-red)]
                focus:outline-none focus:ring-1 focus:ring-[var(--title-red)]"
            >
              {isPreviewVisible ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Hide Preview
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Preview Project
                </>
              )}
            </button>
          </div>
          
          {/* Project Preview */}
          {isPreviewVisible && (
            <div className="w-full flex justify-center mb-10 mt-4 animate-fadeIn">
              <div className="bg-[#1a1a1a] p-6 rounded-xl border border-[var(--muted-red)] shadow-lg">
                <h3 className="text-lg font-bold text-[var(--off-white)] mb-4">Project Preview</h3>
                <ProjectPreview
                  id="preview"
                  name={repoName || "Project Name"}
                  date={new Date().toISOString()}
                  tags={highlightedTags.map(tag => ({ 
                    name: tag, 
                    is_highlighted: true,
                    colour: "amber-500"
                  })).concat(
                    selectedTags
                      .filter(tag => !highlightedTags.includes(tag))
                      .map(tag => ({ 
                        name: tag,
                        is_highlighted: false,
                        colour: "gray-500"
                      }))
                  )}
                  description={customDescription || "No description provided yet."}
                  techStack={highlightedTechnologies.length > 0 ? highlightedTechnologies : selectedTechnologies}
                  issueCount={repoInfo.openIssues || 0}
                  image={bannerImagePreview}
                />
              </div>
            </div>
          )}

          <div className="w-full flex justify-center mt-10 mb-16">
            <button
              type="submit"
              disabled={isSubmitting || !hasRepoAccess}
              className={`px-10 py-4 rounded-xl font-bold flex items-center gap-3 text-lg transition-all duration-200 shadow-lg
                ${isSubmitting || !hasRepoAccess
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  : 'bg-[var(--title-red)] text-white hover:scale-105 hover:bg-[var(--orange)] focus:outline-none focus:ring-2 focus:ring-[var(--orange)]'}`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isEditMode ? "Updating..." : "Submitting..."}
                </>
              ) : !hasRepoAccess ? (
                "No Repository Access"
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {isEditMode ? "Update Project" : "Post Project"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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

