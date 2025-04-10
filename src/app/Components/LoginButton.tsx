"use client";

import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';

const LoginButton = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      console.log('Starting GitHub OAuth login...');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/onboarding`,
          scopes: 'repo read:user user:email',
          queryParams: {
            access_type: 'offline'
          }
        }
      });

      if (error) {
        console.error('Error logging in with GitHub:', error.message);
      } else {
        console.log('OAuth initiated successfully, redirecting...');
      }
    } catch (err) {
      console.error('Unexpected error during login:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button 
      onClick={handleLogin}
      disabled={isLoading}
      className="bg-[--muted-red] hover:bg-red-700 px-3 py-2 rounded-full transition-colors duration-200 inria-sans-bold text-off-white text-sm disabled:opacity-50"
    >
      {isLoading ? 'Logging in...' : 'Log in'}
    </button>
  );
};

export default LoginButton;