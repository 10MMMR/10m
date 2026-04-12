import type { NoteSession } from "@/lib/supabase-note-session-repository";

export type Flashcard = {
  answer: string;
  id: string;
  question: string;
};

export type FlashcardSession = {
  cards: Flashcard[];
  createdAt: string;
  id: string;
  kind: "flashcard";
  noteTitles: string[];
  pdfTitles: string[];
  title: string;
  unitTitles: string[];
  updatedAt: string;
};

export type EditorNoteSession = NoteSession & {
  kind: "editor-note";
};

export type WorkspaceSession = EditorNoteSession | FlashcardSession;

const MOCK_FLASHCARD_SESSION_BY_CLASS_ID: Record<string, FlashcardSession[]> = {
  "cs101-ai": [
    {
      cards: [
        {
          answer:
            "Turing proposed the Imitation Game as a behavioral test: if a machine's responses are indistinguishable from a human's in conversation, it demonstrates intelligent behavior.",
          id: "cs101-ai-fc-1",
          question: "What is the core idea behind the Turing Test?",
        },
        {
          answer:
            "A rational agent chooses actions that maximize expected performance based on what it perceives and what it knows about the environment.",
          id: "cs101-ai-fc-2",
          question: "How is a rational agent defined in AI?",
        },
        {
          answer:
            "A* combines actual path cost g(n) with heuristic estimate h(n) into f(n) = g(n) + h(n), allowing it to find optimal paths with informed search.",
          id: "cs101-ai-fc-3",
          question: "Why is A* search often preferred over uninformed search?",
        },
      ],
      createdAt: "2026-04-11T00:00:00.000Z",
      id: "mock-session-cs101-ai-flashcards",
      kind: "flashcard",
      noteTitles: ["Unit 1: Fundamentals"],
      pdfTitles: ["Lecture Notes.pdf"],
      title: "AI Fundamentals Flashcards",
      unitTitles: ["Unit 1: AI Fundamentals"],
      updatedAt: "2026-04-11T00:00:00.000Z",
    },
  ],
};

export function toEditorNoteWorkspaceSession(
  session: NoteSession,
): EditorNoteSession {
  return {
    ...session,
    kind: "editor-note",
  };
}

export function getMockFlashcardSessions(classId: string): FlashcardSession[] {
  return MOCK_FLASHCARD_SESSION_BY_CLASS_ID[classId] ?? [];
}
