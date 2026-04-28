"use client";

import {
  DocumentTextIcon,
  EyeIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/_global/authentication/auth-context";
import { supabase } from "@/app/_global/authentication/supabaseClient";
import {
  PdfReferenceModal,
  type PdfReference,
} from "@/app/_components/chat/pdf-reference-modal";

type ClassMaterialsModalProps = {
  classId: string;
  refreshKey: number;
  onAddMaterial: () => void;
  onClose: () => void;
};

type MaterialItem = {
  created_at: string | null;
  filepath: string | null;
  id: string;
  title: string | null;
};

const materialDateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatMaterialDate(value: string | null) {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return materialDateFormatter.format(date);
}

function getMaterialTitle(material: MaterialItem) {
  return material.title?.trim() || "Untitled material";
}

function DeleteMaterialConfirm({
  isDeleting,
  materialTitle,
  onCancel,
  onConfirm,
}: {
  isDeleting: boolean;
  materialTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      aria-modal="true"
      aria-labelledby="delete-material-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay-scrim) p-4 backdrop-blur-sm"
      role="dialog"
    >
      <section className="organic-card w-full max-w-md rounded-[1.5rem] p-6 shadow-(--shadow-floating)">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-base) text-(--destructive)">
            <TrashIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3
              className="display-font text-xl font-bold text-(--text-main)"
              id="delete-material-title"
            >
              Delete material?
            </h3>
            <p className="mt-2 break-words text-sm text-(--text-muted)">
              This will remove{" "}
              <span className="font-semibold text-(--text-main)">
                {materialTitle}
              </span>{" "}
              from this class.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="min-h-11 rounded-full border border-(--border-soft) bg-(--surface-base) px-5 text-sm font-bold text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint) disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isDeleting}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-(--destructive) bg-(--destructive) px-5 text-sm font-bold text-(--destructive-foreground) transition-transform duration-200 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
          >
            {isDeleting ? (
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-(--destructive-foreground) border-t-transparent"
              />
            ) : null}
            <span>{isDeleting ? "Deleting..." : "Delete"}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export function ClassMaterialsModal({
  classId,
  refreshKey,
  onAddMaterial,
  onClose,
}: ClassMaterialsModalProps) {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MaterialItem | null>(null);
  const [activePdfReference, setActivePdfReference] = useState<PdfReference | null>(null);

  const loadMaterials = useCallback(async () => {
    if (!supabase) {
      setMaterials([]);
      setError("Supabase is unavailable right now.");
      setIsLoading(false);
      return;
    }

    if (!user?.id) {
      setMaterials([]);
      setError("Please sign in to view your materials.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from("materials")
      .select("created_at, filepath, id, title")
      .eq("class_id", classId)
      .order("created_at", { ascending: false });

    if (queryError) {
      setMaterials([]);
      setError(queryError.message || "Could not load materials.");
      setIsLoading(false);
      return;
    }

    setMaterials((data as MaterialItem[] | null) ?? []);
    setIsLoading(false);
  }, [classId, user?.id]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials, refreshKey]);

  const removeStorageFile = async (material: MaterialItem) => {
    if (!material.filepath) {
      return null;
    }

    const { error: storageError } = await supabase!.storage
      .from("class_materials")
      .remove([material.filepath]);

    return storageError;
  };

  const deleteMaterialRow = async (materialId: string) =>
    supabase!
      .from("materials")
      .delete()
      .eq("id", materialId)
      .eq("class_id", classId);

  const deleteMaterialChunks = async (materialId: string) => {
    await supabase!.from("material_chunks").delete().eq("material_id", materialId);
  };

  const handleDeleteMaterial = async (material: MaterialItem) => {
    if (deletingId) {
      return;
    }

    if (!supabase) {
      setError("Supabase is unavailable right now.");
      return;
    }

    if (!user?.id) {
      setError("Please sign in again before deleting a material.");
      return;
    }

    setDeletingId(material.id);
    setError(null);

    try {
      let { error: deleteError } = await deleteMaterialRow(material.id);

      if (deleteError) {
        await deleteMaterialChunks(material.id);
        ({ error: deleteError } = await deleteMaterialRow(material.id));
      } else {
        await deleteMaterialChunks(material.id);
      }

      if (deleteError) {
        throw new Error(deleteError.message || "Could not delete material.");
      }

      setPendingDelete(null);
      setMaterials((previousMaterials) =>
        previousMaterials.filter((item) => item.id !== material.id),
      );

      const storageError = await removeStorageFile(material);

      if (storageError) {
        setError("Material was removed, but the stored file could not be cleaned up.");
      }
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete material.";
      setError(message);
      setPendingDelete(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      aria-modal="true"
      aria-labelledby="class-materials-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay-scrim) p-0 sm:p-4"
      role="dialog"
    >
      <section className="organic-card flex h-full w-full flex-col overflow-hidden rounded-none p-6 sm:h-auto sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-[1.8rem] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">
              Uploaded Materials
            </p>
            <h2
              className="display-font mt-2 text-2xl font-bold text-(--text-main)"
              id="class-materials-title"
            >
              Materials
            </h2>
          </div>

          <button
            aria-label="Close materials popup"
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-base) text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
            onClick={onClose}
            type="button"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-(--text-muted)">
            {materials.length === 1
              ? "1 material"
              : `${materials.length} materials`}
          </p>
          <button
            className="organic-button organic-button-primary min-h-11 cursor-pointer"
            onClick={onAddMaterial}
            type="button"
          >
            <PlusIcon className="h-5 w-5" aria-hidden="true" />
            <span>Add material</span>
          </button>
        </div>

        {error ? (
          <p className="mt-4 text-sm font-semibold text-(--destructive)">
            {error}
          </p>
        ) : null}

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-(--border-soft) bg-(--surface-panel) p-4">
              <div
                aria-hidden="true"
                className="h-5 w-5 animate-spin rounded-full border-2 border-(--border-soft) border-t-(--main)"
              />
              <p className="text-sm font-semibold text-(--text-muted)">
                Loading materials...
              </p>
            </div>
          ) : materials.length === 0 ? (
            <div className="rounded-2xl border border-(--border-soft) bg-(--surface-panel) p-5">
              <h3 className="text-base font-bold text-(--text-main)">
                No materials yet
              </h3>
              <p className="mt-2 text-sm text-(--text-muted)">
                Add PDFs or PowerPoints here whenever you want them attached to
                this class.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {materials.map((material) => {
                const title = getMaterialTitle(material);
                const isDeleting = deletingId === material.id;

                return (
                  <li
                    className="rounded-2xl border border-(--border-soft) bg-(--surface-panel) p-4"
                    key={material.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-(--border-soft) bg-(--surface-base) text-(--text-muted)">
                          <DocumentTextIcon
                            className="h-5 w-5"
                            aria-hidden="true"
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold text-(--text-main)">
                            {title}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-(--text-muted)">
                            Added {formatMaterialDate(material.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          aria-label={`View ${title}`}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-base) text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main) disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={Boolean(deletingId)}
                          onClick={() => {
                            setActivePdfReference({
                              classId,
                              materialId: material.id,
                              page: null,
                              title,
                            });
                          }}
                          type="button"
                        >
                          <EyeIcon className="h-4 w-4" aria-hidden="true" />
                        </button>

                        <button
                          aria-label={`Delete ${title}`}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-base) text-(--destructive) transition-colors duration-200 hover:bg-(--surface-main-faint) disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={Boolean(deletingId)}
                          onClick={() => {
                            setPendingDelete(material);
                          }}
                          type="button"
                        >
                          {isDeleting ? (
                            <span
                              aria-hidden="true"
                              className="h-4 w-4 animate-spin rounded-full border-2 border-(--border-soft) border-t-(--destructive)"
                            />
                          ) : (
                            <TrashIcon className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {pendingDelete ? (
        <DeleteMaterialConfirm
          isDeleting={deletingId === pendingDelete.id}
          materialTitle={getMaterialTitle(pendingDelete)}
          onCancel={() => {
            if (!deletingId) {
              setPendingDelete(null);
            }
          }}
          onConfirm={() => {
            void handleDeleteMaterial(pendingDelete);
          }}
        />
      ) : null}

      {activePdfReference ? (
        <PdfReferenceModal
          onClose={() => {
            setActivePdfReference(null);
          }}
          reference={activePdfReference}
          userId={user?.id}
        />
      ) : null}
    </div>
  );
}
