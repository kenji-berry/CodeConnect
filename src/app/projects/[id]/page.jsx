"use client";

import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/supabaseClient';
import { trackProjectView, trackProjectLike, removeProjectLike } from '@/services/recommendation-service';
import { useProfanityFilter } from '@/hooks/useProfanityFilter';
import ActivityGraph from '@/app/Components/ActivityGraph';
import { formatDistanceToNow } from 'date-fns';

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

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  const [showDeleteCommentModal, setShowDeleteCommentModal] = useState(false);
  const [commentToDeleteId, setCommentToDeleteId] = useState(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  const [copiedSecret, setCopiedSecret] = useState(false);

  // State for issues and pull requests
  const [issues, setIssues] = useState([]);
  const [pullRequests, setPullRequests] = useState([]);
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [showAllPullRequests, setShowAllPullRequests] = useState(false);
  const [expandedIssueId, setExpandedIssueId] = useState(null);
  const [expandedPrId, setExpandedPrId] = useState(null);


  const isOwner = currentUser && project && currentUser.id === project.user_id;

  const secret = process.env.NEXT_PUBLIC_GITHUB_WEBHOOK_SECRET;

  const redirectToEditPage = () => {
    if (!project || !project.repo_name) return;

    const owner = project.repo_owner;
    const repoName = project.repo_name;

    if (!owner || !repoName) {
      console.error("Missing repository owner or name");
      return;
    }

    window.location.href = `/post-project/project-form?repo=${encodeURIComponent(repoName)}&owner=${encodeURIComponent(owner)}`;
  };

  const handleProjectDelete = async () => {
    if (deleteConfirmation !== project.repo_name) {
      return;
    }

    setIsDeletingProject(true);

    try {
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

      localStorage.setItem('notification', JSON.stringify({
        message: `Project "${project.repo_name}" was successfully deleted`,
        type: 'success',
        timestamp: Date.now()
      }));

      window.location.href = '/';
    } catch (err) {
      console.error('Unexpected error deleting project:', err);
      alert('An unexpected error occurred.');
      setIsDeletingProject(false);
    }
  };

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

  useEffect(() => {
    if (!currentUser || !id) return;

    const checkIfLiked = async () => {
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
        // Ignore single() error if no like exists
        if (err.code !== 'PGRST116') {
            console.error('Error checking if project is liked:', err);
        } else {
            setIsLiked(false);
        }
      }
    };

    checkIfLiked();
  }, [currentUser, id]);

  useEffect(() => {
    if (!id) return;

    const getTotalLikes = async () => {
      const { data, error } = await supabase
        .from('project_likes')
        .select('id', { count: 'exact' })
        .eq('project_id', id);

      if (!error && data) {
        setLikes(data.length);
      } else if (error) {
        console.error('Error fetching total likes:', error);
      }
    };

    const fetchProject = async () => {
      const { data: projectData, error } = await supabase
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
            is_highlighted,
            tags (
              id,
              name,
              colour
            )
          ),
          project_contribution_type (
            contribution_type (
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
        let processedProject = { ...projectData };

        // Parse links if they are JSON strings
        if (processedProject && processedProject.links) {
          if (typeof processedProject.links === 'string') {
            try {
              processedProject.links = JSON.parse(processedProject.links);
            } catch (e) {
              console.error('Error parsing links JSON:', e);
              processedProject.links = [];
            }
          }

          if (!Array.isArray(processedProject.links)) {
            processedProject.links = [];
          }
        }

        setProject(processedProject);

        if (currentUser && !viewTracked.current) {
          viewTracked.current = true;
          trackProjectView(currentUser.id, processedProject.id)
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

      if (commentsData.length === 0) {
        setComments([]);
        return;
      }

      const userIds = commentsData.map(comment => comment.user_id);
      const commentIds = commentsData.map(comment => comment.id);

      const [profilesResult, votesResult] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name').in('user_id', userIds),
        supabase.from('project_comment_votes').select('*').in('comment_id', commentIds)
      ]);

      const { data: profilesData, error: profilesError } = profilesResult;
      const { data: votesData, error: votesError } = votesResult;

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }
      if (votesError) {
        console.error('Error fetching comment votes:', votesError);
      }

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

      const commentsWithProfiles = commentsData.map(comment => ({
        ...comment,
        profiles: {
          display_name: profilesData?.find(profile => profile.user_id === comment.user_id)?.display_name || 'User'
        }
      }));

      setComments(commentsWithProfiles);
    };

    // Fetch Issues
    const fetchIssues = async () => {
        const { data, error } = await supabase
            .from('project_issues')
            .select('*')
            .eq('project_id', id)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Error fetching issues:', error);
        } else {
            setIssues(data || []);
        }
    };

    // Fetch Pull Requests
    const fetchPullRequests = async () => {
        const { data, error } = await supabase
            .from('project_pull_requests')
            .select('*')
            .eq('project_id', id)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Error fetching pull requests:', error);
        } else {
            setPullRequests(data || []);
        }
    };


    getTotalLikes();
    fetchProject();
    fetchComments();
    fetchIssues();
    fetchPullRequests();
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
      const { error } = await supabase
        .from('project_likes')
        .delete()
        .eq('project_id', id)
        .eq('user_id', currentUser.id);

      if (!error) {
        setIsLiked(false);
        setLikes(prev => prev - 1);

        if (project) {
          const result = await removeProjectLike(currentUser.id, project.id);
          if (result.error) {
            console.error('Failed to remove like from recommendation system:', result.error);
          }
        }
      } else {
        console.error('Error removing like:', error);
      }
    } else {
      const { error } = await supabase
        .from('project_likes')
        .upsert([
          { project_id: id, user_id: currentUser.id }
        ], { onConflict: ['project_id', 'user_id'] });

      if (!error) {
        setIsLiked(true);
        setLikes(prev => prev + 1);

        if (project) {
          trackProjectLike(currentUser.id, project.id);
        }
      } else {
        console.error('Error adding like:', error);
      }
    }
  };

  const handleVote = async (commentId, voteType) => {
    if (!currentUser) {
      redirectToLogin();
      return;
    }

    const currentVote = commentVotes[commentId]?.userVote;
    let scoreChange = 0;
    let newUserVote = null;
    let dbError = null;

    if (currentVote === voteType) {
      // --- Removing vote ---
      scoreChange = voteType === 'up' ? -1 : 1;
      newUserVote = null;

      const { error } = await supabase
        .from('project_comment_votes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', currentUser.id);
      dbError = error;

    } else {
      // --- Adding or changing vote ---
      scoreChange =
        currentVote === null ? (voteType === 'up' ? 1 : -1) // New vote
        : (voteType === 'up' ? 2 : -2); // Flipping vote (e.g., down to up is +2)
      newUserVote = voteType;

      const { error } = await supabase
        .from('project_comment_votes')
        .upsert([
          {
            comment_id: commentId,
            user_id: currentUser.id,
            vote_type: voteType
          }
        ], { onConflict: ['comment_id', 'user_id'] });
      dbError = error;
    }

    // --- Update state only if DB operation was successful ---
    if (!dbError) {
      setCommentVotes(prev => {
        // Safely access previous score, defaulting to 0 if commentId doesn't exist yet
        const existingVoteData = prev[commentId] || { score: 0, userVote: null };

        return {
          ...prev,
          [commentId]: {
            score: existingVoteData.score + scoreChange,
            userVote: newUserVote
          }
        };
      });
    } else {
      console.error("Error updating vote in DB:", dbError);
      // Optionally: Show an error message to the user
    }
  };

  const handleCommentDelete = async (commentId) => {
    if (!currentUser) {
      redirectToLogin();
      return;
    }

    // Find the comment to ensure the current user is the owner
    const commentToDelete = comments.find(comment => comment.id === commentId);
    if (!commentToDelete || commentToDelete.user_id !== currentUser.id) {
      console.error("User is not authorized to delete this comment or comment not found.");
      return;
    }

    // Set the comment ID and show the confirmation modal
    setCommentToDeleteId(commentId);
    setShowDeleteCommentModal(true);
  };

  const confirmCommentDelete = async () => {
    if (!commentToDeleteId || !currentUser) return;

    setIsDeletingComment(true);

    try {
      const { error } = await supabase
        .from('project_comments')
        .delete()
        .eq('id', commentToDeleteId)
        .eq('user_id', currentUser.id);

      if (error) {
        console.error('Error deleting comment:', error);
        alert('Failed to delete comment. Please try again.');
      } else {
        setComments(prevComments => prevComments.filter(comment => comment.id !== commentToDeleteId));

        setCommentVotes(prevVotes => {
          const newVotes = { ...prevVotes };
          delete newVotes[commentToDeleteId];
          return newVotes;
        });
      }
    } catch (err) {
      console.error('Unexpected error deleting comment:', err);
      alert('An unexpected error occurred while deleting the comment.');
    } finally {
      setIsDeletingComment(false);
      setShowDeleteCommentModal(false);
      setCommentToDeleteId(null);
    }
  };

  const openReportModal = (target) => {
    if (!currentUser) {
      redirectToLogin();
      return;
    }

    setReportTarget(target);
    setReportReason('');
    handleReportDescriptionChange({ target: { value: '' } });
    setReportSuccess(false);
    setShowReportModal(true);
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();

    if (!reportReason) {
      alert('Please select a reason for reporting');
      return;
    }

    if (reportHasProfanity) {
      alert('Please remove inappropriate language before submitting');
      return;
    }

    setReportSubmitting(true);

    try {
      const reportData = {
        reporter_id: currentUser.id,
        reason: reportReason,
        description: cleanReportText(reportDescription) || null, // Use cleaned text
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

    const trimmedComment = newComment.trim();
    if (!trimmedComment) {
      return;
    }

    if (commentHasProfanity) {
      alert('Please remove inappropriate language before submitting');
      return;
    }

    setIsSubmittingComment(true);

    try {
      const commentToInsert = await cleanCommentText(trimmedComment);
      console.log('Cleaned comment to insert:', commentToInsert);

      if (typeof commentToInsert !== 'string') {
          console.error('Cleaned comment is not a string:', commentToInsert);
          alert('Failed to process comment text. Please try again.');
          setIsSubmittingComment(false);
          return;
      }

      const { data, error } = await supabase
        .from('project_comments')
        .insert([
          {
            project_id: parseInt(id),
            user_id: currentUser.id,
            comment: commentToInsert
          }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error submitting comment:', error);
        alert('Failed to submit comment. Please try again.');
        setIsSubmittingComment(false);
        return;
      }

      if (!data) {
        console.error('No data returned after comment insertion');
        alert('Failed to submit comment. Please try again.');
        setIsSubmittingComment(false);
        return;
      }

      const newCommentId = data.id;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', currentUser.id)
        .single();

      const displayName = profileError ? 'User' : (profileData?.display_name || 'User');

      const newCommentWithProfile = {
        ...data,
        profiles: {
          display_name: displayName
        }
      };

      setComments(prevComments =>
        commentFilter === 'new'
          ? [newCommentWithProfile, ...prevComments]
          : [...prevComments, newCommentWithProfile]
      );
      handleCommentChange({ target: { value: '' } });

      setCommentVotes(prev => ({
        ...prev,
        [newCommentId]: {
          score: 0,
          userVote: null
        }
      }));

    } catch (error) {
      console.error('Error in comment submission:', error);
      alert('An unexpected error occurred.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const getFilteredComments = () => {
    if (!comments || comments.length === 0) return [];

    const filtered = [...comments];

    switch (commentFilter) {
      case 'top':
        return filtered.sort((a, b) =>
          (commentVotes[b.id]?.score || 0) - (commentVotes[a.id]?.score || 0)
        );
      case 'old':
        return filtered.sort((a, b) =>
          new Date(a.created_at) - new Date(b.created_at)
        );
      case 'new':
      default:
        return filtered.sort((a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
        );
    }
  };

  // Helper to format relative time
  const formatRelativeTime = (dateString) => {
    if (!dateString) return '';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (e) {
      console.error("Error formatting date:", e);
      return dateString; // Fallback
    }
  };

  // Helper to get state color
  const getStateColor = (state, merged = false) => {
    if (merged) return 'bg-purple-600';
    switch (state?.toLowerCase()) {
      case 'open': return 'bg-green-600';
      case 'closed': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
          </div>
          <h1 className="inria-sans-bold text-xl text-off-white">Loading Project Details</h1>
        </div>
      </div>
    );
  }

  const displayedIssues = showAllIssues ? issues : issues.slice(0, 3);
  const displayedPullRequests = showAllPullRequests ? pullRequests : pullRequests.slice(0, 3);

  return (
    <div className="w-full flex flex-col items-center px-2 py-10">
      <div className="w-full max-w-[1200px] mx-auto">
        {/* Webhook Warning Banner */}
        {isOwner && project && !project.webhook_active && (
          <div className="bg-[--title-red] bg-opacity-90 text-[--off-white] p-6 rounded-xl border-b-2 border-[--orange] flex items-start gap-4 mb-8 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2 mt-0.5 text-[--orange]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-bold text-xl mb-1 tracking-tight">GitHub Webhook Required</h3>
              <p className="mb-2 text-[--off-white] opacity-80">
                Your project isn&#39;t visible to other users because you haven&#39;t set up a GitHub webhook.
                Projects without active webhooks won&#39;t appear in recommendations or search results.
              </p>
              <details className="bg-[#232323] rounded-lg p-3 mt-2 border-l-4 border-[--orange]">
                <summary className="font-semibold cursor-pointer text-[--orange]">How to set up your webhook</summary>
                <ol className="list-decimal ml-6 mt-2 text-sm text-[--off-white]">
                  <li className="mb-1">Go to your GitHub repository &rarr; <b>Settings</b> &rarr; <b>Webhooks</b></li>
                  <li className="mb-1">Click <b>Add webhook</b></li>
                  <li className="mb-1">
                    <div className="mb-1"><b>Payload URL:</b></div>
                    <code className="bg-amber-800 p-1 rounded block overflow-x-auto text-xs">
                      {`${window.location.origin}/api/webhooks/github?projectId=${project.id}`}
                    </code>
                  </li>
                  <li className="mb-1"><b>Content type:</b> <code className="bg-amber-800 p-1 rounded">application/json</code></li>
                  <li className="mb-1">
                    <div><b>Secret:</b></div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="bg-amber-800 p-1 rounded font-mono text-green-300">{secret}</code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(secret);
                          setCopiedSecret(true);
                          setTimeout(() => setCopiedSecret(false), 2000);
                        }}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs"
                      >
                        {copiedSecret ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </li>
                  <li className="mb-1">For <b>events</b>, select <b>Push</b>, <b>Issues</b>, and <b>Pull requests</b></li>
                  <li>Click <b>Add webhook</b> to save</li>
                </ol>
              </details>
            </div>
          </div>
        )}

        {/* Project Title and Actions */}
        <section className="rounded-xl shadow-lg bg-[#232323] border border-[var(--muted-red)] p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 border-b border-[--muted-red] pb-6 mb-6">
            <div className="min-w-0">
              <h1 className="text-5xl font-extrabold flex items-center group text-[var(--off-white)] tracking-tight mb-2 truncate">
                <a
                  href={`https://github.com/${project.repo_owner}/${project.repo_name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 relative text-[var(--off-white)] hover:text-[var(--title-red)] transition-colors duration-300"
                >
                  <span className="">{project.repo_name}</span>
                  <div className="relative">
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--title-red)] transform scale-x-0 transition-transform duration-300 group-hover:scale-x-100" />
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-7 w-7 transform transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 00-2-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleLike}
                className={`px-5 py-2 rounded-full flex items-center gap-2 font-bold shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[--orange] ${
                  currentUser && isLiked ? 'bg-[--orange] hover:bg-[--title-red] text-white scale-105' : 'bg-[#232323] hover:bg-[--orange] text-[--off-white]'
                } ${!currentUser ? 'cursor-pointer' : ''}`}
                aria-pressed={currentUser ? isLiked : undefined}
                title={currentUser ? (isLiked ? "Unlike project" : "Like project") : "Log in to like"}
              >
                <span className="text-xl">{currentUser && isLiked ? '❤️' : '🤍'}</span>
                <span className="font-semibold">{likes}</span>
              </button>
              <button
                onClick={() => openReportModal({ type: 'project' })}
                className="px-3 py-2 bg-[--muted-red] hover:bg-[--title-red] rounded-full text-sm shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[--title-red]"
                title="Report Project"
              >
                <span role="img" aria-label="Report">⚠️</span>
              </button>
              {isOwner && (
                <>
                  <button
                    onClick={redirectToEditPage}
                    className="px-4 py-2 bg-green-700 hover:bg-green-800 rounded-full text-sm font-bold shadow transition-all duration-200 ml-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                    title="Edit Project"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-red-700 hover:bg-red-800 rounded-full text-sm font-bold shadow transition-all duration-200 ml-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                    title="Delete Project"
                  >
                    🗑️ Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Project Description */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[--orange] mb-2">Description</h2>
            <p className="text-[--off-white]">{project.custom_description || "No custom description provided."}</p>
          </div>

          {/* Project Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <h3 className="font-semibold text-[--orange] mb-1">Repository</h3>
              <div className="text-[--off-white] flex items-center">
                <a
                  href={`https://github.com/${project.repo_owner}/${project.repo_name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center hover:text-[--title-red] transition-colors"
                >
                  {project.repo_owner}/{project.repo_name}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.293 10.172a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-[--orange] mb-1">Status</h3>
              <p className="text-[--off-white]">{project.status || "Unknown"}</p>
            </div>

            <div>
              <h3 className="font-semibold text-[--orange] mb-1">Difficulty Level</h3>
              <div className="flex items-center">
                {Array.from({ length: project.difficulty_level || 1 }).map((_, i) => (
                  <svg key={i} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[--title-red]" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
                {Array.from({ length: 5 - (project.difficulty_level || 1) }).map((_, i) => (
                  <svg key={i + project.difficulty_level} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-[--orange] mb-1">Setup Time</h3>
              <p className="text-[--off-white]">{project.setup_time ? `${project.setup_time} minutes` : "Not specified"}</p>
            </div>

            <div>
              <h3 className="font-semibold text-[--orange] mb-1">Mentorship</h3>
              <p className="text-[--off-white]">{project.mentorship ? "Available" : "Not available"}</p>
            </div>

            <div>
              <h3 className="font-semibold text-[--orange] mb-1">License</h3>
              <p className="text-[--off-white]">{project.license || "Not specified"}</p>
            </div>

            <div>
              <h3 className="font-semibold text-[--orange] mb-1">Open Issues</h3>
              <p className="text-[--off-white]">{project.open_issues || "0"}</p>
            </div>

            <div>
              <h3 className="font-semibold text-[--orange] mb-1">Contribution Types</h3>
              {project.project_contribution_type && project.project_contribution_type.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {project.project_contribution_type.map((ct) => (
                    <span
                      key={ct.contribution_type.id}
                      className="inline-block px-3 py-1 rounded-full text-sm font-medium shadow bg-[#232323] text-[var(--off-white)] border border-[var(--muted-red)] hover:border-[var(--title-red)]"
                    >
                      {ct.contribution_type.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No contribution types specified</p>
              )}
            </div>
          </div>
        </section>

        {/* Technologies and Tags */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Technologies */}
          <section className="rounded-xl shadow-lg bg-[#232323] border border-[var(--muted-red)] p-8">
            <h2 className="text-xl font-bold text-[var(--off-white)] mb-4">Technologies & Languages</h2>
            <div className="flex flex-wrap gap-2">
              {project.project_technologies && project.project_technologies.length > 0
                ? project.project_technologies.map(pt =>
                    <span
                      key={pt.technologies.id}
                      className={`inline-block px-3 py-1 rounded-full text-sm font-medium shadow ${
                        pt.is_highlighted
                          ? "bg-[#232323] text-[var(--off-white)] border-2 border-amber-500 hover:border-amber-400"
                          : "bg-[#232323] text-[var(--off-white)] border border-[var(--muted-red)] hover:border-[var(--title-red)]"
                      }`}
                    >
                      {pt.technologies.name}{pt.is_highlighted ? " ★" : ""}
                    </span>
                  )
                : <span className="text-gray-400">No technologies specified</span>}
            </div>
          </section>

          {/* Tags */}
          <section className="rounded-xl shadow-lg bg-[#232323] border border-[var(--muted-red)] p-8">
            <h2 className="text-xl font-bold text-[var(--off-white)] mb-4">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {project.project_tags && project.project_tags.length > 0
                ? project.project_tags.map(pt => {
                    const tagColor = pt.tags.colour ? `#${pt.tags.colour}` : null;

                    return (
                      <span
                        key={pt.tags.id}
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium shadow ${
                          pt.is_highlighted
                            ? "bg-[#232323] text-[var(--off-white)] border-2 border-amber-500 hover:border-amber-400"
                            : "bg-[#232323] text-[var(--off-white)] border border-[var(--muted-red)] hover:border-[var(--title-red)]"
                        }`}
                        style={tagColor ? {
                          borderColor: tagColor,
                          borderLeftColor: tagColor,
                          borderRightColor: tagColor,
                          borderTopColor: tagColor,
                          borderBottomColor: tagColor
                        } : {}}
                      >
                        {pt.tags.name}{pt.is_highlighted ? " ★" : ""}
                      </span>
                    );
                  })
                : <span className="text-gray-400">No tags specified</span>}
            </div>
          </section>
        </div>

        {/* Issues and Pull Requests */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Recent Issues */}
          <section className="rounded-xl shadow-lg bg-[#232323] border border-[var(--muted-red)] p-8 flex flex-col">
            <h2 className="text-xl font-bold text-[var(--off-white)] mb-4">Recent Issues</h2>
            {issues.length > 0 ? (
              <div className="flex-grow space-y-3">
                {displayedIssues.map(issue => (
                  <div key={issue.id} className="p-3 bg-[#1a1a1a] rounded-lg border border-gray-700">
                    <div className="flex justify-between items-start mb-1">
                      <a
                        href={issue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[var(--off-white)] hover:text-[var(--orange)] transition-colors mr-2 truncate flex-1"
                        title={issue.title}
                      >
                        #{issue.number} {issue.title}
                      </a>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${getStateColor(issue.state)}`}>
                        {issue.state}
                      </span>
                    </div>
                    {issue.labels && issue.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {issue.labels.map(label => (
                          <span key={label.id || label.name} className="px-2 py-0.5 rounded text-xs bg-gray-600 text-gray-200">
                            {label.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {issue.body && (
                      <div className="text-sm text-gray-400 mb-1">
                        <p className={`${expandedIssueId !== issue.id ? 'line-clamp-2' : ''}`}>
                          {issue.body}
                        </p>
                        {issue.body.length > 100 && ( // Only show toggle if body is long enough
                          <button
                            onClick={() => setExpandedIssueId(expandedIssueId === issue.id ? null : issue.id)}
                            className="text-xs text-[var(--orange)] hover:underline mt-1"
                          >
                            {expandedIssueId === issue.id ? 'Show Less' : 'Show More'}
                          </button>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      Updated {formatRelativeTime(issue.updated_at)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-4 flex-grow flex items-center justify-center">
                No issues found for this project.
              </div>
            )}
            {issues.length > 3 && (
              <button
                onClick={() => setShowAllIssues(!showAllIssues)}
                className="mt-4 px-4 py-2 bg-[var(--muted-red)] hover:bg-[var(--title-red)] rounded-lg text-sm font-semibold text-white transition-colors duration-200 self-center"
              >
                {showAllIssues ? 'Show Less Issues' : 'View More Issues'}
              </button>
            )}
          </section>

          {/* Recent Pull Requests */}
          <section className="rounded-xl shadow-lg bg-[#232323] border border-[var(--muted-red)] p-8 flex flex-col">
            <h2 className="text-xl font-bold text-[var(--off-white)] mb-4">Recent Pull Requests</h2>
            {pullRequests.length > 0 ? (
              <div className="flex-grow space-y-3">
                {displayedPullRequests.map(pr => (
                  <div key={pr.id} className="p-3 bg-[#1a1a1a] rounded-lg border border-gray-700">
                    <div className="flex justify-between items-start mb-1">
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[var(--off-white)] hover:text-[var(--orange)] transition-colors mr-2 truncate flex-1"
                        title={pr.title}
                      >
                        #{pr.number} {pr.title}
                      </a>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${getStateColor(pr.state, pr.merged)}`}>
                        {pr.merged ? 'Merged' : pr.state}
                      </span>
                    </div>
                     {pr.labels && pr.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {pr.labels.map(label => (
                          <span key={label.id || label.name} className="px-2 py-0.5 rounded text-xs bg-gray-600 text-gray-200">
                            {label.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {pr.body && (
                      <div className="text-sm text-gray-400 mb-1">
                        <p className={`${expandedPrId !== pr.id ? 'line-clamp-2' : ''}`}>
                          {pr.body}
                        </p>
                        {pr.body.length > 100 && ( // Only show toggle if body is long enough
                          <button
                            onClick={() => setExpandedPrId(expandedPrId === pr.id ? null : pr.id)}
                            className="text-xs text-[var(--orange)] hover:underline mt-1"
                          >
                            {expandedPrId === pr.id ? 'Show Less' : 'Show More'}
                          </button>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      Updated {formatRelativeTime(pr.updated_at)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-4 flex-grow flex items-center justify-center">
                No pull requests found for this project.
              </div>
            )}
            {pullRequests.length > 3 && (
              <button
                onClick={() => setShowAllPullRequests(!showAllPullRequests)}
                className="mt-4 px-4 py-2 bg-[var(--muted-red)] hover:bg-[var(--title-red)] rounded-lg text-sm font-semibold text-white transition-colors duration-200 self-center"
              >
                {showAllPullRequests ? 'Show Less Pull Requests' : 'View More Pull Requests'}
              </button>
            )}
          </section>
        </div>


        {/* Resource Links */}
        {project.links && project.links.length > 0 && (
          <section className="rounded-xl shadow-lg bg-[#232323] border border-[var(--muted-red)] p-8 mb-8">
            <h2 className="text-xl font-bold text-[var(--off-white)] mb-4">Resource Links</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {project.links.map((link, index) => {
                // Parse the link if it's a string
                let linkObj = link;
                if (typeof link === 'string') {
                  try {
                    linkObj = JSON.parse(link);
                  } catch (e) {
                    console.error('Error parsing link JSON:', e);
                    return null;
                  }
                }

                // Basic validation for link object structure
                if (!linkObj || typeof linkObj !== 'object' || !linkObj.url || !linkObj.name) {
                    console.warn('Skipping invalid link object:', linkObj);
                    return null;
                }

                return (
                  <a
                    key={index}
                    href={linkObj.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-3 rounded-lg bg-[#1a1a1a] border border-[var(--muted-red)] hover:border-[var(--title-red)] transition-colors group"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[var(--orange)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <span className="text-[var(--off-white)] block truncate group-hover:text-[var(--orange)] transition-colors">{linkObj.name}</span>
                      <span className="text-xs text-gray-400 truncate block">{linkObj.url}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* Activity Graph */}
        <section className="rounded-xl shadow-lg bg-[#232323] border border-[var(--muted-red)] p-8 mb-8">
          <h2 className="text-xl font-bold text-[var(--off-white)] mb-4">Project Activity</h2>
          <div className="bg-[#1a1a1a] rounded-xl shadow-sm border border-gray-800 p-6">
            {project.repo_owner && project.repo_name ? (
              <>
                <p className="text-sm text-[var(--off-white)] mb-4">
                  Weekly commit activity for the past 2 months
                </p>
                <ActivityGraph
                  projectId={project.id}
                  weeks={8}
                />
              </>
            ) : (
              <div className="text-center text-gray-400 py-8">
                No repository information available to display activity
              </div>
            )}
          </div>
        </section>

        {/* Comments Section */}
        <section className="rounded-xl shadow-lg bg-[#232323] border border-[var(--muted-red)] p-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
            <h2 className="text-xl font-bold text-[var(--off-white)]">Comments</h2>
            <div className="flex items-center mt-2 sm:mt-0">
              <label htmlFor="comment-filter" className="mr-2 text-sm text-[var(--off-white)]">Filter by:</label>
              <select
                id="comment-filter"
                className="bg-[#1a1a1a] text-[var(--off-white)] rounded px-3 py-1 text-sm border border-gray-700"
                value={commentFilter}
                onChange={(e) => setCommentFilter(e.target.value)}
              >
                <option value="new">Newest</option>
                <option value="top">Top Rated</option>
                <option value="old">Oldest</option>
              </select>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {getFilteredComments().length > 0 ? getFilteredComments().map((comment) => (
              <div key={comment.id} className="p-4 bg-[#1a1a1a] rounded-xl shadow-sm border border-gray-800">
                <div className="flex justify-between items-start mb-1">
                  <p className="font-bold text-[var(--orange)]">{comment.profiles?.display_name || 'User'}</p>
                  <div className="flex items-center gap-2">
                    {currentUser && currentUser.id === comment.user_id && (
                      <button
                        onClick={() => handleCommentDelete(comment.id)}
                        className="text-xs bg-red-700 hover:bg-red-800 px-2 py-1 rounded transition-colors duration-200 text-white"
                        title="Delete Comment"
                      >
                        🗑️
                      </button>
                    )}
                    <button
                      onClick={() => openReportModal({ type: 'comment', id: comment.id })}
                      className="text-xs bg-[var(--muted-red)] hover:bg-[var(--title-red)] px-2 py-1 rounded transition-colors duration-200"
                      title="Report Comment"
                    >
                      ⚠️
                    </button>
                  </div>
                </div>
                <p className="text-[var(--off-white)] whitespace-pre-wrap break-words">
                  {comment.comment && typeof comment.comment === 'string' && comment.comment !== '{}'
                    ? comment.comment
                    : '[Comment content unavailable]'}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center">
                    <button
                      onClick={() => handleVote(comment.id, 'up')}
                      disabled={!currentUser}
                      className={`px-2 py-1 rounded transition-colors duration-200 ${
                        commentVotes[comment.id]?.userVote === 'up'
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#232323] hover:bg-blue-700'
                      }`}
                      title={currentUser ? "Upvote" : "Sign in to vote"}
                    >
                      ▲
                    </button>
                    <span className="mx-2 font-semibold text-[var(--off-white)]">{commentVotes[comment.id]?.score || 0}</span>
                    <button
                      onClick={() => handleVote(comment.id, 'down')}
                      disabled={!currentUser}
                      className={`px-2 py-1 rounded transition-colors duration-200 ${
                        commentVotes[comment.id]?.userVote === 'down'
                          ? 'bg-red-600 text-white'
                          : 'bg-[#232323] hover:bg-red-700'
                      }`}
                      title={currentUser ? "Downvote" : "Sign in to vote"}
                    >
                      ▼
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    {comment.created_at ? new Date(comment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Date unknown'}
                  </p>
                </div>
              </div>
            )) : (
              <div className="text-center text-gray-400 py-4">
                No comments yet. Be the first to comment!
              </div>
            )}
          </div>

          {/* Add Comment Form */}
          <div className="p-4 bg-[#1a1a1a] rounded-xl border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-[var(--orange)]">Add a Comment</h3>
            {currentUser ? (
              <form onSubmit={handleCommentSubmit}>
                <textarea
                  className={`w-full bg-[#18181b] p-3 rounded-xl text-[var(--off-white)] mb-3 resize-none border ${
                    commentHasProfanity
                      ? 'border-2 border-[var(--title-red)]'
                      : 'border border-[var(--muted-red)]'
                  } focus:ring-2 focus:ring-[var(--title-red)] focus:border-[var(--title-red)] outline-none`}
                  rows="3"
                  value={newComment}
                  onChange={handleCommentChange}
                  placeholder="Share your thoughts about this project..."
                  required
                ></textarea>
                {commentHasProfanity && (
                  <p className="text-[var(--title-red)] text-sm mb-2">
                    Please remove inappropriate language
                  </p>
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[var(--title-red)] hover:bg-[var(--orange)] rounded-xl text-white font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmittingComment || !newComment.trim() || commentHasProfanity}
                  >
                    {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center p-4 bg-[#18181b] rounded-xl">
                <p className="mb-2 text-[var(--off-white)]">You need to be logged in to comment</p>
                <button
                  onClick={redirectToLogin}
                  className="px-4 py-2 bg-[var(--title-red)] hover:bg-[var(--orange)] rounded-xl text-white font-semibold"
                >
                  Log In
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
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
                  <label htmlFor="report-reason" className="block mb-2">Reason:</label>
                  <select
                    id="report-reason"
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
                  <label htmlFor="report-description" className="block mb-2">Description (optional):</label>
                  <textarea
                    id="report-description"
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
                    className="px-4 py-2 rounded bg-[--title-red] hover:bg-[--muted-red] font-semibold disabled:opacity-50"
                    disabled={reportSubmitting || !reportReason || reportHasProfanity}
                  >
                    {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Project Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
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
                Type <span className="text-red-400 font-mono">&ldquo;{project.repo_name}&rdquo;</span> to confirm:
              </p>
              <input
                type="text"
                className="w-full bg-gray-800 p-2 rounded text-[--off-white] border border-gray-700 focus:ring-red-500 focus:border-red-500 outline-none"
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

      {/* Delete Comment Modal */}
      {showDeleteCommentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md text-[--off-white] border border-red-500 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-red-500">Delete Comment</h2>
              <button
                onClick={() => {
                  setShowDeleteCommentModal(false);
                  setCommentToDeleteId(null);
                }}
                className="text-gray-400 hover:text-white text-2xl"
                aria-label="Close"
                disabled={isDeletingComment}
              >
                &times;
              </button>
            </div>
            <div className="mb-6">
              <p className="text-[--off-white]">
                Are you sure you want to delete this comment? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteCommentModal(false);
                  setCommentToDeleteId(null);
                }}
                className="px-4 py-2 rounded mr-2 bg-gray-700 hover:bg-gray-600"
                disabled={isDeletingComment}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCommentDelete}
                className="px-4 py-2 rounded font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50"
                disabled={isDeletingComment}
              >
                {isDeletingComment ? 'Deleting...' : 'Delete Comment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails;