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

        // Get trending projects based on combined likes and comments
        const trendingIds = await getTrendingProjects(5);
        console.log('Trending project IDs returned:', trendingIds);
        
        if (!trendingIds || trendingIds.length === 0) {
          console.log('No trending projects found');
          setTrendingProjects([]);
          setLoadingTrending(false);
          return;
        }
        
        // Get activity data for each trending project
        for (const item of trendingIds) {
          // Log likes count
          const { data: likes, error: likeError } = await supabase
            .from('project_likes')
            .select('created_at', { count: 'exact' })
            .eq('project_id', item.project_id)
            .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
          
          // Log comments count
          const { data: comments, error: commentError } = await supabase
            .from('project_comments')
            .select('created_at', { count: 'exact' })
            .eq('project_id', item.project_id)
            .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
          
          console.log(`Project ${item.project_id} activity:`, {
            likes: likes?.length || 0,
            comments: comments?.length || 0,
            total: (likes?.length || 0) + (comments?.length || 0)
          });
        }
        
        // Fetch the actual project details for each trending ID
        const { data: projects, error: projectsError } = await supabase
          .from('project')
          .select(`
            id,
            repo_name,
            repo_owner,
            description_type,
            custom_description,
            difficulty_level,
            created_at,
            image
          `)
          .in('id', trendingIds.map(item => item.project_id));
          
        if (projectsError) {
          console.error('Error fetching project details:', projectsError);
          return;
        }
        
        // Now fetch technologies and tags for each project
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
                  name,
                  colour
                )
              `)
              .eq('project_id', project.id);

            if (techError) console.error('Error fetching technologies:', techError);
            if (tagError) console.error('Error fetching tags:', tagError);

            return {
              ...project,
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
          })
        );
        
        if (projectsWithData?.length > 0) {
          setCachedData('trending_projects', projectsWithData);
        }
        
        setTrendingProjects(projectsWithData);
      } catch (error) {
        console.error('Error fetching trending projects:', error);
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
        const cachedNewest = getCachedData('newest_projects');
        if (cachedNewest) {
          console.log('Using cached newest projects');
          setNewestProjects(cachedNewest);
          setLoadingNewest(false);
          return;
        }

        // Get newest projects
        const { data: newestIds, error } = await supabase.rpc('get_newest_projects', {
          results_limit: 3
        });
        
        if (error) {
          console.error('Error fetching newest projects:', error);
          setNewestProjects([]);
          setLoadingNewest(false);
          return;
        }
        
        if (!newestIds || newestIds.length === 0) {
          setNewestProjects([]);
          setLoadingNewest(false);
          return;
        }

        // Fetch project details
        const { data: projects } = await supabase
          .from('project')
          .select(`
            id,
            repo_name,
            repo_owner,
            description_type,
            custom_description,
            difficulty_level,
            created_at,
            image
          `)
          .in('id', newestIds.map(item => item.project_id));
        
        // Fetch technologies and tags for each project
        const projectsWithData = await Promise.all(
          projects.map(async (project) => {
            const { data: techData } = await supabase
              .from('project_technologies')
              .select(`
                technologies (name),
                is_highlighted
              `)
              .eq('project_id', project.id);

            const { data: tagData } = await supabase
              .from('project_tags')  
              .select(`
                tag_id, 
                tags!inner (  
                  name,
                  colour
                )
              `)
              .eq('project_id', project.id);

            return {
              ...project,
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
          })
        );
        
        if (projectsWithData?.length > 0) {
          setCachedData('newest_projects', projectsWithData);
        }
        
        setNewestProjects(projectsWithData);
      } catch (error) {
        console.error('Error in fetchNewestProjects:', error);
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
        const cachedPopular = getCachedData('popular_projects');
        if (cachedPopular) {
          console.log('Using cached popular projects');
          setPopularProjects(cachedPopular);
          setLoadingPopular(false);
          return;
        }

        // Get popular projects
        const { data: popularIds, error } = await supabase.rpc('get_popular_projects', {
          results_limit: 3
        });
        
        if (error) {
          console.error('Error fetching popular projects:', error);
          setPopularProjects([]);
          setLoadingPopular(false);
          return;
        }
        
        if (!popularIds || popularIds.length === 0) {
          setPopularProjects([]);
          setLoadingPopular(false);
          return;
        }

        // Fetch project details
        const { data: projects } = await supabase
          .from('project')
          .select(`
            id,
            repo_name,
            repo_owner,
            description_type,
            custom_description,
            difficulty_level,
            created_at,
            image
          `)
          .in('id', popularIds.map(item => item.project_id));
        
        // Fetch technologies and tags for each project
        const projectsWithData = await Promise.all(
          projects.map(async (project) => {
            const { data: techData } = await supabase
              .from('project_technologies')
              .select(`
                technologies (name),
                is_highlighted
              `)
              .eq('project_id', project.id);

            const { data: tagData } = await supabase
              .from('project_tags')  
              .select(`
                tag_id, 
                tags!inner (  
                  name,
                  colour
                )
              `)
              .eq('project_id', project.id);

            return {
              ...project,
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
          })
        );
        
        if (projectsWithData?.length > 0) {
          setCachedData('popular_projects', projectsWithData);
        }
        
        setPopularProjects(projectsWithData);
      } catch (error) {
        console.error('Error in fetchPopularProjects:', error);
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
        const cachedBeginner = getCachedData('beginner_projects');
        if (cachedBeginner) {
          console.log('Using cached beginner projects');
          setBeginnerProjects(cachedBeginner);
          setLoadingBeginner(false);
          return;
        }

        // Call our SQL function to get beginner projects
        const { data: beginnerIds, error } = await supabase.rpc('get_beginner_projects', {
          results_limit: 3
        });
        
        if (error) {
          console.error('Error fetching beginner projects:', error);
          setBeginnerProjects([]);
          setLoadingBeginner(false);
          return;
        }
        
        if (!beginnerIds || beginnerIds.length === 0) {
          setBeginnerProjects([]);
          setLoadingBeginner(false);
          return;
        }

        // Fetch project details
        const { data: projects } = await supabase
          .from('project')
          .select(`
            id,
            repo_name,
            repo_owner,
            description_type,
            custom_description,
            difficulty_level,
            created_at,
            image
          `)
          .in('id', beginnerIds.map(item => item.project_id));
        
        // Fetch technologies and tags for each project
        const projectsWithData = await Promise.all(
          projects.map(async (project) => {
            const { data: techData } = await supabase
              .from('project_technologies')
              .select(`
                technologies (name),
                is_highlighted
              `)
              .eq('project_id', project.id);

            const { data: tagData } = await supabase
              .from('project_tags')  
              .select(`
                tag_id, 
                tags!inner (  
                  name,
                  colour
                )
              `)
              .eq('project_id', project.id);

            return {
              ...project,
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
          })
        );
        
        if (projectsWithData?.length > 0) {
          setCachedData('beginner_projects', projectsWithData);
        }
        
        setBeginnerProjects(projectsWithData);
      } catch (error) {
        console.error('Error in fetchBeginnerProjects:', error);
        setBeginnerProjects([]);
      } finally {
        setLoadingBeginner(false);
      }
    };
    
    fetchBeginnerProjects();
  }, []);

  return (
    <div className="w-screen min-h-screen justify-center flex flex-col items-center">
      <CodeConnectTitle />
      {notification && (
        <Notification
          notification={notification}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="flex justify-center w-full">
        <div className="main-page-contents">
          <div className="w-full py-2.5">
            <div className="flex justify-between items-center">
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
              <div className="flex flex-wrap justify-around gap-4">
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

          <div className="w-full py-2.5">
            <div className="flex justify-between items-center">
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
              <div className="flex flex-wrap justify-around gap-4">
                {trendingProjects.map(project => (
                  <ProjectPreview
                    key={`trending-${project.id}`}
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
                    recommended={false}
                    image={project.image}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="w-full py-2.5">
            <div className="flex justify-between items-center">
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
              <div className="flex flex-wrap justify-around gap-4">
                {newestProjects.map(project => (
                  <ProjectPreview
                    key={`newest-${project.id}`}
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
                    recommended={false}
                    image={project.image}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="w-full py-2.5">
            <div className="flex justify-between items-center">
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
              <div className="flex flex-wrap justify-around gap-4">
                {popularProjects.map(project => (
                  <ProjectPreview
                    key={`popular-${project.id}`}
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
                    recommended={false}
                    image={project.image}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="w-full py-2.5">
            <div className="flex justify-between items-center">
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
              <div className="flex flex-wrap justify-around gap-4">
                {beginnerProjects.map(project => (
                  <ProjectPreview
                    key={`beginner-${project.id}`}
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
                    recommended={false}
                    image={project.image}
                  />
                ))}
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
