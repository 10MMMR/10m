import {
  getMockFlashcardSessions,
  toEditorNoteWorkspaceSession,
} from "./workspace-sessions";

describe("workspace session helpers", () => {
  test("toEditorNoteWorkspaceSession adds the editor-note kind while preserving note session fields", () => {
    const mapped = toEditorNoteWorkspaceSession({
      classId: "cs101-ai",
      createdAt: "2026-04-11T00:00:00.000Z",
      id: "session-1",
      noteNodeId: "note-node-1",
      noteTitles: ["Lecture 1"],
      pdfTitles: ["lecture.pdf"],
      title: "Session 1",
      unitTitles: ["Unit 1"],
      updatedAt: "2026-04-11T00:10:00.000Z",
    });

    expect(mapped).toEqual({
      classId: "cs101-ai",
      createdAt: "2026-04-11T00:00:00.000Z",
      id: "session-1",
      kind: "editor-note",
      noteNodeId: "note-node-1",
      noteTitles: ["Lecture 1"],
      pdfTitles: ["lecture.pdf"],
      title: "Session 1",
      unitTitles: ["Unit 1"],
      updatedAt: "2026-04-11T00:10:00.000Z",
    });
  });

  test("getMockFlashcardSessions returns seeded flashcard sessions for supported classes", () => {
    const sessions = getMockFlashcardSessions("cs101-ai");

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: "mock-session-cs101-ai-flashcards",
      kind: "flashcard",
      title: "AI Fundamentals Flashcards",
    });
    expect(sessions[0].cards).toHaveLength(3);
  });

  test("getMockFlashcardSessions returns an empty list for classes without mock data", () => {
    expect(getMockFlashcardSessions("math201")).toEqual([]);
  });
});
