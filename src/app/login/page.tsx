"use client";

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginButton from '../Components/LoginButton';

export default function AuthRequiredPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnPath = searchParams?.get('returnTo') || '/';
  
  // Store return path for after login
  useEffect(() => {
    localStorage.setItem('redirectAfterLogin', returnPath);
  }, [returnPath]);

  return (
    <div className="w-screen min-h-screen flex items-center justify-center radial-background">
      <div className="max-w-md w-full mx-4 radial-background rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-2xl inter-bold main-subtitle mb-4">Authentication Required</h1>
        <p className="mb-8">
          You need to be logged in to access this page. 
          Please login with your GitHub account to continue.
        </p>
        
        <div className="flex justify-center mb-6">
          <LoginButton />
        </div>
        
        <button 
          onClick={() => router.push('/')}
          className="text-sm text-gray-400 hover:text-gray-300"
        >
          Return to home page
        </button>
      </div>
    </div>
  );
}