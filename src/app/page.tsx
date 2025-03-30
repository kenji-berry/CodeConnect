"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CodeConnectTitle from "./Components/CodeConnectTitle";
import ProjectPreview from "./Components/ProjectPreview";
import MultiSelector from "./Components/MultiSelector";
import SingleSelector from "./Components/SingleSelector";
import { supabase } from '@/supabaseClient';
import { getRecommendedProjects, getPopularProjects, getHybridRecommendations } from '@/services/recommendation-service';

interface GitHubData {
  repositories?: any[];
  user?: {
    login: string;
    name: string;
    email: string;
  };
}

interface Technology {
  id: number;
  name: string;
}

interface Project {
  id: number;
  repo_name: string;
  repo_owner: string;
  description_type: string;
  custom_description: string | null;
  difficulty_level: number;
  created_at: string;
  technologies: {
    name: string;
    is_highlighted: boolean;
  }[];
  tags: string[];
}

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [availableTechnologies, setAvailableTechnologies] = useState<Technology[]>([]);
  const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>([]);
  const [selectedContributionTypes, setSelectedContributionTypes] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("");
  const [selectedLastUpdated, setSelectedLastUpdated] = useState<string>("");
  const [filterMode, setFilterMode] = useState<string>('AND');
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [githubData, setGithubData] = useState<GitHubData | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recommendedProjects, setRecommendedProjects] = useState<Project[]>([]);

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

  useEffect(() => {
    const fetchRecentProjects = async () => {
      try {
        // Fetch the 5 most recent projects with their basic info
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
        // Fetch technologies and tags for each project
        const projectsWithData = await Promise.all(
          projects.map(async (project) => {
            // Fetch technologies
            const { data: techData, error: techError } = await supabase
              .from('project_technologies')
              .select(`
                technologies (name),
                is_highlighted
              `)
              .eq('project_id', project.id);

            // Fetch tags
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

            console.log('Fetched technologies:', techData);
            console.log('Fetched tags:', tagData);

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

        setRecentProjects(projectsWithData);
        console.log(projectsWithData);
      } catch (error) {
        console.error('Failed to fetch recent projects:', error);
      }
    };

    fetchRecentProjects();
  }, []);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        console.log("===== RECOMMENDATION DEBUGGING =====");
        console.log("Fetching recommendations...");
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log("User logged in:", session.user.id);
          
          // Check if there are any interactions first
          const { data: interactions, error: interactionError } = await supabase
            .from('user_interactions')
            .select('*')
            .eq('user_id', session.user.id);
          
          if (interactionError) {
            console.error("Error fetching interactions:", interactionError);
          }
          
          console.log(`Found ${interactions?.length || 0} interactions for user:`);
          
          // Use hybrid recommendations instead of just content-based
          console.log("Calling getHybridRecommendations with debug enabled...");
          const recommendations = await getHybridRecommendations(session.user.id, 3, true);
          
          console.log("Recommendations received:", recommendations?.length || 0);
          console.log("Recommended projects:", recommendations?.map(p => 
            `${p.repo_name} (ID: ${p.id}, Tags: ${p.tags?.join(', ')}, Techs: ${p.technologies?.map(t => t.name).join(', ')})`
          ));
          
          setRecommendedProjects(recommendations || []);
        } else {
          console.log("No user session, getting popular projects");
          const popular = await getPopularProjects(3, true);
          console.log("Popular projects received:", popular?.length || 0);
          setRecommendedProjects(popular || []);
        }
        console.log("===== END RECOMMENDATION DEBUGGING =====");
      } catch (error) {
        console.error('Error fetching recommendations:', error);
        setRecommendedProjects([]);
      }
    };
    
    fetchRecommendations();
  }, []);

  const handleTagsChange = (type: string, tags: string[]) => {
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

  const handleValueChange = (type: string, value: string) => {
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

  const printTags = () => {
    console.log("selected stuff");
    console.log(selectedTechnologies);
    console.log(selectedContributionTypes);
    console.log(selectedDifficulty);
    console.log(selectedLastUpdated);
  };

  return (
    <div className="w-screen min-h-screen justify-center flex flex-col items-center">
      <CodeConnectTitle />
      <div className="flex justify-center w-full">
        <div className="main-page-contents">
          <div className="w-full py-2.5">
            <h3 className="inter-bold main-subtitle">Recommended For You:</h3>
            
            {!user ? (
              // User is not logged in - show blurred placeholder recommendations with overlay
              <div className="relative">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 blur-sm opacity-60">
                  {/* Static placeholder projects instead of fetching data */}
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
              // User is logged in but has no recommendations
              <div className="bg-gray-900 rounded-lg p-8 text-center">
                <h3 className="text-lg font-bold mb-2">Looking for recommendations?</h3>
                <p className="mb-3 text-sm">Explore and interact with more projects to help us understand your interests!</p>
              </div>
            ) : (
              // User is logged in and has recommendations - show normal view
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
            {recentProjects.map((project) => (
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
            ))}
            {recentProjects.length === 0 && (
              <div className="text-center text-gray-400 py-4">
                No projects found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
