"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CodeConnectTitle from "./Components/CodeConnectTitle";
import ProjectPreview from "./Components/ProjectPreview";
import Notification from "@/app/Components/Notification";
import { supabase } from '@/supabaseClient';
import { getPopularProjects, getHybridRecommendations } from '@/services/recommendation-service';

// Function to get trending projects
async function getTrendingProjects(limit = 5) {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    console.log(`Fetching trending projects for past 7 days (since ${oneWeekAgo.toISOString()})`);
    
    console.log('Attempting RPC call to get_trending_projects...');
    const { data, error } = await supabase.rpc('get_trending_projects', {
      lookback_days: 7,
      results_limit: limit
    });
    
    if (error) {
      console.error('RPC Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      console.log('RPC failed, returning empty array');
      return [];
    }
    
    console.log('RPC succeeded, trending projects:', data);
    return data || [];
  } catch (error) {
    console.error('Unhandled error in getTrendingProjects:', error.message || error);
    return [];
  }
}

function HomeContent() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [recommendedProjects, setRecommendedProjects] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [trendingProjects, setTrendingProjects] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [newestProjects, setNewestProjects] = useState([]);
  const [loadingNewest, setLoadingNewest] = useState(true);
  const [popularProjects, setPopularProjects] = useState([]);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [beginnerProjects, setBeginnerProjects] = useState([]);
  const [loadingBeginner, setLoadingBeginner] = useState(true);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    // Check for notification in localStorage
    const storedNotification = localStorage.getItem('notification');
    if (storedNotification) {
      try {
        const parsedNotification = JSON.parse(storedNotification);
        
        // Only show notifications that are less than 10 seconds old
        if (parsedNotification.timestamp && (Date.now() - parsedNotification.timestamp < 10000)) {
          setNotification({
            message: parsedNotification.message,
            type: parsedNotification.type
          });
        }
        
        // Remove the notification from localStorage
        localStorage.removeItem('notification');
      } catch (e) {
        console.error('Error parsing notification:', e);
        localStorage.removeItem('notification');
      }
    }
  }, []);

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

  const fetchOpenIssueCounts = async (projectIds) => {
    if (!projectIds.length) return {};
    const { data: issuesData } = await supabase
      .from('project_issues')
      .select('project_id, state')
      .in('project_id', projectIds);

    const openIssueCountMap = {};
    if (issuesData) {
      issuesData.forEach(issue => {
        if (issue.state === 'open') {
          openIssueCountMap[issue.project_id] = (openIssueCountMap[issue.project_id] || 0) + 1;
        }
      });
    }
    return openIssueCountMap;
  };

  const fetchTagsAndTech = async (projectId) => {
    const [{ data: techData }, { data: tagData }] = await Promise.all([
      supabase
        .from('project_technologies')
        .select(`technologies (name), is_highlighted`)
        .eq('project_id', projectId),
      supabase
        .from('project_tags')
        .select(`tag_id, tags!inner (name, colour), is_highlighted`)
        .eq('project_id', projectId)
    ]);
    return {
      technologies: techData?.map(tech => ({
        name: tech.technologies.name,
        is_highlighted: tech.is_highlighted
      })) || [],
      tags: tagData?.map(tag => ({
        name: tag.tags.name,
        colour: tag.tags.colour,
        is_highlighted: tag.is_highlighted
      })) || []
    };
  };

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
          
          if (recommendations?.length > 0) {
            const projectsWithData = await Promise.all(
              recommendations.map(async (project) => {
                const { technologies, tags } = await fetchTagsAndTech(project.id);
                return {
                  ...project,
                  technologies,
                  tags,
                };
              })
            );
            recommendations = projectsWithData;
          }
        } else {
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

  useEffect(() => {
    const fetchTrendingProjects = async () => {
      setLoadingTrending(true);
      try {
        const cachedTrending = getCachedData('trending_projects');
        if (cachedTrending) {
          console.log('Using cached trending projects:', cachedTrending);
          setTrendingProjects(cachedTrending);
          setLoadingTrending(false);
          return;
        }

        const trendingIds = await getTrendingProjects(5);
        if (!trendingIds || trendingIds.length === 0) {
          setTrendingProjects([]);
          setLoadingTrending(false);
          return;
        }
        const projectIds = trendingIds.map(item => item.project_id).filter(Boolean);
        if (!projectIds.length) {
          setTrendingProjects([]);
          setLoadingTrending(false);
          return;
        }
        const { data: projects } = await supabase
          .from('project')
          .select(`
            id, repo_name, repo_owner, description_type, 
            custom_description, difficulty_level, created_at, image
          `)
          .in('id', projectIds);

        const openIssueCountMap = await fetchOpenIssueCounts(projectIds);

        const projectsWithData = await Promise.all(
          projects.map(async (project) => {
            const { technologies, tags } = await fetchTagsAndTech(project.id);
            return {
              ...project,
              technologies,
              tags,
              issueCount: openIssueCountMap[project.id] || 0
            };
          })
        );
        setTrendingProjects(projectsWithData);
      } catch (error) {
        setTrendingProjects([]);
      } finally {
        setLoadingTrending(false);
      }
    };
    fetchTrendingProjects();
  }, []);

  useEffect(() => {
    const fetchNewestProjects = async () => {
      setLoadingNewest(true);
      try {
        const { data: newestIds, error } = await supabase.rpc('get_newest_projects', {
          results_limit: 3
        });
        if (error || !newestIds || newestIds.length === 0) {
          setNewestProjects([]);
          setLoadingNewest(false);
          return;
        }
        const projectIds = newestIds.map(item => item.project_id).filter(Boolean);
        if (!projectIds.length) {
          setNewestProjects([]);
          setLoadingNewest(false);
          return;
        }
        const { data: projects } = await supabase
          .from('project')
          .select(`
            id, repo_name, repo_owner, description_type, 
            custom_description, difficulty_level, created_at, image
          `)
          .in('id', projectIds);

        const openIssueCountMap = await fetchOpenIssueCounts(projectIds);

        const projectsWithData = await Promise.all(
          projects.map(async (project) => {
            const { technologies, tags } = await fetchTagsAndTech(project.id);
            return {
              ...project,
              technologies,
              tags,
              issueCount: openIssueCountMap[project.id] || 0
            };
          })
        );
        setNewestProjects(projectsWithData);
      } catch (error) {
        setNewestProjects([]);
      } finally {
        setLoadingNewest(false);
      }
    };
    fetchNewestProjects();
  }, []);

  useEffect(() => {
    const fetchPopularProjects = async () => {
      setLoadingPopular(true);
      try {
        const { data: popularIds, error } = await supabase.rpc('get_popular_projects', {
          results_limit: 3
        });
        if (error || !popularIds || popularIds.length === 0) {
          setPopularProjects([]);
          setLoadingPopular(false);
          return;
        }
        const projectIds = popularIds.map(item => item.project_id).filter(Boolean);
        if (!projectIds.length) {
          setPopularProjects([]);
          setLoadingPopular(false);
          return;
        }
        const { data: projects } = await supabase
          .from('project')
          .select(`
            id, repo_name, repo_owner, description_type, 
            custom_description, difficulty_level, created_at, image
          `)
          .in('id', projectIds);

        const openIssueCountMap = await fetchOpenIssueCounts(projectIds);

        const projectsWithData = await Promise.all(
          projects.map(async (project) => {
            const { technologies, tags } = await fetchTagsAndTech(project.id);
            return {
              ...project,
              technologies,
              tags,
              issueCount: openIssueCountMap[project.id] || 0
            };
          })
        );
        setPopularProjects(projectsWithData);
      } catch (error) {
        setPopularProjects([]);
      } finally {
        setLoadingPopular(false);
      }
    };
    fetchPopularProjects();
  }, []);

  useEffect(() => {
    const fetchBeginnerProjects = async () => {
      setLoadingBeginner(true);
      try {
        const { data: beginnerIds, error } = await supabase.rpc('get_beginner_projects', {
          results_limit: 3
        });
        if (error || !beginnerIds || beginnerIds.length === 0) {
          setBeginnerProjects([]);
          setLoadingBeginner(false);
          return;
        }
        const projectIds = beginnerIds.map(item => item.project_id).filter(Boolean);
        if (!projectIds.length) {
          setBeginnerProjects([]);
          setLoadingBeginner(false);
          return;
        }
        const { data: projects } = await supabase
          .from('project')
          .select(`
            id, repo_name, repo_owner, description_type, 
            custom_description, difficulty_level, created_at, image
          `)
          .in('id', projectIds);

        const openIssueCountMap = await fetchOpenIssueCounts(projectIds);

        const projectsWithData = await Promise.all(
          projects.map(async (project) => {
            const { technologies, tags } = await fetchTagsAndTech(project.id);
            return {
              ...project,
              technologies,
              tags,
              issueCount: openIssueCountMap[project.id] || 0
            };
          })
        );
        setBeginnerProjects(projectsWithData);
      } catch (error) {
        setBeginnerProjects([]);
      } finally {
        setLoadingBeginner(false);
      }
    };
    fetchBeginnerProjects();
  }, []);

  return (
    <div className="w-full min-h-screen flex flex-col items-center">
      <CodeConnectTitle />
      {notification && (
        <Notification
          notification={notification}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="flex justify-center w-full px-2 sm:px-4 max-w-[1200px]">
        <div
          className="
            main-page-contents
            w-full
            mx-auto
            py-6
            space-y-8
          "
        >
          {/* --- Recommended Section --- */}
          <div className="w-full">
            <div className="flex justify-between items-center mb-2">
              <h3 className="inter-bold main-subtitle">Recommended For You:</h3>
              <Link href="/recommended" className="text-sm inria-sans-bold title-red hover:underline">View more</Link>
            </div>
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
                <div className="flex flex-wrap justify-around gap-4 blur-sm opacity-60 space-between">
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
                  <div className="bg-gray-900 bg-opacity-80 rounded-lg p-6 text-center">
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
              <div className="flex flex-wrap justify-center gap-6">
                {recommendedProjects.map((project, index) => (
                  <ProjectPreview
                    key={`recommended-${project.id}-${index}`}
                    id={project.id}
                    name={project.repo_name}
                    date={project.created_at}
                    tags={
                      project.tags && project.tags.filter(tag => tag.is_highlighted).length > 0
                        ? project.tags.filter(tag => tag.is_highlighted)
                        : project.tags.slice(0, 3)
                    }
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
                    image={project.image}
                  />
                ))}
              </div>
            )}
          </div>

          {/* --- Trending Section --- */}
          <div className="w-full">
            <div className="flex justify-between items-center mb-2">
              <h3 className="inter-bold main-subtitle">Trending Projects:</h3>
              <Link href="/trending" className="text-sm inria-sans-bold title-red hover:underline">View more</Link>
            </div>
            {loadingTrending ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="mb-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
                  </div>
                  <p className="text-sm text-off-white">Loading trending projects...</p>
                </div>
              </div>
            ) : trendingProjects.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                No trending projects found
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-6">
                {trendingProjects.map(project => {
                  const highlightedTags = project.tags.filter(tag => tag.is_highlighted);
                  const tagsToShow = highlightedTags.length > 0 ? highlightedTags : project.tags.slice(0, 3);
                  return (
                    <ProjectPreview
                      key={`trending-${project.id}`}
                      id={project.id}
                      name={project.repo_name}
                      date={project.created_at}
                      tags={tagsToShow}
                      description={
                        project.description_type === "Write your Own"
                          ? project.custom_description
                          : "GitHub project description"
                      }
                      techStack={project.technologies
                        .filter(tech => tech.is_highlighted)
                        .map(tech => tech.name)}
                      issueCount={project.issueCount || 0}
                      recommended={false}
                      image={project.image}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* --- Newest Section --- */}
          <div className="w-full">
            <div className="flex justify-between items-center mb-2">
              <h3 className="inter-bold main-subtitle">Newest Projects:</h3>
              <Link href="/newest" className="text-sm inria-sans-bold title-red hover:underline">View more</Link>
            </div>
            {loadingNewest ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="mb-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
                  </div>
                  <p className="text-sm text-off-white">Loading newest projects...</p>
                </div>
              </div>
            ) : newestProjects.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                No new projects found
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-6">
                {newestProjects.map(project => {
                  const highlightedTags = project.tags.filter(tag => tag.is_highlighted);
                  const tagsToShow = highlightedTags.length > 0 ? highlightedTags : project.tags.slice(0, 3);
                  return (
                    <ProjectPreview
                      key={`newest-${project.id}`}
                      id={project.id}
                      name={project.repo_name}
                      date={project.created_at}
                      tags={tagsToShow}
                      description={
                        project.description_type === "Write your Own"
                          ? project.custom_description
                          : "GitHub project description"
                      }
                      techStack={project.technologies
                        .filter(tech => tech.is_highlighted)
                        .map(tech => tech.name)}
                      issueCount={project.issueCount || 0}
                      recommended={false}
                      image={project.image}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* --- Popular Section --- */}
          <div className="w-full">
            <div className="flex justify-between items-center mb-2">
              <h3 className="inter-bold main-subtitle">Popular Projects:</h3>
              <Link href="/popular" className="text-sm inria-sans-bold title-red hover:underline">View more</Link>
            </div>
            {loadingPopular ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="mb-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
                  </div>
                  <p className="text-sm text-off-white">Loading popular projects...</p>
                </div>
              </div>
            ) : popularProjects.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                No popular projects found
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-6">
                {popularProjects.map(project => {
                  const highlightedTags = project.tags.filter(tag => tag.is_highlighted);
                  const tagsToShow = highlightedTags.length > 0 ? highlightedTags : project.tags.slice(0, 3);
                  return (
                    <ProjectPreview
                      key={`popular-${project.id}`}
                      id={project.id}
                      name={project.repo_name}
                      date={project.created_at}
                      tags={tagsToShow}
                      description={
                        project.description_type === "Write your Own"
                          ? project.custom_description
                          : "GitHub project description"
                      }
                      techStack={project.technologies
                        .filter(tech => tech.is_highlighted)
                        .map(tech => tech.name)}
                      issueCount={project.issueCount || 0}
                      recommended={false}
                      image={project.image}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* --- Beginner Section --- */}
          <div className="w-full">
            <div className="flex justify-between items-center mb-2">
              <h3 className="inter-bold main-subtitle">Beginner Projects:</h3>
              <Link href="/beginner" className="text-sm inria-sans-bold title-red hover:underline">View more</Link>
            </div>
            {loadingBeginner ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="mb-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
                  </div>
                  <p className="text-sm text-off-white">Loading beginner projects...</p>
                </div>
              </div>
            ) : beginnerProjects.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                No beginner projects found
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-6">
                {beginnerProjects.map(project => {
                  const highlightedTags = project.tags.filter(tag => tag.is_highlighted);
                  const tagsToShow = highlightedTags.length > 0 ? highlightedTags : project.tags.slice(0, 3);
                  return (
                    <ProjectPreview
                      key={`beginner-${project.id}`}
                      id={project.id}
                      name={project.repo_name}
                      date={project.created_at}
                      tags={tagsToShow}
                      description={
                        project.description_type === "Write your Own"
                          ? project.custom_description
                          : "GitHub project description"
                      }
                      techStack={project.technologies
                        .filter(tech => tech.is_highlighted)
                        .map(tech => tech.name)}
                      issueCount={project.issueCount || 0}
                      recommended={false}
                      image={project.image}
                    />
                  );
                })}
              </div>
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
