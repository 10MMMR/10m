"use client";

import {
  Bars3Icon,
  DocumentTextIcon,
  EyeIcon,
  FolderIcon,
  FolderPlusIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
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

type MaterialFolder = {
  id: string;
  index: number | null;
  name: string | null;
};

type FolderIndexRow = {
  index: number | null;
};

type MaterialSection = {
  folder: MaterialFolder | null;
  id: string;
  materials: MaterialItem[];
  title: string;
};

type FolderMaterialSection = MaterialSection & {
  folder: MaterialFolder;
};

const UNSORTED_SECTION_ID = "unsorted";
const UNSORTED_SECTION_TITLE = "Unsorted";
const MATERIAL_FOLDER_TABLE = "material_folder";
const ORDER_GAP = 1000;
const MIN_GAP = 0.000001;

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

function getFolderName(folder: MaterialFolder) {
  return folder.name?.trim() || "Untitled folder";
}

function getSortableFolderIndex(folder: MaterialFolder) {
  if (typeof folder.index === "number" && Number.isFinite(folder.index)) {
    return folder.index;
  }

  return Number.MAX_SAFE_INTEGER;
}

function sortFolders(firstFolder: MaterialFolder, secondFolder: MaterialFolder) {
  const indexDifference =
    getSortableFolderIndex(firstFolder) - getSortableFolderIndex(secondFolder);

  if (indexDifference !== 0) {
    return indexDifference;
  }

  return getFolderName(firstFolder).localeCompare(
    getFolderName(secondFolder),
    undefined,
    { sensitivity: "base" },
  );
}

function buildMaterialSections(
  folders: MaterialFolder[],
  materials: MaterialItem[],
): MaterialSection[] {
  const sections: MaterialSection[] = folders.map((folder) => ({
    folder,
    id: folder.id,
    materials: [] as MaterialItem[],
    title: getFolderName(folder),
  }));
  const unsortedMaterials: MaterialItem[] = [];

  for (const material of materials) {
    unsortedMaterials.push(material);
  }

  if (unsortedMaterials.length > 0) {
    sections.push({
      folder: null,
      id: UNSORTED_SECTION_ID,
      materials: unsortedMaterials,
      title: UNSORTED_SECTION_TITLE,
    });
  }

  return sections;
}

function getNextFolderIndex(rows: FolderIndexRow[]) {
  const lastIndex = rows[0]?.index;

  if (typeof lastIndex !== "number" || !Number.isFinite(lastIndex)) {
    return ORDER_GAP;
  }

  return lastIndex + ORDER_GAP;
}

function isFolderSection(section: MaterialSection): section is FolderMaterialSection {
  return section.folder !== null;
}

function getOrderedFolders(folders: MaterialFolder[]) {
  return [...folders].sort(sortFolders);
}

function reindexFolders(folders: MaterialFolder[]) {
  return folders.map((folder, position) => ({
    ...folder,
    index: (position + 1) * ORDER_GAP,
  }));
}

function getFolderIndex(folder: MaterialFolder) {
  if (typeof folder.index !== "number" || !Number.isFinite(folder.index)) {
    return null;
  }

  return folder.index;
}

function getMovedFolderIndex(folders: MaterialFolder[], movedPosition: number) {
  const previousIndex =
    movedPosition > 0 ? getFolderIndex(folders[movedPosition - 1]!) : null;
  const nextIndex =
    movedPosition < folders.length - 1
      ? getFolderIndex(folders[movedPosition + 1]!)
      : null;

  if (previousIndex === null && nextIndex === null) {
    return ORDER_GAP;
  }

  if (previousIndex === null) {
    return nextIndex === null ? ORDER_GAP : nextIndex / 2;
  }

  if (nextIndex === null) {
    return previousIndex + ORDER_GAP;
  }

  return (previousIndex + nextIndex) / 2;
}

function shouldRebalanceFolders(folders: MaterialFolder[]) {
  for (let position = 1; position < folders.length; position += 1) {
    const previousIndex = getFolderIndex(folders[position - 1]!);
    const currentIndex = getFolderIndex(folders[position]!);

    if (previousIndex === null || currentIndex === null) {
      return true;
    }

    if (currentIndex - previousIndex < MIN_GAP) {
      return true;
    }
  }

  return false;
}

function reorderMaterials(
  materials: MaterialItem[],
  activeId: string,
  overId: string,
) {
  const oldIndex = materials.findIndex((material) => material.id === activeId);
  const newIndex = materials.findIndex((material) => material.id === overId);

  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return null;
  }

  return arrayMove(materials, oldIndex, newIndex);
}

