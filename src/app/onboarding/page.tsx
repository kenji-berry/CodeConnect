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

interface UserTagPreference {
  tags: {
    id: string;
    name: string;
  }[];
}

interface UserTechnologyPreference {
  technologies: {
    id: string;
    name: string;
  }[];
}

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

  const [allTechnologyObjects, setAllTechnologyObjects] = useState<{ id: string; name: string }[]>([]);
  const [allTechnologyNames, setAllTechnologyNames] = useState<string[]>([]);
  const [selectedTechnologyNames, setSelectedTechnologyNames] = useState<string[]>([]);
  const [selectedTechnologyObjects, setSelectedTechnologyObjects] = useState<{ id: string; name: string }[]>([]);
  const [savingTechnologies, setSavingTechnologies] = useState(false);

  const [selectedDifficulties, setSelectedDifficulties] = useState<number[]>([]);
  const [savingDifficulty, setSavingDifficulty] = useState(false);
  const [emailFrequency, setEmailFrequency] = useState<string>('never');
  const [savingEmailFrequency, setSavingEmailFrequency] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const urlStep = searchParams ? Number(searchParams.get('step')) : null;
    if (urlStep && [1, 2, 3, 4, 5].includes(urlStep)) {
      setCurrentStep(urlStep);
    } else if (urlStep && urlStep >= 6) {
      setSetupComplete(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const checkUserProfile = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session || !session.user) {
        router.replace('/');
        return;
      }

      const userId = session.user.id;
      setUserId(userId);

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, is_changed, onboarding_step, display_name, difficulty')
        .eq('user_id', userId)
        .maybeSingle();

      const { data: userTags } = await supabase
        .from('user_tag_preferences')
        .select('tags(id, name)')
        .eq('user_id', userId);

      const { data: userTechnologies } = await supabase
        .from('user_technology_preferences')
        .select('technologies(id, name)')
        .eq('user_id', userId);

      const { data: emailPrefs } = await supabase
        .from('user_email_preferences')
        .select('email_frequency')
        .eq('user_id', userId)
        .maybeSingle();

      if (profile && profile.onboarding_step >= 6) {
        setSetupComplete(true);
        setLoading(false);
        return;
      }

      const profileStep = profile?.onboarding_step;
      const urlStep = searchParams ? Number(searchParams.get('step')) : null;
      const effectiveStep = urlStep && [1, 2, 3, 4, 5].includes(urlStep) ? urlStep : (profileStep && profileStep < 6 ? profileStep : 1);

      setCurrentStep(effectiveStep);

      if (profile) {
        if (profile.display_name) setDisplayName(profile.display_name);
        if (profile.difficulty) setSelectedDifficulties(profile.difficulty);
      }
      if (userTags) {
        const tagNames = userTags.flatMap((ut: UserTagPreference) => ut.tags.map(tag => tag.name));
        setSelectedTagNames(tagNames);
        setSelectedTagObjects(userTags.flatMap((ut: UserTagPreference) => ut.tags.map(tag => ({ id: tag.id, name: tag.name }))));
      }
      if (userTechnologies) {
        const techNames = userTechnologies.flatMap((ut: { technologies: { id: string; name: string }[] }) => ut.technologies.map(tech => tech.name));
        setSelectedTechnologyNames(techNames);
        setSelectedTechnologyObjects(userTechnologies.flatMap((ut: UserTechnologyPreference) => ut.technologies.map((tech: { id: string; name: string }) => ({ id: tech.id, name: tech.name }))));
      }
      if (emailPrefs) {
        setEmailFrequency(emailPrefs.email_frequency || 'never');
      }

      await fetchAllTags();
      await fetchAllTechnologies();
      setLoading(false);
    };

    checkUserProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

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

      setAllTechnologyObjects(data || []);
      setAllTechnologyNames((data || []).map(tech => tech.name));
    } catch (error) {
      console.error("Error fetching all technologies:", error);
      setAllTechnologyObjects([]);
      setAllTechnologyNames([]);
    }
  }

  const updateStep = async (step: number, redirect: boolean = true) => {
    if (!userId) return;
    await supabase
      .from('profiles')
      .update({ onboarding_step: step })
      .eq('user_id', userId);

    setCurrentStep(step);

    if (redirect) {
      const currentPath = window.location.pathname;
      const newUrl = `${currentPath}?step=${step}`;
      router.push(newUrl, { scroll: false });
    }
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
        .eq('display_name', displayName.trim())
        .neq('user_id', userId); // Ensure we don't block the user's own current name if unchanged

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
      return obj ? { id: obj.id, name: name } : { id: '', name: name };
    }).filter(obj => obj.id);
    setSelectedTagObjects(objects);
  };

  const handleTechnologiesChange = (names: string[]) => {
    setSelectedTechnologyNames(names);
    const objects = names.map(name => {
      const obj = allTechnologyObjects.find(t => t.name === name);
      return obj ? { id: obj.id, name: name } : { id: '', name: name };
    }).filter(obj => obj.id);
    setSelectedTechnologyObjects(objects);
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
        .filter(id => id && id !== '');

      if (tagIds.length !== selectedTagObjects.length) {
          console.error("Mismatch in selected tag objects and valid IDs:", selectedTagObjects, tagIds);
          setError('Error processing selected tags. Please try again.');
          setSavingTags(false);
          return;
      }

      const { error: deleteError } = await supabase
        .from('user_tag_preferences')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error("Error deleting old tag preferences:", deleteError);
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
          console.error("Error inserting new tag preferences:", insertError);
          throw insertError;
        }
      }

      await updateStep(4);
      setSavingTags(false);
    } catch (e) {
      console.error("Error saving tag preferences:", e);
      const errorMessage = (e instanceof Error && e.message) ? e.message : 'Unknown error';
      setError(`Failed to save your tag preferences: ${errorMessage}`);
      setSavingTags(false);
    }
  };

  const saveTechnologyPreferences = async () => {
    if (!userId) return;

    try {
      setSavingTechnologies(true);
      setError('');

      if (selectedTechnologyObjects.length === 0) {
        setError('Please select at least one technology');
        setSavingTechnologies(false);
        return;
      }

      const technologyIds = selectedTechnologyObjects
        .map(tech => tech.id)
        .filter(id => id && id !== '');

      if (technologyIds.length !== selectedTechnologyObjects.length) {
          console.error("Mismatch in selected technology objects and valid IDs:", selectedTechnologyObjects, technologyIds);
          setError('Error processing selected technologies. Please try again.');
          setSavingTechnologies(false);
          return;
      }

      const { error: deleteError } = await supabase
        .from('user_technology_preferences')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error("Error deleting old technology preferences:", deleteError);
        throw deleteError;
      }

      if (technologyIds.length > 0) {
        const preferencesArray = technologyIds.map(techId => ({
          user_id: userId,
          technology_id: techId,
          created_at: new Date().toISOString()
        }));

        const { error: insertError } = await supabase
          .from('user_technology_preferences')
          .insert(preferencesArray);

        if (insertError) {
          console.error("Error inserting new technology preferences:", insertError);
          throw insertError;
        }
      }

      await updateStep(5);
      setSavingTechnologies(false);
    } catch (e) {
      console.error("Error saving technology preferences:", e);
      const errorMessage = (e instanceof Error && e.message) ? e.message : 'Unknown error';
      setError(`Failed to save your technology preferences: ${errorMessage}`);
      setSavingTechnologies(false);
    }
  };

  const saveEmailPreferences = async () => {
    if (!userId) return;
    setSavingEmailFrequency(true);
    setError('');
    try {
      const { error: emailError } = await supabase
        .from('user_email_preferences')
        .upsert({ user_id: userId, email_frequency: emailFrequency });

      if (emailError) {
        throw emailError;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_step: 6, is_changed: true })
        .eq('user_id', userId);

      if (profileError) {
        throw profileError;
      }

      setSetupComplete(true);
      setCurrentStep(6);
      setSavingEmailFrequency(false);
    } catch (e) {
      console.error("Error saving email preferences:", e);
      const errorMessage = (e instanceof Error && e.message) ? e.message : 'Unknown error';
      setError(`Failed to save email preferences: ${errorMessage}`);
      setSavingEmailFrequency(false);
    }
  };

  if (loading) {
    return <LoadingFallback />;
  }

  if (setupComplete) {
    return (
      <div className="w-screen min-h-screen flex items-center justify-center">
        <div className="max-w-[500px] w-full mx-4 radial-background rounded-lg shadow-lg p-8">
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
              onClick={() => router.replace('/')}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen min-h-screen flex items-center justify-center">
      <div className="max-w-[500px] w-full mx-4 radial-background rounded-lg shadow-lg p-8">
        <div className="flex mb-6 items-center justify-center">
          {[1, 2, 3, 4, 5].map((step) => (
            <React.Fragment key={step}>
              <div className={`rounded-full w-8 h-8 flex items-center justify-center transition-colors duration-300
                ${currentStep === step ? 'bg-blue-600 text-white' : (currentStep > step ? 'bg-green-600 text-white' : 'bg-blue-900 text-blue-300')}`}>
                {currentStep > step ? '✓' : step}
              </div>
              {step < 5 && <div className={`h-1 w-8 mx-2 transition-colors duration-300 ${currentStep > step ? 'bg-green-600' : 'bg-gray-700'}`}></div>}
            </React.Fragment>
          ))}
        </div>

        {currentStep === 1 && (
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
        )}

        {currentStep === 2 && (
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
                onClick={() => updateStep(1)}
                className="px-4 py-2 text-gray-400 rounded hover:bg-gray-800"
              >
                Back
              </button>
              <button
                onClick={saveDifficulty}
                disabled={savingDifficulty || selectedDifficulties.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {savingDifficulty ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </>
        )}

        {currentStep === 3 && (
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
                onClick={() => updateStep(2)}
                className="px-4 py-2 text-gray-400 rounded hover:bg-gray-800"
              >
                Back
              </button>
              <button
                onClick={saveTagPreferences}
                disabled={savingTags || selectedTagObjects.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {savingTags ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </>
        )}

        {currentStep === 4 && (
          <>
            <h1 className="text-2xl inter-bold main-subtitle mb-4">Select Your Technologies</h1>
            <p className="mb-6">Choose technologies you know or want to work with.</p>

            <div className="mb-6">
              <div className="main-page-filter-box px-2 py-4 rounded">
                <MultiSelector
                  availableTags={allTechnologyNames}
                  onTagsChange={handleTechnologiesChange}
                  initialTags={selectedTechnologyNames}
                />
              </div>

              <div className="mt-3 text-sm text-gray-400">
                <p>• Select technologies like languages, frameworks, or tools.</p>
                <p>• This helps match you with relevant projects.</p>
              </div>
            </div>

            {error && <p className="text-red-500 mb-4">{error}</p>}

            <div className="flex justify-between">
              <button
                onClick={() => updateStep(3)}
                className="px-4 py-2 text-gray-400 rounded hover:bg-gray-800"
              >
                Back
              </button>
              <button
                onClick={saveTechnologyPreferences}
                disabled={savingTechnologies || selectedTechnologyObjects.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {savingTechnologies ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </>
        )}

        {currentStep === 5 && (
          <>
            <h1 className="text-2xl inter-bold main-subtitle mb-4">Email Notifications</h1>
            <p className="mb-6">How often would you like to receive project recommendation emails?</p>

            <div className="flex flex-col space-y-3 mb-6">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="emailFrequency"
                  value="never"
                  checked={emailFrequency === 'never'}
                  onChange={(e) => setEmailFrequency(e.target.value)}
                  className="form-radio h-5 w-5 text-[var(--title-red)] focus:ring-[var(--title-red)] bg-gray-700 border-gray-600"
                />
                <span className="ml-3 text-[var(--off-white)]">Never</span>
              </label>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="emailFrequency"
                  value="daily"
                  checked={emailFrequency === 'daily'}
                  onChange={(e) => setEmailFrequency(e.target.value)}
                  className="form-radio h-5 w-5 text-[var(--title-red)] focus:ring-[var(--title-red)] bg-gray-700 border-gray-600"
                />
                <span className="ml-3 text-[var(--off-white)]">Daily</span>
              </label>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="emailFrequency"
                  value="weekly"
                  checked={emailFrequency === 'weekly'}
                  onChange={(e) => setEmailFrequency(e.target.value)}
                  className="form-radio h-5 w-5 text-[var(--title-red)] focus:ring-[var(--title-red)] bg-gray-700 border-gray-600"
                />
                <span className="ml-3 text-[var(--off-white)]">Weekly</span>
              </label>
            </div>

            <div className="mt-3 text-sm text-gray-400 mb-6">
              <p>• Choose &quot;Never&quot; to opt out of all notification emails.</p>
            </div>

            {error && <p className="text-red-500 mb-4">{error}</p>}

            <div className="flex justify-between">
              <button
                onClick={() => updateStep(4)}
                className="px-4 py-2 text-gray-400 rounded hover:bg-gray-800"
              >
                Back
              </button>
              <button
                onClick={saveEmailPreferences}
                disabled={savingEmailFrequency}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {savingEmailFrequency ? 'Saving...' : 'Finish Setup'}
              </button>
            </div>
          </>
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