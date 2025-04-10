"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/supabaseClient';
import Link from 'next/link';
import ProjectPreview from '@/app/Components/ProjectPreview';

const ContributionsPage = () => {
  const { session, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserProjects = async () => {
      if (!session?.user) return;

      try {
        setLoading(true);

        const { data: projects, error } = await supabase
          .from('project')
          .select(`
            id, 
            repo_name,
            repo_owner,
            description_type,
            custom_description,
            difficulty_level,
            created_at
          `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const projectsWithData = await Promise.all(
          projects.map(async (project) => {
            const { data: techData } = await supabase
              .from('project_technologies')
              .select(`
                technologies (name),
                is_highlighted
              `)
              .eq('project_id', project.id);

            const { data: tagData } = await supabase
              .from('project_tags')
              .select(`
                tag_id,
                tags!inner (
                  name
                )
              `)
              .eq('project_id', project.id);

            return {
              ...project,
              technologies: techData?.map(tech => ({
                name: tech.technologies?.name || '',
                is_highlighted: tech.is_highlighted || false,
              })) || [],
              tags: tagData?.map(tag => tag.tags?.name || '') || [],
            };
          })
        );

        setProjects(projectsWithData);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError('Failed to load your projects. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && session) {
      fetchUserProjects();
    } else if (!authLoading && !session) {
      setLoading(false);
    }
  }, [session, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full radial-background">
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
    <div className="w-full min-h-screen p-8 inria-sans-regular">
      <h1 className="text-3xl font-bold text-white mb-8">Your Contributions</h1>
      
      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(project => (
            <ProjectPreview 
              key={project.id}
              id={project.id}
              name={project.repo_name || "Untitled Project"}
              date={new Date(project.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              tags={project.tags.slice(0, 3)}
              description={
                project.description_type === "Write your Own" 
                  ? project.custom_description 
                  : "Loading GitHub description..."
              }
              techStack={project.technologies
                .filter(tech => tech.is_highlighted)
                .map(tech => tech.name)}
              issueCount={0}
              recommended={false}
            />
          ))}
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
  );
};

export default ContributionsPage;