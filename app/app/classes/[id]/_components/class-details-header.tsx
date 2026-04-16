"use client";

import {
  AcademicCapIcon,
  ArrowLeftIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  RectangleStackIcon,
  DocumentTextIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from "@/app/_global/authentication/auth-context";
import { supabase } from "@/app/_global/authentication/supabaseClient";

type ClassDetailsHeaderProps = {
  classId: string;
};

type UploadStatusItem = {
  key: string;
  name: string;
  status: "loading" | "success" | "error";
  errorMessage: string | null;
};

export function ClassDetailsHeader({ classId }: ClassDetailsHeaderProps) {
  const MAX_UPLOAD_FILES = 10;
  const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;
  const { user } = useAuth();
  const [className, setClassName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadStatusItems, setUploadStatusItems] = useState<UploadStatusItem[]>([]);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const quickActions = [
    {
      label: "Upload material",
      Icon: ArrowUpTrayIcon,
    },
    {
      label: "Take notes",
      Icon: DocumentTextIcon,
    },
    {
      label: "Start a mock exam",
      Icon: AcademicCapIcon,
    },
  ];
  const stats = [
    {
      label: "Mock Exam Score",
      value: "100%",
    },
    {
      label: "Days studied past week",
      value: "4",
    },
  ];

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

  const handleUploadMaterialClick = () => {
    uploadInputRef.current?.click();
  };

  const updateUploadStatus = (
    key: string,
    status: UploadStatusItem["status"],
    errorMessage: string | null,
  ) => {
    setUploadStatusItems((previousItems) =>
      previousItems.map((item) => {
        if (item.key !== key) {
          return item;
        }

        return {
          ...item,
          status,
          errorMessage,
        };
      }),
    );
  };

  const uploadMaterialFile = async (statusKey: string, file: File) => {
    if (!supabase) {
      updateUploadStatus(statusKey, "error", "Supabase is unavailable right now.");
      return;
    }

    if (!user?.id) {
      updateUploadStatus(statusKey, "error", "Please sign in to upload files.");
      return;
    }

    const materialId = uuidv4();
    const filepath = `${user.id}/${materialId}/${file.name}`;
    const { error: insertError } = await supabase.from("materials").insert({
      id: materialId,
      class_id: classId,
      title: file.name,
      filepath,
    });

    if (insertError) {
      updateUploadStatus(statusKey, "error", insertError.message || "Could not create material record.");
      return;
    }

    const { error: uploadError } = await supabase.storage.from("class_materials").upload(filepath, file, {
      upsert: false,
      contentType: file.type || undefined,
    });

    if (uploadError) {
      updateUploadStatus(statusKey, "error", uploadError.message || "Could not upload file.");
      return;
    }

    updateUploadStatus(statusKey, "success", null);
  };

  const handleUploadMaterialSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;

    if (!selectedFiles?.length) {
      return;
    }

    if (selectedFiles.length > MAX_UPLOAD_FILES) {
      setUploadError(`You can upload up to ${MAX_UPLOAD_FILES} files at a time.`);
      event.target.value = "";
      return;
    }

    const invalidTypeFile = Array.from(selectedFiles).find((file) => {
      const lowerName = file.name.toLowerCase();
      return !lowerName.endsWith(".pdf") && !lowerName.endsWith(".pptx");
    });

    if (invalidTypeFile) {
      setUploadError("Files must be .pdf or .pptx.");
      event.target.value = "";
      return;
    }

    setUploadError(null);
    const files = Array.from(selectedFiles);
    const nextStatusItems = files.map((file) => {
      const statusKey = uuidv4();
      const isOversized = file.size > MAX_UPLOAD_FILE_BYTES;

      return {
        key: statusKey,
        name: file.name,
        status: isOversized ? ("error" as const) : ("loading" as const),
        errorMessage: isOversized ? "File is over 50MB." : null,
      };
    });

    setUploadStatusItems(nextStatusItems);

    nextStatusItems.forEach((statusItem, index) => {
      const file = files[index];
      if (!file || statusItem.status === "error") {
        return;
      }

      void uploadMaterialFile(statusItem.key, file);
    });

    event.target.value = "";
  };

  return (
    <section className="space-y-8">
      <input
        ref={uploadInputRef}
        type="file"
        accept=".pdf,.pptx"
        multiple
        className="hidden"
        onChange={handleUploadMaterialSelect}
      />
      <div>
        <Link
          href="/app/classes"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-panel) text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
          aria-label="Back to classes"
        >
          <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>

      <header className="space-y-3">
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
      </header>

      <section className="space-y-4">
        <h2 className="display-font text-2xl font-bold text-(--text-main)">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map(({ label, Icon }) => (
            <button
              key={label}
              type="button"
              className="organic-card flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-6 text-left text-sm font-semibold text-(--text-main) transition-all duration-200 hover:-translate-y-px hover:bg-(--surface-main-faint) hover:shadow-(--shadow-soft)"
              onClick={label === "Upload material" ? handleUploadMaterialClick : undefined}
            >
              <Icon className="h-5 w-5 text-(--text-muted)" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        {uploadError ? <p className="text-sm text-(--destructive)">{uploadError}</p> : null}
      </section>

      {uploadStatusItems.length > 0 ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Upload Status"
          className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay-scrim) p-4"
        >
          <div className="organic-card w-full max-w-xl rounded-[1.8rem] p-6">
            <div className="flex items-start justify-between gap-4">
              <h3 className="display-font text-2xl font-bold text-(--text-main)">Upload Status</h3>
              <button
                type="button"
                aria-label="Close upload status"
                onClick={() => {
                  setUploadStatusItems([]);
                }}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-base) text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {uploadStatusItems.map((item) => (
                <div key={item.key} className="organic-card rounded-2xl p-4">
                  {item.errorMessage ? (
                    <p className="mb-2 text-sm font-semibold text-(--destructive)">{item.errorMessage}</p>
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-(--text-main)">{item.name}</p>
                    {item.status === "error" ? (
                      <XCircleIcon className="h-5 w-5 text-(--destructive)" aria-hidden="true" />
                    ) : item.status === "success" ? (
                      <CheckCircleIcon className="h-5 w-5 text-(--success)" aria-hidden="true" />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="h-5 w-5 animate-spin rounded-full border-2 border-(--border-soft) border-t-(--main)"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <section className="space-y-4">
        <h2 className="display-font text-2xl font-bold text-(--text-main)">Statistics</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.map((stat) => (
            <article key={stat.label} className="organic-card rounded-2xl p-4 sm:p-5">
              <p className="text-sm font-semibold text-(--text-muted)">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold text-(--text-main)">{stat.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="display-font text-2xl font-bold text-(--text-main)">Study</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="organic-card flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-6 text-left text-sm font-semibold text-(--text-main) transition-all duration-200 hover:-translate-y-px hover:bg-(--surface-main-faint) hover:shadow-(--shadow-soft)"
          >
            <RectangleStackIcon className="h-5 w-5 text-(--text-muted)" aria-hidden="true" />
            <span>Study with flashcards</span>
          </button>

          <button
            type="button"
            className="organic-card flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-6 text-left text-sm font-semibold text-(--text-main) transition-all duration-200 hover:-translate-y-px hover:bg-(--surface-main-faint) hover:shadow-(--shadow-soft)"
          >
            <AcademicCapIcon className="h-5 w-5 text-(--text-muted)" aria-hidden="true" />
            <span>Study with mock exams</span>
          </button>
        </div>
      </section>
    </section>
  );
}
