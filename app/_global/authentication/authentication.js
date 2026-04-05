import { supabase } from "./supabaseClient";

export const getAccessToken = async () => {
  if (!supabase) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  //checks to make sure session is linked to a user
  if (session) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  } else {
    return null;
  }
};

//google sign in
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

//sign out of account
export const handleSignOut = () => {
  if (!supabase) {
    return;
  }

  void supabase.auth.signOut();
};
