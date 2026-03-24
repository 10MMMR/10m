export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  class: string;
};

export interface NoteRepository {
  listByClass(classId: string): Note[];
  getById(classId: string, noteId: string): Note | null;
  save(note: Note): void;
  deleteById(classId: string, noteId: string): void;
}

const STORAGE_KEY = "10m.notes.v1";

function isNote(value: unknown): value is Note {
  if (!value || typeof value !== "object") {
    return false;
  }

  const note = value as Record<string, unknown>;

  return (
    typeof note.id === "string" &&
    typeof note.title === "string" &&
    typeof note.body === "string" &&
    typeof note.createdAt === "string" &&
    typeof note.updatedAt === "string" &&
    typeof note.class === "string"
  );
}

function sortByUpdatedAt(notes: Note[]): Note[] {
  return [...notes].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  );
}

export class LocalStorageNoteRepository implements NoteRepository {
  private readAll(): Note[] {
    if (typeof window === "undefined") {
      return [];
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(isNote);
    } catch {
      return [];
    }
  }

  private writeAll(notes: Note[]) {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  listByClass(classId: string): Note[] {
    const notes = this.readAll().filter((note) => note.class === classId);
    return sortByUpdatedAt(notes);
  }

  getById(classId: string, noteId: string): Note | null {
    const note = this.readAll().find(
      (item) => item.class === classId && item.id === noteId,
    );

    return note ?? null;
  }

  save(note: Note): void {
    const notes = this.readAll();
    const index = notes.findIndex(
      (item) => item.class === note.class && item.id === note.id,
    );

    if (index >= 0) {
      notes[index] = note;
    } else {
      notes.push(note);
    }

    this.writeAll(notes);
  }

  deleteById(classId: string, noteId: string): void {
    const notes = this.readAll().filter(
      (note) => !(note.class === classId && note.id === noteId),
    );

    this.writeAll(notes);
  }
}

export function createDraftNote(classId: string): Note {
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: "Untitled note",
    body: "<p></p>",
    createdAt: timestamp,
    updatedAt: timestamp,
    class: classId,
  };
}

export function cloneNote(note: Note): Note {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    class: note.class,
  };
}
