"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import ProjectPreview from "../Components/ProjectPreview";
import { supabase } from '@/supabaseClient';

export default function NewestProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchNewestProjects = async () => {
      setLoading(true);
      try {
        // Get newest projects
        const { data: newestIds, error } = await supabase.rpc('get_newest_projects', {
          results_limit: 15
        });
        
        if (error) {
          console.error('Error fetching newest projects:', error);
          setProjects([]);
          setLoading(false);
          return;
        }
        
        if (!newestIds || newestIds.length === 0) {
          setProjects([]);
          setLoading(false);
          return;
        }

        // Fetch project details
        const { data: projects } = await supabase
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
          .in('id', newestIds.map(item => item.project_id));
        
        // Fetch technologies and tags for each project
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
                name: tech.technologies.name,
                is_highlighted: tech.is_highlighted
              })) || [],
              tags: tagData?.map(tag => tag.tags.name) || [] 
            };
          })
        );
        
        setProjects(projectsWithData);
      } catch (error) {
        console.error('Error in fetchNewestProjects:', error);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchNewestProjects();
  }, []);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Newest Projects</h1>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
            </div>
            <p>Loading newest projects...</p>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg">
          <h3 className="text-xl font-bold mb-3">No new projects found</h3>
          <p>Be the first to add a project!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(project => (
            <ProjectPreview
              key={project.id}
              id={project.id}
              name={project.repo_name}
              date={project.created_at}
              tags={project.tags.slice(0, 3)}
              description={
                project.description_type === "Write your Own" 
                  ? project.custom_description 
                  : "GitHub project description"
              }
              techStack={project.technologies
                .filter(tech => tech.is_highlighted)
                .map(tech => tech.name)}
              issueCount={0}
              recommended={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}