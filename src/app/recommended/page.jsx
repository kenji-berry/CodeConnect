"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProjectPreview from "../Components/ProjectPreview";
import { supabase } from '@/supabaseClient';
import { getHybridRecommendations, getPopularProjects } from '@/services/recommendation-service';

export default function RecommendedProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState(1);
  const router = useRouter();
  
  useEffect(() => {
    // Check if user is authenticated
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    
    checkUser();
  }, []);
  
  useEffect(() => {
    const fetchRecommendedProjects = async () => {
      setLoading(true);
      try {
        let recommendations;
        if (user) {
          // Get personalized recommendations if logged in
          recommendations = await getHybridRecommendations(user.id, 15, true);
        } else {
          // Get popular projects for non-authenticated users
          recommendations = await getPopularProjects(15, true);
        }
        
        setProjects(recommendations || []);
      } catch (error) {
        console.error('Error fetching recommended projects:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRecommendedProjects();
  }, [user, page]);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Recommended Projects</h1>
      </div>
      
      {!user && (
        <div className="bg-gray-900 rounded-lg p-6 mb-6 text-center">
          <h3 className="text-xl font-bold mb-2">Log in for personalized recommendations</h3>
          <p className="mb-4">Currently showing popular projects. Sign in to see projects tailored to your interests.</p>
          <button 
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-red-600 rounded hover:bg-red-700 transition"
          >
            Sign In
          </button>
        </div>
      )}
      
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
            </div>
            <p>Loading recommended projects...</p>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg">
          <h3 className="text-xl font-bold mb-3">No recommendations available yet</h3>
          <p>Interact with more projects to help us understand your interests!</p>
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
              recommended={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}