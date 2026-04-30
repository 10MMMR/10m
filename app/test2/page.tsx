"use client";

import { PlusIcon, Bars3Icon } from "@heroicons/react/24/outline";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useMemo, useRef, useState } from "react";

type SortableListItem = {
  id: string;
  label: string;
};

type SortableItemProps = {
  item: SortableListItem;
};

const notifyReorder = () => {
  void fetch("/test2/reorder", {
    method: "POST",
  }).catch(() => undefined);
};

function SortableItem({ item }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const style = {
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
        className="flex size-10 shrink-0 cursor-grab items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-main-faint) text-(--text-muted) transition-colors duration-150 hover:border-(--border-strong) hover:text-(--text-main) active:cursor-grabbing"
        aria-label={`Drag ${item.label}`}
        {...attributes}
        {...listeners}
      >
        <Bars3Icon className="size-5" aria-hidden="true" />
      </button>
      <span className="display-font text-lg font-bold text-(--text-main)">
        {item.label}
      </span>
    </li>
  );
}

export default function Test2Page() {
  const [items, setItems] = useState<SortableListItem[]>([]);
  const nextItemNumber = useRef(1);
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
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

  const handleAddItem = useCallback(() => {
    const itemNumber = nextItemNumber.current;
    nextItemNumber.current += 1;

    setItems((currentItems) => [
      ...currentItems,
      {
        id: `item-${itemNumber}`,
        label: `Item ${itemNumber}`,
      },
    ]);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      setItems(arrayMove(items, oldIndex, newIndex));
      notifyReorder();
    },
    [items],
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16 text-(--text-main) sm:px-6">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">
            Sortable List
          </p>
          <h1 className="display-font mt-2 text-4xl font-bold text-(--text-main)">
            Test 2
          </h1>
        </div>
        <button
          type="button"
          className="organic-button organic-button-primary min-h-12 w-full sm:w-auto"
          onClick={handleAddItem}
        >
          <PlusIcon className="size-5" aria-hidden="true" />
          Add item
        </button>
      </header>

      <section className="organic-card rounded-2xl p-4 sm:p-5">
        {items.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={itemIds}
              strategy={verticalListSortingStrategy}
            >
              <ul className="flex flex-col gap-3">
                {items.map((item) => (
                  <SortableItem key={item.id} item={item} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-(--border-soft) bg-(--surface-panel-soft) px-6 text-center">
            <p className="max-w-sm text-sm leading-6 text-(--text-muted)">
              No items yet. Add one, then drag rows by their handle to reorder
              the list.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
