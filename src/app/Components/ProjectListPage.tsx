import React, { useState, useEffect, useCallback, useMemo } from "react";
import ProjectPageLayout from "./ProjectPageLayout";
import ProjectPreview from "./ProjectPreview";
import useProjectFilters from "../hooks/useProjectFilters";
import { supabase } from "../../supabaseClient";

interface ProjectListPageProps {
  title: string;
  getInitialProjectIds?: (limit?: number, userId?: string) => Promise<string[]>;
  rpcFunctionName: string;
  rpcArgsTransform?: (args: any) => any;
  sortOptions: { [key: string]: string };
  defaultSortOption: string;
  recommended?: boolean;
  requireUser?: boolean;
  getUserId?: () => Promise<string | null>;
}

const ProjectListPage: React.FC<ProjectListPageProps> = ({
  title,
  getInitialProjectIds,
  rpcFunctionName,
  rpcArgsTransform,
  sortOptions,
  defaultSortOption,
  recommended = false,
  requireUser = false,
  getUserId,
}) => {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [sortOption, setSortOption] = useState(defaultSortOption);
  const [userId, setUserId] = useState<string | null>(null);
  const resultsPerPage = 15;

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

  // For routing and pagination
  let router: any = undefined;
  let searchParams: any = undefined;
  let currentPage: number = 1;
  try {
    // @ts-ignore
    router = require("next/navigation").useRouter();
    // @ts-ignore
    searchParams = require("next/navigation").useSearchParams();
    currentPage = parseInt(searchParams.get("page") || "1", 10) || 1;
  } catch {
    currentPage = 1;
  }

  useEffect(() => {
    if (requireUser && getUserId) {
      getUserId().then(uid => setUserId(uid));
    }
  }, [requireUser, getUserId]);

  const fetchInteractionCounts = async (projectIds: string[]) => {
    if (!projectIds || projectIds.length === 0) {
      return { likeCounts: {}, commentCounts: {}, viewCounts: {} };
    }
    try {
      const [likesRes, commentsRes, viewsRes] = await Promise.all([
        supabase.from("project_likes").select("project_id").in("project_id", projectIds),
        supabase.from("project_comments").select("project_id").in("project_id", projectIds),
        supabase.from("user_interactions").select("project_id").eq("interaction_type", "view").in("project_id", projectIds),
      ]);
      const likeCounts = (likesRes.data || []).reduce((acc: any, { project_id }: any) => {
        acc[project_id] = (acc[project_id] || 0) + 1;
        return acc;
      }, {});
      const commentCounts = (commentsRes.data || []).reduce((acc: any, { project_id }: any) => {
        acc[project_id] = (acc[project_id] || 0) + 1;
        return acc;
      }, {});
      const viewCounts = (viewsRes.data || []).reduce((acc: any, { project_id }: any) => {
        acc[project_id] = (acc[project_id] || 0) + 1;
        return acc;
      }, {});
      return { likeCounts, commentCounts, viewCounts };
    } catch (error) {
      return { likeCounts: {}, commentCounts: {}, viewCounts: {} };
    }
  };

  const fetchOpenIssueCounts = async (projectIds: string[]) => {
    if (!projectIds || !projectIds.length) return {};
    const { data: issuesData } = await supabase
      .from("project_issues")
      .select("project_id, state")
      .in("project_id", projectIds);
    const openIssueCountMap: Record<string, number> = {};
    if (issuesData) {
      issuesData.forEach((issue: any) => {
        if (issue.state === "open") {
          openIssueCountMap[issue.project_id] = (openIssueCountMap[issue.project_id] || 0) + 1;
        }
      });
    }
    return openIssueCountMap;
  };

  const fetchProjects = useCallback(async (page: number) => {
    setLoading(true);
    try {
      let initialProjectIds: string[] = [];
      if (getInitialProjectIds) {
        if (requireUser && !userId) {
          setProjects([]);
          setTotalPages(1);
          setLoading(false);
          return;
        }
        initialProjectIds = await getInitialProjectIds(100, userId || undefined);
        if (!Array.isArray(initialProjectIds) || initialProjectIds.length === 0) {
          setProjects([]);
          setTotalPages(1);
          setLoading(false);
          return;
        }
      }
      const offset = (page - 1) * resultsPerPage;
      const numericDifficulties = selectedDifficulties.map((d: any) =>
        typeof d === "string" ? parseInt(d, 10) : d
      ).filter((d: any) => !isNaN(d));
      const filtersJSON: any = {
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
      };
      if (initialProjectIds.length > 0) {
        filtersJSON.project_ids = initialProjectIds;
      }
      let rpcArgs: any = {
        filters: filtersJSON,
        results_limit: resultsPerPage,
        results_offset: offset,
      };
      if (rpcArgsTransform) {
        rpcArgs = rpcArgsTransform(rpcArgs);
      }
      const { data: filteredData, error: rpcError } = await supabase.rpc(
        rpcFunctionName,
        rpcArgs
      );
      if (rpcError) {
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
      const projectIds = filteredData.map((item: any) => item.project_id);
      const totalCount = filteredData[0]?.total_filtered_count || 0;
      setTotalPages(Math.ceil(totalCount / resultsPerPage));
      const { data: projectDetails, error: projectError } = await supabase
        .from("project")
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
        .in("id", projectIds);
      if (projectError) {
        setProjects([]);
        setTotalPages(1);
        setLoading(false);
        return;
      }
      const [openIssueCountMap, interactionCounts] = await Promise.all([
        fetchOpenIssueCounts(projectIds),
        fetchInteractionCounts(projectIds),
      ]);
      const { likeCounts, commentCounts, viewCounts } = interactionCounts;
      const processedProjects = (projectDetails || []).map((proj: any) => {
        const techStackToShow = proj.project_technologies
          ?.filter((tech: any) => tech.is_highlighted)
          .map((tech: any) => tech.technologies?.name) || [];
        const tags = proj.project_tags
          ?.map((tagObj: any) => ({
            name: tagObj.tags?.name,
            colour: tagObj.tags?.colour,
            is_highlighted: tagObj.is_highlighted,
          })) || [];
        return {
          ...proj,
          technologies: techStackToShow,
          tags,
          issueCount: openIssueCountMap[proj.id] || 0,
          likeCount: likeCounts[proj.id] || 0,
          commentCount: commentCounts[proj.id] || 0,
          viewCount: viewCounts[proj.id] || 0,
        };
      });
      setProjects(processedProjects);
    } catch (error) {
      setProjects([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [
    getInitialProjectIds,
    requireUser,
    userId,
    selectedTechnologies,
    selectedTags,
    selectedContributionTypes,
    selectedDifficulties,
    selectedLastUpdated,
    selectedLicense,
    selectedMentorship,
    setupTimeMin,
    setupTimeMax,
    filterMode,
    resultsPerPage,
    rpcFunctionName,
    rpcArgsTransform,
  ]);

  useEffect(() => {
    fetchProjects(currentPage);
  }, [currentPage, fetchProjects]);

  const sortedProjects = useMemo(() => {
    if (!projects || projects.length === 0) return [];
    const projectsToSort = [...projects];
    switch (sortOption) {
      case sortOptions.LAST_UPDATED_NEWEST:
        return projectsToSort.sort((a, b) => new Date(b.latest_activity_date || b.created_at).getTime() - new Date(a.latest_activity_date || a.created_at).getTime());
      case sortOptions.LAST_UPDATED_OLDEST:
        return projectsToSort.sort((a, b) => new Date(a.latest_activity_date || a.created_at).getTime() - new Date(b.latest_activity_date || b.created_at).getTime());
      case sortOptions.DATE_POSTED_NEWEST:
        return projectsToSort.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case sortOptions.DATE_POSTED_OLDEST:
        return projectsToSort.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case sortOptions.MOST_INTERACTIONS:
        return projectsToSort.sort((a, b) => (b.likeCount + b.commentCount + b.viewCount) - (a.likeCount + a.commentCount + a.viewCount));
      case sortOptions.LEAST_INTERACTIONS:
        return projectsToSort.sort((a, b) => (a.likeCount + a.commentCount + a.viewCount) - (b.likeCount + b.commentCount + b.viewCount));
      default:
        return projectsToSort;
    }
  }, [projects, sortOption, sortOptions]);

  const handleNextPage = () => {
    if (currentPage < totalPages && router) {
      const params = new URLSearchParams(searchParams);
      params.set("page", String(currentPage + 1));
      router.push(`?${params.toString()}`, { scroll: false });
    }
  };
  const handlePreviousPage = () => {
    if (currentPage > 1 && router) {
      const params = new URLSearchParams(searchParams);
      params.set("page", String(currentPage - 1));
      router.push(`?${params.toString()}`, { scroll: false });
    }
  };

  return (
    <ProjectPageLayout
      title={title}
      loading={loading && sortedProjects.length === 0}
      filterProps={filterPropsForLayout}
      projectCount={sortedProjects.length}
      sortOption={sortOption}
      onSortChange={setSortOption}
  availableSortOptions={Object.values(sortOptions) as string[]}
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
          <h3 className="text-xl font-bold mb-3">No matching projects found</h3>
          <p>Try adjusting your filter criteria or check back later.</p>
        </div>
      )}
      {!loading && sortedProjects.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedProjects.map((project: any) => (
              <ProjectPreview
                key={project.id}
                id={project.id}
                name={project.repo_name || "Unnamed Project"}
                date={project.latest_activity_date || project.created_at || new Date().toISOString()}
                tags={Array.isArray(project.tags) ? project.tags : []}
                description={project.custom_description || "No custom description provided."}
                techStack={project.technologies}
                recommended={recommended}
                image={project.image}
                issueCount={project.issueCount || 0}
                github_link={project.github_link}
              />
            ))}
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
};

export default ProjectListPage;
