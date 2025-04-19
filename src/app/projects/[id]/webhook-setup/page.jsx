"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/supabaseClient';
import Link from 'next/link';

export default function WebhookSetup() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Get the single global secret from env
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  useEffect(() => {
    async function checkOwner() {
      try {
        setLoading(true);
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("Please sign in to access this page");
          return;
        }

        // Check if user owns this project
        const { data: project, error: projectError } = await supabase
          .from('project')
          .select('user_id')
          .eq('id', id)
          .single();

        if (projectError || !project) {
          setError("Project not found");
          return;
        }

        if (project.user_id !== user.id) {
          setError("You don't have permission to access this page");
          return;
        }

        setIsOwner(true);
      } catch (err) {
        setError("An unexpected error occurred");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    checkOwner();
  }, [id]);

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full radial-background">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
          </div>
          <h1 className="inria-sans-bold text-xl text-off-white">Setting Up Webhook...</h1>
        </div>
      </div>
    );
  }

  if (error || !isOwner) {
    return (
      <div className="max-w-xl mx-auto my-10 bg-[--primary-color] rounded-2xl shadow-lg border border-[--magenta-dark] p-6">
        <h1 className="text-2xl inria-sans-bold text-[--title-red] mb-6">Error</h1>
        <p className="text-[--off-white]">{error || "You don't have permission to view this page"}</p>
        <div className="mt-6">
          <Link href="/" className="px-4 py-2 bg-[--muted-red] hover:bg-[--title-red] rounded text-white font-semibold inline-block">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto my-10 bg-[--primary-color] rounded-2xl shadow-lg border border-[--magenta-dark] p-6">
      <h1 className="text-2xl inria-sans-bold text-[--title-red] mb-6">Webhook Secret</h1>
      <div className="mb-6">
        <p className="text-[--off-white] mb-4">
          Use this secret when configuring the webhook in your GitHub repository settings.
          Keep this secret secure - it&#39;s used to verify that webhook events are coming from GitHub.
        </p>
        <div className="bg-gray-800 p-4 rounded flex justify-between items-center border border-gray-700">
          <code className="text-green-400 font-mono">{secret || "Secret not available"}</code>
          <button 
            onClick={handleCopySecret} 
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
            disabled={!secret}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl inria-sans-bold text-[--orange] mb-4">Webhook Instructions</h2>
        <ol className="list-decimal ml-6 space-y-3 text-[--off-white]">
          <li>Go to your GitHub repository → <b>Settings</b> → <b>Webhooks</b></li>
          <li>Click <b>Add webhook</b></li>
          <li>
            <b>Payload URL:</b>
            <code className="bg-gray-800 p-1 rounded block overflow-x-auto mt-1 text-sm">
              {`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/github?projectId=${id}`}
            </code>
          </li>
          <li><b>Content type:</b> <code className="bg-gray-800 p-1 rounded">application/json</code></li>
          <li>
            <b>Secret:</b> Use the secret displayed above
          </li>
          <li>For <b>events</b>, select <b>Push</b>, <b>Issues</b>, and <b>Pull requests</b></li>
          <li>Click <b>Add webhook</b> to save</li>
        </ol>
      </div>
      
      <div className="mt-8">
        <button 
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          Back to Project
        </button>
      </div>
    </div>
  );
}