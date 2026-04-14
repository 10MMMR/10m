"use client";

import { useEffect, useState } from "react";

export type OptionValue = string | number;

export type PopupOption = {
  name: string;
  value: OptionValue;
};

export type OptionsPopupColumn = {
  key: string;
  options: PopupOption[];
};

export type OptionsPopupSelection = Record<string, OptionValue | null>;

type OptionsPopupProps = {
  columns: OptionsPopupColumn[];
  align?: "left" | "right";
  onSelectionChange: (selection: OptionsPopupSelection) => void;
  selectedValues?: OptionsPopupSelection;
};

const toInitialSelection = (
  columns: OptionsPopupColumn[],
  selectedValues?: OptionsPopupSelection,
) =>
  columns.reduce<OptionsPopupSelection>((nextSelection, column) => {
    nextSelection[column.key] = selectedValues?.[column.key] ?? null;
    return nextSelection;
  }, {});

const formatColumnLabel = (key: string) =>
  key.charAt(0).toUpperCase() + key.slice(1).replaceAll("-", " ");

export function OptionsPopup({
  columns,
  align = "left",
  onSelectionChange,
  selectedValues,
}: OptionsPopupProps) {
  const [selection, setSelection] = useState<OptionsPopupSelection>(() =>
    toInitialSelection(columns, selectedValues),
  );

  useEffect(() => {
    setSelection(toInitialSelection(columns, selectedValues));
  }, [columns, selectedValues]);

  if (columns.length < 1) {
    return null;
  }

  const handleSelect = (key: string, value: OptionValue) => {
    if (selection[key] === value) {
      return;
    }

    const nextSelection = {
      ...selection,
      [key]: value,
    };

    setSelection(nextSelection);
    onSelectionChange(nextSelection);
  };

  return (
    <div
      className={`absolute top-full z-20 mt-2 min-w-full rounded-2xl border border-(--border-soft) bg-(--surface-panel-strong) p-3 shadow-(--shadow-soft) backdrop-blur-md ${
        align === "right" ? "right-0" : "left-0"
      }`}
      data-schedule-selector="true"
    >
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${columns.length}, minmax(5.5rem, 1fr))`,
        }}
      >
        {columns.map((column) => (
          <section key={column.key} className="space-y-2">
            <p className="mono-label text-[11px] font-semibold uppercase tracking-[0.12em] text-(--text-muted)">
              {formatColumnLabel(column.key)}
            </p>

            <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
              {column.options.map((option) => {
                const isSelected = selection[column.key] === option.value;

                return (
                  <button
                    key={`${column.key}-${String(option.value)}`}
                    className={`w-full cursor-pointer rounded-xl px-2 py-1.5 text-left text-sm font-semibold transition-colors duration-200 ${
                      isSelected
                        ? "bg-(--surface-main-soft) text-(--text-main)"
                        : "text-(--text-muted) hover:bg-(--surface-main-faint) hover:text-(--text-main)"
                    }`}
                    onClick={() => handleSelect(column.key, option.value)}
                    type="button"
                  >
                    {option.name}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