function CreateFolderDialog({
  error,
  isCreating,
  onCancel,
  onCreate,
}: {
  error: string | null;
  isCreating: boolean;
  onCancel: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const trimmedName = name.trim();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!trimmedName || isCreating) {
      return;
    }

    onCreate(trimmedName);
  };

  return (
    <div
      aria-modal="true"
      aria-labelledby="create-folder-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay-scrim) p-4 backdrop-blur-sm"
      role="dialog"
    >
      <form
        className="organic-card w-full max-w-md rounded-[1.5rem] p-6 shadow-(--shadow-floating)"
        onSubmit={handleSubmit}
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-base) text-(--text-secondary)">
            <FolderPlusIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3
              className="display-font text-xl font-bold text-(--text-main)"
              id="create-folder-title"
            >
              Create folder
            </h3>
            <p className="mt-2 text-sm text-(--text-muted)">
              Give this materials folder a short name.
            </p>
          </div>
        </div>

        <label
          className="mt-6 block text-sm font-bold text-(--text-main)"
          htmlFor="material-folder-name"
        >
          Folder name
        </label>
        <input
          autoFocus
          className="organic-input mt-2"
          disabled={isCreating}
          id="material-folder-name"
          maxLength={80}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="Week 1 readings"
          type="text"
          value={name}
        />

        {error ? (
          <p className="mt-3 text-sm font-semibold text-(--destructive)">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="min-h-11 rounded-full border border-(--border-soft) bg-(--surface-base) px-5 text-sm font-bold text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-faint) disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isCreating}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="organic-button organic-button-primary min-h-11 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={!trimmedName || isCreating}
            type="submit"
          >
            {isCreating ? (
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-(--primary-foreground) border-t-transparent"
              />
            ) : null}
            <span>{isCreating ? "Creating..." : "Create folder"}</span>
          </button>
        </div>
      </form>
    </div>
  );
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

function MaterialRow({
  deletingId,
  isSortingDisabled,
  material,
  onDelete,
  onView,
}: {
  deletingId: string | null;
  isSortingDisabled: boolean;
  material: MaterialItem;
  onDelete: (material: MaterialItem) => void;
  onView: (material: MaterialItem) => void;
}) {
  const title = getMaterialTitle(material);
  const isDeleting = deletingId === material.id;
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    disabled: isSortingDisabled,
    id: material.id,
  });
  const style: CSSProperties = {
    opacity: isDragging ? 0.75 : undefined,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="rounded-2xl border border-(--border-soft) bg-(--surface-panel) p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <button
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${title}`}
            className="inline-flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-base) text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main) active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSortingDisabled}
            ref={setActivatorNodeRef}
            type="button"
          >
            <Bars3Icon className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-(--border-soft) bg-(--surface-base) text-(--text-muted)">
            <DocumentTextIcon className="h-5 w-5" aria-hidden="true" />
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
              onView(material);
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
              onDelete(material);
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
}

function MaterialSectionMaterials({
  deletingId,
  isSortingDisabled,
  materials,
  onDelete,
  onReorder,
  onView,
}: {
  deletingId: string | null;
  isSortingDisabled: boolean;
  materials: MaterialItem[];
  onDelete: (material: MaterialItem) => void;
  onReorder: (event: DragEndEvent) => void;
  onView: (material: MaterialItem) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const materialIds = useMemo(
    () => materials.map((material) => material.id),
    [materials],
  );

  if (materials.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-(--border-soft) bg-(--surface-panel-soft) p-4 text-sm font-semibold text-(--text-muted)">
        No materials in this folder yet.
      </p>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={onReorder}
      sensors={sensors}
    >
      <SortableContext items={materialIds} strategy={verticalListSortingStrategy}>
        <ul className="space-y-3">
          {materials.map((material) => (
            <MaterialRow
              deletingId={deletingId}
              isSortingDisabled={isSortingDisabled}
              key={material.id}
              material={material}
              onDelete={onDelete}
              onView={onView}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableMaterialFolderItem({
  isSortingDisabled,
  section,
}: {
  isSortingDisabled: boolean;
  section: FolderMaterialSection;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    disabled: isSortingDisabled,
    id: section.id,
  });
  const style: CSSProperties = {
    opacity: isDragging ? 0.75 : undefined,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex min-h-16 items-center gap-4 rounded-2xl border border-(--border-soft) bg-(--surface-panel-strong) px-4 py-3 shadow-(--shadow-soft)"
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="flex size-10 shrink-0 cursor-grab items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-main-faint) text-(--text-muted) transition-colors duration-150 hover:border-(--border-strong) hover:text-(--text-main) active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Drag ${section.title}`}
        disabled={isSortingDisabled}
        {...attributes}
        {...listeners}
      >
        <Bars3Icon className="size-5" aria-hidden="true" />
      </button>
      <span className="display-font text-lg font-bold text-(--text-main)">
        {section.title}
      </span>
    </li>
  );
}

