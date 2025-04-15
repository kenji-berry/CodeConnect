"use client";

import { useState } from "react";
import { supabase } from "../../supabaseClient";

const LoginButton = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      // Start GitHub OAuth flow with Supabase
      await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined,
          scopes: "repo",
        },
      });
    } catch (err) {
      console.error("Login error:", err);
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogin}
      disabled={isLoading}
      className="bg-[--muted-red] hover:bg-red-700 px-3 py-2 rounded-full transition-colors duration-200 inria-sans-bold text-off-white text-sm disabled:opacity-50"
    >
      {isLoading ? "Logging in..." : "Log in with GitHub"}
    </button>
  );
};

export default LoginButton;