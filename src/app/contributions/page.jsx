"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/supabaseClient';
import Link from 'next/link';
import ProjectPreview from '@/app/Components/ProjectPreview';

function ContributionsContent() {
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const fetchUserProjects = async () => {
      if (!session?.user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch user's projects
        const { data: projects, error } = await supabase
          .from('project')
          .select(`
            id, 
            repo_name,
            repo_owner,
            description_type,
            custom_description,
            difficulty_level,
            created_at,
            license,
            mentorship,
            setup_time,
            image
          `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (error || !projects || projects.length === 0) {
          if (isMounted) setProjects([]);
          if (error) throw error;
          return;
        }

        const projectIds = projects.map(p => p.id);

        // Fetch open issue counts for all project IDs in one query
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

        // Process projects in batches
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
                    name: tech.technologies?.name || '',
                    is_highlighted: tech.is_highlighted || false,
                  })) || [],
                  tags: tagResult.data?.map(tag => ({
                    name: tag.tags?.name || '',
                    colour: tag.tags?.colour || null,
                    is_highlighted: tag.is_highlighted || false,
                  })) || [],
                  issueCount: openIssueCountMap[project.id] || 0
                };
              } catch (error) {
                return {
                  ...project,
                  technologies: [],
                  tags: [],
                  issueCount: openIssueCountMap[project.id] || 0
                };
              }
            })
          );

          projectsWithData.push(...batchResults);
        }

        if (isMounted) {
          setProjects(projectsWithData);
        }
      } catch (err) {
        if (isMounted) setError('Failed to load your projects. Please try again later.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (!authLoading && session) {
      fetchUserProjects();
    } else if (!authLoading && !session) {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [session, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
          </div>
          <h1 className="inria-sans-bold text-xl text-off-white">Loading Your Contributions</h1>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="w-full min-h-screen flex flex-col justify-center items-center inria-sans-regular">
        <p className="text-xl text-white mb-4">Please log in to view your contributions</p>
        <p className="text-md text-gray-300">Your posted projects will appear here after you log in</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-h-screen flex justify-center items-center inria-sans-regular">
        <p className="text-xl text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col items-center">
      <div className="w-full max-w-[1200px] px-2 sm:px-4 py-8 mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="inter-bold main-subtitle text-2xl">Your Contributions</h2>
          <Link
            href="/post-project"
            className="px-6 py-2 bg-orange text-white rounded-full font-bold hover:bg-orange-600 transition-colors bg-[--muted-red]"
          >
            Post New Project
          </Link>
        </div>
        {projects.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-6">
            {projects.map(project => {
              const highlightedTags = project.tags.filter(tag => tag.is_highlighted);
              const tagsToShow = highlightedTags.length > 0 ? highlightedTags : project.tags.slice(0, 3);
              return (
                <ProjectPreview
                  key={project.id}
                  id={project.id}
                  name={project.repo_name || "Untitled Project"}
                  date={new Date(project.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
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
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="bg-indigo-950 bg-opacity-30 rounded-lg p-8 shadow-lg max-w-md text-center">
              <h2 className="text-2xl text-white mb-4">You haven&apos;t posted any projects yet</h2>
              <p className="text-gray-300 mb-6">
                Share your open-source projects with the community to find collaborators and contributors.
              </p>
              <Link
                href="/post-project"
                className="px-6 py-3 bg-orange text-white rounded-full font-bold hover:bg-orange-600 transition-colors inline-block"
              >
                Post Your First Project
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ContributionsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen w-full">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
          </div>
          <h1 className="inria-sans-bold text-xl text-off-white">Loading Your Contributions</h1>
        </div>
      </div>
    }>
      <ContributionsContent />
    </Suspense>
  );
}