"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import Link from 'next/link';
import MultiSelector from '../Components/MultiSelector';

export default function Settings() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferredTags, setPreferredTags] = useState([]);
  const [preferredTechnologies, setPreferredTechnologies] = useState([]);
  const [interactionHistory, setInteractionHistory] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [allTechnologies, setAllTechnologies] = useState([]);
  const [error, setError] = useState(null);
  const [saveMessage, setSaveMessage] = useState(null);

  const [preferredTagNames, setPreferredTagNames] = useState<string[]>([]);
  const [preferredTechNames, setPreferredTechNames] = useState<string[]>([]);
  const [allTagNames, setAllTagNames] = useState<string[]>([]);
  const [allTechNames, setAllTechNames] = useState<string[]>([]);

  const [preferredTagObjects, setPreferredTagObjects] = useState([]);
  const [preferredTechObjects, setPreferredTechObjects] = useState([]);
  const [allTagObjects, setAllTagObjects] = useState([]);
  const [allTechObjects, setAllTechObjects] = useState([]);

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

        // Fetch all available tags and technologies for the selector
        await Promise.all([
          fetchAllTags(),
          fetchAllTechnologies()
        ]);

        // First check for explicit user preferences
        const { data: userPrefs, error: prefsError } = await supabase
          .from('user_preferences')
          .select('preferred_tags, preferred_technologies')
          .eq('user_id', user.id)
          .single();

        if (!prefsError && userPrefs) {
          // User has explicit preferences, fetch the full objects
          if (userPrefs.preferred_tags && userPrefs.preferred_tags.length > 0) {
            await fetchTagsById(userPrefs.preferred_tags);
          }
          
          if (userPrefs.preferred_technologies && userPrefs.preferred_technologies.length > 0) {
            await fetchTechnologiesById(userPrefs.preferred_technologies);
          }
        } else {
          // No explicit preferences, derive from interactions
          await Promise.all([
            fetchPreferredTags(user.id),
            fetchPreferredTechnologies(user.id)
          ]);
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

  async function fetchAllTechnologies() {
    try {
      const { data, error } = await supabase
        .from('technologies')
        .select('id, name')
        .order('name');

      if (error) throw error;

      setAllTechObjects(data || []);
      setAllTechNames((data || []).map(tech => tech.name));
    } catch (error) {
      console.error("Error fetching all technologies:", error);
      setAllTechObjects([]);
      setAllTechNames([]);
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
          name: ta.tags.name  '
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

  async function fetchPreferredTechnologies(userId) {
    try {
      // Get user interactions
      const { data: interactions, error: interactionError } = await supabase
        .from('user_interactions')
        .select('repo_id')
        .eq('user_id', userId);

      if (interactionError) throw interactionError;

      const interactedRepoIds = [...new Set(interactions.map(i => i.repo_id))];

      if (interactedRepoIds.length === 0) {
        setPreferredTechObjects([]);
        setPreferredTechNames([]);
        return;
      }

      // Get projects by repo_id
      const { data: projects, error: projectError } = await supabase
        .from('project')
        .select('id, repo_name')
        .in('repo_name', interactedRepoIds);

      if (projectError) throw projectError;
      if (!projects || projects.length === 0) {
        setPreferredTechObjects([]);
        setPreferredTechNames([]);
        return;
      }

      const projectIds = projects.map(p => p.id);

      // Get technologies associated with these projects
      const { data: techAssociations, error: techError } = await supabase
        .from('project_technologies')
        .select(`
          project_id,
          technologies (
            id,
            name
          )
        `)
        .in('project_id', projectIds);

      if (techError) throw techError;

      // Extract tech objects and remove duplicates by id
      const techObjects = techAssociations
        .filter(ta => ta.technologies)
        .map(ta => ({
          id: ta.technologies.id,
          name: ta.technologies.name
        }));

      // Remove duplicates
      const uniqueTechs = Array.from(
        new Map(techObjects.map(tech => [tech.id, tech])).values()
      );

      setPreferredTechObjects(uniqueTechs);
      setPreferredTechNames(uniqueTechs.map(tech => tech.name));
    } catch (error) {
      console.error("Error fetching preferred technologies:", error);
      setPreferredTechObjects([]);
      setPreferredTechNames([]);
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

  async function saveUserPreferences() {
    if (!currentUser) return;

    try {
      setSaving(true);

      // Store user preferences in a new table called user_preferences
      // First check if the user already has preferences
      const { data: existingPrefs, error: getError } = await supabase
        .from('user_preferences')
        .select('id')
        .eq('user_id', currentUser.id)
        .single();

      const tagIds = preferredTagObjects.map(tag => tag.id).filter(Boolean);
      const techIds = preferredTechObjects.map(tech => tech.id).filter(Boolean);

      if (getError && getError.code !== 'PGRST116') {
        // Error other than "not found"
        throw getError;
      }

      if (existingPrefs) {
        // Update existing preferences
        const { error: updateError } = await supabase
          .from('user_preferences')
          .update({
            preferred_tags: tagIds,
            preferred_technologies: techIds,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPrefs.id);

        if (updateError) throw updateError;
      } else {
        // Insert new preferences
        const { error: insertError } = await supabase
          .from('user_preferences')
          .insert({
            user_id: currentUser.id,
            preferred_tags: tagIds,
            preferred_technologies: techIds
          });

        if (insertError) throw insertError;
      }

      // Show success message
      setSaveMessage({ type: 'success', text: 'Preferences saved successfully!' });

      // Clear message after a few seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);

      // Show error message
      setSaveMessage({ type: 'error', text: 'Failed to save preferences' });

      // Clear message after a few seconds
      setTimeout(() => setSaveMessage(null), 3000);
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

  async function fetchTechnologiesById(techIds) {
    try {
      const { data, error } = await supabase
        .from('technologies')
        .select('id, name')
        .in('id', techIds);
        
      if (error) throw error;
      setPreferredTechObjects(data || []);
      setPreferredTechNames((data || []).map(tech => tech.name));
    } catch (error) {
      console.error("Error fetching technologies by ID:", error);
      setPreferredTechObjects([]);
      setPreferredTechNames([]);
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
    } else if (type === "technologies") {
      setPreferredTechNames(names);
      // Map names back to objects
      const objects = names.map(name => {
        const obj = allTechObjects.find(t => t.name === name);
        return obj || { name };
      });
      setPreferredTechObjects(objects);
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
          <h2 className="text-xl font-semibold">Your Preferred Technologies</h2>
          <p className="text-sm text-gray-400">Select the technologies you're interested in</p>
        </div>

        <MultiSelector
          availableTags={allTechNames}
          onTagsChange={(tags) => handleTagsChange("technologies", tags)}
          initialTags={preferredTechNames}
        />
        
        <div className="mt-3 text-sm text-gray-400">
          <p>• Select technologies to customize your project recommendations</p>
          <p>• These technologies are derived from projects you've interacted with</p>
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
    </div>
  );
}