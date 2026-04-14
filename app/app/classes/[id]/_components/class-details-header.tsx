"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/_global/authentication/auth-context";
import { supabase } from "@/app/_global/authentication/supabaseClient";

type ClassDetailsHeaderProps = {
  classId: string;
};

export function ClassDetailsHeader({ classId }: ClassDetailsHeaderProps) {
  const { user } = useAuth();
  const [className, setClassName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadClassName = async () => {
      if (!supabase) {
        if (isMounted) {
          setError("Supabase is unavailable right now.");
          setIsLoading(false);
        }
        return;
      }

      if (!user?.id) {
        if (isMounted) {
          setError("Please sign in to view this class.");
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("classes")
        .select("name")
        .eq("id", classId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (queryError) {
        setError(queryError.message || "Could not load class details.");
        setClassName("");
        setIsLoading(false);
        return;
      }

      setClassName(data?.name?.trim() || "Untitled class");
      setIsLoading(false);
    };

    void loadClassName();

    return () => {
      isMounted = false;
    };
  }, [classId, user?.id]);

  return (
    <section className="space-y-3">
      <p className="mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">
        Class
      </p>
      {isLoading ? (
        <div className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="h-6 w-6 animate-spin rounded-full border-2 border-(--border-soft) border-t-(--main)"
          />
          <p className="text-sm font-semibold text-(--text-muted)">Loading class...</p>
        </div>
      ) : (
        <h1 className="display-font text-4xl font-bold text-(--text-main)">{className}</h1>
      )}
      {error ? <p className="text-sm text-(--destructive)">{error}</p> : null}
    </section>
  );
}
