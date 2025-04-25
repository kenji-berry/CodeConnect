"use client";
import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ProjectPreview from "../Components/ProjectPreview";
import ProjectPageLayout from "../Components/ProjectPageLayout";
import useProjectFilters from "../hooks/useProjectFilters";
import { supabase } from '@/supabaseClient';

function NewestProjectsContent() {
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [projects, setProjects] = useState([]);
  const resultsPerPage = 15;

  const filterProps = useProjectFilters({ includeTags: true });
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
  } = filterProps;

  const searchParams = useSearchParams();
  const router = useRouter();
  const currentPage = parseInt(searchParams.get("page") || "1", 10) || 1;

  const fetchFilteredProjects = useCallback(async (page) => {
    setLoading(true);
    try {
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
        console.error("Error fetching filtered project IDs:", rpcError);
        setProjects([]);
        setTotalPages(1);
        return;
      }

      if (!filteredData || filteredData.length === 0) {
        setProjects([]);
        setTotalPages(1);
        return;
      }

      const projectIds = filteredData.map(item => item.project_id);
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
        .in('id', projectIds)
        .order('created_at', { ascending: false });

      if (projectError) {
        console.error("Error fetching project details:", projectError);
        setProjects([]);
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

          const contribution_types = (proj.project_contribution_type || []).map(pct => ({
              name: pct.contribution_type?.name
          })).filter(ct => ct.name);

          return {
              ...proj,
              technologies,
              tags,
              contribution_types
          };
      });

      setProjects(processedProjects);

    } catch (error) {
      console.error("Unexpected error fetching projects:", error);
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
    fetchFilteredProjects(currentPage);
  }, [currentPage, fetchFilteredProjects]);

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
      title="Newest Projects"
      loading={loading}
      filterProps={{ ...filterProps, ...restFilterProps }}
      projectCount={projects.length}
    >
      {loading && (!projects || projects.length === 0) ? ( // Added check for !projects
         <div className="text-center py-12">Loading projects...</div>
      ) : !loading && (!projects || projects.length === 0) ? ( // Added check for !projects
        <div className="text-center py-12 bg-gray-900 rounded-lg">
          <h3 className="text-xl font-bold mb-3">No matching projects found</h3>
          <p>Try adjusting your filter criteria or clearing filters.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Ensure projects is an array before mapping */}
            {Array.isArray(projects) && projects.map(project => {
              // Defensive check: Ensure project is an object before accessing properties
              if (!project || typeof project !== 'object') {
                console.error("Invalid project data encountered:", project);
                return null; // Skip rendering this invalid item
              }

              const techStackToShow = project.technologies
                ?.filter(tech => tech.is_highlighted)
                .map(tech => tech.name) || [];

              return (
                <ProjectPreview
                  key={project.id}
                  id={project.id}
                  name={project.repo_name || 'Unnamed Project'} 
                  date={project.created_at || new Date().toISOString()}
                  tags={Array.isArray(project.tags) ? project.tags : []}
                  techStack={techStackToShow}
                  description={project.custom_description || 'No description available.'}
                  issueCount={0}
                  recommended={false}
                  image={project.image}
                />
              );
            })}
          </div>
          {/* ...pagination... */}
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
      )}
    </ProjectPageLayout>
  );
}

export default function NewestProjectsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12">Loading Page...</div>}>
      <NewestProjectsContent />
    </Suspense>
  );
}