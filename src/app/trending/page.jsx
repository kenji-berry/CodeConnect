"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import ProjectPreview from "../Components/ProjectPreview";
import { supabase } from '@/supabaseClient';

// Function to get trending projects
async function getTrendingProjects(limit = 15) {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    console.log(`Fetching trending projects for past 7 days`);
    
    const { data, error } = await supabase.rpc('get_trending_projects', {
      lookback_days: 7,
      results_limit: limit
    });
    
    if (error) {
      console.error('Error fetching trending projects:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getTrendingProjects:', error);
    return [];
  }
}

export default function TrendingProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchTrendingProjects = async () => {
      setLoading(true);
      try {
        // Get trending projects based on combined likes and comments
        const trendingIds = await getTrendingProjects(15);
        
        if (!trendingIds || trendingIds.length === 0) {
          setProjects([]);
          setLoading(false);
          return;
        }
        
        // Fetch the actual project details for each trending ID
        const { data: projects, error: projectsError } = await supabase
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
          .in('id', trendingIds.map(item => item.project_id));
          
        if (projectsError) {
          console.error('Error fetching project details:', projectsError);
          return;
        }
        
        // Now fetch technologies and tags for each project
        const projectsWithData = await Promise.all(
          projects.map(async (project) => {
            const { data: techData, error: techError } = await supabase
              .from('project_technologies')
              .select(`
                technologies (name),
                is_highlighted
              `)
              .eq('project_id', project.id);

            const { data: tagData, error: tagError } = await supabase
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
        console.error('Error fetching trending projects:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTrendingProjects();
  }, []);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Trending Projects</h1>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
            </div>
            <p>Loading trending projects...</p>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg">
          <h3 className="text-xl font-bold mb-3">No trending projects found</h3>
          <p>Check back later for new activity!</p>
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