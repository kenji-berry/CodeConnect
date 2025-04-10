"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
  const router = useRouter();
  
  useEffect(() => {
    const redirectTimer = setTimeout(() => {
      router.push('/');
    }, 2000);
    
    return () => clearTimeout(redirectTimer);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen w-full radial-background">
      <div className="text-center">
        <div className="mb-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
        </div>
        <h1 className="inria-sans-bold text-xl text-off-white">Completing Login</h1>
      </div>
    </div>
  );
}