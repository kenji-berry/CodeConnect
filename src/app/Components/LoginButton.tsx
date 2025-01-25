"use client";

import React from 'react';
import { supabase } from '@/supabaseClient';

const LoginButton = () => {
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
    });
    if (error) console.error('Error logging in with GitHub:', error.message);
  };

  return (
    <button 
      onClick={handleLogin}
      className="bg-[--muted-red] hover: px-3 py-2 rounded-full transition-colors duration-200 inria-sans-bold text-off-white text-sm"
    >
      Log in with GitHub
    </button>
  );
};

export default LoginButton;