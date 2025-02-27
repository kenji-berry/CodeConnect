"use client";

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {supabase} from '@/supabaseClient'; 

const ProjectDetails = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [comments, setComments] = useState([]);

  useEffect(() => {
    if (id) {
      const fetchProject = async () => {
        const { data, error } = await supabase
          .from('project')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error('Error fetching project:', error);
        } else {
          setProject(data);
        }
      };

      const fetchComments = async () => {
        const { data, error } = await supabase
          .from('project_comments')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching comments:', error);
        } else {
          setComments(data);
        }
      };

      fetchProject();
      fetchComments();
    }
  }, [id]);

  if (!project) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto bg-red-400 shadow-md rounded-lg">
      <h1 className="text-2xl font-bold mb-4">{project.repo_name}</h1>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <strong>Repository Owner:</strong> {project.repo_owner}
        </div>
        <div>
          <strong>Custom Description:</strong> {project.custom_description || 'N/A'}
        </div>
        <div>
          <strong>Difficulty Level:</strong> {project.difficulty_level}
        </div>
        <div>
          <strong>Status:</strong> {project.status}
        </div>
        <div>
          <strong>Created At:</strong> {new Date(project.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <div>
          <strong>Links:</strong> {project.links.length > 0 ? project.links.join(', ') : 'N/A'}
        </div>
      </div>

      <h2 className="text-xl font-bold mt-8 mb-4">Comments</h2>
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="p-4 bg-gray-900 rounded-lg shadow-sm">
            <p>{comment.comment}</p>
            <p className="text-sm text-gray-500">
              {new Date(comment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        ))}
        {comments.length === 0 && (
          <div className="text-center text-gray-400 py-4">
            No comments found
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetails;