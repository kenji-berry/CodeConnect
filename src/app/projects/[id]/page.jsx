"use client";

import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/supabaseClient';
import { trackProjectView, trackProjectLike, removeProjectLike } from '@/services/recommendation-service';

const ProjectDetails = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [comments, setComments] = useState([]);
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  // Add a ref to track if we've already logged a view for this session
  const viewTracked = useRef(false);

  // First effect to get user info
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error fetching user:', error);
        return;
      }
      setCurrentUser(user);
    };

    getCurrentUser();
  }, []);
  
  // Second effect to check if the project is liked
  useEffect(() => {
    if (!currentUser || !id) return;
    
    const checkIfLiked = async () => {
      // check if user has liked the project
      const { data, error: likeError } = await supabase
        .from('project_likes')
        .select('*')
        .eq('project_id', id)
        .eq('user_id', currentUser.id)
        .single();
      
      if (!likeError) {
        setIsLiked(!!data);
      }
    };
    
    checkIfLiked();
  }, [currentUser, id]);

  // Third effect to get project data and comments
  useEffect(() => {
    if (!id) return;
    
    // get total likes
    const getTotalLikes = async () => {
      const { data, error } = await supabase
        .from('project_likes')
        .select('id')
        .eq('project_id', id);

      if (!error && data) {
        setLikes(data.length);
      }
    };

    const fetchProject = async () => {
      const { data: project, error } = await supabase
        .from('project')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching project:', error);
      } else {
        setProject(project);
        
        // Track view for recommendations if user is logged in and we haven't tracked yet
        if (currentUser && !viewTracked.current) {
          console.log('Tracking view for project:', project.id);
          viewTracked.current = true; // Mark that we've tracked this view
          
          trackProjectView(currentUser.id, project.id)
            .then(result => {
              if (result.error) {
                console.error('Failed to track view:', result.error);
              }
            });
        }
      }
    };

    const fetchComments = async () => {
      const { data: commentsData, error: commentsError } = await supabase
        .from('project_comments')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      if (commentsError) {
        console.error('Error fetching comments:', commentsError);
        return;
      }

      // fetch display names for each comment's user_id
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', commentsData.map(comment => comment.user_id));

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
      }

      // combine comments with display names
      const commentsWithProfiles = commentsData.map(comment => ({
        ...comment,
        profiles: {
          display_name: profilesData.find(profile => profile.user_id === comment.user_id)?.display_name
        }
      }));

      setComments(commentsWithProfiles);
    };

    getTotalLikes();
    fetchProject();
    fetchComments();
  }, [id, currentUser]); // Keep currentUser dependency but use the ref to prevent multiple tracking
 
  const handleLike = async () => {
    if (!currentUser) return;

    if (isLiked) {
      // Unlike
      const { error } = await supabase
        .from('project_likes')
        .delete()
        .eq('project_id', id)
        .eq('user_id', currentUser.id);

      if (!error) {
        setIsLiked(false);
        setLikes(prev => prev - 1);
        
        // Also remove like from recommendation system
        if (project) {
          const result = await removeProjectLike(currentUser.id, project.id);
          if (result.error) {
            console.error('Failed to remove like from recommendation system:', result.error);
          }
        }
      }
    } else {
      // Like
      const { error } = await supabase
        .from('project_likes')
        .upsert([
          { project_id: id, user_id: currentUser.id }
        ], { onConflict: ['project_id', 'user_id'] });

      if (!error) {
        setIsLiked(true);
        setLikes(prev => prev + 1);
        
        // Also track like for recommendation system
        if (project) {
          trackProjectLike(currentUser.id, project.id);
        }
      }
    }
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full radial-background">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
          </div>
          <h1 className="inria-sans-bold text-xl text-off-white">Loading Project Details</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto bg-red-400 shadow-md rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{project.repo_name}</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleLike}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              isLiked ? 'bg-blue-600' : 'bg-gray-600'
            }`}
            disabled={!currentUser}
          >
            <span>{isLiked ? '❤️' : '🤍'}</span>
            <span>{likes}</span>
          </button>
        </div>
      </div>
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
          <strong>Tech:</strong> {project.technologies}
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
            <p className="font-bold">{comment.profiles.display_name}</p>
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