"use client";
import React, { useState, useEffect, Suspense } from "react";
import ProjectPreview from "../Components/ProjectPreview";
import ProjectPageLayout from "../Components/ProjectPageLayout";
import useProjectFilters from "../hooks/useProjectFilters";
import { supabase } from '@/supabaseClient';

function PopularProjectsContent() {
  const [loading, setLoading] = useState(true);
  const filterProps = useProjectFilters([], { includeTags: true });
  const { filteredProjects, updateProjects } = filterProps;

  useEffect(() => {
    let isMounted = true;

    const fetchPopularProjects = async () => {
      if (!isMounted) return;
      setLoading(true);

      try {
        const { data: popularIds, error: idError } = await supabase.rpc('get_popular_projects', {
          results_limit: 15
        });

        if (idError || !popularIds || popularIds.length === 0) {
          if (isMounted) updateProjects([]);
          return;
        }

        const projectIds = popularIds.map(item => item.project_id).filter(Boolean);

        if (projectIds.length === 0) {
          if (isMounted) updateProjects([]);
          return;
        }

        const { data: projects, error: projectError } = await supabase
          .from('project')
          .select(`
            id, repo_name, repo_owner, description_type, 
            custom_description, difficulty_level, created_at,
            license, mentorship, setup_time, image
          `)
          .in('id', projectIds);

        if (projectError || !projects || projects.length === 0) {
          if (isMounted) updateProjects([]);
          return;
        }

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

        const { data: commitsData } = await supabase
          .from('project_commits')
          .select('project_id, timestamp')
          .in('project_id', projectIds);

        const latestCommitMap = {};
        if (commitsData) {
          commitsData.forEach(commit => {
            const ts = new Date(commit.timestamp);
            if (!latestCommitMap[commit.project_id] || ts > latestCommitMap[commit.project_id]) {
              latestCommitMap[commit.project_id] = ts;
            }
          });
        }

        const projectsWithData = [];
        const BATCH_SIZE = 5;

        for (let i = 0; i < projects.length; i += BATCH_SIZE) {
          if (!isMounted) return;

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
                    .select(`tag_id, tags!inner (name, colour), is_highlighted`)
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
                    colour: tag.tags.colour || null,
                    is_highlighted: tag.is_highlighted
                  })) || [],
                  issueCount: openIssueCountMap[project.id] || 0,
                  last_commit_at: latestCommitMap[project.id] || null
                };
              } catch (error) {
                return {
                  ...project,
                  technologies: [],
                  tags: [],
                  issueCount: openIssueCountMap[project.id] || 0,
                  last_commit_at: latestCommitMap[project.id] || null
                };
              }
            })
          );

          projectsWithData.push(...batchResults);
        }

        if (isMounted) updateProjects(projectsWithData);
      } catch (error) {
        if (isMounted) updateProjects([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPopularProjects();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ProjectPageLayout
      title="Popular Projects"
      loading={loading}
      filterProps={filterProps}
      projectCount={filteredProjects.length}
    >
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg">
          <h3 className="text-xl font-bold mb-3">No popular projects found</h3>
          <p>Be the first to like or comment on projects!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => {
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

export default function PopularProjectsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PopularProjectsContent />
    </Suspense>
  );
}