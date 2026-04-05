"use client";

import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "./supabaseClient";

type AuthStatus =
  | "loading"
  | "signed-in"
  | "signed-out"
  | "signing-out"
  | "unavailable";

type AuthContextValue = {
  isAuthenticated: boolean;
  signInWithGoogle: () => void;
  signOut: () => void;
  status: AuthStatus;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const browserSupabase = supabase as SupabaseClient | null;

type AuthProviderProps = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(
    browserSupabase ? "loading" : "unavailable",
  );

  useEffect(() => {
    if (!browserSupabase) {
      return;
    }

    let isMounted = true;

    const applySession = (session: Session | null) => {
      if (!isMounted) {
        return;
      }

      setUser(session?.user ?? null);
      setStatus(session?.user ? "signed-in" : "signed-out");
    };

    void browserSupabase.auth
      .getSession()
      .then(({ data }) => {
        applySession(data.session);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setUser(null);
        setStatus("signed-out");
      });

    const {
      data: { subscription },
    } = browserSupabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === "SIGNED_OUT") {
          if (isMounted) {
            setUser(null);
            setStatus("signing-out");
          }

          if (window.location.pathname !== "/signedout") {
            window.location.replace("/signedout");
            return;
          }

          if (isMounted) {
            setStatus("signed-out");
          }
          return;
        }

        applySession(session);
      },
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(() => {
    if (!browserSupabase) {
      return;
    }

    void browserSupabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href,
      },
    });
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    setStatus("signing-out");

    if (!browserSupabase) {
      if (window.location.pathname !== "/signedout") {
        window.location.replace("/signedout");
      }
      return;
    }

    void browserSupabase.auth.signOut().finally(() => {
      if (window.location.pathname !== "/signedout") {
        window.location.replace("/signedout");
      }
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === "signed-in" && Boolean(user),
      signInWithGoogle,
      signOut,
    }),
    [signInWithGoogle, signOut, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
