"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import Link from 'next/link';
import MultiSelector from '../Components/MultiSelector';
import { User } from '@supabase/supabase-js';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [preferredTagNames, setPreferredTagNames] = useState<string[]>([]);
  const [allTagNames, setAllTagNames] = useState<string[]>([]);
  const [allTagObjects, setAllTagObjects] = useState<{ id: string; name: string }[]>([]);
  const [emailFrequency, setEmailFrequency] = useState<string>('never');
  const [error, setError] = useState<string | null>(null);

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

        // Fetch all available tags for the selector
        await fetchAllTags();

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

  const handleTagsChange = (names: string[]) => {
    setPreferredTagNames(names);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full radial-background">
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
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Your Preferences</h1>

      <div className="mb-8 p-6 bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Your Preferred Tags</h2>
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
          <p>• Choose &quot;Never&quot; to opt out of all notification emails</p>
        </div>
      </div>
    </div>
  );
}