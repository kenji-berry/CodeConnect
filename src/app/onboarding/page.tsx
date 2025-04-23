"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { supabase } from '../../supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import MultiSelector from '../Components/MultiSelector';
import MultiDifficultySelector from '../Components/MultiDifficultySelector';

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mb-4"></div>
    <p className="text-[--off-white]">Loading Onboarding</p>
  </div>
);

function OnboardingClient() {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [setupComplete, setSetupComplete] = useState(false);

  const [allTagObjects, setAllTagObjects] = useState<{ id: string; name: string }[]>([]);
  const [allTagNames, setAllTagNames] = useState<string[]>([]);
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [selectedTagObjects, setSelectedTagObjects] = useState<{ id: string; name: string }[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  const [selectedDifficulties, setSelectedDifficulties] = useState<number[]>([]);
  const [savingDifficulty, setSavingDifficulty] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const urlStep = searchParams ? Number(searchParams.get('step')) : null;
    if (urlStep && [1, 2, 3].includes(urlStep)) {
      setCurrentStep(urlStep);
    }
  }, [searchParams]);

  useEffect(() => {
    const checkUserProfile = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session || !session.user) {
        router.push('/');
        return;
      }

      const userId = session.user.id;
      setUserId(userId);

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, is_changed, onboarding_step, display_name, difficulty')
        .eq('user_id', userId)
        .maybeSingle();

      if (profile && profile.is_changed === true) {
        router.push('/');
        return;
      }

      if (profile && profile.onboarding_step && searchParams && !searchParams.get('step')) {
        setCurrentStep(profile.onboarding_step);
        if (profile.display_name) setDisplayName(profile.display_name);
        if (profile.difficulty) setSelectedDifficulties(profile.difficulty);
      } else if (profile && profile.onboarding_step && !searchParams) {
         setCurrentStep(profile.onboarding_step);
         if (profile.display_name) setDisplayName(profile.display_name);
         if (profile.difficulty) setSelectedDifficulties(profile.difficulty);
      }


      await fetchAllTags();
      setLoading(false);
    };

    checkUserProfile();
  }, [router, searchParams]);

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

  const updateStep = async (step: number) => {
    if (!userId) return;
    await supabase
      .from('profiles')
      .update({ onboarding_step: step })
      .eq('user_id', userId);
  };

  const validateAndSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
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

      const { data: existingNames, error: nameCheckError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('display_name', displayName.trim());

      if (nameCheckError) {
        setError('Error checking if display name exists. Please try again.');
        setIsSubmitting(false);
        return;
      }

      if (existingNames && existingNames.length > 0) {
        setError('This display name is already taken');
        setIsSubmitting(false);
        return;
      }

      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileCheckError) {
        setError('Error checking existing profile');
        setIsSubmitting(false);
        return;
      }

      let saveResult;

      if (existingProfile) {
        saveResult = await supabase
          .from('profiles')
          .update({
            display_name: displayName.trim()
          })
          .eq('user_id', userId);
      } else {
        saveResult = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            display_name: displayName.trim(),
            onboarding_step: 1,
            created_at: new Date().toISOString()
          });
      }

      if (saveResult.error) {
        setError('Failed to save display name: ' + (saveResult.error.message || 'Unknown error'));
        setIsSubmitting(false);
        return;
      }

      await updateStep(2);
      setCurrentStep(2);
      setIsSubmitting(false);
    } catch (e) {
      setError('An unexpected error occurred');
      setIsSubmitting(false);
    }
  };

  const handleTagsChange = (names: string[]) => {
    setSelectedTagNames(names);
    const objects = names.map(name => {
      const obj = allTagObjects.find(t => t.name === name);
      return obj || { id: '', name };
    });
    setSelectedTagObjects(objects);
  };

  const saveDifficulty = async () => {
    if (!userId) return;
    setSavingDifficulty(true);
    setError('');
    try {
      if (selectedDifficulties.length === 0) {
        setError('Please select at least one difficulty level');
        setSavingDifficulty(false);
        return;
      }
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ difficulty_level: selectedDifficulties })
        .eq('user_id', userId);

      if (updateError) {
        setError('Failed to save difficulty selection');
        setSavingDifficulty(false);
        return;
      }
      await updateStep(3);
      setCurrentStep(3);
      setSavingDifficulty(false);
    } catch (e) {
      setError('Failed to save difficulty selection');
      setSavingDifficulty(false);
    }
  };

  const saveTagPreferences = async () => {
    if (!userId) return;

    try {
      setSavingTags(true);
      setError('');

      if (selectedTagObjects.length === 0) {
        setError('Please select at least one tag');
        setSavingTags(false);
        return;
      }

      const tagIds = selectedTagObjects
        .map(tag => tag.id)
        .filter(Boolean);

      const { error: deleteError } = await supabase
        .from('user_tag_preferences')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        throw deleteError;
      }

      if (tagIds.length > 0) {
        const preferencesArray = tagIds.map(tagId => ({
          user_id: userId,
          tag_id: tagId,
          created_at: new Date().toISOString()
        }));

        const { error: insertError } = await supabase
          .from('user_tag_preferences')
          .insert(preferencesArray);

        if (insertError) {
          throw insertError;
        }
      }

      await supabase
        .from('profiles')
        .update({ is_changed: true, onboarding_step: 4 })
        .eq('user_id', userId);

      setSetupComplete(true);
      setCurrentStep(4);
      setSavingTags(false);
    } catch (e) {
      console.error("Error saving tag preferences:", e);
      const errorMessage = (e instanceof Error && e.message) ? e.message : 'Unknown error';
      setError(`Failed to save your tag preferences: ${errorMessage}`);
      setSavingTags(false);
    }
  };

  if (loading) {
    return <LoadingFallback />;
  }

  return (
    <div className="w-screen min-h-screen flex items-center justify-center">
      <div className="max-w-[500px] w-full mx-4 radial-background rounded-lg shadow-lg p-8">
        <div className="flex mb-6 items-center">
          {[1, 2, 3].map((step) => (
            <React.Fragment key={step}>
              <div className={`rounded-full w-8 h-8 flex items-center justify-center
                ${currentStep === step ? 'bg-blue-600 text-white' : 'bg-blue-900 text-blue-300'}`}>
                {step}
              </div>
              {step < 3 && <div className="h-1 w-8 mx-2 bg-gray-700"></div>}
            </React.Fragment>
          ))}
          {currentStep === 4 && (
            <>
              <div className="h-1 w-8 mx-2 bg-gray-700"></div>
              <div className="rounded-full w-8 h-8 flex items-center justify-center bg-green-600 text-white">
                ✓
              </div>
            </>
          )}
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
        ) : currentStep === 2 ? (
          <>
            <h1 className="text-2xl inter-bold main-subtitle mb-4">Select Your Preferred Difficulty</h1>
            <p className="mb-6">Choose one or more difficulty levels for projects you want to see.</p>
            <div className="mb-6">
              <MultiDifficultySelector
                selectedDifficulties={selectedDifficulties}
                onDifficultiesChange={setSelectedDifficulties}
              />
            </div>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <div className="flex justify-between">
              <button
                onClick={async () => {
                  await updateStep(1);
                  setCurrentStep(1);
                }}
                className="px-4 py-2 text-gray-400 rounded hover:bg-gray-800"
              >
                Back
              </button>
              <button
                onClick={saveDifficulty}
                disabled={savingDifficulty}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {savingDifficulty ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </>
        ) : currentStep === 3 ? (
          <>
            <h1 className="text-2xl inter-bold main-subtitle mb-4">Select Your Interests</h1>
            <p className="mb-6">Choose topics you&apos;re interested in to help us personalize your recommendations.</p>

            <div className="mb-6">
              <div className="main-page-filter-box px-2 py-4 rounded">
                <MultiSelector
                  availableTags={allTagNames}
                  onTagsChange={handleTagsChange}
                  initialTags={selectedTagNames}
                />
              </div>

              <div className="mt-3 text-sm text-gray-400">
                <p>• Select tags that represent technologies or topics you&apos;re interested in</p>
                <p>• You can always change these later in your settings</p>
              </div>
            </div>

            {error && <p className="text-red-500 mb-4">{error}</p>}

            <div className="flex justify-between">
              <button
                onClick={async () => {
                  await updateStep(2);
                  setCurrentStep(2);
                }}
                className="px-4 py-2 text-gray-400 rounded hover:bg-gray-800"
              >
                Back
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
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-4">
              <svg className="h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-green-500 mb-2">Setup Complete!</h1>
            <p className="text-[--off-white] mb-6 text-center">
              Your profile is ready and personalized. You can now explore projects tailored to your interests.
            </p>
            <button
              className="px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition"
              onClick={() => router.push('/')}
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OnboardingClient />
    </Suspense>
  );
}