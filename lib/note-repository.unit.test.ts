import {
  createDraftNote,
  LocalStorageNoteRepository,
  type Note,
} from "./note-repository";

function buildNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id ?? "note-1",
    title: overrides.title ?? "Default title",
    body: overrides.body ?? "<p>Default body</p>",
    createdAt: overrides.createdAt ?? "2026-01-01T12:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T12:00:00.000Z",
    class: overrides.class ?? "cs101-ai",
  };
}

describe("note-repository", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  test("createDraftNote returns expected defaults", () => {
    const draft = createDraftNote("cs101-ai");

    expect(draft.id).toBe("test-uuid");
    expect(draft.title).toBe("Untitled note");
    expect(draft.body).toBe("<p></p>");
    expect(draft.class).toBe("cs101-ai");
    expect(Date.parse(draft.createdAt)).not.toBeNaN();
    expect(draft.updatedAt).toBe(draft.createdAt);
  });

  test("save upserts notes with the same id and class", () => {
    const repository = new LocalStorageNoteRepository();
    const first = buildNote();
    const updated = buildNote({
      title: "Updated title",
      updatedAt: "2026-01-01T13:00:00.000Z",
    });

    repository.save(first);
    repository.save(updated);

    const notes = repository.listByClass("cs101-ai");

    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe("Updated title");
  });

  test("listByClass returns notes sorted by updatedAt descending", () => {
    const repository = new LocalStorageNoteRepository();

    repository.save(
      buildNote({
        id: "older",
        title: "Older note",
        updatedAt: "2026-01-01T10:00:00.000Z",
      }),
    );
    repository.save(
      buildNote({
        id: "newer",
        title: "Newer note",
        updatedAt: "2026-01-01T11:00:00.000Z",
      }),
    );

    const notes = repository.listByClass("cs101-ai");
    expect(notes.map((note) => note.id)).toEqual(["newer", "older"]);
  });

  test("deleteById removes the requested note", () => {
    const repository = new LocalStorageNoteRepository();

    repository.save(buildNote({ id: "note-a", title: "A" }));
    repository.save(buildNote({ id: "note-b", title: "B" }));

    repository.deleteById("cs101-ai", "note-a");

    const notes = repository.listByClass("cs101-ai");
    expect(notes).toHaveLength(1);
    expect(notes[0].id).toBe("note-b");
  });
});
