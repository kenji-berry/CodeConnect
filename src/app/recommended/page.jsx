"use client";
import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter } from "next/navigation";
import ProjectPreview from "../Components/ProjectPreview";
import ProjectPageLayout from "../Components/ProjectPageLayout";
import useProjectFilters from "../hooks/useProjectFilters";
import { supabase } from '@/supabaseClient';
import { getHybridRecommendations } from '@/services/recommendation-service';

const fetchTagsAndTech = async (projectId) => {
  if (typeof projectId === 'undefined' || projectId === null) {
    return { technologies: [], tags: [] };
  }
  try {
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
  } catch (error) {
    console.error(`Error fetching details for project ${projectId}:`, error);
    return { technologies: [], tags: [] };
  }
};

function RecommendedProjectsContent() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(undefined);
  const [page, setPage] = useState(1);
  const router = useRouter();
  const { filteredProjects, updateProjects: originalUpdateProjects, ...restFilterProps } = useProjectFilters([]);
  const updateProjects = useCallback(originalUpdateProjects, []);

  const filterProps = { filteredProjects, updateProjects, ...restFilterProps };

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

  useEffect(() => {
    let isMounted = true;

    const fetchRecommendedProjects = async () => {
      if (!isMounted || !user) return;

      setLoading(true);
      try {
        const initialProjectsData = await getHybridRecommendations(user.id, 15, true);

        if (!Array.isArray(initialProjectsData)) {
            throw new Error("Recommendations data is not an array");
        }

        let projectsWithDetails = [];
        if (initialProjectsData.length > 0) {
          projectsWithDetails = await Promise.all(
            initialProjectsData.map(async (project) => {
              if (!project || typeof project.id === 'undefined') {
                  return null;
              }
              const { technologies, tags } = await fetchTagsAndTech(project.id);
              return {
                ...project,
                technologies: technologies || [],
                tags: tags || [],
              };
            })
          );
          projectsWithDetails = projectsWithDetails.filter(p => p !== null);
        }

        if (isMounted) {
            updateProjects(projectsWithDetails || []);
        }
      } catch (error) {
        console.error('Error fetching recommended projects:', error);
        if (isMounted) updateProjects([]);
      } finally {
        if (isMounted) {
            setLoading(false);
        }
      }
    };

    if (user === undefined) {
      setLoading(true);
    } else if (user === null) {
      setLoading(false);
      updateProjects([]);
    } else {
      fetchRecommendedProjects();
    }

    return () => {
      isMounted = false;
    };
  }, [user, page, updateProjects]);

  return (
    <ProjectPageLayout
      title={user ? "Recommended Projects" : "Log in for Recommendations"}
      loading={loading}
      filterProps={filterProps}
      projectCount={user && !loading ? filteredProjects.length : 0}
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

      {loading && (
         <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <div className="mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
              </div>
              <p className="text-sm text-off-white">Loading projects...</p>
            </div>
          </div>
      )}

      {!loading && filteredProjects.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg">
          <h3 className="text-xl font-bold mb-3">
            {user ? "No matching recommendations found" : "No popular projects found"}
          </h3>
          <p>
            {user ? "Try adjusting your filter criteria or interact with more projects" : "Check back later for popular projects!"}
          </p>
        </div>
      ) : null}

      {!loading && filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => {
            const highlightedTags = project.tags?.filter(tag => tag.is_highlighted) || [];
            const tagsToShow = highlightedTags.length > 0 ? highlightedTags : project.tags?.slice(0, 3) || [];
            const techStackToShow = project.technologies
              ?.filter(tech => tech.is_highlighted)
              .map(tech => tech.name) || [];

            if (typeof project.id === 'undefined') {
                return null;
            }

            return (
              <ProjectPreview
                key={project.id}
                id={project.id}
                name={project.repo_name || "Unnamed Project"}
                date={project.created_at}
                tags={tagsToShow}
                description={project.custom_description || "No custom description provided."}
                techStack={techStackToShow}
                recommended={!!user}
                image={project.image}
              />
            );
          })}
        </div>
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