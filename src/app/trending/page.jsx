
"use client";

import React, { Suspense } from "react";
import ProjectListPage from "../Components/ProjectListPage";
import { supabase } from "../../supabaseClient";

const SORT_OPTIONS = {
  LAST_UPDATED_NEWEST: 'Last Updated (Newest)',
  LAST_UPDATED_OLDEST: 'Last Updated (Oldest)',
  DATE_POSTED_NEWEST: 'Date Posted (Newest)',
  DATE_POSTED_OLDEST: 'Date Posted (Oldest)',
  MOST_INTERACTIONS: 'Most Interactions',
  LEAST_INTERACTIONS: 'Least Interactions',
};

async function getInitialTrendingProjectIds(limit = 100) {
  try {
    const { data, error } = await supabase.rpc('get_trending_projects', {
      lookback_days: 7,
      results_limit: limit
    });
    if (error) {
      return [];
    }
    return (data || []).map(item => item.project_id).filter(id => id !== undefined);
  } catch {
    return [];
  }
}

function TrendingProjectsContent() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [sortOption, setSortOption] = useState(SORT_OPTIONS.DATE_POSTED_NEWEST);
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

  const fetchTrendingAndFilteredProjects = useCallback(async (page) => {
    setLoading(true);
    try {
      const trendingProjectIds = await getInitialTrendingProjectIds(100);

      if (!Array.isArray(trendingProjectIds) || trendingProjectIds.length === 0) {
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
        project_ids: trendingProjectIds
      };

      const rpcArgs = {
        filters: filtersJSON,
        results_limit: resultsPerPage,
        results_offset: offset,
      };

      const { data: filteredData, error: rpcError } = await supabase.rpc(
        'get_filtered_paginated_projects',
        rpcArgs
      );

      if (rpcError) {
        console.error("Error fetching filtered trending project IDs:", rpcError);
        setProjects([]);
        setTotalPages(1);
        setLoading(false);
        return;
      }

      if (!filteredData || filteredData.length === 0) {
        setProjects([]);
        setTotalPages(1);
        setLoading(false);
        return;
      }

      const finalProjectIds = filteredData.map(item => item.project_id);
      const totalCount = filteredData[0]?.total_filtered_count || 0;

      setTotalPages(Math.ceil(totalCount / resultsPerPage));

      const { data: projectDetails, error: projectError } = await supabase
        .from('project')
        .select(`
          id, repo_name, repo_owner, description_type,
          custom_description, difficulty_level, created_at,
          license, mentorship, setup_time, image, github_link,
          project_technologies ( is_highlighted, technologies ( name ) ),
          project_tags ( is_highlighted, tags ( name, colour ) ),
          project_contribution_type ( contribution_type ( name ) ),
          project_commits ( timestamp ),
          project_issues ( updated_at ),
          project_pull_requests ( updated_at )
        `)
        .in('id', finalProjectIds)
        .order('created_at', { ascending: false });

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

        
          const contribution_types = (proj.project_contribution_type || []).map(pct => ({
              name: pct.contribution_type?.name
          })).filter(ct => ct.name);

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
              contribution_types,
              latest_activity_date: latestDate,
              issueCount: openIssueCountMap[proj.id] || 0,
              interactionScore: interactionScore
          };
      });

      setProjects(processedProjects);

    } catch (error) {
      console.error("Unexpected error fetching trending projects:", error);
      setProjects([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [
      selectedTechnologies, selectedTags, selectedContributionTypes, selectedDifficulties,
      selectedLastUpdated, selectedLicense, selectedMentorship, setupTimeMin,
      setupTimeMax, filterMode, resultsPerPage
  ]);

  useEffect(() => {
    fetchTrendingAndFilteredProjects(currentPage);
  }, [currentPage, fetchTrendingAndFilteredProjects]);

  const sortedProjects = useMemo(() => {
    if (!projects || projects.length === 0) return [];

    const projectsToSort = [...projects];

    switch (sortOption) {
      case SORT_OPTIONS.LAST_UPDATED_NEWEST:
        return projectsToSort.sort((a, b) => new Date(b.latest_activity_date) - new Date(a.latest_activity_date));
      case SORT_OPTIONS.LAST_UPDATED_OLDEST:
        return projectsToSort.sort((a, b) => new Date(a.latest_activity_date) - new Date(b.latest_activity_date));
      case SORT_OPTIONS.DATE_POSTED_NEWEST:
        return projectsToSort.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      case SORT_OPTIONS.DATE_POSTED_OLDEST:
        return projectsToSort.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      case SORT_OPTIONS.MOST_INTERACTIONS:
        return projectsToSort.sort((a, b) => (b.interactionScore ?? 0) - (a.interactionScore ?? 0));
      case SORT_OPTIONS.LEAST_INTERACTIONS:
        return projectsToSort.sort((a, b) => (a.interactionScore ?? 0) - (b.interactionScore ?? 0));
      default:
        return projectsToSort;
    }
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
      title="Trending Projects"
      loading={loading && sortedProjects.length === 0}
      filterProps={filterPropsForLayout}
      projectCount={sortedProjects.length}
      sortOption={sortOption}
      onSortChange={setSortOption}
      availableSortOptions={Object.values(SORT_OPTIONS)}
    >
      {loading && sortedProjects.length === 0 && (
         <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <div className="mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
              </div>
              <p className="text-sm text-off-white">Loading projects...</p>
            </div>
          </div>
      )}

      {!loading && sortedProjects.length === 0 && (
        <div className="text-center py-12 bg-gray-900 rounded-lg">
          <h3 className="text-xl font-bold mb-3">No matching trending projects found</h3>
          <p>Try adjusting your filter criteria or check back later.</p>
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
                  recommended={false}
                  image={project.image}
                  issueCount={project.issueCount || 0}
                  github_link={project.github_link}
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

export default function TrendingProjectsPage() {
  return (
    <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen w-full">
            <div className="text-center">
            <div className="mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
            </div>
            <h1 className="inria-sans-bold text-xl text-off-white">Loading Trending Projects</h1>
            </div>
        </div>
    }>
      <ProjectListPage
        title="Trending Projects"
        getInitialProjectIds={getInitialTrendingProjectIds}
        rpcFunctionName="get_filtered_paginated_projects"
        sortOptions={SORT_OPTIONS}
        defaultSortOption={SORT_OPTIONS.DATE_POSTED_NEWEST}
        recommended={false}
      />
    </Suspense>
  );
}