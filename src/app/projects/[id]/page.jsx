"use client";

import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/supabaseClient';
import { trackProjectView, trackProjectLike, removeProjectLike } from '@/services/recommendation-service';
import { useProfanityFilter } from '@/hooks/useProfanityFilter';

const ProjectDetails = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [comments, setComments] = useState([]);
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const viewTracked = useRef(false);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const {
    value: reportDescription,
    onChange: handleReportDescriptionChange, 
    containsProfanity: reportHasProfanity,
    cleanText: cleanReportText
  } = useProfanityFilter('');

  const [commentVotes, setCommentVotes] = useState({});

  const {
    value: newComment,
    onChange: handleCommentChange,
    containsProfanity: commentHasProfanity,
    cleanText: cleanCommentText
  } = useProfanityFilter('');

  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const [commentFilter, setCommentFilter] = useState('new');

  // Add state for edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Helper: check if current user owns the project
  const isOwner = currentUser && project && currentUser.id === project.user_id;

  // Replace startEditing function with this redirect function
  const redirectToEditPage = () => {
    if (!project || !project.repo_name) return;
    
    // Extract owner from project data
    // The repo_owner field should contain the GitHub username
    const owner = project.repo_owner;
    const repoName = project.repo_name;
    
    if (!owner || !repoName) {
      console.error("Missing repository owner or name");
      return;
    }
    
    // Navigate to the project edit form with query parameters
    window.location.href = `/post-project/project-form?repo=${encodeURIComponent(repoName)}&owner=${encodeURIComponent(owner)}`;
  };

  // Update the handleProjectDelete function
  const handleProjectDelete = async () => {
    if (deleteConfirmation !== project.repo_name) {
      return; // Don't proceed if confirmation text doesn't match
    }
    
    setIsDeletingProject(true);
    
    try {
      // Delete the project and all related data
      const { error } = await supabase
        .from('project')
        .delete()
        .eq('id', project.id);
        
      if (error) {
        console.error('Error deleting project:', error);
        alert('Failed to delete project. Please try again.');
        setIsDeletingProject(false);
        return;
      }
      
      // Store notification data in localStorage to be displayed on the home page
      localStorage.setItem('notification', JSON.stringify({
        message: `Project "${project.repo_name}" was successfully deleted`,
        type: 'success',
        timestamp: Date.now() // Add timestamp to prevent stale notifications
      }));
      
      // Redirect to home
      window.location.href = '/';
    } catch (err) {
      console.error('Unexpected error deleting project:', err);
      alert('An unexpected error occurred.');
      setIsDeletingProject(false);
    }
  };

  // Save edits
  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!isOwner) return;
    try {
      const { error } = await supabase
        .from('project')
        .update({
          ...editData,
          repo_name: editData.repo_name,
          repo_description: editData.repo_description
        })
        .eq('id', project.id);
      if (error) {
        alert('Failed to update project.');
        return;
      }
      setProject({
        ...project,
        ...editData,
        repo_name: editData.repo_name,
        repo_description: editData.repo_description
      });
      setIsEditing(false);
    } catch (err) {
      alert('Unexpected error updating project.');
    }
  };

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
    // Only run this effect if user is logged in
    if (!currentUser || !id) return;

    const checkIfLiked = async () => {
      // check if user has liked the project
      try {
        const { data, error: likeError } = await supabase
          .from('project_likes')
          .select('*')
          .eq('project_id', id)
          .eq('user_id', currentUser.id)
          .single();

        if (!likeError) {
          setIsLiked(!!data);
        }
      } catch (err) {
        console.error('Error checking if project is liked:', err);
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
        .select(`
          *,
          project_technologies (
            is_highlighted,
            technologies (
              id,
              name
            )
          ),
          project_tags (
            tags (
              id,
              name
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching project:', error);
      } else {
        setProject(project);

        // Only track view if user is logged in
        if (currentUser && !viewTracked.current) {
          viewTracked.current = true;
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

      // Only proceed if there are comments
      if (commentsData.length === 0) {
        setComments([]);
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

      // Fetch comment votes
      const { data: votesData, error: votesError } = await supabase
        .from('project_comment_votes')
        .select('*')
        .in('comment_id', commentsData.map(comment => comment.id));

      if (votesError) {
        console.error('Error fetching comment votes:', votesError);
      }

      // Calculate vote totals and user's votes
      const votesByComment = {};
      commentsData.forEach(comment => {
        const commentVotes = votesData?.filter(vote => vote.comment_id === comment.id) || [];
        const upvotes = commentVotes.filter(vote => vote.vote_type === 'up').length;
        const downvotes = commentVotes.filter(vote => vote.vote_type === 'down').length;
        const userVote = currentUser ?
          commentVotes.find(vote => vote.user_id === currentUser.id)?.vote_type || null
          : null;

        votesByComment[comment.id] = {
          score: upvotes - downvotes,
          userVote: userVote
        };
      });

      setCommentVotes(votesByComment);

      // combine comments with display names
      const commentsWithProfiles = commentsData.map(comment => ({
        ...comment,
        profiles: {
          display_name: profilesData.find(profile => profile.user_id === comment.user_id)?.display_name
        }
      }));

      setComments(commentsWithProfiles);
    };

    const fetchTechnologiesAndTags = async () => {
      const { data: techs, error: techsError } = await supabase
        .from('project_technologies')
        .select('*')
        .eq('project_id', id);

      const { data: tags, error: tagsError } = await supabase
        .from('project_tags')
        .select('*')
        .eq('project_id', id);

      console.log('techs', techs);
      console.log('tags', tags);
    };

    getTotalLikes();
    fetchProject();
    fetchComments();
    fetchTechnologiesAndTags();
  }, [id, currentUser]);

  const redirectToLogin = () => {
    window.location.href = '/login';
  };

  const handleLike = async () => {
    if (!currentUser) {
      redirectToLogin();
      return;
    }

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

  const handleVote = async (commentId, voteType) => {
    if (!currentUser) {
      redirectToLogin();
      return;
    }

    const currentVote = commentVotes[commentId]?.userVote;

    // If same vote type, remove the vote
    if (currentVote === voteType) {
      // Delete existing vote
      const { error } = await supabase
        .from('project_comment_votes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', currentUser.id);

      if (!error) {
        setCommentVotes(prev => ({
          ...prev,
          [commentId]: {
            score: prev[commentId].score + (voteType === 'up' ? -1 : 1),
            userVote: null
          }
        }));
      }
    } else {
      // Either adding new vote or changing vote
      const voteChange =
        currentVote === null ? (voteType === 'up' ? 1 : -1) :  // New vote
          voteType === 'up' ? 2 : -2;  // Changing from down to up or up to down (double effect)

      const { error } = await supabase
        .from('project_comment_votes')
        .upsert([
          {
            comment_id: commentId,
            user_id: currentUser.id,
            vote_type: voteType
          }
        ], { onConflict: ['comment_id', 'user_id'] });

      if (!error) {
        setCommentVotes(prev => ({
          ...prev,
          [commentId]: {
            score: prev[commentId].score + voteChange,
            userVote: voteType
          }
        }));
      }
    }
  };

  const openReportModal = (target) => {
    if (!currentUser) {
      redirectToLogin();
      return;
    }

    setReportTarget(target);
    setReportReason('');
    setReportSuccess(false);
    setShowReportModal(true);
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();

    if (!reportReason) {
      alert('Please select a reason for reporting');
      return;
    }
    
    // Check for profanity before submitting
    if (reportHasProfanity) {
      alert('Please remove inappropriate language before submitting');
      return;
    }

    setReportSubmitting(true);

    try {
      const reportData = {
        reporter_id: currentUser.id,
        reason: reportReason,
        description: reportDescription || null,
        status: 'pending'
      };

      if (reportTarget.type === 'project') {
        reportData.project_id = parseInt(id);
      } else {
        reportData.comment_id = parseInt(reportTarget.id);
      }

      const { error } = await supabase
        .from('reports')
        .insert([reportData]);

      if (error) {
        console.error('Error submitting report:', error);
        alert('Failed to submit report. Please try again.');
      } else {
        setReportSuccess(true);
        setTimeout(() => {
          setShowReportModal(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Error in report submission:', error);
      alert('An unexpected error occurred.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      redirectToLogin();
      return;
    }
    
    if (!newComment.trim()) {
      return; 
    }
    
    // Check for profanity
    if (commentHasProfanity) {
      alert('Please remove inappropriate language before submitting');
      return;
    }
    
    setIsSubmittingComment(true);
    
    try {
      // First insert the comment
      const { data, error } = await supabase
        .from('project_comments')
        .insert([
          {
            project_id: parseInt(id),
            user_id: currentUser.id,
            comment: newComment.trim()
          }
        ])
        .select();
        
      if (error) {
        console.error('Error submitting comment:', error);
        alert('Failed to submit comment. Please try again.');
      } else {
        // Fetch the user's profile to get the display_name
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', currentUser.id)
          .single();
          
        const displayName = profileError ? 'User' : profileData.display_name;
        
        // Add the new comment to the list with the correct display name from profiles
        const newCommentWithProfile = {
          ...data[0],
          profiles: {
            display_name: displayName
          }
        };
        
        setComments(prevComments => [newCommentWithProfile, ...prevComments]);
        setNewComment(''); // Clear the input
        
        // Initialize vote count for the new comment
        setCommentVotes(prev => ({
          ...prev,
          [newCommentWithProfile.id]: {
            score: 0,
            userVote: null
          }
        }));
      }
    } catch (error) {
      console.error('Error in comment submission:', error);
      alert('An unexpected error occurred.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const getFilteredComments = () => {
    if (!comments || comments.length === 0) return [];
    
    // Create a copy to avoid mutating the original array
    const filtered = [...comments];
    
    switch (commentFilter) {
      case 'top':
        // Sort by highest score first
        return filtered.sort((a, b) => 
          (commentVotes[b.id]?.score || 0) - (commentVotes[a.id]?.score || 0)
        );
      case 'old':
        // Sort by oldest first
        return filtered.sort((a, b) => 
          new Date(a.created_at) - new Date(b.created_at)
        );
      case 'new':
      default:
        // Sort by newest first (default)
        return filtered.sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        );
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
    <div className="max-w-3xl mx-auto my-10 bg-[--primary-color] rounded-2xl shadow-lg border border-[--magenta-dark] p-0 overflow-hidden">
      {/* Project Image */}
      {project.image_url && (
        <div className="w-full h-64 bg-gray-800 flex items-center justify-center overflow-hidden">
          <img
            src={project.image_url}
            alt={project.repo_name}
            className="object-cover w-full h-full"
            style={{ maxHeight: 320 }}
          />
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 border-b border-[--muted-red] pb-4">
          <div>
            <h1 className="text-3xl inria-sans-bold text-[--title-red] mb-1">{project.repo_name}</h1>
            <p className="text-sm text-[--off-white] opacity-70">{project.repo_description || "No description provided."}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLike}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200 shadow-sm ${
                isLiked ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              disabled={!currentUser}
            >
              <span className="text-lg">{isLiked ? '❤️' : '🤍'}</span>
              <span className="font-semibold">{likes}</span>
            </button>
            <button
              onClick={() => openReportModal({ type: 'project' })}
              className="px-3 py-2 bg-[--muted-red] hover:bg-[--title-red] rounded-lg text-sm shadow-sm transition-colors duration-200"
              title="Report Project"
            >
              <span role="img" aria-label="Report">⚠️</span>
            </button>
            {isOwner && !isEditing && (
              <>
                <button
                  onClick={redirectToEditPage}
                  className="px-3 py-2 bg-green-700 hover:bg-green-800 rounded-lg text-sm shadow-sm transition-colors duration-200 ml-2"
                  title="Edit Project"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-3 py-2 bg-red-700 hover:bg-red-800 rounded-lg text-sm shadow-sm transition-colors duration-200 ml-2"
                  title="Delete Project"
                >
                  🗑️ Delete
                </button>
              </>
            )}
          </div>
        </div>

        {/* Project Info */}
        <div className="mb-6">
          {isEditing ? (
            <form onSubmit={handleEditSave} className="space-y-4">
              <div>
                <label className="block font-semibold text-[--orange] mb-1">Project Name</label>
                <input
                  type="text"
                  name="repo_name"
                  value={editData.repo_name}
                  onChange={handleEditChange}
                  className="w-full bg-gray-900 text-[--off-white] rounded px-3 py-2 border border-gray-700"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-[--orange] mb-1">Description</label>
                <textarea
                  name="repo_description"
                  value={editData.repo_description}
                  onChange={handleEditChange}
                  className="w-full bg-gray-900 text-[--off-white] rounded px-3 py-2 border border-gray-700"
                  rows={3}
                />
              </div>
              {Object.entries(editData).map(([key, value]) => {
                if (['repo_name', 'repo_description'].includes(key)) return null;
                return (
                  <div key={key}>
                    <label className="block font-semibold text-[--orange] mb-1 capitalize">{key.replace(/_/g, ' ')}</label>
                    <input
                      type="text"
                      name={key}
                      value={value}
                      onChange={handleEditChange}
                      className="w-full bg-gray-900 text-[--off-white] rounded px-3 py-2 border border-gray-700"
                    />
                  </div>
                );
              })}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-green-700 hover:bg-green-800 font-semibold text-white"
                >
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Show each field on its own line */}
              {Object.entries(project).map(([key, value]) => {
                if (
                  [
                    'id', 'user_id', 'created_at', 'updated_at',
                    'project_technologies', 'project_tags', 'repo_name',
                    'repo_description', 'image_url'
                  ].includes(key)
                ) return null;
                return (
                  <div key={key} className="flex flex-col mb-2">
                    <span className="font-semibold text-[--orange] capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="text-[--off-white] break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                  </div>
                );
              })}
              <div className="flex flex-col mb-2">
                <span className="font-semibold text-[--orange]">Technologies</span>
                <div>
                  {project.project_technologies && project.project_technologies.length > 0
                    ? project.project_technologies.map(pt =>
                        <span
                          key={pt.technologies.id}
                          className={`inline-block mr-2 mb-1 px-2 py-1 rounded bg-gray-800 text-sm ${
                            pt.is_highlighted ? "font-bold text-blue-300 border border-blue-400" : "text-[--off-white]"
                          }`}
                        >
                          {pt.technologies.name}{pt.is_highlighted ? " ★" : ""}
                        </span>
                      )
                    : <span className="text-gray-400">N/A</span>}
                </div>
              </div>
              <div className="flex flex-col mb-2">
                <span className="font-semibold text-[--orange]">Tags</span>
                <div>
                  {project.project_tags && project.project_tags.length > 0
                    ? project.project_tags.map(pt =>
                        <span key={pt.tags.id} className="inline-block mr-2 mb-1 px-2 py-1 rounded bg-gray-800 text-sm text-[--off-white]">
                          {pt.tags.name}
                        </span>
                      )
                    : <span className="text-gray-400">N/A</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Comments Section */}
        <div className="mt-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
            <h2 className="text-2xl inria-sans-bold text-[--title-red]">Comments</h2>
            <div className="flex items-center">
              <label htmlFor="comment-filter" className="mr-2 text-sm text-[--off-white]">Filter by:</label>
              <select
                id="comment-filter"
                className="bg-gray-800 text-[--off-white] rounded px-3 py-1 text-sm border border-gray-700"
                value={commentFilter}
                onChange={(e) => setCommentFilter(e.target.value)}
              >
                <option value="new">Newest</option>
                <option value="top">Top Rated</option>
                <option value="old">Oldest</option>
              </select>
            </div>
          </div>
          <div className="space-y-4">
            {getFilteredComments().map((comment) => (
              <div key={comment.id} className="p-4 bg-gray-900 rounded-xl shadow-sm border border-gray-800">
                <div className="flex justify-between items-start mb-1">
                  <p className="font-bold text-[--orange]">{comment.profiles.display_name}</p>
                  <button
                    onClick={() => openReportModal({ type: 'comment', id: comment.id })}
                    className="text-xs bg-[--muted-red] hover:bg-[--title-red] px-2 py-1 rounded transition-colors duration-200"
                    title="Report Comment"
                  >
                    ⚠️
                  </button>
                </div>
                <p className="text-[--off-white]">{comment.comment}</p>
                <div className="flex items-center mt-2">
                  <div className="flex items-center mr-4">
                    <button
                      onClick={() => handleVote(comment.id, 'up')}
                      disabled={!currentUser}
                      className={`px-2 py-1 rounded transition-colors duration-200 ${
                        commentVotes[comment.id]?.userVote === 'up'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 hover:bg-blue-700'
                      }`}
                      title={currentUser ? "Upvote" : "Sign in to vote"}
                    >
                      ▲
                    </button>
                    <span className="mx-2 font-semibold text-[--off-white]">{commentVotes[comment.id]?.score || 0}</span>
                    <button
                      onClick={() => handleVote(comment.id, 'down')}
                      disabled={!currentUser}
                      className={`px-2 py-1 rounded transition-colors duration-200 ${
                        commentVotes[comment.id]?.userVote === 'down'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-800 hover:bg-red-700'
                      }`}
                      title={currentUser ? "Downvote" : "Sign in to vote"}
                    >
                      ▼
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(comment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <div className="text-center text-gray-400 py-4">
                No comments found
              </div>
            )}
            {/* Add Comment */}
            <div className="mt-8 p-4 bg-gray-800 rounded-xl border border-gray-700">
              <h3 className="text-lg font-semibold mb-4 text-[--orange]">Add a Comment</h3>
              {currentUser ? (
                <form onSubmit={handleCommentSubmit}>
                  <textarea
                    className={`w-full bg-gray-900 p-3 rounded text-[--off-white] mb-3 resize-none border ${
                      commentHasProfanity ? 'border-red-500' : 'border-gray-700'
                    }`}
                    rows="3"
                    value={newComment}
                    onChange={handleCommentChange}
                    placeholder="Share your thoughts about this project..."
                    required
                  ></textarea>
                  {commentHasProfanity && (
                    <p className="text-red-500 text-sm mb-2">
                      Please remove inappropriate language
                    </p>
                  )}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold transition-colors duration-200"
                      disabled={isSubmittingComment || !newComment.trim()}
                    >
                      {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center p-4 bg-gray-900 rounded">
                  <p className="mb-2">You need to be logged in to comment</p>
                  <button
                    onClick={redirectToLogin}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold"
                  >
                    Log In
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Report Modal */}
        {showReportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md text-[--off-white] border border-[--muted-red] shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-[--title-red]">
                  Report {reportTarget?.type === 'project' ? 'Project' : 'Comment'}
                </h2>
                <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-white text-2xl">
                  &times;
                </button>
              </div>
              {reportSuccess ? (
                <div className="text-green-500 text-center py-4">
                  Report submitted successfully. Thank you for helping keep our community safe.
                </div>
              ) : (
                <form onSubmit={handleReportSubmit}>
                  <div className="mb-4">
                    <label className="block mb-2">Reason:</label>
                    <select
                      className="w-full bg-gray-800 p-2 rounded text-[--off-white] border border-gray-700"
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      required
                    >
                      <option value="">Select a reason</option>
                      <option value="spam">Spam</option>
                      <option value="inappropriate">Inappropriate content</option>
                      <option value="offensive">Offensive language</option>
                      <option value="harassment">Harassment</option>
                      <option value="misinformation">Misinformation</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block mb-2">Description (optional):</label>
                    <textarea
                      className={`w-full bg-gray-800 p-2 rounded text-[--off-white] border ${
                        reportHasProfanity ? 'border-red-500' : 'border-gray-700'
                      }`}
                      rows="3"
                      value={reportDescription}
                      onChange={handleReportDescriptionChange}
                      placeholder="Please provide additional details..."
                    ></textarea>
                    {reportHasProfanity && (
                      <p className="text-red-500 text-sm mt-1">
                        Please remove inappropriate language
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowReportModal(false)}
                      className="px-4 py-2 rounded mr-2 bg-gray-700 hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded bg-[--title-red] hover:bg-[--muted-red] font-semibold"
                      disabled={reportSubmitting}
                    >
                      {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md text-[--off-white] border border-red-500 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-red-500">Delete Project</h2>
                <button 
                  onClick={() => setShowDeleteModal(false)} 
                  className="text-gray-400 hover:text-white text-2xl"
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>
              <div className="mb-6">
                <p className="text-[--off-white] mb-4">
                  Are you sure you want to delete this project? This action <span className="font-bold">cannot be undone</span> and will remove all associated data including comments and likes.
                </p>
                <p className="font-semibold mb-2">
                  Type <span className="text-red-400">&ldquo;{project.repo_name}&rdquo;</span> to confirm:
                </p>
                <input
                  type="text"
                  className="w-full bg-gray-800 p-2 rounded text-[--off-white] border border-gray-700"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Enter project name to confirm"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded mr-2 bg-gray-700 hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProjectDelete}
                  className={`px-4 py-2 rounded font-semibold ${
                    deleteConfirmation === project.repo_name 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-gray-600 cursor-not-allowed'
                  }`}
                  disabled={deleteConfirmation !== project.repo_name || isDeletingProject}
                >
                  {isDeletingProject ? 'Deleting...' : 'Delete Project'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetails;