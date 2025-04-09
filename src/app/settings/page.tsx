"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import Link from 'next/link';
import MultiSelector from '../Components/MultiSelector';
import { User } from '@supabase/supabase-js';
import Notification, { NotificationItem } from '../Components/Notification';

export default function Settings() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferredTags, setPreferredTags] = useState([]);
  const [interactionHistory, setInteractionHistory] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState(null);

  const [preferredTagNames, setPreferredTagNames] = useState<string[]>([]);
  const [allTagNames, setAllTagNames] = useState<string[]>([]);

  const [preferredTagObjects, setPreferredTagObjects] = useState([]);
  const [allTagObjects, setAllTagObjects] = useState<{ id: any; name: any }[]>([]);
  const [emailFrequency, setEmailFrequency] = useState<string>('never');
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    async function fetchUserData() {
      try {
        setLoading(true);

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) {
          setError("You must be logged in to view this page");
          setLoading(false);
          return;
        }

        setCurrentUser(user);

        // Fetch all available tags for the selector
        await fetchAllTags();

        // First check for explicit user preferences
        const { data: userPrefs, error: prefsError } = await supabase
          .from('user_preferences')
          .select('preferred_tags')
          .eq('user_id', user.id)
          .single();

        // Add this code to fetch email preferences
        const { data: emailPrefs, error: emailPrefsError } = await supabase
          .from('user_email_preferences')
          .select('email_frequency')
          .eq('user_id', user.id)
          .single();

        if (!emailPrefsError && emailPrefs && emailPrefs.email_frequency) {
          setEmailFrequency(emailPrefs.email_frequency);
        }

        if (!prefsError && userPrefs) {
          // User has explicit preferences, fetch the full objects
          if (userPrefs.preferred_tags && userPrefs.preferred_tags.length > 0) {
            await fetchTagsById(userPrefs.preferred_tags);
          }
        } else {
          // No explicit preferences, derive from interactions
          await fetchPreferredTags(user.id);
        }

        // Always fetch interaction history
        await fetchInteractionHistory(user.id);
        
        setLoading(false);
      } catch (err) {
        console.error("Error fetching user preferences:", err);
        setError("Failed to load preferences");
        setLoading(false);
      }
    }

    fetchUserData();
  }, []);

  async function fetchAllTags() {
    try {
      const { data, error } = await supabase
        .from('tags') 
        .select('id, name')
        .order('name');

      if (error) throw error;

      setAllTagObjects(data || []);
      setAllTagNames((data || []).map(tag => tag.name));
    } catch (error) {
      console.error("Error fetching all tags:", error);
      setAllTagObjects([]);
      setAllTagNames([]);
    }
  }

  async function fetchPreferredTags(userId) {
    try {
      // Get user interactions
      const { data: interactions, error: interactionError } = await supabase
        .from('user_interactions')
        .select('repo_id')
        .eq('user_id', userId);

      if (interactionError) throw interactionError;

      const interactedRepoIds = [...new Set(interactions.map(i => i.repo_id))];

      if (interactedRepoIds.length === 0) {
        setPreferredTagObjects([]);
        setPreferredTagNames([]);
        return;
      }

      // Get projects by repo_id
      const { data: projects, error: projectError } = await supabase
        .from('project')
        .select('id, repo_name')
        .in('repo_name', interactedRepoIds);

      if (projectError) throw projectError;
      if (!projects || projects.length === 0) {
        setPreferredTagObjects([]);
        setPreferredTagNames([]);
        return;
      }

      const projectIds = projects.map(p => p.id);

      // Get tags associated with these projects
      const { data: tagAssociations, error: tagError } = await supabase
        .from('project_tags') 
        .select(`
          project_id,
          tags (  
            id,
            name
          )
        `)
        .in('project_id', projectIds);

      if (tagError) throw tagError;

      // Extract tag objects and remove duplicates by id
      const tagObjects = tagAssociations
        .filter(ta => ta.tags) 
        .map(ta => ({
          id: ta.tags.id, 
          name: ta.tags.name
        }));

      // Remove duplicates
      const uniqueTags = Array.from(
        new Map(tagObjects.map(tag => [tag.id, tag])).values()
      );

      setPreferredTagObjects(uniqueTags);
      setPreferredTagNames(uniqueTags.map(tag => tag.name));
    } catch (error) {
      console.error("Error fetching preferred tags:", error);
      setPreferredTagObjects([]);
      setPreferredTagNames([]);
    }
  }

  async function fetchInteractionHistory(userId) {
    try {
      const { data, error } = await supabase
        .from('user_interactions')
        .select(`
          id, 
          interaction_type, 
          timestamp, 
          repo_id
        `)
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      setInteractionHistory(data || []);
    } catch (error) {
      console.error("Error fetching interaction history:", error);
      setInteractionHistory([]);
    }
  }

  async function clearInteractionHistory() {
    if (!currentUser || !confirm("Are you sure you want to clear your interaction history? This will reset your recommendations.")) {
      return;
    }
    
    try {
      setSaving(true);
      const { error } = await supabase
        .from('user_interactions')
        .delete()
        .eq('user_id', currentUser.id);
        
      if (error) throw error;
      
      setInteractionHistory([]);
      setSaveMessage({ type: 'success', text: 'Interaction history cleared successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error clearing interaction history:', error);
      setSaveMessage({ type: 'error', text: 'Failed to clear interaction history' });
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  // Helper function to add a notification
  const addNotification = (message: string, type: 'success' | 'error') => {
    const newNotification: NotificationItem = {
      id: Date.now().toString(), // Simple unique ID
      message,
      type,
      timestamp: Date.now()
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, 3)); // Keep max 3 notifications
  };

  // Function to remove a notification by ID
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  async function saveUserPreferences() {
    if (!currentUser) return;

    try {
      setSaving(true);

      // Get the tag IDs from selected preferences
      const tagIds = preferredTagObjects.map(tag => tag.id).filter(Boolean);

      // First handle tag preferences - this is a many-to-many relationship table
      try {
        // First, delete all existing tag preferences for this user
        const { error: deleteError } = await supabase
          .from('user_tag_preferences')
          .delete()
          .eq('user_id', currentUser.id);

        if (deleteError) throw new Error(`Error deleting existing tag preferences: ${deleteError.message}`);

        // Then insert new preferences if there are any
        if (tagIds.length > 0) {
          // Prepare the rows for insertion
          const tagRows = tagIds.map(tag_id => ({
            user_id: currentUser.id,
            tag_id
          }));

          const { error: insertError } = await supabase
            .from('user_tag_preferences')
            .insert(tagRows);

          if (insertError) throw new Error(`Error inserting tag preferences: ${insertError.message}`);
        }
      } catch (prefError) {
        console.error("Failed to save tag preferences:", prefError);
        throw prefError;
      }

      // Now handle the email preferences
      try {
        // First check if the user already has email preferences
        const { data: existingEmailPrefs, error: getEmailError } = await supabase
          .from('user_email_preferences')
          .select('*')  // Select all columns to ensure we have everything we need
          .eq('user_id', currentUser.id)
          .maybeSingle(); 

        if (getEmailError) {
          throw new Error(`Error fetching email preferences: ${getEmailError.message}`);
        }

        // Validate email frequency value before saving
        const validFrequencies = ['never', 'daily', 'weekly'];
        if (!validFrequencies.includes(emailFrequency)) {
          throw new Error(`Invalid email frequency: ${emailFrequency}`);
        }

        // Prepare the data object without updated_at to avoid schema mismatches
        const emailPrefData = {
          user_id: currentUser.id,
          email_frequency: emailFrequency
        };

        if (existingEmailPrefs) {
          // Update existing email preferences using user_id as the identifier
          const { error: updateEmailError } = await supabase
            .from('user_email_preferences')
            .update(emailPrefData)
            .eq('user_id', currentUser.id);

          if (updateEmailError) throw new Error(`Error updating email preferences: ${updateEmailError.message}`);
        } else {
          // Insert new email preferences
          const { error: insertEmailError } = await supabase
            .from('user_email_preferences')
            .insert(emailPrefData);

          if (insertEmailError) throw new Error(`Error inserting email preferences: ${insertEmailError.message}`);
        }
      } catch (emailPrefError) {
        console.error("Failed to save email preferences:", emailPrefError);
        throw emailPrefError;
      }

      // Show success message
      setSaveMessage({ type: 'success', text: 'Preferences saved successfully!' });
      
      // Show success notification
      addNotification('Your preferences have been saved successfully!', 'success');
      
      // Clear message after a few seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error.message || error);

      // Show error message
      setSaveMessage({ 
        type: 'error', 
        text: `Failed to save preferences: ${error.message || 'Unknown error'}` 
      });
      
      // Show error notification
      addNotification(`Failed to save preferences: ${error.message || 'Unknown error'}`, 'error');
      
      // Clear message after a few seconds
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setSaving(false);
    }
  }

  async function fetchTagsById(tagIds) {
    try {
      const { data, error } = await supabase
        .from('tags')  
        .select('id, name')
        .in('id', tagIds);
        
      if (error) throw error;
      setPreferredTagObjects(data || []);
      setPreferredTagNames((data || []).map(tag => tag.name));
    } catch (error) {
      console.error("Error fetching tags by ID:", error);
      setPreferredTagObjects([]);
      setPreferredTagNames([]);
    }
  }

  const handleTagsChange = (type, names) => {
    if (type === "tags") {
      setPreferredTagNames(names);
      // Map names back to objects
      const objects = names.map(name => {
        const obj = allTagObjects.find(t => t.name === name);
        return obj || { name };
      });
      setPreferredTagObjects(objects);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-6">Loading your preferences...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-6">User Preferences</h1>
        <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded p-4 mb-6">
          {error}
        </div>
        <Link href="/login" className="text-blue-400 hover:underline">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Your Preferences</h1>
      
      {saveMessage && (
        <div className={`p-4 mb-4 rounded-md ${
          saveMessage.type === 'success' 
            ? 'bg-green-500 bg-opacity-20 border border-green-500' 
            : 'bg-red-500 bg-opacity-20 border border-red-500'
        }`}>
          {saveMessage.text}
        </div>
      )}

      <div className="mb-8 p-6 bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Your Preferred Tags</h2>
          <p className="text-sm text-gray-400">Select the tags you're interested in</p>
        </div>

        <MultiSelector
          availableTags={allTagNames}
          onTagsChange={(tags) => handleTagsChange("tags", tags)}
          initialTags={preferredTagNames}
        />
        
        <div className="mt-3 text-sm text-gray-400">
          <p>• Select tags to customize your project recommendations</p>
          <p>• These tags are derived from projects you've interacted with</p>
        </div>
      </div>

      <div className="mb-8 p-6 bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Email Notifications</h2>
          <p className="text-sm text-gray-400">How often would you like to receive emails?</p>
        </div>
        
        <div className="flex flex-col space-y-3">
          <label className="inline-flex items-center">
            <input 
              type="radio" 
              name="emailFrequency" 
              value="never" 
              checked={emailFrequency === 'never'}
              onChange={(e) => setEmailFrequency(e.target.value)}
              className="form-radio h-5 w-5 text-blue-600"
            />
            <span className="ml-2">Never</span>
          </label>
          <label className="inline-flex items-center">
            <input 
              type="radio" 
              name="emailFrequency" 
              value="daily" 
              checked={emailFrequency === 'daily'}
              onChange={(e) => setEmailFrequency(e.target.value)}
              className="form-radio h-5 w-5 text-blue-600"
            />
            <span className="ml-2">Daily</span>
          </label>
          <label className="inline-flex items-center">
            <input 
              type="radio" 
              name="emailFrequency" 
              value="weekly" 
              checked={emailFrequency === 'weekly'}
              onChange={(e) => setEmailFrequency(e.target.value)}
              className="form-radio h-5 w-5 text-blue-600"
            />
            <span className="ml-2">Weekly</span>
          </label>
        </div>
        
        <div className="mt-3 text-sm text-gray-400">
          <p>• Select how frequently you want to receive recommendation emails</p>
          <p>• Choose "Never" to opt out of all notification emails</p>
        </div>
      </div>

      <div className="mb-8 flex gap-4">
        <button
          onClick={saveUserPreferences}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>

      <div className="mb-8 p-6 bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Recent Interactions</h2>
          {interactionHistory.length > 0 && (
            <button
              onClick={clearInteractionHistory}
              disabled={saving}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              Clear history
            </button>
          )}
        </div>
        {interactionHistory.length > 0 ? (
          <div className="space-y-3">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left pb-2">Project</th>
                  <th className="text-left pb-2">Interaction</th>
                  <th className="text-left pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {interactionHistory.map(interaction => (
                  <tr key={interaction.id} className="border-b border-gray-700">
                    <td className="py-3">
                      <Link href={`/projects/${interaction.repo_id}`} className="text-blue-400 hover:underline">
                        {interaction.repo_id}
                      </Link>
                    </td>
                    <td className="py-3">
                      {interaction.interaction_type === 'like' ? '❤️ Liked' : '👁️ Viewed'}
                    </td>
                    <td className="py-3">
                      {new Date(interaction.timestamp).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400">No interaction history yet.</p>
        )}
      </div>

      <div className="mb-8 p-6 bg-gray-800 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">How Recommendations Work</h2>
        <p className="mb-2">Our recommendation system uses your interactions to suggest projects you might like:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Viewing a project adds 0.5 points to that project's score</li>
          <li>Liking a project adds 1 point to that project's score</li>
          <li>We analyze the tags and technologies of projects you interact with</li>
          <li>Projects with similar tags and technologies are recommended to you</li>
          <li>Your manually selected preferences above are also used to enhance recommendations</li>
          <li>The more you interact with projects, the better your recommendations become!</li>
        </ul>
      </div>
      
      {/* Updated Notification component */}
      <Notification
        notifications={notifications}
        onClose={removeNotification}
      />
    </div>
  );
}