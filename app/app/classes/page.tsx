"use client";

import { ArrowUpTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  OptionsPopup,
  type OptionsPopupColumn,
  type OptionsPopupSelection,
} from "@/app/app/_components/options-popup";

type AddClassStep = "options" | "manual-entry";
type ScheduleField = "day" | "start-time" | "end-time";
type ActiveSchedulePopup = {
  entryId: string;
  field: ScheduleField;
};
type ScheduleEntry = {
  id: string;
  daySelection: OptionsPopupSelection;
  startTimeSelection: OptionsPopupSelection;
  endTimeSelection: OptionsPopupSelection;
};

const classDayColumns: OptionsPopupColumn[] = [
  {
    key: "day",
    options: [
      { name: "Monday", value: "Monday" },
      { name: "Tuesday", value: "Tuesday" },
      { name: "Wednesday", value: "Wednesday" },
      { name: "Thursday", value: "Thursday" },
      { name: "Friday", value: "Friday" },
      { name: "Saturday", value: "Saturday" },
      { name: "Sunday", value: "Sunday" },
    ],
  },
];

const classTimeColumns: OptionsPopupColumn[] = [
  {
    key: "hour",
    options: Array.from({ length: 12 }, (_, index) => {
      const value = index + 1;
      return {
        name: String(value),
        value,
      };
    }),
  },
  {
    key: "minute",
    options: Array.from({ length: 12 }, (_, index) => {
      const minute = index * 5;
      return {
        name: String(minute).padStart(2, "0"),
        value: minute,
      };
    }),
  },
  {
    key: "period",
    options: [
      { name: "AM", value: "am" },
      { name: "PM", value: "pm" },
    ],
  },
];

const defaultDaySelection: OptionsPopupSelection = {
  day: null,
};

const defaultTimeSelection: OptionsPopupSelection = {
  hour: null,
  minute: null,
  period: null,
};

const createScheduleEntry = (id: string): ScheduleEntry => ({
  id,
  daySelection: { ...defaultDaySelection },
  startTimeSelection: { ...defaultTimeSelection },
  endTimeSelection: { ...defaultTimeSelection },
});

const formatSelectedTime = (selection: OptionsPopupSelection) => {
  const hour = selection.hour;
  const minute = selection.minute;
  const period = selection.period;

  const hourText = typeof hour === "number" ? String(hour).padStart(2, "0") : "--";
  const minuteText = typeof minute === "number" ? String(minute).padStart(2, "0") : "--";
  const periodText = typeof period === "string" ? period.toUpperCase() : "--";

  return `${hourText}: ${minuteText} ${periodText}`;
};

const hasSelectedDay = (selection: OptionsPopupSelection) => typeof selection.day === "string";
const hasSelectedTime = (selection: OptionsPopupSelection) =>
  typeof selection.hour === "number" &&
  typeof selection.minute === "number" &&
  typeof selection.period === "string";

