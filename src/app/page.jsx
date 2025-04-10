"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CodeConnectTitle from "./Components/CodeConnectTitle";
import ProjectPreview from "./Components/ProjectPreview";
import MultiSelector from "./Components/MultiSelector";
import SingleSelector from "./Components/SingleSelector";
import { supabase } from '@/supabaseClient';
import { getPopularProjects, getHybridRecommendations } from '@/services/recommendation-service';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [availableTechnologies, setAvailableTechnologies] = useState([]);
  const [selectedTechnologies, setSelectedTechnologies] = useState([]);
  const [selectedContributionTypes, setSelectedContributionTypes] = useState([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [selectedLastUpdated, setSelectedLastUpdated] = useState("");
  const [filterMode, setFilterMode] = useState('AND');
  const [user, setUser] = useState(null);
  const [recentProjects, setRecentProjects] = useState([]);
  const [recommendedProjects, setRecommendedProjects] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [loadingRecentProjects, setLoadingRecentProjects] = useState(true);

  useEffect(() => {
    const technologies = searchParams.get("technologies")?.split(",") || [];
    const contributionTypes = searchParams.get("contributionTypes")?.split(",") || [];
    const difficulty = searchParams.get("difficulty") || "";
    const lastUpdated = searchParams.get("lastUpdated") || "";
    const mode = searchParams.get("filterMode") || 'AND';

    setSelectedTechnologies(technologies.filter(Boolean));
    setSelectedContributionTypes(contributionTypes.filter(Boolean));
    setSelectedDifficulty(difficulty);
    setSelectedLastUpdated(lastUpdated);
    setFilterMode(mode);
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();

    if (selectedTechnologies.length > 0) {
      params.append("technologies", selectedTechnologies.join(","));
    }
    if (selectedContributionTypes.length > 0) {
      params.append("contributionTypes", selectedContributionTypes.join(","));
    }
    if (selectedDifficulty) {
      params.append("difficulty", selectedDifficulty);
    }
    if (selectedLastUpdated) {
      params.append("lastUpdated", selectedLastUpdated);
    }
    params.append("filterMode", filterMode);

    router.push(`?${params.toString()}`, { scroll: false });
  }, [
    selectedTechnologies,
    selectedContributionTypes,
    selectedDifficulty,
    selectedLastUpdated,
    filterMode,
    router
  ]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user && session.user.email ? { email: session.user.email } : null);
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user && session.user.email ? { email: session.user.email } : null);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchTechnologies = async () => {
      try {
        const { data, error } = await supabase
          .from('technologies')
          .select('id, name')
          .order('name');

        if (error) {
          console.error('Error fetching technologies:', error);
          return;
        }

        if (data) {
          setAvailableTechnologies(data);
        }
      } catch (error) {
        console.error('Failed to fetch technologies:', error);
      }
    };

    fetchTechnologies();
  }, []);

  const CACHE_EXPIRATION = 5 * 60 * 1000; // 5 minutes

  const getCachedData = (key) => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      
      const { data, timestamp } = JSON.parse(item);
      if (Date.now() - timestamp > CACHE_EXPIRATION) {
        localStorage.removeItem(key);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error(`Error retrieving cached ${key}:`, error);
      return null;
    }
  };

  const setCachedData = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error(`Error caching ${key}:`, error);
    }
  };

  useEffect(() => {
    const fetchRecentProjects = async () => {
      setLoadingRecentProjects(true);
      try {
        // Try to get cached data first
        const cachedProjects = getCachedData('recent_projects');
        if (cachedProjects) {
          setRecentProjects(cachedProjects);
          setLoadingRecentProjects(false);
          return;
        }

        // No cache, fetch from database
        const { data: projects, error: projectsError } = await supabase
          .from('project')
          .select(`
            id,
            repo_name,
            repo_owner,
            description_type,
            custom_description,
            difficulty_level,
            created_at
          `)
          .order('created_at', { ascending: false })
          .limit(5);

        if (projectsError) {
          console.error('Error fetching projects:', projectsError);
          return;
        }

        const projectsWithData = await Promise.all(
          projects.map(async (project) => {
            const { data: techData, error: techError } = await supabase
              .from('project_technologies')
              .select(`
                technologies (name),
                is_highlighted
              `)
              .eq('project_id', project.id);

            const { data: tagData, error: tagError } = await supabase
              .from('project_tags')  
              .select(`
                tag_id, 
                tags!inner (  
                  name
                )
              `)
              .eq('project_id', project.id);

            if (techError) {
              console.error('Error fetching technologies:', techError);
            }

            if (tagError) {
              console.error('Error fetching tags:', tagError.message || tagError);
            }

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

        // Cache the projects
        if (projectsWithData?.length > 0) {
          setCachedData('recent_projects', projectsWithData);
        }
        
        setRecentProjects(projectsWithData);
      } catch (error) {
        console.error('Failed to fetch recent projects:', error);
      } finally {
        setLoadingRecentProjects(false);
      }
    };

    fetchRecentProjects();
  }, []);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoadingRecommendations(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const cacheKey = session?.user?.id ? `recommendations_${session.user.id}` : 'recommendations_guest';
        
        const cachedRecommendations = getCachedData(cacheKey);
        if (cachedRecommendations) {
          setRecommendedProjects(cachedRecommendations);
          setLoadingRecommendations(false);
          return;
        }
        
        let recommendations;
        if (session?.user) {
          recommendations = await getHybridRecommendations(session.user.id, 3, true);
        } else {
          recommendations = await getPopularProjects(3, true);
        }
        
        if (recommendations?.length > 0) {
          setCachedData(cacheKey, recommendations);
        }
        
        setRecommendedProjects(recommendations || []);
      } catch (error) {
        console.error('Error fetching recommendations:', error);
        setRecommendedProjects([]);
      } finally {
        setLoadingRecommendations(false);
      }
    };
    
    fetchRecommendations();
  }, []);

  const handleTagsChange = (type, tags) => {
    switch (type) {
      case "technologies":
        setSelectedTechnologies(tags);
        break;
      case "contributionTypes":
        setSelectedContributionTypes(tags);
        break;
      default:
        break;
    }
  };

  const handleValueChange = (type, value) => {
    switch (type) {
      case "difficulty":
        setSelectedDifficulty(value);
        break;
      case "lastUpdated":
        setSelectedLastUpdated(value);
        break;
      case "filterMode":
        setFilterMode(value);
        break;
      default:
        break;
    }
  };

  const clearAllFilters = () => {
    setSelectedTechnologies([]);
    setSelectedContributionTypes([]);
    setSelectedDifficulty("");
    setSelectedLastUpdated("");
    setFilterMode('AND');
    router.push(`?`, { scroll: false });
  };

  const contributionTypes = [
    "Documentation",
    "Design",
    "Testing",
    "????",
    "Translation",
  ];

  const difficulty = ["Beginner", "Intermediate", "Advanced", "Expert"];
  const lastUpdated = ["Last 24 hours", "Last 7 days", "Last 30 days"];

  return (
    <div className="w-screen min-h-screen justify-center flex flex-col items-center">
      <CodeConnectTitle />
      <div className="flex justify-center w-full">
        <div className="main-page-contents">
          <div className="w-full py-2.5">
            <h3 className="inter-bold main-subtitle">Recommended For You:</h3>
            
            {loadingRecommendations ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="mb-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
                  </div>
                  <p className="text-sm text-off-white">Loading recommendations...</p>
                </div>
              </div>
            ) : !user ? (
              <div className="relative">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 blur-sm opacity-60">
                  {[...Array(3)].map((_, index) => (
                    <ProjectPreview
                      key={`placeholder-${index}`}
                      id={index}
                      name={`Example Project ${index + 1}`}
                      date={"2025-03-15"}
                      tags={["React", "TypeScript", "UI/UX"]}
                      description="This is a placeholder project description to show the recommendation feature"
                      techStack={["React", "TypeScript", "Node.js"]}
                      issueCount={0}
                      recommended={true}
                    />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className=" bg-opacity-70 p-6 text-center ">
                    <h3 className="text-lg font-bold mb-2">Log in for personalized recommendations</h3>
                    <p>See projects tailored to your interests and skills</p>
                  </div>
                </div>
              </div>
            ) : recommendedProjects.length === 0 ? (
              <div className="bg-gray-900 rounded-lg p-8 text-center">
                <h3 className="text-lg font-bold mb-2">Looking for recommendations?</h3>
                <p className="mb-3 text-sm">Explore and interact with more projects to help us understand your interests!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendedProjects.map(project => (
                  <ProjectPreview
                    key={project.id}
                    id={project.id}
                    name={project.repo_name}
                    date={project.created_at}
                    tags={project.tags.slice(0, 3)}
                    description={
                      project.description_type === "Write your Own" 
                        ? project.custom_description 
                        : "GitHub project description"
                    }
                    techStack={project.technologies
                      .filter(tech => tech.is_highlighted)
                      .map(tech => tech.name)}
                    issueCount={0}
                    recommended={true}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="w-full py-2.5">
            <h3 className="inter-bold main-subtitle">More Projects:</h3>
            <div className="w-full flex justify-evenly filtertag-holder">
              <div className="w-1/2 mr-2 h-full filter-holder">
                <h3 className="inter-bold main-subtitle">Filter By:</h3>
                <div className="main-page-filter-box radial-background px-2 py-1 inria-sans-bold flex flex-col justify-center">
                  <div>
                    <p>Technologies/Languages:</p>
                    <MultiSelector
                      availableTags={availableTechnologies.map(tech => tech.name)}
                      onTagsChange={(tags) =>
                        handleTagsChange("technologies", tags)
                      }
                      initialTags={selectedTechnologies}
                    />
                  </div>
                  <div>
                    <p>Contribution Type:</p>
                    <MultiSelector
                      availableTags={contributionTypes}
                      onTagsChange={(tags) =>
                        handleTagsChange("contributionTypes", tags)
                      }
                      initialTags={selectedContributionTypes}
                    />
                  </div>
                  <div>
                    <p>Difficulty:</p>
                    <SingleSelector
                      values={difficulty}
                      onValueChange={(value) =>
                        handleValueChange("difficulty", value || "")
                      }
                      initialValue={selectedDifficulty}
                    />
                  </div>
                  <div>
                    <p>Last Updated:</p>
                    <SingleSelector
                      values={lastUpdated}
                      onValueChange={(value) =>
                        handleValueChange("lastUpdated", value || "")
                      }
                      initialValue={selectedLastUpdated}
                    />
                  </div>
                  <div>
                    <p>Filter Mode:</p>
                    <SingleSelector
                      values={['AND', 'OR']}
                      onValueChange={(value) => handleValueChange("filterMode", value || 'AND')}
                      initialValue={filterMode}
                    />
                  </div>
                  <div>
                    <button onClick={clearAllFilters} className="flex items-center py-1 px-2 m-1 bg-red-700 hover:bg-red-900 rounded">
                      Clear All
                    </button>
                  </div>
                </div>
              </div>
              <div className="w-1/2 ml-2 filter-holder">
                <h3 className="inter-bold rad main-subtitle">Include These Tags:</h3>
                <div className="main-page-filter-box radial-background px-2 py-1"></div>
              </div>
            </div>
          </div>

          <div className="main-page-holder">
            {loadingRecentProjects ? (
              <div className="flex items-center justify-center p-8 w-full">
                <div className="text-center">
                  <div className="mb-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
                  </div>
                  <p className="text-sm text-off-white">Loading projects...</p>
                </div>
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                No projects found
              </div>
            ) : (
              recentProjects.map((project) => (
                <ProjectPreview
                  id={project.id}
                  key={project.id}
                  name={project.repo_name}
                  date={new Date(project.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  tags={project.tags.slice(0, 3)}
                  description={
                    project.description_type === "Write your Own" 
                      ? project.custom_description 
                      : "Loading GitHub description..."
                  }
                  techStack={project.technologies
                    .filter(tech => tech.is_highlighted)
                    .map(tech => tech.name)}
                  issueCount={0}
                  recommended={false}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen w-full radial-background">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
          </div>
          <h1 className="inria-sans-bold text-xl text-off-white">Loading Dashboard</h1>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
