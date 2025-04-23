"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import Link from 'next/link';
import MultiSelector from '../Components/MultiSelector';
import MultiDifficultySelector from '../Components/MultiDifficultySelector';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [preferredTagNames, setPreferredTagNames] = useState<string[]>([]);
  const [allTagNames, setAllTagNames] = useState<string[]>([]);
  const [allTagObjects, setAllTagObjects] = useState<{ id: string; name: string }[]>([]);
  const [emailFrequency, setEmailFrequency] = useState<string>('never');
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [displayName, setDisplayName] = useState<string>('');
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [updatingDisplayName, setUpdatingDisplayName] = useState(false);
  const [selectedDifficulties, setSelectedDifficulties] = useState<number[]>([]);
  const [updatingDifficulty, setUpdatingDifficulty] = useState(false);
  const [allTechnologyNames, setAllTechnologyNames] = useState<string[]>([]);
  const [allTechnologyObjects, setAllTechnologyObjects] = useState<{ id: string; name: string }[]>([]);
  const [preferredTechnologyNames, setPreferredTechnologyNames] = useState<string[]>([]);
  const [updatingTechnologies, setUpdatingTechnologies] = useState(false);

  // Fetch user, tags, and preferences
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
        setUserId(user.id);

        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('display_name, difficulty_level')
          .eq('user_id', user.id)
          .single();
        
        if (profileError && profileError.code !== 'PGRST116') throw profileError;
        
        if (profile) {
          setDisplayName(profile.display_name || '');
          setSelectedDifficulties(profile.difficulty_level || []);
        }

        // Fetch all available tags
        const { data: allTags, error: tagsError } = await supabase
          .from('tags')
          .select('id, name')
          .order('name');
        if (tagsError) throw tagsError;
        setAllTagObjects(allTags || []);
        setAllTagNames((allTags || []).map(tag => tag.name));

        // Fetch all available technologies
        const { data: allTechnologies, error: techError } = await supabase
          .from('technologies')
          .select('id, name')
          .order('name');
        if (techError) throw techError;
        setAllTechnologyObjects(allTechnologies || []);
        setAllTechnologyNames((allTechnologies || []).map(tech => tech.name));

        // Fetch user tag preferences
        const { data: tagPrefs, error: tagPrefsError } = await supabase
          .from('user_tag_preferences')
          .select('tag_id, tags(name)')
          .eq('user_id', user.id);
        if (tagPrefsError) throw tagPrefsError;

        setPreferredTagNames(
          (tagPrefs || [])
            .map(pref => {
              if (Array.isArray(pref.tags)) {
                return pref.tags[0]?.name;
              } else {
                return (pref.tags as { name: string })?.name;
              }
            })
            .filter(Boolean)
        );

        // Fetch user technology preferences
        const { data: techPrefs, error: techPrefsError } = await supabase
          .from('user_technology_preferences')
          .select('technology_id, technologies(name)')
          .eq('user_id', user.id);
        if (techPrefsError) throw techPrefsError;

        setPreferredTechnologyNames(
          (techPrefs || [])
            .map(pref => {
              if (Array.isArray(pref.technologies)) {
                return pref.technologies[0]?.name;
              } else {
                return (pref.technologies as { name: string })?.name;
              }
            })
            .filter(Boolean)
        );

        // Fetch user email preferences
        const { data: emailPrefs, error: emailPrefsError } = await supabase
          .from('user_email_preferences')
          .select('email_frequency')
          .eq('user_id', user.id)
          .single();
        if (emailPrefsError && emailPrefsError.code !== 'PGRST116') throw emailPrefsError;
        setEmailFrequency(emailPrefs?.email_frequency || 'never');

        setLoading(false);
      } catch (err) {
        console.error("Error fetching user preferences:", err);
        setError("Failed to load preferences");
        setLoading(false);
      }
    }

    fetchUserData();
  }, []);

  // Update tag preferences in DB
  const handleTagsChange = async (names: string[]) => {
    setPreferredTagNames(names);
    if (!userId) return;
    try {
      // Get tag IDs for selected names
      const selectedTagIds = allTagObjects
        .filter(tag => names.includes(tag.name))
        .map(tag => tag.id);

      // Remove all old preferences
      await supabase
        .from('user_tag_preferences')
        .delete()
        .eq('user_id', userId);

      // Insert new preferences
      if (selectedTagIds.length > 0) {
        const inserts = selectedTagIds.map(tag_id => ({
          user_id: userId,
          tag_id,
        }));
        await supabase.from('user_tag_preferences').insert(inserts);
      }
    } catch (err) {
      setError("Failed to update tag preferences");
    }
  };

  // Update technology preferences in DB
  const handleTechnologiesChange = async (names: string[]) => {
    setPreferredTechnologyNames(names);
    if (!userId) return;
    try {
      setUpdatingTechnologies(true);
      
      // Get technology IDs for selected names
      const selectedTechnologyIds = allTechnologyObjects
        .filter(tech => names.includes(tech.name))
        .map(tech => tech.id);

      // Remove all old preferences
      await supabase
        .from('user_technology_preferences')
        .delete()
        .eq('user_id', userId);

      // Insert new preferences
      if (selectedTechnologyIds.length > 0) {
        const inserts = selectedTechnologyIds.map(technology_id => ({
          user_id: userId,
          technology_id,
        }));
        await supabase.from('user_technology_preferences').insert(inserts);
      }
      
      setUpdatingTechnologies(false);
    } catch (err) {
      setError("Failed to update technology preferences");
      setUpdatingTechnologies(false);
    }
  };

  // Update email frequency in DB
  const handleEmailFrequencyChange = async (value: string) => {
    setEmailFrequency(value);
    if (!userId) return;
    try {
      // Upsert (insert or update) the preference
      await supabase
        .from('user_email_preferences')
        .upsert(
          [{ user_id: userId, email_frequency: value }],
        );
    } catch (err) {
      setError("Failed to update email preferences");
    }
  };

  // Update display name in DB
  const handleUpdateDisplayName = async () => {
    if (!userId || !displayName.trim()) return;
    
    setDisplayNameError(null);
    setUpdatingDisplayName(true);
    
    try {
      // Validate display name
      if (displayName.length > 16) {
        setDisplayNameError("Display name cannot exceed 16 characters");
        setUpdatingDisplayName(false);
        return;
      }
      
      // Check for existing display name
      const { data: existingNames, error: nameCheckError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('display_name', displayName.trim())
        .neq('user_id', userId);
        
      if (nameCheckError) throw nameCheckError;
      
      if (existingNames && existingNames.length > 0) {
        setDisplayNameError("This display name is already taken");
        setUpdatingDisplayName(false);
        return;
      }
      
      // Update the display name
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('user_id', userId);
        
      if (updateError) throw updateError;
      
      setUpdatingDisplayName(false);
    } catch (err) {
      console.error("Error updating display name:", err);
      setDisplayNameError("Failed to update display name");
      setUpdatingDisplayName(false);
    }
  };

  // Update difficulty preferences in DB
  const handleUpdateDifficulty = async () => {
    if (!userId) return;
    
    setUpdatingDifficulty(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ difficulty_level: selectedDifficulties })
        .eq('user_id', userId);
        
      if (updateError) throw updateError;
      
      setUpdatingDifficulty(false);
    } catch (err) {
      setError("Failed to update difficulty preferences");
      setUpdatingDifficulty(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
          </div>
          <h1 className="inria-sans-bold text-xl text-off-white">Loading Your Preferences</h1>
        </div>
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
    <div className="min-h-screen w-full flex flex-col items-center bg-gradient-to-br from-[#18181b] via-[#232323] to-[#1a1a1a]">
      <div className="w-full max-w-4xl flex-1 flex flex-col justify-center px-2 py-10">
        <h1 className="text-2xl font-bold mb-6">Your Preferences</h1>

        <div className="mb-8 p-6 bg-[#232323] border border-[var(--muted-red)] rounded-xl shadow-lg w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-[var(--off-white)]">Your Display Name</h2>
            <p className="text-sm text-gray-400">How others will see you</p>
          </div>

          <div className="flex space-x-4">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={16}
              className="flex-1 p-2 border border-gray-600 bg-slate-900 rounded focus:border-blue-500 focus:outline-none"
              placeholder="Enter display name"
            />
            <button
              onClick={handleUpdateDisplayName}
              disabled={updatingDisplayName}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {updatingDisplayName ? 'Saving...' : 'Update'}
            </button>
          </div>
          
          {displayNameError && (
            <div className="mt-2 text-red-500 text-sm">{displayNameError}</div>
          )}
          
          <div className="mt-3 text-sm text-gray-400">
            <p>• Display name must be unique and no more than 16 characters</p>
          </div>
        </div>

        <div className="mb-8 p-6 bg-[#232323] border border-[var(--muted-red)] rounded-xl shadow-lg w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-[var(--off-white)]">Project Difficulty Level</h2>
            <p className="text-sm text-gray-400">Select your preferred difficulty levels</p>
          </div>

          <div className="mb-4">
            <MultiDifficultySelector
              selectedDifficulties={selectedDifficulties}
              onDifficultiesChange={setSelectedDifficulties}
            />
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={handleUpdateDifficulty}
              disabled={updatingDifficulty}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {updatingDifficulty ? 'Saving...' : 'Update'}
            </button>
          </div>

          <div className="mt-3 text-sm text-gray-400">
            <p>• Select the difficulty levels of projects you want to see</p>
            <p>• Multiple levels can be selected</p>
          </div>
        </div>

        <div className="mb-8 p-6 bg-[#232323] border border-[var(--muted-red)] rounded-xl shadow-lg w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-[var(--off-white)]">Your Preferred Tags</h2>
            <p className="text-sm text-gray-400">Select the tags you&apos;re interested in</p>
          </div>

          <MultiSelector
            availableTags={allTagNames}
            onTagsChange={handleTagsChange}
            initialTags={preferredTagNames}
          />

          <div className="mt-3 text-sm text-gray-400">
            <p>• Select tags to customize your project recommendations</p>
            <p>• These tags are derived from projects you&apos;ve interacted with</p>
          </div>
        </div>
        
        <div className="mb-8 p-6 bg-[#232323] border border-[var(--muted-red)] rounded-xl shadow-lg w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-[var(--off-white)]">Your Technologies</h2>
            <p className="text-sm text-gray-400">Select technologies you know or want to work with</p>
          </div>

          <MultiSelector
            availableTags={allTechnologyNames}
            onTagsChange={handleTechnologiesChange}
            initialTags={preferredTechnologyNames}
          />
          
          {updatingTechnologies && (
            <div className="mt-2 text-blue-400 text-sm">Saving your technology preferences...</div>
          )}

          <div className="mt-3 text-sm text-gray-400">
            <p>• Select technologies like languages, frameworks, or tools</p>
            <p>• This helps match you with relevant projects</p>
          </div>
        </div>

        <div className="mb-8 p-6 bg-[#232323] border border-[var(--muted-red)] rounded-xl shadow-lg w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-[var(--off-white)]">Email Notifications</h2>
            <p className="text-sm text-gray-400">How often would you like to receive emails?</p>
          </div>

          <div className="flex flex-col space-y-3">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="emailFrequency"
                value="never"
                checked={emailFrequency === 'never'}
                onChange={(e) => handleEmailFrequencyChange(e.target.value)}
                className="form-radio h-5 w-5 text-[var(--title-red)] focus:ring-[var(--title-red)]"
              />
              <span className="ml-2 text-[var(--off-white)]">Never</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="emailFrequency"
                value="daily"
                checked={emailFrequency === 'daily'}
                onChange={(e) => handleEmailFrequencyChange(e.target.value)}
                className="form-radio h-5 w-5 text-[var(--title-red)] focus:ring-[var(--title-red)]"
              />
              <span className="ml-2 text-[var(--off-white)]">Daily</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="emailFrequency"
                value="weekly"
                checked={emailFrequency === 'weekly'}
                onChange={(e) => handleEmailFrequencyChange(e.target.value)}
                className="form-radio h-5 w-5 text-[var(--title-red)] focus:ring-[var(--title-red)]"
              />
              <span className="ml-2 text-[var(--off-white)]">Weekly</span>
            </label>
          </div>

          <div className="mt-3 text-sm text-gray-400">
            <p>• Select how frequently you want to receive recommendation emails</p>
            <p>• Choose &quot;Never&quot; to opt out of all notification emails</p>
          </div>
        </div>
      </div>
    </div>
  );
}