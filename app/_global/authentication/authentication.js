import { supabase } from "./supabaseClient";

export const handleGoogleSignIn = () => {
  if (!supabase) {
    return;
  }

  void supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.href,
    },
  });
};

export const handleSignOut = () => {
  if (!supabase) {
    return;
  }

  void supabase.auth.signOut();
};
