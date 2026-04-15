"use client";

import {
  ArrowUpTrayIcon,
  DocumentTextIcon,
  RectangleStackIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/app/_global/authentication/auth-context";
import { supabase } from "@/app/_global/authentication/supabaseClient";

type AddClassStep = "options" | "manual-entry";
type SemesterSeason = "Spring" | "Summer" | "Fall";
type SemesterTerm = {
  season: SemesterSeason;
  year: number;
};
type SemesterOption = {
  label: string;
  value: string;
};
type ClassListItem = {
  id: string;
  name: string | null;
  semester: string | null;
};

const toSemesterLabel = (term: SemesterTerm) => `${term.season} ${term.year}`;

const getCurrentSemester = (date: Date): SemesterTerm => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  if (month >= 1 && month <= 5) {
    return { season: "Spring", year };
  }

  if (month >= 6 && month <= 7) {
    return { season: "Summer", year };
  }

  return { season: "Fall", year };
};

const getSemesterOptions = (date: Date): SemesterOption[] => {
  const current = getCurrentSemester(date);
  let second: SemesterTerm;
  let third: SemesterTerm;

  if (current.season === "Spring") {
    second = { season: "Fall", year: current.year };
    third = { season: "Summer", year: current.year };
  } else if (current.season === "Fall") {
    second = { season: "Spring", year: current.year + 1 };
    third = { season: "Summer", year: current.year + 1 };
  } else {
    second = { season: "Fall", year: current.year };
    third = { season: "Summer", year: current.year + 1 };
  }

  const terms = [current, second, third];

  return terms.map((term) => {
    const label = toSemesterLabel(term);
    return {
      label,
      value: label,
    };
  });
};

