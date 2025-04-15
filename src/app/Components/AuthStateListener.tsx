"use client";

import { useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { storeGitHubToken, clearGitHubTokens } from "../../utils/tokenRefresh";

export function AuthStateListener() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.provider_token) {
        storeGitHubToken(session.provider_token);
      }
      if (session) {
        fetch("/api/auth/set-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ event: "SIGNED_IN", session }),
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.provider_token) {
        storeGitHubToken(session.provider_token);
      }
      if (event === "SIGNED_IN" && session) {
        fetch("/api/auth/set-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ event, session }),
        });
      } else if (event === "SIGNED_OUT") {
        clearGitHubTokens();
        fetch("/api/auth/set-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ event, session: null }),
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);
  return null;
}