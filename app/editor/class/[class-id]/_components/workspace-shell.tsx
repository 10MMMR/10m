"use client";

import { ChatBubbleLeftEllipsisIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { ChatPane } from "./chat-pane";
import { EditorPane } from "./editor-pane";
import { LeftPane } from "./left-pane";
import { Topbar } from "./topbar";
import { getWorkspaceSeed } from "../_lib/workspace-data";

type WorkspaceShellProps = {
  classId: string;
  requestedClassId: string;
  usedFallback: boolean;
};

export function WorkspaceShell({
  classId,
  requestedClassId,
  usedFallback,
}: WorkspaceShellProps) {
  const workspace = getWorkspaceSeed(classId);
  const [lockIn, setLockIn] = useState(false);
  const [isLeftPaneCollapsed, setIsLeftPaneCollapsed] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isLgViewport, setIsLgViewport] = useState(false);
  const [isXlViewport, setIsXlViewport] = useState(false);

  const desktopGridColumns = isLeftPaneCollapsed
    ? isChatOpen
      ? "xl:grid-cols-[60px_minmax(0,1fr)_340px]"
      : "xl:grid-cols-[60px_minmax(0,1fr)]"
    : isChatOpen
      ? "xl:grid-cols-[280px_minmax(0,1fr)_340px]"
      : "xl:grid-cols-[280px_minmax(0,1fr)]";

  const desktopGridTemplateColumns = isLeftPaneCollapsed
    ? isXlViewport && isChatOpen
      ? "60px minmax(0,1fr) 340px"
      : "60px minmax(0,1fr)"
    : isXlViewport && isChatOpen
      ? "280px minmax(0,1fr) 340px"
      : isXlViewport
        ? "280px minmax(0,1fr)"
        : "250px minmax(0,1fr)";

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

  useEffect(() => {
    const lgQuery = window.matchMedia("(min-width: 1024px)");
    const xlQuery = window.matchMedia("(min-width: 1280px)");

    const syncViewport = () => {
      setIsLgViewport(lgQuery.matches);
      setIsXlViewport(xlQuery.matches);
    };

    syncViewport();
    lgQuery.addEventListener("change", syncViewport);
    xlQuery.addEventListener("change", syncViewport);

    return () => {
      lgQuery.removeEventListener("change", syncViewport);
      xlQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  const handleHideChat = () => {
    if (!isChatOpen) {
      return;
    }
    setIsChatOpen(false);
  };

  const handleRestoreChat = () => {
    if (isChatOpen) {
      return;
    }
    setIsChatOpen(true);
  };

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
      <div
        className={`grid min-h-0 flex-1 grid-cols-1 transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isLeftPaneCollapsed ? "lg:grid-cols-[60px_minmax(0,1fr)]" : "lg:grid-cols-[250px_minmax(0,1fr)]"} ${desktopGridColumns}`}
        style={
          isLgViewport
            ? {
                gridTemplateColumns: desktopGridTemplateColumns,
              }
            : undefined
        }
      >
        <LeftPane
          key={`left-${classId}`}
          locked={lockIn}
          collapsed={isLeftPaneCollapsed}
          onCollapse={() => setIsLeftPaneCollapsed(true)}
          onExpand={() => setIsLeftPaneCollapsed(false)}
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
        {isChatOpen ? (
          <div className="relative h-full min-h-0 min-w-0 overflow-hidden lg:col-span-2 xl:col-span-1">
            <ChatPane
              locked={lockIn}
              onHide={handleHideChat}
              messages={workspace.messages}
            />
          </div>
        ) : null}
      </div>

      {!isChatOpen ? (
        <button
          className="fixed right-15 bottom-10 z-50 grid h-14 w-14 place-items-center rounded-full border border-(--border-strong) bg-(--main) text-(--text-contrast) shadow-(--shadow-accent) transition-transform duration-200 hover:scale-105 hover:shadow-(--shadow-accent-strong)"
          onClick={handleRestoreChat}
          type="button"
          aria-label="Show chat"
        >
          <ChatBubbleLeftEllipsisIcon className="h-6 w-6" aria-hidden="true" />
        </button>
      ) : null}
    </main>
  );
}
