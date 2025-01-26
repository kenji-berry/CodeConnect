"use client";

import React from 'react';
import { supabase } from '@/supabaseClient';

const LogoutButton = () => {
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error.message);
    }
  };

  return (
    <button 
      onClick={handleLogout}
      className="bg-[--muted-red] hover:bg-red-700 px-3 py-2 rounded-full transition-colors duration-200 inria-sans-bold text-off-white text-sm"
    >
      Log out
    </button>
  );
};

export default LogoutButton;