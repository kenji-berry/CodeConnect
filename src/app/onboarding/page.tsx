"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useRouter } from 'next/navigation';
import MultiSelector from '../Components/MultiSelector';

export default function OnboardingPage() {
  // Display name states
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Onboarding step
  const [currentStep, setCurrentStep] = useState(1);
  
  // Tag selection states
  const [allTagObjects, setAllTagObjects] = useState<{ id: any; name: any }[]>([]);
  const [allTagNames, setAllTagNames] = useState<string[]>([]);
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [selectedTagObjects, setSelectedTagObjects] = useState<{ id: any; name: any }[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const checkUserProfile = async () => {
      setLoading(true);
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || !session.user) {
        // No session, redirect to home
        router.push('/');
        return;
      }
      
      const userId = session.user.id;
      setUserId(userId);
      
      // Check if user has already completed profile setup
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, is_changed')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (data && data.is_changed === true) {
        // Profile already set up, redirect to home/dashboard
        router.push('/');
        return;
      }

      // Fetch all available tags for selection
      await fetchAllTags();
      
      setLoading(false);
    };
    
    checkUserProfile();
  }, [router]);

  // Fetch all available tags from database
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

  const validateAndSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Validation checks
      if (!displayName.trim()) {
        setError('Display name cannot be empty');
        setIsSubmitting(false);
        return;
      }
      
      if (displayName.length > 16) {
        setError('Display name cannot exceed 16 characters');
        setIsSubmitting(false);
        return;
      }
  
      // Check if name already exists
      const { data: existingNames, error: nameCheckError } = await supabase
        .from('profiles')
        .select('user_id') 
        .eq('display_name', displayName.trim());
      
      if (nameCheckError) {
        console.error('Error checking display name:', nameCheckError);
        setError('Error checking if display name exists. Please try again.');
        setIsSubmitting(false);
        return;
      }
        
      if (existingNames && existingNames.length > 0) {
        setError('This display name is already taken');
        setIsSubmitting(false);
        return;
      }
      
      // Check if profile already exists
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('user_id')  
        .eq('user_id', userId)  
        .maybeSingle();
      
      if (profileCheckError) {
        console.error('Error checking profile:', profileCheckError);
        setError('Error checking existing profile');
        setIsSubmitting(false);
        return;
      }
      
      let saveResult;
      
      if (existingProfile) {
        // Update existing profile
        saveResult = await supabase
          .from('profiles')
          .update({ 
            display_name: displayName.trim(),
            is_changed: true
          })
          .eq('user_id', userId);  
      } else {
        // Insert new profile
        saveResult = await supabase
          .from('profiles')
          .insert({ 
            user_id: userId,
            display_name: displayName.trim(),
            created_at: new Date().toISOString(),
            is_changed: true
          });
      }
      
      if (saveResult.error) {
        console.error('Error saving display name:', saveResult.error);
        setError('Failed to save display name: ' + (saveResult.error.message || 'Unknown error'));
        setIsSubmitting(false);
        return;
      }
      
      // Move to next step (tag selection)
      setCurrentStep(2);
      setIsSubmitting(false);
    } catch (e) {
      console.error('Exception during save:', e);
      setError('An unexpected error occurred');
      setIsSubmitting(false);
    }
  };

  const handleTagsChange = (names: string[]) => {
    setSelectedTagNames(names);
    // Map names back to objects
    const objects = names.map(name => {
      const obj = allTagObjects.find(t => t.name === name);
      return obj || { name };
    });
    setSelectedTagObjects(objects);
  };

  const saveTagPreferences = async () => {
    if (!userId) return;
    
    try {
      setSavingTags(true);
      
      // Get the tag IDs from the selected objects
      const tagIds = selectedTagObjects
        .map(tag => tag.id)
        .filter(Boolean);
      
      // Log what we're about to save
      console.log("Selected tag IDs:", tagIds);
      
      // First, delete any existing tag preferences for this user
      const { error: deleteError } = await supabase
        .from('user_tag_preferences')
        .delete()
        .eq('user_id', userId);
        
      if (deleteError) {
        console.error("Error deleting existing preferences:", deleteError);
        throw deleteError;
      }
      
      // If there are tags selected, insert them
      if (tagIds.length > 0) {
        // Create an array of objects for batch insert
        const preferencesArray = tagIds.map(tagId => ({
          user_id: userId,
          tag_id: tagId,
          created_at: new Date().toISOString()
        }));
        
        console.log("Inserting preferences:", preferencesArray);
        
        // Insert all the preferences at once
        const { error: insertError } = await supabase
          .from('user_tag_preferences')
          .insert(preferencesArray);
          
        if (insertError) {
          console.error("Error inserting preferences:", insertError);
          throw insertError;
        }
      }
      
      // Redirect to home/dashboard
      router.push('/');
    } catch (e) {
      console.error('Error saving tag preferences:', e);
      setError('Failed to save your tag preferences');
      setSavingTags(false);
    }
  };

  // Skip tag selection but still proceed to home
  const skipTagSelection = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="w-screen min-h-screen flex items-center justify-center bg-gray-900">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="w-screen min-h-screen flex items-center justify-center radial-background">
      <div className="max-w-[500px] w-full mx-4 radial-background rounded-lg shadow-lg p-8">
        {/* Progress indicator */}
        <div className="flex mb-6 items-center">
          <div className={`rounded-full w-8 h-8 flex items-center justify-center 
                     ${currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-blue-900 text-blue-300'}`}>
            1
          </div>
          <div className="h-1 w-8 mx-2 bg-gray-700"></div>
          <div className={`rounded-full w-8 h-8 flex items-center justify-center 
                     ${currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-blue-900 text-blue-300'}`}>
            2
          </div>
        </div>
        
        {currentStep === 1 ? (
          <>
            <h1 className="text-2xl inter-bold main-subtitle mb-4">Welcome to CodeConnect!</h1>
            <p className="mb-6">Please choose a display name to continue.</p>
            
            <form onSubmit={validateAndSaveDisplayName}>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full p-2 border border-gray-600 bg-slate-900 rounded mb-4 focus:border-blue-500 focus:outline-none"
                placeholder="Enter display name (max 16 chars)"
                maxLength={16}
                autoFocus
              />
              
              {error && <p className="text-red-500 mb-4">{error}</p>}
              
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Continue'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl inter-bold main-subtitle mb-4">Select Your Interests</h1>
            <p className="mb-6">Choose topics you're interested in to help us personalize your recommendations.</p>
            
            <div className="mb-6">
              <div className="main-page-filter-box px-2 py-4 rounded">
                <MultiSelector
                  availableTags={allTagNames}
                  onTagsChange={handleTagsChange}
                  initialTags={selectedTagNames}
                />
              </div>
              
              <div className="mt-3 text-sm text-gray-400">
                <p>• Select tags that represent technologies or topics you're interested in</p>
                <p>• You can always change these later in your settings</p>
              </div>
            </div>
            
            {error && <p className="text-red-500 mb-4">{error}</p>}
            
            <div className="flex justify-between">
              <button
                onClick={skipTagSelection}
                className="px-4 py-2 text-gray-400 rounded hover:bg-gray-800"
              >
                Skip for now
              </button>
              <button
                onClick={saveTagPreferences}
                disabled={savingTags}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {savingTags ? 'Saving...' : 'Finish Setup'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}