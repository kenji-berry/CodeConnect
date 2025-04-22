"use client";

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginButton from '../Components/LoginButton';

function AuthRequiredContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnPath = searchParams?.get('returnTo') || '/';

  // Store return path for after login
  useEffect(() => {
    localStorage.setItem('redirectAfterLogin', returnPath);
  }, [returnPath]);

  return (
    <div className="w-screen min-h-screen flex items-center justify-center">
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

export default function AuthRequiredPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen w-full radial-background">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
          </div>
          <h1 className="inria-sans-bold text-xl text-off-white">Loading Authentication</h1>
        </div>
      </div>
    }>
      <AuthRequiredContent />
    </Suspense>
  );
}