"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../supabaseClient";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleAuthCallback() {
      let finalRedirectPath = '/';

      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!session?.user) throw new Error("No user found after session exchange");

        let profileData;
        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('is_changed, onboarding_step')
          .eq('user_id', session.user.id)
          .single();

        if (profileError && profileError.code === 'PGRST116') {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert([{
              user_id: session.user.id,
              display_name: `User-${Math.random().toString(36).substring(2, 7)}`,
              is_changed: false,
              onboarding_step: 1
            }])
            .select('onboarding_step')
            .single();
          if (insertError) throw insertError;
          profileData = newProfile;
        } else if (profileError) {
          throw profileError;
        } else {
          profileData = existingProfile;
        }

        const onboardingStep = profileData?.onboarding_step ?? 1;
        if (onboardingStep < 5) {
          finalRedirectPath = `/onboarding?step=${onboardingStep}`;
        } else {
          finalRedirectPath = '/';
        }

      } catch (err) {
        console.error("Auth callback error:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred during authentication callback");
        setLoading(false);
        return;
      } finally {
        if (!error) {
            setLoading(false);
            router.replace(finalRedirectPath);
        }
      }
    }

    handleAuthCallback();
  }, [router, error]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mb-4"></div>
        <p className="text-[--off-white]">Completing login...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-red-900 bg-opacity-50 rounded-lg p-6 max-w-md">
          <h2 className="text-xl text-red-400 font-bold mb-2">Authentication Error</h2>
          <p className="text-[--off-white]">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-[--title-red] rounded-md text-white"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mb-4"></div>
      <p className="text-[--off-white]">Redirecting...</p>
    </div>
  );
}