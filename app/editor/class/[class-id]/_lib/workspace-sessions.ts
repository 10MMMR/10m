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
  "biol-101": [
    {
      cards: [
        {
          answer:
            "The cell membrane is a selectively permeable phospholipid bilayer with embedded proteins that controls transport, signaling, and cellular homeostasis.",
          id: "biol-101-fc-1",
          question: "What is the structure and primary function of the cell membrane?",
        },
        {
          answer:
            "Mitosis produces two genetically identical daughter cells (growth/repair), while meiosis produces four genetically unique haploid gametes (sexual reproduction).",
          id: "biol-101-fc-2",
          question: "How do mitosis and meiosis differ in outcome and biological role?",
        },
        {
          answer:
            "In cellular respiration, glycolysis occurs in the cytoplasm, while the Krebs cycle and electron transport chain occur in mitochondria to generate ATP.",
          id: "biol-101-fc-3",
          question: "Where do the major stages of cellular respiration occur?",
        },
        {
          answer:
            "Enzyme activity generally increases with temperature up to an optimal point, then drops as enzymes denature; pH also affects active-site shape and reaction rate.",
          id: "biol-101-fc-4",
          question: "How do temperature and pH influence enzyme activity?",
        },
      ],
      createdAt: "2026-04-11T00:00:00.000Z",
      id: "mock-session-biol-101-flashcards",
      kind: "flashcard",
      noteTitles: ["Unit 2: Cells and Energy"],
      pdfTitles: ["BIOL-101 Lecture 2.pdf"],
      title: "BIOL-101 Core Concepts Flashcards",
      unitTitles: ["Unit 2: Cells and Energy"],
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
