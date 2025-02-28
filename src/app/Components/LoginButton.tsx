"use client";

import React from 'react';
import { supabase } from '../../supabaseClient';

const LoginButton = () => {
  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}`,
        scopes: 'repo read:user user:email',
        queryParams: {
          access_type: 'offline'
        }
      }
    });

    if (error) {
      console.error('Error logging in with GitHub:', error.message);
    }
  };

  return (
    <button 
      onClick={handleLogin}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
    >
      Log in with GitHub
    </button>
  );
};

export default LoginButton;