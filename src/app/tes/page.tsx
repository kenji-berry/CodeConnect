'use client';

import { useState, useEffect } from 'react';
import { testGitHubAccess } from '../../utils/githubUtils';

export default function GitHubStatus() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const result = await testGitHubAccess();
        
        if (result.success) {
          setStatus('connected');
          setUsername(result.username);
        } else {
          setStatus('disconnected');
        }
      } catch (error) {
        setStatus('disconnected');
      }
    };
    
    checkAccess();
  }, []);

  if (status === 'checking') {
    return <div>Checking GitHub connection...</div>;
  }

  if (status === 'connected') {
    return <div className="text-green-500">Connected to GitHub as {username}</div>;
  }

  return (
    <div className="text-red-500">
      GitHub connection required. Please log out and log in again.
    </div>
  );
}