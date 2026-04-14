"use client";

import { ArrowUpTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/_global/authentication/auth-context";
import { supabase } from "@/app/_global/authentication/supabaseClient";
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
type ScheduleEntryError = {
  day?: string;
  startTime?: string;
  endTime?: string;
};
type PreparedSchedule = {
  dayOfWeek: number;
  endTime: string;
  startTime: string;
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
const dayToDayOfWeek: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};
const missingColumnPattern = /could not find.*column|column .* does not exist/i;

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
const isMissingColumnError = (message: string | undefined) =>
  missingColumnPattern.test(message ?? "");

const toTwentyFourHour = (hour: number, period: string) => {
  if (period === "am") {
    return hour % 12;
  }

  return hour % 12 === 0 ? 12 : hour + 12;
};

const toDateForDayAndTime = (dayOfWeek: number, hour24: number, minute: number) => {
  const next = new Date();
  const targetDay = dayOfWeek % 7;
  const delta = (targetDay - next.getDay() + 7) % 7;

  next.setDate(next.getDate() + delta);
  next.setHours(hour24, minute, 0, 0);
  return next;
};

export default function ClassesPage() {
  const { user } = useAuth();
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [addClassStep, setAddClassStep] = useState<AddClassStep>("options");
  const [activeSchedulePopup, setActiveSchedulePopup] = useState<ActiveSchedulePopup | null>(null);
  const [className, setClassName] = useState("");
  const [classNameError, setClassNameError] = useState<string | null>(null);
  const [scheduleSectionError, setScheduleSectionError] = useState<string | null>(null);
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, ScheduleEntryError>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmittingClass, setIsSubmittingClass] = useState(false);
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
    setSubmitError(null);
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
    setScheduleSectionError(null);
    setSubmitError(null);
    setScheduleErrors((previousErrors) => {
      const entryErrors = previousErrors[entryId];
      if (!entryErrors?.day) {
        return previousErrors;
      }

      const nextEntryErrors = { ...entryErrors };
      delete nextEntryErrors.day;

      const nextErrors = { ...previousErrors };
      if (Object.keys(nextEntryErrors).length === 0) {
        delete nextErrors[entryId];
      } else {
        nextErrors[entryId] = nextEntryErrors;
      }

      return nextErrors;
    });
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
    setScheduleSectionError(null);
    setSubmitError(null);
    setScheduleErrors((previousErrors) => {
      const entryErrors = previousErrors[entryId];
      if (!entryErrors?.startTime) {
        return previousErrors;
      }

      const nextEntryErrors = { ...entryErrors };
      delete nextEntryErrors.startTime;

      const nextErrors = { ...previousErrors };
      if (Object.keys(nextEntryErrors).length === 0) {
        delete nextErrors[entryId];
      } else {
        nextErrors[entryId] = nextEntryErrors;
      }

      return nextErrors;
    });
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
    setScheduleSectionError(null);
    setSubmitError(null);
    setScheduleErrors((previousErrors) => {
      const entryErrors = previousErrors[entryId];
      if (!entryErrors?.endTime) {
        return previousErrors;
      }

      const nextEntryErrors = { ...entryErrors };
      delete nextEntryErrors.endTime;

      const nextErrors = { ...previousErrors };
      if (Object.keys(nextEntryErrors).length === 0) {
        delete nextErrors[entryId];
      } else {
        nextErrors[entryId] = nextEntryErrors;
      }

      return nextErrors;
    });
  };

  const handleAddScheduleEntry = () => {
    const newId = `schedule-${nextScheduleId.current}`;
    nextScheduleId.current += 1;

    setScheduleEntries((previousEntries) => [...previousEntries, createScheduleEntry(newId)]);
    setScheduleSectionError(null);
    setSubmitError(null);
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
    setScheduleErrors((previousErrors) => {
      if (!previousErrors[entryId]) {
        return previousErrors;
      }

      const nextErrors = { ...previousErrors };
      delete nextErrors[entryId];
      return nextErrors;
    });
    setSubmitError(null);
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmittingClass) {
      return;
    }

    const trimmedClassName = className.trim();
    const nextScheduleErrors: Record<string, ScheduleEntryError> = {};
    let hasValidationError = false;

    if (trimmedClassName.length === 0) {
      setClassNameError("Class name is required.");
      hasValidationError = true;
    } else {
      setClassNameError(null);
    }

    if (scheduleEntries.length === 0) {
      setScheduleSectionError("Add at least one class schedule.");
      hasValidationError = true;
    } else {
      setScheduleSectionError(null);
    }

    scheduleEntries.forEach((entry) => {
      const entryErrors: ScheduleEntryError = {};

      if (!hasSelectedDay(entry.daySelection)) {
        entryErrors.day = "Select a day of the week.";
      }

      if (!hasSelectedTime(entry.startTimeSelection)) {
        entryErrors.startTime = "Complete the start time.";
      }

      if (!hasSelectedTime(entry.endTimeSelection)) {
        entryErrors.endTime = "Complete the end time.";
      }

      if (Object.keys(entryErrors).length > 0) {
        nextScheduleErrors[entry.id] = entryErrors;
        hasValidationError = true;
      }
    });

    setScheduleErrors(nextScheduleErrors);

    if (hasValidationError) {
      return;
    }

    if (!user?.id || !supabase) {
      setSubmitError("Could not connect to class storage. Please try again.");
      return;
    }

    const preparedSchedule: PreparedSchedule[] = [];

    for (const entry of scheduleEntries) {
      const selectedDay = entry.daySelection.day;
      const startHour = entry.startTimeSelection.hour;
      const startMinute = entry.startTimeSelection.minute;
      const startPeriod = entry.startTimeSelection.period;
      const endHour = entry.endTimeSelection.hour;
      const endMinute = entry.endTimeSelection.minute;
      const endPeriod = entry.endTimeSelection.period;

      if (
        typeof selectedDay !== "string" ||
        typeof startHour !== "number" ||
        typeof startMinute !== "number" ||
        typeof startPeriod !== "string" ||
        typeof endHour !== "number" ||
        typeof endMinute !== "number" ||
        typeof endPeriod !== "string"
      ) {
        setSubmitError("One or more schedule entries are invalid.");
        return;
      }

      const dayOfWeek = dayToDayOfWeek[selectedDay];
      if (!dayOfWeek) {
        setSubmitError("One or more schedule days are invalid.");
        return;
      }

      const startDate = toDateForDayAndTime(
        dayOfWeek,
        toTwentyFourHour(startHour, startPeriod),
        startMinute,
      );
      const endDate = toDateForDayAndTime(
        dayOfWeek,
        toTwentyFourHour(endHour, endPeriod),
        endMinute,
      );

      if (endDate <= startDate) {
        endDate.setDate(endDate.getDate() + 1);
      }

      preparedSchedule.push({
        dayOfWeek,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      });
    }

    setSubmitError(null);
    setIsSubmittingClass(true);

    try {
      const classPayloadCandidates: Array<Record<string, string>> = [
        { name: trimmedClassName, user_id: user.id },
        { name: trimmedClassName, userId: user.id },
        { name: trimmedClassName },
      ];

      let classId: string | number | null = null;
      let classInsertErrorMessage: string | null = null;

      for (const payload of classPayloadCandidates) {
        const { data, error } = await supabase
          .from("classes")
          .insert(payload)
          .select("id")
          .single();

        if (!error && data?.id !== undefined && data?.id !== null) {
          classId = data.id;
          break;
        }

        if (error && isMissingColumnError(error.message)) {
          classInsertErrorMessage = error.message;
          continue;
        }

        classInsertErrorMessage = error?.message ?? "Unable to create class.";
        break;
      }

      if (classId === null) {
        setSubmitError(classInsertErrorMessage ?? "Unable to create class.");
        return;
      }

      const schedulePayloadCandidates = [
        preparedSchedule.map((row) => ({
          class_id: classId,
          user_id: user.id,
          start_time: row.startTime,
          end_time: row.endTime,
          day_of_week: row.dayOfWeek,
        })),
        preparedSchedule.map((row) => ({
          class_id: classId,
          start_time: row.startTime,
          end_time: row.endTime,
          day_of_week: row.dayOfWeek,
        })),
        preparedSchedule.map((row) => ({
          classId,
          userId: user.id,
          startTime: row.startTime,
          endTime: row.endTime,
          dayOfWeek: row.dayOfWeek,
        })),
        preparedSchedule.map((row) => ({
          classId,
          startTime: row.startTime,
          endTime: row.endTime,
          dayOfWeek: row.dayOfWeek,
        })),
      ];

      let scheduleInsertErrorMessage: string | null = null;
      let didInsertSchedule = false;

      for (const payload of schedulePayloadCandidates) {
        const { error } = await supabase.from("class_schedule").insert(payload);

        if (!error) {
          didInsertSchedule = true;
          break;
        }

        if (isMissingColumnError(error.message)) {
          scheduleInsertErrorMessage = error.message;
          continue;
        }

        scheduleInsertErrorMessage = error.message ?? "Unable to create class schedule.";
        break;
      }

      if (!didInsertSchedule) {
        setSubmitError(scheduleInsertErrorMessage ?? "Unable to create class schedule.");
        return;
      }

      setClassName("");
      setClassNameError(null);
      setScheduleSectionError(null);
      setScheduleErrors({});
      setSubmitError(null);
      setScheduleEntries([createScheduleEntry("schedule-1")]);
      nextScheduleId.current = 2;
      setActiveSchedulePopup(null);
      setAddClassStep("options");
      setIsAddClassModalOpen(false);
    } catch {
      setSubmitError("Unable to create class right now. Please try again.");
    } finally {
      setIsSubmittingClass(false);
    }
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
          <div className="organic-card h-full w-full overflow-y-auto rounded-none p-6 sm:h-auto sm:max-h-[90dvh] sm:max-w-5xl sm:rounded-[1.8rem] sm:p-7">
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
                    setSubmitError(null);
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
                    className={`organic-input ${classNameError ? "border-(--destructive)" : ""}`}
                    id="class-name"
                    name="className"
                    onChange={(event) => {
                      setClassName(event.target.value);
                      if (classNameError) {
                        setClassNameError(null);
                      }
                      setSubmitError(null);
                    }}
                    placeholder="Example: Biology 101"
                    type="text"
                    value={className}
                  />
                  {classNameError ? <p className="text-sm text-(--destructive)">{classNameError}</p> : null}
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
                              className={`organic-input inline-flex h-12 cursor-pointer items-center justify-between px-4 text-left text-sm font-semibold text-(--text-main) ${
                                scheduleErrors[entry.id]?.day ? "border-(--destructive)" : ""
                              }`}
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
                                selectedValues={entry.daySelection}
                              />
                            ) : null}
                            {scheduleErrors[entry.id]?.day ? (
                              <p className="mt-2 text-sm text-(--destructive)">
                                {scheduleErrors[entry.id]?.day}
                              </p>
                            ) : null}
                          </div>

                          <div className="relative" data-schedule-selector="true">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-(--text-muted)">
                              Start time
                            </p>
                            <button
                              className={`organic-input inline-flex h-12 cursor-pointer items-center justify-between px-4 text-left text-sm font-semibold text-(--text-main) ${
                                scheduleErrors[entry.id]?.startTime ? "border-(--destructive)" : ""
                              }`}
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
                                selectedValues={entry.startTimeSelection}
                              />
                            ) : null}
                            {scheduleErrors[entry.id]?.startTime ? (
                              <p className="mt-2 text-sm text-(--destructive)">
                                {scheduleErrors[entry.id]?.startTime}
                              </p>
                            ) : null}
                          </div>

                          <div className="relative" data-schedule-selector="true">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-(--text-muted)">
                              End time
                            </p>
                            <button
                              className={`organic-input inline-flex h-12 cursor-pointer items-center justify-between px-4 text-left text-sm font-semibold text-(--text-main) ${
                                scheduleErrors[entry.id]?.endTime ? "border-(--destructive)" : ""
                              }`}
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
                                align="right"
                                columns={classTimeColumns}
                                onSelectionChange={(selection) =>
                                  handleEndTimeSelectionChange(entry.id, selection)
                                }
                                selectedValues={entry.endTimeSelection}
                              />
                            ) : null}
                            {scheduleErrors[entry.id]?.endTime ? (
                              <p className="mt-2 text-sm text-(--destructive)">
                                {scheduleErrors[entry.id]?.endTime}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {scheduleSectionError ? (
                    <p className="text-sm text-(--destructive)">{scheduleSectionError}</p>
                  ) : null}
                </section>

                {submitError ? <p className="text-sm text-(--destructive)">{submitError}</p> : null}

                <button
                  className="organic-button organic-button-primary min-h-11 disabled:pointer-events-none disabled:opacity-60"
                  disabled={isSubmittingClass}
                  type="submit"
                >
                  {isSubmittingClass ? "Adding class..." : "Add class"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
