"use client";

import React from 'react';
import { supabase } from '@/supabaseClient';

const LoginButton = () => {
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        scopes: 'repo'
      }
    });

    const { data: session } = await supabase.auth.getSession();

    if (error) {
      console.error('Error logging in with GitHub:', error.message);
      return;
    }

    if (session?.provider_token) {
      try {
        const repoResponse = await fetch('https://api.github.com/user/repos', {
          headers: {
            'Authorization': `Bearer ${session.provider_token}`
          }
        });
        const repos = await repoResponse.json();
        console.log('GitHub Repositories:', repos);
      } catch (error) {
        console.error('Error fetching GitHub repositories:', error);
      }
    }
  };

  return (
    <button 
      onClick={handleLogin}
      className="bg-[--muted-red] hover:bg-red-700 px-3 py-2 rounded-full transition-colors duration-200 inria-sans-bold text-off-white text-sm"
    >
      Log in with GitHub
    </button>
  );
};

export default LoginButton;