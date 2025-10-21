"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CodeConnectTitle from "./Components/CodeConnectTitle";
import ProjectPreview from "./Components/ProjectPreview";
import Notification from "@/app/Components/Notification";
import { supabase } from '@/supabaseClient';
import { getPopularProjects, getHybridRecommendations } from '@/services/recommendation-service';

async function getTrendingProjects(limit = 5) {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    //console.log(`Fetching trending projects for past 7 days (since ${oneWeekAgo.toISOString()})`);

    //console.log('Attempting RPC call to get_trending_projects...');
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

      //console.log('RPC failed, returning empty array');
      return [];
    }

    //console.log('RPC succeeded, trending projects:', data);
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
    const storedNotification = localStorage.getItem('notification');
    if (storedNotification) {
      try {
        const parsedNotification = JSON.parse(storedNotification);

        if (parsedNotification.timestamp && (Date.now() - parsedNotification.timestamp < 10000)) {
          setNotification({
            message: parsedNotification.message,
            type: parsedNotification.type
          });
        }

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

  const CACHE_EXPIRATION = 5 * 60 * 1000;

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
    if (!projectIds || !projectIds.length) return {};
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

        let recommendations = [];
        if (session?.user) {
          const fetchedRecs = await getHybridRecommendations(session.user.id, 3, true);

          if (fetchedRecs?.length > 0) {
            const projectsWithData = await Promise.all(
              fetchedRecs.map(async (project) => {
                const { technologies, tags } = await fetchTagsAndTech(project.id);
                const openIssueCountMap = await fetchOpenIssueCounts([project.id]);
                const { data: projectDetails } = await supabase
                  .from('project')
                  .select('image')
                  .eq('id', project.id)
                  .single();
                
                return {
                  ...project,
                  technologies,
                  tags,
                  issueCount: openIssueCountMap[project.id] || 0,
                  image: projectDetails?.image || null
                };
              })
            );
            recommendations = projectsWithData;
          }
        }

        if (recommendations?.length > 0) {
          setCachedData(cacheKey, recommendations);
        }

        setRecommendedProjects(recommendations);
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
        const cacheKey = 'trending_projects';
        const cachedTrending = getCachedData(cacheKey);
        if (cachedTrending) {
          setTrendingProjects(cachedTrending);
          setLoadingTrending(false);
          return;
        }

        const trendingIds = await getTrendingProjects(3);
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
            custom_description, difficulty_level, created_at, image,
            project_commits ( timestamp ),
            project_issues ( updated_at ),
            project_pull_requests ( updated_at )
          `)
          .in('id', projectIds);

        const openIssueCountMap = await fetchOpenIssueCounts(projectIds);

        const projectsWithData = await Promise.all(
          projects.map(async (project) => {
            const { technologies, tags } = await fetchTagsAndTech(project.id);
            
            const dates = [
              project.created_at,
              ...(project.project_commits || []).map(commit => commit.timestamp),
              ...(project.project_issues || []).map(issue => issue.updated_at),
              ...(project.project_pull_requests || []).map(pr => pr.updated_at)
            ].filter(Boolean);
            
            const latestDate = dates.length > 0 
              ? new Date(Math.max(...dates.map(date => new Date(date).getTime()))).toISOString()
              : project.created_at;
            
            return {
              ...project,
              technologies,
              tags,
              issueCount: openIssueCountMap[project.id] || 0,
              latest_activity_date: latestDate
            };
          })
        );

        const sortedProjects = projectIds
          .map(id => projectsWithData.find(p => p.id === id))
          .filter(Boolean);

        setCachedData(cacheKey, sortedProjects);
        setTrendingProjects(sortedProjects);
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
        const cacheKey = 'newest_projects';
        const cachedNewest = getCachedData(cacheKey);
        if (cachedNewest) {
          setNewestProjects(cachedNewest);
          setLoadingNewest(false);
          return;
        }

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

        const sortedProjects = projectIds
          .map(id => projectsWithData.find(p => p.id === id))
          .filter(Boolean);

        setCachedData(cacheKey, sortedProjects);
        setNewestProjects(sortedProjects);
      } catch (error) {
        console.error('Error fetching newest projects:', error);
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
        const cacheKey = 'popular_projects';
        const cachedPopular = getCachedData(cacheKey);
        if (cachedPopular) {
          setPopularProjects(cachedPopular);
          setLoadingPopular(false);
          return;
        }

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

        const sortedProjects = projectIds
          .map(id => projectsWithData.find(p => p.id === id))
          .filter(Boolean);

        setCachedData(cacheKey, sortedProjects);
        setPopularProjects(sortedProjects);
      } catch (error) {
        console.error('Error fetching popular projects:', error);
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
        const cacheKey = 'beginner_projects';
        const cachedBeginner = getCachedData(cacheKey);
        if (cachedBeginner) {
          setBeginnerProjects(cachedBeginner);
          setLoadingBeginner(false);
          return;
        }

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

        const sortedProjects = projectIds
          .map(id => projectsWithData.find(p => p.id === id))
          .filter(Boolean);

        setCachedData(cacheKey, sortedProjects);
        setBeginnerProjects(sortedProjects);
      } catch (error) {
        console.error('Error fetching beginner projects:', error);
        setBeginnerProjects([]);
      } finally {
        setLoadingBeginner(false);
      }
    };
    fetchBeginnerProjects();
  }, []);

  const renderLoadingSpinner = (text) => (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="mb-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
        </div>
        <p className="text-sm text-off-white">{text}</p>
      </div>
    </div>
  );

  const renderProjectList = (projects, type) => (
    <div className="flex flex-wrap justify-center gap-6">
      {projects.map((project, index) => {
        const highlightedTags = project.tags.filter(tag => tag.is_highlighted);
        const tagsToShow = highlightedTags.length > 0 ? highlightedTags : project.tags.slice(0, 3);
        return (
          <ProjectPreview
            key={`${type}-${project.id}-${index}`}
            id={project.id}
            name={project.repo_name}
            date={project.latest_activity_date || project.created_at}
            tags={tagsToShow}
            description={project.custom_description}
            techStack={project.technologies
              .filter(tech => tech.is_highlighted)
              .map(tech => tech.name)}
            issueCount={project.issueCount || 0}
            recommended={type === 'recommended'}
            image={project.image}
          />
        );
      })}
    </div>
  );

  return (
    <div className="w-full min-h-screen flex flex-col items-center px-2 sm:px-4">
      <div className="hidden md:flex w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl my-4 md:my-6 justify-center items-center">
        <CodeConnectTitle />
      </div>
      {notification && (
        <Notification
          notification={notification}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="flex justify-center w-full max-w-[1200px]">
        <div
          className="
            main-page-contents
            w-full
            mx-auto
            py-6
            space-y-8
          "
        >
          <div className="w-full">
            <div className="flex justify-between items-center mb-2 px-2">
              <h3 className="inter-bold main-subtitle">Recommended For You:</h3>
              {user && (
                <Link href="/recommended" className="text-sm inria-sans-bold title-red hover:underline">View more</Link>
              )}
            </div>
            {loadingRecommendations ? (
              renderLoadingSpinner('Loading recommendations...')
            ) : !user ? (
              <div className="relative">
                <div className="flex flex-wrap justify-center gap-4 blur-sm opacity-60">
                  {[...Array(3)].map((_, index) => (
                    <div key={`placeholder-${index}`} className="w-[calc(100%-1rem)] sm:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1rem)]">
                      <ProjectPreview
                        id={index}
                        name={`Example Project ${index + 1}`}
                        date={"2025-03-15"}
                        tags={["React", "TypeScript", "UI/UX"]}
                        description="This is a placeholder project description to show the recommendation feature"
                        techStack={["React", "TypeScript", "Node.js"]}
                        issueCount={0}
                        recommended={true}
                      />
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="bg-gray-900 bg-opacity-80 rounded-lg p-4 sm:p-6 text-center">
                    <h3 className="text-md sm:text-lg font-bold mb-2">Log in for personalized recommendations</h3>
                    <p className="text-xs sm:text-sm">See projects tailored to your interests and skills</p>
                  </div>
                </div>
              </div>
            ) : recommendedProjects.length === 0 ? (
              <div className="bg-gray-900 rounded-lg p-6 sm:p-8 text-center mx-2">
                <h3 className="text-md sm:text-lg font-bold mb-2">Looking for recommendations?</h3>
                <p className="mb-3 text-xs sm:text-sm">Explore and interact with more projects to help us understand your interests!</p>
              </div>
            ) : (
              renderProjectList(recommendedProjects, 'recommended')
            )}
          </div>

          <div className="w-full">
            <div className="flex justify-between items-center mb-2 px-2">
              <h3 className="inter-bold main-subtitle">Trending Projects:</h3>
              <Link href="/trending" className="text-sm inria-sans-bold title-red hover:underline">View more</Link>
            </div>
            {loadingTrending ? (
              renderLoadingSpinner('Loading trending projects...')
            ) : trendingProjects.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                No trending projects found
              </div>
            ) : (
              renderProjectList(trendingProjects, 'trending')
            )}
          </div>

          <div className="w-full">
            <div className="flex justify-between items-center mb-2 px-2">
              <h3 className="inter-bold main-subtitle">Newest Projects:</h3>
              <Link href="/newest" className="text-sm inria-sans-bold title-red hover:underline">View more</Link>
            </div>
            {loadingNewest ? (
              renderLoadingSpinner('Loading newest projects...')
            ) : newestProjects.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                No new projects found
              </div>
            ) : (
              renderProjectList(newestProjects, 'newest')
            )}
          </div>

          <div className="w-full">
            <div className="flex justify-between items-center mb-2 px-2">
              <h3 className="inter-bold main-subtitle">Popular Projects:</h3>
              <Link href="/popular" className="text-sm inria-sans-bold title-red hover:underline">View more</Link>
            </div>
            {loadingPopular ? (
              renderLoadingSpinner('Loading popular projects...')
            ) : popularProjects.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                No popular projects found
              </div>
            ) : (
              renderProjectList(popularProjects, 'popular')
            )}
          </div>

          <div className="w-full">
            <div className="flex justify-between items-center mb-2 px-2">
              <h3 className="inter-bold main-subtitle">Beginner Projects:</h3>
              <Link href="/beginner" className="text-sm inria-sans-bold title-red hover:underline">View more</Link>
            </div>
            {loadingBeginner ? (
              renderLoadingSpinner('Loading beginner projects...')
            ) : beginnerProjects.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                No beginner projects found
              </div>
            ) : (
              renderProjectList(beginnerProjects, 'beginner')
            )}
            <div className="w-full text-center mt-8">
              <a
                href="/newest"
                className="px-6 py-3 bg-[--title-red] text-white rounded-full font-bold hover:bg-[--orange] transition-colors"
              >
                Browse All Projects
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen w-full">
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
