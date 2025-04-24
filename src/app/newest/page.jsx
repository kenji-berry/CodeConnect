"use client";
import React, { useState, useEffect, Suspense } from "react";
import ProjectPreview from "../Components/ProjectPreview";
import ProjectPageLayout from "../Components/ProjectPageLayout";
import useProjectFilters from "../hooks/useProjectFilters";
import { supabase } from '@/supabaseClient';

function NewestProjectsContent() {
  const [loading, setLoading] = useState(true);
  const filterProps = useProjectFilters([], { includeTags: true });
  const { filteredProjects, updateProjects } = filterProps;

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates after unmount

    const fetchNewestProjects = async () => {
      if (!isMounted) return;
      setLoading(true);

      try {
        // Get newest project IDs
        const { data: newestIds, error: idError } = await supabase.rpc('get_newest_projects', {
          results_limit: 15
        });

        if (idError || !newestIds || newestIds.length === 0) {
          console.error('Error fetching newest projects:', idError);
          if (isMounted) updateProjects([]);
          return;
        }

        // Extract project IDs safely
        const projectIds = newestIds.map(item => item.project_id).filter(Boolean);

        if (projectIds.length === 0) {
          if (isMounted) updateProjects([]);
          return;
        }

        // Fetch project details
        const { data: projects, error: projectError } = await supabase
          .from('project')
          .select(`
            id, repo_name, repo_owner, description_type, 
            custom_description, difficulty_level, created_at,
            license, mentorship, setup_time, image
          `)
          .in('id', projectIds);

        if (projectError || !projects || projects.length === 0) {
          console.error('Error fetching project details:', projectError);
          if (isMounted) updateProjects([]);
          return;
        }

        // Fetch open issue counts for all project IDs in one query
        const { data: issuesData, error: issuesError } = await supabase
          .from('project_issues')
          .select('project_id, state')
          .in('project_id', projectIds);

        if (issuesError) {
          console.error('Error fetching issue counts:', issuesError);
        }

        // Build a map of project_id -> open issue count
        const openIssueCountMap = {};
        if (issuesData) {
          issuesData.forEach(issue => {
            if (issue.state === 'open') {
              openIssueCountMap[issue.project_id] = (openIssueCountMap[issue.project_id] || 0) + 1;
            }
          });
        }

        // Fetch all commits for these projects
        const { data: commitsData, error: commitsError } = await supabase
          .from('project_commits')
          .select('project_id, timestamp')
          .in('project_id', projectIds);

        if (commitsError) {
          console.error('Error fetching commit timestamps:', commitsError);
        }

        // Build a map of project_id -> latest commit timestamp
        const latestCommitMap = {};
        if (commitsData) {
          commitsData.forEach(commit => {
            const ts = new Date(commit.timestamp);
            if (
              !latestCommitMap[commit.project_id] ||
              ts > latestCommitMap[commit.project_id]
            ) {
              latestCommitMap[commit.project_id] = ts;
            }
          });
        }

        // Process projects in smaller batches to avoid resource exhaustion
        const projectsWithData = [];
        const BATCH_SIZE = 5;

        for (let i = 0; i < projects.length; i += BATCH_SIZE) {
          if (!isMounted) return; // Check if still mounted before processing each batch

          const batch = projects.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.all(
            batch.map(async (project) => {
              try {
                const [techResult, tagResult] = await Promise.all([
                  supabase
                    .from('project_technologies')
                    .select(`technologies (name), is_highlighted`)
                    .eq('project_id', project.id),
                  supabase
                    .from('project_tags')  
                    .select(`tag_id, tags!inner (name), is_highlighted`)
                    .eq('project_id', project.id)
                ]);

                return {
                  ...project,
                  technologies: techResult.data?.map(tech => ({
                    name: tech.technologies.name,
                    is_highlighted: tech.is_highlighted
                  })) || [],
                  tags: tagResult.data?.map(tag => ({
                    name: tag.tags.name,
                    is_highlighted: tag.is_highlighted
                  })) || [],
                  issueCount: openIssueCountMap[project.id] || 0 
                };
              } catch (error) {
                console.error(`Error processing project ${project.id}:`, error);
                return {
                  ...project,
                  technologies: [],
                  tags: []
                };
              }
            })
          );

          projectsWithData.push(...batchResults);
        }

        if (isMounted) {
          const sortedProjects = projectsWithData.sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
          );
          updateProjects(sortedProjects);
        }
      } catch (error) {
        console.error('Error in fetchNewestProjects:', error);
        if (isMounted) updateProjects([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchNewestProjects();

    return () => {
      isMounted = false; // Cleanup function to prevent state updates after unmount
    };
  }, []); // Remove updateProjects from dependencies

  return (
    <ProjectPageLayout
      title="Newest Projects"
      loading={loading}
      filterProps={filterProps}
      projectCount={filteredProjects.length}
    >
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg">
          <h3 className="text-xl font-bold mb-3">No matching projects found</h3>
          <p>Try adjusting your filter criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => {
            // Only highlighted tags, or fallback to first 3 tags if none highlighted
            const highlightedTags = project.tags.filter(tag => tag.is_highlighted);
            const tagsToShow = highlightedTags.length > 0 ? highlightedTags : project.tags.slice(0, 3);
            return (
              <ProjectPreview
                key={project.id}
                id={project.id}
                name={project.repo_name}
                date={project.created_at}
                tags={tagsToShow}
                description={project.custom_description} 
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
    </ProjectPageLayout>
  );
}

export default function NewestProjectsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewestProjectsContent />
    </Suspense>
  );
}