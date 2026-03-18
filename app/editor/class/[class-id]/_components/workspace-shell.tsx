"use client";

import { useEffect, useState } from "react";
import { ChatPane } from "./chat-pane";
import { EditorPane } from "./editor-pane";
import { LeftPane } from "./left-pane";
import { Topbar } from "./topbar";
import type { WorkspaceSeed } from "../_lib/workspace-data";

type WorkspaceShellProps = {
  classId: string;
  requestedClassId: string;
  usedFallback: boolean;
  workspace: WorkspaceSeed;
};

export function WorkspaceShell({
  classId,
  requestedClassId,
  usedFallback,
  workspace,
}: WorkspaceShellProps) {
  const [lockIn, setLockIn] = useState(false);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)");

    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setLockIn(false);
      }
    };

    mobileQuery.addEventListener("change", handleViewportChange);
    return () => mobileQuery.removeEventListener("change", handleViewportChange);
  }, []);

  return (
    <main className="workspace-shell flex h-screen flex-col overflow-hidden">
      <Topbar
        classId={classId}
        requestedClassId={requestedClassId}
        usedFallback={usedFallback}
        workspaceName={workspace.workspaceName}
        classLabel={workspace.classLabel}
        lockIn={lockIn}
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <LeftPane
          key={`left-${classId}`}
          locked={lockIn}
          explorerItems={workspace.explorerItems}
          sessions={workspace.sessions}
        />
        <EditorPane
          lockIn={lockIn}
          onToggleLockIn={() => setLockIn((current) => !current)}
          unitTitle={workspace.unitTitle}
          unitDescription={workspace.unitDescription}
          sectionTitle={workspace.sectionTitle}
          sectionBody={workspace.sectionBody}
          tableHeaders={workspace.tableHeaders}
          approaches={workspace.approaches}
        />
        <ChatPane
          key={`chat-${classId}`}
          locked={lockIn}
          scopeLabel={workspace.scopeLabel}
          messages={workspace.messages}
        />
      </div>
    </main>
  );
}