export default function ClassesPage() {
  const { user } = useAuth();
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [addClassStep, setAddClassStep] = useState<AddClassStep>("options");
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [className, setClassName] = useState("");
  const [professorEmail, setProfessorEmail] = useState("");
  const [isSubmittingClass, setIsSubmittingClass] = useState(false);
  const [submitClassError, setSubmitClassError] = useState<string | null>(null);
  const semesterOptions = useMemo(() => getSemesterOptions(new Date()), []);
  const [selectedSemester, setSelectedSemester] = useState<string>(
    semesterOptions[0]?.value ?? "",
  );

  const loadClasses = useCallback(async () => {
    if (!supabase) {
      setClasses([]);
      setClassesError("Supabase is unavailable right now.");
      setIsLoadingClasses(false);
      return;
    }

    if (!user) {
      setClasses([]);
      setClassesError(null);
      setIsLoadingClasses(false);
      return;
    }

    setIsLoadingClasses(true);
    setClassesError(null);

    const { data, error } = await supabase
      .from("classes")
      .select("id, name, semester")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      setClasses([]);
      setClassesError(error.message || "Could not load classes.");
      setIsLoadingClasses(false);
      return;
    }

    setClasses(data ?? []);
    setIsLoadingClasses(false);
  }, [user]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const openAddClassModal = () => {
    setSubmitClassError(null);
    setAddClassStep("options");
    setIsAddClassModalOpen(true);
  };

  const closeAddClassModal = () => {
    setSubmitClassError(null);
    setIsAddClassModalOpen(false);
  };

  const handleManualEntryClick = () => {
    setAddClassStep("manual-entry");
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmittingClass) {
      return;
    }

    const trimmedClassName = className.trim();

    if (!trimmedClassName) {
      setSubmitClassError("Please add a class name.");
      return;
    }

    if (!user) {
      setSubmitClassError("Please sign in again before adding a class.");
      return;
    }

    if (!supabase) {
      setSubmitClassError(
        "Supabase is unavailable right now. Please try again.",
      );
      return;
    }

    setSubmitClassError(null);
    setIsSubmittingClass(true);
    try {
      const { error } = await supabase.from("classes").insert({
        name: trimmedClassName,
        professor_email: professorEmail.trim(),
        semester: selectedSemester,
      });

      if (error) {
        setSubmitClassError(
          error.message || "Could not add class. Please try again.",
        );
        return;
      }

      setClassName("");
      setProfessorEmail("");
      setSelectedSemester(semesterOptions[0]?.value ?? "");
      closeAddClassModal();
      void loadClasses();
    } catch {
      setSubmitClassError("Could not add class. Please try again.");
    } finally {
      setIsSubmittingClass(false);
    }
  };

  return (
    <>
      <section className='space-y-6'>
        <header className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <p className='mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)'>
              Workspace
            </p>
            <h1 className='display-font mt-2 text-4xl font-bold text-(--text-main)'>
              Classes
            </h1>
          </div>

          <button
            className='organic-button organic-button-primary min-h-11 cursor-pointer'
            onClick={openAddClassModal}
            type='button'
          >
            Add class
          </button>
        </header>

        {isLoadingClasses ? (
          <article className='organic-card rounded-[1.8rem] p-6 sm:p-8'>
            <div className='flex items-center gap-3'>
              <div
                aria-hidden='true'
                className='h-6 w-6 animate-spin rounded-full border-2 border-(--border-soft) border-t-(--main)'
              />
              <p className='text-sm font-semibold text-(--text-muted)'>
                Loading your classes...
              </p>
            </div>
          </article>
        ) : classes.length === 0 ? (
          <article className='organic-card rounded-[1.8rem] p-6 sm:p-8'>
            <h2 className='display-font text-2xl font-bold text-(--text-main)'>
              No classes yet
            </h2>
            <p className='mt-3 max-w-2xl text-(--text-muted)'>
              Add your first class to start organizing your semester.
            </p>
            {classesError ? (
              <p className='mt-3 text-sm font-semibold text-(--destructive)'>
                {classesError}
              </p>
            ) : null}
            <button
              className='organic-button organic-button-primary mt-5 min-h-11 cursor-pointer'
              onClick={openAddClassModal}
              type='button'
            >
              Add class
            </button>
          </article>
        ) : (
          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
            {classes.map((classItem) => (
              <Link
                className='organic-card block cursor-pointer rounded-[1.5rem] p-5 transition-all duration-200 hover:-translate-y-px hover:border-(--border-strong) hover:shadow-(--shadow-soft)'
                href={`/editor/class/${encodeURIComponent(classItem.id)}`}
                key={classItem.id}
              >
                <h2 className='text-lg font-semibold text-(--text-main)'>
                  {classItem.name?.trim() || "Untitled class"}
                </h2>
                <p className='mt-3 text-sm font-semibold text-(--text-secondary)'>
                  {classItem.semester?.trim() || "No semester selected"}
                </p>
                <div className='mt-4 flex items-center gap-6 text-sm font-semibold text-(--text-muted)'>
                  <div className='inline-flex items-center gap-2'>
                    <RectangleStackIcon
                      aria-hidden='true'
                      className='h-4 w-4'
                    />
                    <span>0 units</span>
                  </div>
                  <div className='inline-flex items-center gap-2'>
                    <DocumentTextIcon aria-hidden='true' className='h-4 w-4' />
                    <span>0 materials</span>
                  </div>
                </div>
                <div className='mt-4 border-t border-(--border-soft) pt-3 text-sm text-(--text-muted)'>
                  <span>Last Activity: </span>
                  <span className='font-semibold text-(--text-main)'>
                    Today
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {isAddClassModalOpen ? (
        <div
          aria-modal='true'
          className='fixed inset-0 z-50 flex items-center justify-center bg-(--overlay-scrim) p-0 sm:px-4'
          role='dialog'
        >
          <div className='organic-card h-full w-full overflow-y-auto rounded-none p-6 sm:h-auto sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-[1.8rem] sm:p-7'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <p className='mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)'>
                  Add Class
                </p>
                <h2 className='display-font mt-2 text-2xl font-bold text-(--text-main)'>
                  {addClassStep === "options"
                    ? "Choose setup method"
                    : "Manual Class Setup"}
                </h2>
              </div>

              <button
                aria-label='Close add class popup'
                className='inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-base) text-(--text-muted) transition-colors duration-200 hover:bg-(--surface-main-faint) hover:text-(--text-main)'
                onClick={closeAddClassModal}
                type='button'
              >
                x
              </button>
            </div>

            {addClassStep === "options" ? (
              <div className='mt-6 space-y-5'>
                <button
                  className='flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-(--border-soft) bg-(--surface-panel) px-5 py-4 text-sm font-semibold text-(--text-main) transition-transform duration-200 hover:-translate-y-px hover:bg-(--surface-main-faint)'
                  type='button'
                >
                  <ArrowUpTrayIcon aria-hidden='true' className='h-5 w-5' />
                  <span>Upload PDF / DOCX syllabus</span>
                </button>

                <div className='flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-(--text-muted)'>
                  <span className='h-px flex-1 bg-(--border-soft)' />
                  <span>or</span>
                  <span className='h-px flex-1 bg-(--border-soft)' />
                </div>

                <button
                  className='group relative mx-auto block w-fit cursor-pointer text-center text-sm font-semibold text-(--main) transition-colors duration-200 hover:text-(--text-secondary)'
                  onClick={handleManualEntryClick}
                  type='button'
                >
                  <span>Manually enter class information</span>
                  <span className='absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-(--main) transition-transform duration-200 group-hover:scale-x-100' />
                </button>
              </div>
            ) : (
              <form className='mt-6 space-y-4' onSubmit={handleManualSubmit}>
                <button
                  className='inline-flex cursor-pointer items-center text-sm font-semibold text-(--main) transition-colors duration-200 hover:text-(--text-secondary)'
                  onClick={() => {
                    setAddClassStep("options");
                  }}
                  type='button'
                >
                  Back to PDF / DOCX upload
                </button>

                <div className='space-y-2'>
                  <label
                    className='text-sm font-semibold text-(--text-main)'
                    htmlFor='class-name'
                  >
                    Class name
                  </label>
                  <input
                    className='organic-input'
                    id='class-name'
                    name='className'
                    onChange={(event) => {
                      setClassName(event.target.value);
                      if (submitClassError) {
                        setSubmitClassError(null);
                      }
                    }}
                    placeholder='Example: Biology 101'
                    type='text'
                    value={className}
                  />
                </div>

                <div className='space-y-2'>
                  <label
                    className='text-sm font-semibold text-(--text-main)'
                    htmlFor='professor-email'
                  >
                    Professor contact email
                  </label>
                  <input
                    className='organic-input'
                    id='professor-email'
                    name='professorEmail'
                    onChange={(event) => {
                      setProfessorEmail(event.target.value);
                      if (submitClassError) {
                        setSubmitClassError(null);
                      }
                    }}
                    placeholder='professor@university.edu'
                    type='email'
                    value={professorEmail}
                  />
                </div>

                <section className='space-y-2'>
                  <p className='text-sm font-semibold text-(--text-main)'>
                    Semester
                  </p>
                  <div className='space-y-2'>
                    {semesterOptions.map((option) => {
                      const isSelected = selectedSemester === option.value;

                      return (
                        <button
                          key={option.value}
                          aria-pressed={isSelected}
                          className={`flex w-full cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors duration-200 ${
                            isSelected
                              ? "border-(--border-strong) bg-(--surface-main-soft) text-(--text-main)"
                              : "border-(--border-soft) bg-(--surface-panel) text-(--text-muted) hover:bg-(--surface-main-faint) hover:text-(--text-main)"
                          }`}
                          onClick={() => {
                            setSelectedSemester(option.value);
                            if (submitClassError) {
                              setSubmitClassError(null);
                            }
                          }}
                          type='button'
                        >
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Class schedule is temporarily disabled to reduce friction when adding classes. */}

                {submitClassError ? (
                  <p className='text-sm font-semibold text-(--destructive)'>
                    {submitClassError}
                  </p>
                ) : null}

                <button
                  className='organic-button organic-button-primary min-h-11 disabled:cursor-not-allowed disabled:opacity-70'
                  disabled={isSubmittingClass}
                  type='submit'
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
