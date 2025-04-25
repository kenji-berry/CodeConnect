"use client";
import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProjectPreview from "../Components/ProjectPreview";
import ProjectPageLayout from "../Components/ProjectPageLayout";
import useProjectFilters from "../hooks/useProjectFilters";
import { supabase } from '@/supabaseClient';
import { getHybridRecommendations } from '@/services/recommendation-service';

function RecommendedProjectsContent() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(undefined);
  const [projects, setProjects] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
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
      setProjects([]);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const recommendedProjectsData = await getHybridRecommendations(user.id, 100, false);

      if (!Array.isArray(recommendedProjectsData) || recommendedProjectsData.length === 0) {
        setProjects([]);
        setTotalPages(1);
        setLoading(false);
        return;
      }

      const recommendedProjectIds = recommendedProjectsData.map(p => p.id).filter(id => id !== undefined);

      if (recommendedProjectIds.length === 0) {
          setProjects([]);
          setTotalPages(1);
          setLoading(false);
          return;
      }

      const offset = (page - 1) * resultsPerPage;
      const filtersJSON = {
        ...(selectedTechnologies.length > 0 && { technologies: selectedTechnologies }),
        ...(selectedTags.length > 0 && { tags: selectedTags }),
        ...(selectedContributionTypes.length > 0 && { contribution_types: selectedContributionTypes }),
        ...(selectedDifficulties.length > 0 && { difficulties: selectedDifficulties }),
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

      const { data: filteredData, error: rpcError } = await supabase.rpc(
        'get_filtered_paginated_projects',
        rpcArgs
      );

      if (rpcError) {
        console.error("Error fetching filtered recommended project IDs:", rpcError);
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
          license, mentorship, setup_time, image,
          project_technologies ( is_highlighted, technologies ( name ) ),
          project_tags ( is_highlighted, tags ( name, colour ) ),
          project_contribution_type ( contribution_type ( name ) )
        `)
        .in('id', finalProjectIds)
        .order('created_at', { ascending: false });

      if (projectError) {
        console.error("Error fetching project details:", projectError);
        setProjects([]);
        setLoading(false);
        return;
      }

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

          return {
              ...proj,
              technologies,
              tags,
          };
      });

      setProjects(processedProjects);

    } catch (error) {
      console.error("Unexpected error fetching recommended projects:", error);
      setProjects([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
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
      projectCount={user && !loading ? projects.length : 0}
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

      {!loading && user && projects.length === 0 && (
        <div className="text-center py-12 bg-gray-900 rounded-lg">
          <h3 className="text-xl font-bold mb-3">No matching recommendations found</h3>
          <p>Try adjusting your filter criteria or interact with more projects.</p>
        </div>
      )}

      {!loading && projects.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => {
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
                  date={project.created_at || new Date().toISOString()}
                  tags={Array.isArray(project.tags) ? project.tags : []}
                  description={project.custom_description || "No custom description provided."}
                  techStack={techStackToShow}
                  recommended={true}
                  image={project.image}
                  issueCount={0}
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
        <div className="flex items-center justify-center min-h-screen w-full radial-background">
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