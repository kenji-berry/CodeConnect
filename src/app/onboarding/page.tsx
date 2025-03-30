"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
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
        .select('user_id, is_changed')  // Changed from id to user_id
        .eq('user_id', userId)  // Changed from id to user_id
        .maybeSingle();
        
      if (data && data.is_changed === true) {
        // Profile already set up, redirect to home/dashboard
        router.push('/');
        return;
      }
      
      setLoading(false);
    };
    
    checkUserProfile();
  }, [router]);

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
      
      // Redirect to home/dashboard
      router.push('/');
    } catch (e) {
      console.error('Exception during save:', e);
      setError('An unexpected error occurred');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-96 max-w-[90%]">
        <h1 className="text-2xl font-bold mb-4">Welcome to CodeConnect!</h1>
        <p className="mb-6">Please choose a display name to continue.</p>
        
        <form onSubmit={validateAndSaveDisplayName}>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded mb-4"
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
      </div>
    </div>
  );
}