function MaterialFolderList({
  folderSections,
  isSortingDisabled,
  onDragEnd,
}: {
  folderSections: FolderMaterialSection[];
  isSortingDisabled: boolean;
  onDragEnd: (event: DragEndEvent) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const folderIds = useMemo(
    () => folderSections.map((section) => section.id),
    [folderSections],
  );

  if (folderSections.length === 0) {
    return null;
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      sensors={sensors}
    >
      <SortableContext items={folderIds} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-3">
          {folderSections.map((section) => (
            <SortableMaterialFolderItem
              isSortingDisabled={isSortingDisabled}
              key={section.id}
              section={section}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function MaterialSectionView({
  deletingId,
  isSortingDisabled,
  onDelete,
  onReorder,
  onView,
  section,
}: {
  deletingId: string | null;
  isSortingDisabled: boolean;
  onDelete: (material: MaterialItem) => void;
  onReorder: (event: DragEndEvent) => void;
  onView: (material: MaterialItem) => void;
  section: MaterialSection;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 border-b border-(--border-soft) pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-base) text-(--text-secondary)">
            <FolderIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <h3 className="break-words text-sm font-bold text-(--text-main)">
            {section.title}
          </h3>
        </div>
        <p className="shrink-0 text-xs font-semibold text-(--text-muted)">
          {section.materials.length === 1
            ? "1 material"
            : `${section.materials.length} materials`}
        </p>
      </div>

      <MaterialSectionMaterials
        deletingId={deletingId}
        isSortingDisabled={isSortingDisabled}
        materials={section.materials}
        onDelete={onDelete}
        onReorder={onReorder}
        onView={onView}
      />
    </section>
  );
}

export function ClassMaterialsModal({
  classId,
  refreshKey,
  onAddMaterial,
  onClose,
}: ClassMaterialsModalProps) {
  const { user } = useAuth();
  const [folders, setFolders] = useState<MaterialFolder[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MaterialItem | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isSavingFolderOrder, setIsSavingFolderOrder] = useState(false);
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);
  const [activePdfReference, setActivePdfReference] = useState<PdfReference | null>(null);
  const materialSections = useMemo(
    () => buildMaterialSections(folders, materials),
    [folders, materials],
  );
  const folderSections = useMemo(
    () => materialSections.filter(isFolderSection),
    [materialSections],
  );
  const unsortedSection = useMemo(
    () => materialSections.find((section) => section.folder === null) ?? null,
    [materialSections],
  );

  const loadMaterials = useCallback(async () => {
    if (!supabase) {
      setFolders([]);
      setMaterials([]);
      setError("Supabase is unavailable right now.");
      setIsLoading(false);
      return;
    }

    if (!user?.id) {
      setFolders([]);
      setMaterials([]);
      setError("Please sign in to view your materials.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const [materialsResult, foldersResult] = await Promise.all([
      supabase
        .from("materials")
        .select("created_at, filepath, id, title")
        .eq("class_id", classId)
        .order("created_at", { ascending: false }),
      supabase
        .from(MATERIAL_FOLDER_TABLE)
        .select("id, index, name")
        .eq("class_id", classId)
        .eq("user_id", user.id)
        .order("index", { ascending: true }),
    ]);

    if (materialsResult.error) {
      setFolders([]);
      setMaterials([]);
      setError(materialsResult.error.message || "Could not load materials.");
      setIsLoading(false);
      return;
    }

    if (foldersResult.error) {
      setFolders([]);
      setMaterials([]);
      setError(foldersResult.error.message || "Could not load material folders.");
      setIsLoading(false);
      return;
    }

    setFolders(getOrderedFolders((foldersResult.data as MaterialFolder[] | null) ?? []));
    setMaterials((materialsResult.data as MaterialItem[] | null) ?? []);
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

  const handleViewMaterial = (material: MaterialItem) => {
    setActivePdfReference({
      classId,
      materialId: material.id,
      page: null,
      title: getMaterialTitle(material),
    });
  };

  const persistFolderOrder = useCallback(
    async (orderedFolders: MaterialFolder[]) => {
      if (!supabase) {
        throw new Error("Supabase is unavailable right now.");
      }

      if (!user?.id) {
        throw new Error("Please sign in again before sorting folders.");
      }

      const client = supabase;
      const { error: upsertError } = await client
        .from(MATERIAL_FOLDER_TABLE)
        .upsert(
          orderedFolders.map((folder) => ({
            class_id: classId,
            id: folder.id,
            index: folder.index,
            name: folder.name,
            user_id: user.id,
          })),
          { onConflict: "id" },
        );

      if (upsertError) {
        throw new Error(upsertError.message || "Could not save folder order.");
      }
    },
    [classId, user?.id],
  );

  const persistMovedFolderIndex = useCallback(
    async (folderId: string, index: number) => {
      if (!supabase) {
        throw new Error("Supabase is unavailable right now.");
      }

      if (!user?.id) {
        throw new Error("Please sign in again before sorting folders.");
      }

      const { data, error: updateError } = await supabase
        .from(MATERIAL_FOLDER_TABLE)
        .update({ index })
        .eq("id", folderId)
        .eq("class_id", classId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();

      if (updateError) {
        throw new Error(updateError.message || "Could not save folder order.");
      }

      if (!data) {
        throw new Error("Could not save folder order.");
      }
    },
    [classId, user?.id],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (isSavingFolderOrder) {
        return;
      }

      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = folders.findIndex((folder) => folder.id === active.id);
      const newIndex = folders.findIndex((folder) => folder.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reorderedFolders = arrayMove(folders, oldIndex, newIndex);
      const movedPosition = reorderedFolders.findIndex(
        (folder) => folder.id === active.id,
      );
      const movedFolder = reorderedFolders[movedPosition];

      if (!movedFolder) {
        return;
      }

      const movedIndex = getMovedFolderIndex(reorderedFolders, movedPosition);
      const indexedFolders = reorderedFolders.map((folder) =>
        folder.id === movedFolder.id ? { ...folder, index: movedIndex } : folder,
      );
      const nextFolders = shouldRebalanceFolders(indexedFolders)
        ? reindexFolders(reorderedFolders)
        : indexedFolders;
      const shouldRebalance = nextFolders !== indexedFolders;

      setFolders(nextFolders);
      setError(null);
      setIsSavingFolderOrder(true);

      const saveOrder = shouldRebalance
        ? persistFolderOrder(nextFolders)
        : persistMovedFolderIndex(movedFolder.id, movedIndex);

      void saveOrder
        .catch((orderError) => {
          setFolders(folders);
          setError(
            orderError instanceof Error
              ? orderError.message
              : "Could not save folder order.",
          );
        })
        .finally(() => {
          setIsSavingFolderOrder(false);
        });
    },
    [
      folders,
      isSavingFolderOrder,
      persistFolderOrder,
      persistMovedFolderIndex,
    ],
  );

  const handleMaterialDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const reorderedMaterials = reorderMaterials(
        materials,
        String(active.id),
        String(over.id),
      );

      if (!reorderedMaterials) {
        return;
      }

      setMaterials(reorderedMaterials);
    },
    [materials],
  );

  const handleCreateFolder = async (folderName: string) => {
    if (isCreatingFolder) {
      return;
    }

    if (!supabase) {
      setCreateFolderError("Supabase is unavailable right now.");
      return;
    }

    if (!user?.id) {
      setCreateFolderError("Please sign in again before creating a folder.");
      return;
    }

    setIsCreatingFolder(true);
    setCreateFolderError(null);

    const { data: indexRows, error: indexError } = await supabase
      .from(MATERIAL_FOLDER_TABLE)
      .select("index")
      .eq("class_id", classId)
      .eq("user_id", user.id)
      .order("index", { ascending: false })
      .limit(1);

    if (indexError) {
      setCreateFolderError(indexError.message || "Could not find next folder order.");
      setIsCreatingFolder(false);
      return;
    }

    const { error: insertError } = await supabase.from(MATERIAL_FOLDER_TABLE).insert({
      class_id: classId,
      index: getNextFolderIndex((indexRows as FolderIndexRow[] | null) ?? []),
      name: folderName,
      user_id: user.id,
    });

    if (insertError) {
      setCreateFolderError(insertError.message || "Could not create folder.");
      setIsCreatingFolder(false);
      return;
    }

    setIsCreateFolderOpen(false);
    setIsCreatingFolder(false);
    await loadMaterials();
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="organic-button organic-button-outline min-h-11 cursor-pointer px-5 py-0 text-sm"
              onClick={() => {
                setCreateFolderError(null);
                setIsCreateFolderOpen(true);
              }}
              type="button"
            >
              <FolderPlusIcon className="h-5 w-5" aria-hidden="true" />
              <span>New folder</span>
            </button>
            <button
              className="organic-button organic-button-primary min-h-11 cursor-pointer"
              onClick={onAddMaterial}
              type="button"
            >
              <PlusIcon className="h-5 w-5" aria-hidden="true" />
              <span>Add material</span>
            </button>
          </div>
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
          ) : materialSections.length === 0 ? (
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
            <div className="space-y-6">
              <MaterialFolderList
                folderSections={folderSections}
                isSortingDisabled={isSavingFolderOrder}
                onDragEnd={handleDragEnd}
              />

              {unsortedSection ? (
                <MaterialSectionView
                  deletingId={deletingId}
                  isSortingDisabled={Boolean(deletingId)}
                  onDelete={setPendingDelete}
                  onReorder={handleMaterialDragEnd}
                  onView={handleViewMaterial}
                  section={unsortedSection}
                />
              ) : null}
            </div>
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

      {isCreateFolderOpen ? (
        <CreateFolderDialog
          error={createFolderError}
          isCreating={isCreatingFolder}
          onCancel={() => {
            if (!isCreatingFolder) {
              setCreateFolderError(null);
              setIsCreateFolderOpen(false);
            }
          }}
          onCreate={(name) => {
            void handleCreateFolder(name);
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