export default function ClassesPage() {
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [addClassStep, setAddClassStep] = useState<AddClassStep>("options");
  const [activeSchedulePopup, setActiveSchedulePopup] = useState<ActiveSchedulePopup | null>(null);
  const [className, setClassName] = useState("");
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([
    createScheduleEntry("schedule-1"),
  ]);
  const nextScheduleId = useRef(2);

  useEffect(() => {
    if (!activeSchedulePopup) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const clickedInsideScheduleSelector = target.closest("[data-schedule-selector='true']");

      if (!clickedInsideScheduleSelector) {
        setActiveSchedulePopup(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [activeSchedulePopup]);

  const openAddClassModal = () => {
    setAddClassStep("options");
    setActiveSchedulePopup(null);
    setIsAddClassModalOpen(true);
  };

  const closeAddClassModal = () => {
    setActiveSchedulePopup(null);
    setIsAddClassModalOpen(false);
  };

  const handleManualEntryClick = () => {
    setAddClassStep("manual-entry");
    setActiveSchedulePopup(null);
  };

  const handleScheduleFieldClick = (entryId: string, field: ScheduleField) => {
    setActiveSchedulePopup((currentPopup) => {
      if (currentPopup?.entryId === entryId && currentPopup.field === field) {
        return null;
      }

      return {
        entryId,
        field,
      };
    });
  };

  const handleDaySelectionChange = (entryId: string, selection: OptionsPopupSelection) => {
    setScheduleEntries((previousEntries) =>
      previousEntries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              daySelection: selection,
            }
          : entry,
      ),
    );
  };

  const handleStartTimeSelectionChange = (entryId: string, selection: OptionsPopupSelection) => {
    setScheduleEntries((previousEntries) =>
      previousEntries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              startTimeSelection: selection,
            }
          : entry,
      ),
    );
  };

  const handleEndTimeSelectionChange = (entryId: string, selection: OptionsPopupSelection) => {
    setScheduleEntries((previousEntries) =>
      previousEntries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              endTimeSelection: selection,
            }
          : entry,
      ),
    );
  };

  const handleAddScheduleEntry = () => {
    const newId = `schedule-${nextScheduleId.current}`;
    nextScheduleId.current += 1;

    setScheduleEntries((previousEntries) => [...previousEntries, createScheduleEntry(newId)]);
  };

  const handleDeleteScheduleEntry = (entryId: string) => {
    if (activeSchedulePopup?.entryId === entryId) {
      setActiveSchedulePopup(null);
    }

    setScheduleEntries((previousEntries) => {
      if (previousEntries.length === 1) {
        return previousEntries;
      }

      return previousEntries.filter((entry) => entry.id !== entryId);
    });
  };

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <>
      <section className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">
              Workspace
            </p>
            <h1 className="display-font mt-2 text-4xl font-bold text-(--text-main)">Classes</h1>
          </div>

          <button
            className="organic-button organic-button-primary min-h-11 cursor-pointer"
            onClick={openAddClassModal}
            type="button"
          >
            Add class
          </button>
        </header>
      </section>

      {isAddClassModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay-scrim) p-0 sm:px-4"
          role="dialog"
        >
          <div className="organic-card h-full w-full overflow-y-auto rounded-none p-6 sm:h-auto sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-[1.8rem] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">
                  Add Class
                </p>
                <h2 className="display-font mt-2 text-2xl font-bold text-(--text-main)">
                  {addClassStep === "options" ? "Choose setup method" : "Manual Class Setup"}
                </h2>
              </div>

              <button
                aria-label="Close add class popup"
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-base) text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main)"
                onClick={closeAddClassModal}
                type="button"
              >
                x
              </button>
            </div>

            {addClassStep === "options" ? (
              <div className="mt-6 space-y-5">
                <button
                  className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-(--border-soft) bg-(--surface-panel) px-5 py-4 text-sm font-semibold text-(--text-main) transition-transform duration-200 hover:-translate-y-px hover:bg-(--surface-main-faint)"
                  type="button"
                >
                  <ArrowUpTrayIcon aria-hidden="true" className="h-5 w-5" />
                  <span>Upload PDF / DOCX syllabus</span>
                </button>

                <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-(--text-muted)">
                  <span className="h-px flex-1 bg-(--border-soft)" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-(--border-soft)" />
                </div>

                <button
                  className="group relative mx-auto block w-fit cursor-pointer text-center text-sm font-semibold text-(--main) transition-colors duration-200 hover:text-(--text-secondary)"
                  onClick={handleManualEntryClick}
                  type="button"
                >
                  <span>Manually enter class information</span>
                  <span className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-(--main) transition-transform duration-200 group-hover:scale-x-100" />
                </button>
              </div>
            ) : (
              <form className="mt-6 space-y-4" onSubmit={handleManualSubmit}>
                <button
                  className="inline-flex cursor-pointer items-center text-sm font-semibold text-(--main) transition-colors duration-200 hover:text-(--text-secondary)"
                  onClick={() => {
                    setAddClassStep("options");
                    setActiveSchedulePopup(null);
                  }}
                  type="button"
                >
                  Back to PDF / DOCX upload
                </button>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-(--text-main)" htmlFor="class-name">
                    Class name
                  </label>
                  <input
                    className="organic-input"
                    id="class-name"
                    name="className"
                    onChange={(event) => setClassName(event.target.value)}
                    placeholder="Example: Biology 101"
                    type="text"
                    value={className}
                  />
                </div>

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="display-font text-xl font-bold text-(--text-main)">Class schedule</h3>
                    <button
                      className="organic-button organic-button-outline min-h-10 px-4 py-2 text-sm"
                      onClick={handleAddScheduleEntry}
                      type="button"
                    >
                      Add day
                    </button>
                  </div>

                  <div className="space-y-3">
                    {scheduleEntries.map((entry, index) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-(--border-soft) bg-(--surface-panel) p-3"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--text-muted)">
                            Schedule {index + 1}
                          </p>
                          <button
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-(--border-soft) text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main) disabled:cursor-not-allowed disabled:opacity-45"
                            disabled={scheduleEntries.length === 1}
                            onClick={() => handleDeleteScheduleEntry(entry.id)}
                            type="button"
                          >
                            <TrashIcon aria-hidden="true" className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="relative" data-schedule-selector="true">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-(--text-muted)">
                              Day
                            </p>
                            <button
                              className="organic-input inline-flex h-12 cursor-pointer items-center justify-between px-4 text-left text-sm font-semibold text-(--text-main)"
                              onClick={() => handleScheduleFieldClick(entry.id, "day")}
                              type="button"
                            >
                              <span
                                className={
                                  hasSelectedDay(entry.daySelection)
                                    ? "text-(--text-main)"
                                    : "text-(--text-muted)"
                                }
                              >
                                {hasSelectedDay(entry.daySelection)
                                  ? entry.daySelection.day
                                  : "Select day"}
                              </span>
                              <ChevronUpDownIcon
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0 text-(--text-muted)"
                              />
                            </button>

                            {activeSchedulePopup?.entryId === entry.id &&
                            activeSchedulePopup.field === "day" ? (
                              <OptionsPopup
                                columns={classDayColumns}
                                onSelectionChange={(selection) =>
                                  handleDaySelectionChange(entry.id, selection)
                                }
                              />
                            ) : null}
                          </div>

                          <div className="relative" data-schedule-selector="true">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-(--text-muted)">
                              Start time
                            </p>
                            <button
                              className="organic-input inline-flex h-12 cursor-pointer items-center justify-between px-4 text-left text-sm font-semibold text-(--text-main)"
                              onClick={() => handleScheduleFieldClick(entry.id, "start-time")}
                              type="button"
                            >
                              <span
                                className={
                                  hasSelectedTime(entry.startTimeSelection)
                                    ? "mono-label text-(--text-main)"
                                    : "mono-label text-(--text-muted)"
                                }
                              >
                                {formatSelectedTime(entry.startTimeSelection)}
                              </span>
                              <ChevronUpDownIcon
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0 text-(--text-muted)"
                              />
                            </button>

                            {activeSchedulePopup?.entryId === entry.id &&
                            activeSchedulePopup.field === "start-time" ? (
                              <OptionsPopup
                                columns={classTimeColumns}
                                onSelectionChange={(selection) =>
                                  handleStartTimeSelectionChange(entry.id, selection)
                                }
                              />
                            ) : null}
                          </div>

                          <div className="relative" data-schedule-selector="true">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-(--text-muted)">
                              End time
                            </p>
                            <button
                              className="organic-input inline-flex h-12 cursor-pointer items-center justify-between px-4 text-left text-sm font-semibold text-(--text-main)"
                              onClick={() => handleScheduleFieldClick(entry.id, "end-time")}
                              type="button"
                            >
                              <span
                                className={
                                  hasSelectedTime(entry.endTimeSelection)
                                    ? "mono-label text-(--text-main)"
                                    : "mono-label text-(--text-muted)"
                                }
                              >
                                {formatSelectedTime(entry.endTimeSelection)}
                              </span>
                              <ChevronUpDownIcon
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0 text-(--text-muted)"
                              />
                            </button>

                            {activeSchedulePopup?.entryId === entry.id &&
                            activeSchedulePopup.field === "end-time" ? (
                              <OptionsPopup
                                columns={classTimeColumns}
                                onSelectionChange={(selection) =>
                                  handleEndTimeSelectionChange(entry.id, selection)
                                }
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <button className="organic-button organic-button-primary min-h-11" type="submit">
                  Save class name
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
