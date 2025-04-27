"use client";
import React, { useState, useEffect, Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProjectPreview from "../Components/ProjectPreview";
import ProjectPageLayout from "../Components/ProjectPageLayout";
import useProjectFilters from "../hooks/useProjectFilters";
import { supabase } from '@/supabaseClient';
import { getHybridRecommendations } from '@/services/recommendation-service';

const SORT_OPTIONS = {
  LAST_UPDATED_NEWEST: 'Last Updated (Newest)',
  LAST_UPDATED_OLDEST: 'Last Updated (Oldest)',
  DATE_POSTED_NEWEST: 'Date Posted (Newest)',
  DATE_POSTED_OLDEST: 'Date Posted (Oldest)',
  MOST_INTERACTIONS: 'Most Interactions',
  LEAST_INTERACTIONS: 'Least Interactions',
};

function RecommendedProjectsContent() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(undefined);
  const [projects, setProjects] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [sortOption, setSortOption] = useState(SORT_OPTIONS.LAST_UPDATED_NEWEST);
  const resultsPerPage = 15;

  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = parseInt(searchParams.get("page") || "1", 10) || 1;

  const filterHookProps = useProjectFilters({ includeTags: true });
  const {
    selectedTechnologies,
    selectedContributionTypes,
    selectedDifficulties,
    selectedLastUpdated,
    filterMode,
    selectedTags,
    selectedLicense,
    selectedMentorship,
    setupTimeMin,
    setupTimeMax,
    ...restFilterProps
  } = filterHookProps;

  const filterPropsForLayout = { ...filterHookProps };

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

  const fetchInteractionCounts = async (projectIds) => {
    if (!projectIds || projectIds.length === 0) {
      return { likeCounts: {}, commentCounts: {}, viewCounts: {} };
    }

    try {
      const [likesRes, commentsRes, viewsRes] = await Promise.all([
        supabase.from('project_likes').select('project_id').in('project_id', projectIds),
        supabase.from('project_comments').select('project_id').in('project_id', projectIds),
        supabase.from('user_interactions').select('project_id').eq('interaction_type', 'view').in('project_id', projectIds)
      ]);

      if (likesRes.error) console.error("Error fetching likes:", likesRes.error);
      if (commentsRes.error) console.error("Error fetching comments:", commentsRes.error);
      if (viewsRes.error) console.error("Error fetching views:", viewsRes.error);

      const likeCounts = (likesRes.data || []).reduce((acc, { project_id }) => {
        acc[project_id] = (acc[project_id] || 0) + 1;
        return acc;
      }, {});

      const commentCounts = (commentsRes.data || []).reduce((acc, { project_id }) => {
        acc[project_id] = (acc[project_id] || 0) + 1;
        return acc;
      }, {});

      const viewCounts = (viewsRes.data || []).reduce((acc, { project_id }) => {
        acc[project_id] = (acc[project_id] || 0) + 1;
        return acc;
      }, {});

      return { likeCounts, commentCounts, viewCounts };

    } catch (error) {
      console.error("Error fetching interaction counts:", error);
      return { likeCounts: {}, commentCounts: {}, viewCounts: {} };
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    checkUser();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user || null);
    });
    return () => {
        authListener?.subscription.unsubscribe();
    };
  }, []);

  const fetchRecommendedAndFilteredProjects = useCallback(async (page) => {
    if (!user) {
      //console.log('User not logged in, skipping fetch.');
      setProjects([]);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    setLoading(true);
    //console.log(`Fetching page ${page} for user ${user.id}`);
    try {
      const recommendedProjectsData = await getHybridRecommendations(user.id, 100, false);
      //console.log('Raw recommended projects data:', recommendedProjectsData);

      if (!Array.isArray(recommendedProjectsData) || recommendedProjectsData.length === 0) {
        //console.log('No recommended projects found or data is invalid.');
        setProjects([]);
        setTotalPages(1);
        setLoading(false);
        return;
      }

      const recommendedProjectIds = recommendedProjectsData.map(p => p.id).filter(id => id !== undefined);
      //console.log('Filtered recommended project IDs:', recommendedProjectIds);

      if (recommendedProjectIds.length === 0) {
          //console.log('No valid recommended project IDs after filtering.');
          setProjects([]);
          setTotalPages(1);
          setLoading(false);
          return;
      }

      const offset = (page - 1) * resultsPerPage;
      
      const numericDifficulties = selectedDifficulties.map(d => 
        typeof d === 'string' ? parseInt(d, 10) : d
      ).filter(d => !isNaN(d));
      
      const filtersJSON = {
        ...(selectedTechnologies.length > 0 && { technologies: selectedTechnologies }),
        ...(selectedTags.length > 0 && { tags: selectedTags }),
        ...(selectedContributionTypes.length > 0 && { contribution_types: selectedContributionTypes }),
        ...(numericDifficulties.length > 0 && { difficulties: numericDifficulties }),
        ...(selectedLastUpdated && { last_updated: selectedLastUpdated }),
        ...(selectedLicense && { license: selectedLicense }),
        ...(selectedMentorship && { mentorship: selectedMentorship }),
        ...(setupTimeMin && { setup_time_min: setupTimeMin }),
        ...(setupTimeMax && { setup_time_max: setupTimeMax }),
        filter_mode: filterMode,
        project_ids: recommendedProjectIds
      };

      const rpcArgs = {
        filters: filtersJSON,
        results_limit: resultsPerPage,
        results_offset: offset,
      };
      //console.log('RPC arguments for get_filtered_paginated_projects:', rpcArgs);

      const { data: filteredData, error: rpcError } = await supabase.rpc(
        'get_recommended_filtered_paginated_projects',
        rpcArgs
      );
      //console.log('[Recommended Page] RPC Result (filteredData):', filteredData);
      //console.log('[Recommended Page] RPC Error:', rpcError);

      if (rpcError) {
        console.error("Error fetching filtered recommended project IDs:", rpcError);
        setProjects([]);
        setTotalPages(1);
        setLoading(false);
        return;
      }

      if (!filteredData || filteredData.length === 0) {
        //console.log('No projects returned from RPC call.');
        setProjects([]);
        setTotalPages(1);
        setLoading(false);
        return;
      }

      const finalProjectIds = filteredData.map(item => item.project_id);
      const totalCount = filteredData[0]?.total_filtered_count || 0;
      //console.log('Final project IDs for details fetch:', finalProjectIds);
      //console.log('Total filtered count from RPC:', totalCount);

      setTotalPages(Math.ceil(totalCount / resultsPerPage));

      const { data: projectDetails, error: projectError } = await supabase
        .from('project')
        .select(`
          id, repo_name, repo_owner, description_type,
          custom_description, difficulty_level, created_at,
          license, mentorship, setup_time, image,
          project_technologies ( is_highlighted, technologies ( name ) ),
          project_tags ( is_highlighted, tags ( name, colour ) ),
          project_contribution_type ( contribution_type ( name ) ),
          project_commits ( timestamp ),
          project_issues ( updated_at ),
          project_pull_requests ( updated_at )
        `)
        .in('id', finalProjectIds);
      //console.log('Fetched project details:', projectDetails);

      if (projectError) {
        console.error("Error fetching project details:", projectError);
        setProjects([]);
        setLoading(false);
        return;
      }

      const [openIssueCountMap, interactionCounts] = await Promise.all([
        fetchOpenIssueCounts(finalProjectIds),
        fetchInteractionCounts(finalProjectIds)
      ]);
      const { likeCounts, commentCounts, viewCounts } = interactionCounts;

      //console.log('Open issue counts:', openIssueCountMap);
      //console.log('Interaction counts:', interactionCounts);

      const processedProjects = (projectDetails || []).map(proj => {
          const technologies = (proj.project_technologies || []).map(pt => ({
              name: pt.technologies?.name,
              is_highlighted: pt.is_highlighted
          })).filter(t => t.name);

          const tags = (proj.project_tags || []).map(ptag => ({
              name: ptag.tags?.name,
              colour: ptag.tags?.colour,
              is_highlighted: ptag.is_highlighted
          })).filter(t => t.name);

          const dates = [
            proj.created_at,
            ...(proj.project_commits || []).map(commit => commit.timestamp),
            ...(proj.project_issues || []).map(issue => issue.updated_at),
            ...(proj.project_pull_requests || []).map(pr => pr.updated_at)
          ].filter(Boolean);

          const latestDate = dates.length > 0
            ? new Date(Math.max(...dates.map(date => new Date(date).getTime()))).toISOString()
            : proj.created_at;

          const likes = likeCounts[proj.id] || 0;
          const comments = commentCounts[proj.id] || 0;
          const views = viewCounts[proj.id] || 0;
          const interactionScore = (likes * 2) + (comments * 1.5) + (views * 0.5);

          return {
              ...proj,
              technologies,
              tags,
              latest_activity_date: latestDate,
              issueCount: openIssueCountMap[proj.id] || 0,
              interactionScore: interactionScore
          };
      });
      //console.log('Processed projects for display:', processedProjects);

      setProjects(processedProjects);

    } catch (error) {
      console.error("Unexpected error fetching recommended projects:", error);
      setProjects([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
      //console.log('Finished fetching recommended projects.');
    }
  }, [
      user,
      selectedTechnologies, selectedTags, selectedContributionTypes, selectedDifficulties,
      selectedLastUpdated, selectedLicense, selectedMentorship, setupTimeMin,
      setupTimeMax, filterMode, resultsPerPage
  ]);

  useEffect(() => {
    if (user === undefined) {
      setLoading(true);
    } else {
      fetchRecommendedAndFilteredProjects(currentPage);
    }
  }, [user, currentPage, fetchRecommendedAndFilteredProjects]);

  const sortedProjects = useMemo(() => {
    if (!projects || projects.length === 0) return [];

    let sorted = [...projects];

    switch (sortOption) {
      case SORT_OPTIONS.LAST_UPDATED_NEWEST:
        sorted.sort((a, b) => new Date(b.latest_activity_date) - new Date(a.latest_activity_date));
        break;
      case SORT_OPTIONS.LAST_UPDATED_OLDEST:
        sorted.sort((a, b) => new Date(a.latest_activity_date) - new Date(b.latest_activity_date));
        break;
      case SORT_OPTIONS.DATE_POSTED_NEWEST:
        sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case SORT_OPTIONS.DATE_POSTED_OLDEST:
        sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case SORT_OPTIONS.MOST_INTERACTIONS:
        sorted.sort((a, b) => b.interactionScore - a.interactionScore);
        break;
      case SORT_OPTIONS.LEAST_INTERACTIONS:
        sorted.sort((a, b) => a.interactionScore - b.interactionScore);
        break;
      default:
        sorted.sort((a, b) => new Date(b.latest_activity_date) - new Date(a.latest_activity_date));
        break;
    }
    return sorted;
  }, [projects, sortOption]);


  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const params = new URLSearchParams(searchParams);
      params.set('page', String(currentPage + 1));
      router.push(`?${params.toString()}`, { scroll: false });
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const params = new URLSearchParams(searchParams);
      params.set('page', String(currentPage - 1));
      router.push(`?${params.toString()}`, { scroll: false });
    }
  };

  return (
    <ProjectPageLayout
      title={user ? "Recommended Projects" : "Log in for Recommendations"}
      loading={loading && user === undefined}
      filterProps={filterPropsForLayout}
      projectCount={user && !loading ? sortedProjects.length : 0}
      availableSortOptions={Object.values(SORT_OPTIONS)}
      selectedSortOption={sortOption}
      onSortChange={setSortOption}
    >
      {!user && !loading && user !== undefined && (
        <div className="bg-gray-900 rounded-lg p-6 mb-6 text-center">
          <h3 className="text-xl font-bold mb-2">Log in for personalized recommendations</h3>
          <p className="mb-4">Sign in to see projects tailored to your interests.</p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-red-600 rounded hover:bg-red-700 transition"
          >
            Sign In
          </button>
        </div>
      )}

      {loading && user !== undefined && (
         <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <div className="mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
              </div>
              <p className="text-sm text-off-white">Loading projects...</p>
            </div>
          </div>
      )}

      {!loading && user && sortedProjects.length === 0 && (
        <div className="text-center py-12 bg-gray-900 rounded-lg">
          <h3 className="text-xl font-bold mb-3">No matching recommendations found</h3>
          <p>Try adjusting your filter criteria or interact with more projects.</p>
        </div>
      )}

      {!loading && sortedProjects.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedProjects.map(project => {
              if (!project || typeof project.id === 'undefined') {
                  console.warn("Skipping rendering invalid project data:", project);
                  return null;
              }

              const techStackToShow = project.technologies
                ?.filter(tech => tech.is_highlighted)
                .map(tech => tech.name) || [];

              return (
                <ProjectPreview
                  key={project.id}
                  id={project.id}
                  name={project.repo_name || "Unnamed Project"}
                  date={project.latest_activity_date || project.created_at || new Date().toISOString()}
                  tags={Array.isArray(project.tags) ? project.tags : []}
                  description={project.custom_description || "No custom description provided."}
                  techStack={techStackToShow}
                  recommended={true}
                  image={project.image}
                  issueCount={project.issueCount || 0}
                />
              );
            })}
          </div>

          {totalPages > 1 && (
             <div className="flex justify-between items-center mt-6">
               <button
                 onClick={handlePreviousPage}
                 disabled={currentPage === 1 || loading}
                 className="px-4 py-2 bg-gray-800 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 Previous
               </button>
               <span className="text-white">
                 Page {currentPage} of {totalPages}
               </span>
               <button
                 onClick={handleNextPage}
                 disabled={currentPage === totalPages || loading}
                 className="px-4 py-2 bg-gray-800 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 Next
               </button>
             </div>
          )}
        </>
      ) : null}
    </ProjectPageLayout>
  );
}

export default function RecommendedProjectsPage() {
  return (
    <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen w-full">
            <div className="text-center">
            <div className="mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
            </div>
            <h1 className="inria-sans-bold text-xl text-off-white">Loading Recommendations</h1>
            </div>
        </div>
    }>
      <RecommendedProjectsContent />
    </Suspense>
  );
}