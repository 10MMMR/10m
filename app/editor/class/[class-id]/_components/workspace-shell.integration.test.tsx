import { fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceShell } from "./workspace-shell";

jest.mock("./topbar", () => ({
  Topbar: () => <div data-testid="topbar" />,
}));

jest.mock("./chat-pane", () => ({
  ChatPane: () => <div data-testid="chat-pane" />,
}));

jest.mock("./editor-pane", () => ({
  EditorPane: ({
    isDirty,
    note,
    onBodyChange,
    onSave,
    onTitleChange,
  }: {
    isDirty: boolean;
    note: { title: string } | null;
    onBodyChange: (body: string) => void;
    onSave: () => void;
    onTitleChange: (title: string) => void;
  }) => (
    <div>
      <p data-testid="draft-state">{isDirty ? "dirty" : "clean"}</p>
      <p data-testid="draft-title">{note?.title ?? "none"}</p>
      <button onClick={() => onTitleChange("Fresh note")} type="button">
        Update draft title
      </button>
      <button onClick={() => onBodyChange("<p>Fresh body</p>")} type="button">
        Update draft body
      </button>
      <button onClick={onSave} type="button">
        Save draft
      </button>
    </div>
  ),
}));

describe("WorkspaceShell note flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("creates a note from the left pane and updates the draft state", () => {
    render(
      <WorkspaceShell
        classId="cs101-ai"
        requestedClassId="cs101-ai"
        usedFallback={false}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Add item" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "New note" }));

    expect(screen.getByTestId("draft-state")).toHaveTextContent("dirty");
    expect(screen.getByTestId("draft-title")).toHaveTextContent("Untitled note");

    fireEvent.click(screen.getByRole("button", { name: "Update draft title" }));
    fireEvent.click(screen.getByRole("button", { name: "Update draft body" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    expect(screen.getByTestId("draft-state")).toHaveTextContent("clean");
    expect(screen.getByTestId("draft-title")).toHaveTextContent("Fresh note");
    expect(screen.getByRole("button", { name: /Fresh note/ })).toBeInTheDocument();
  });
});
