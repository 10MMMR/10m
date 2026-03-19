"use client";

import { ChatBubbleLeftEllipsisIcon } from "@heroicons/react/24/outline";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
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
  const prefersReducedMotion = useReducedMotion();
  const [lockIn, setLockIn] = useState(false);
  const [isLeftPaneCollapsed, setIsLeftPaneCollapsed] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [isChatInGrid, setIsChatInGrid] = useState(true);
  const [isLgViewport, setIsLgViewport] = useState(false);
  const [isXlViewport, setIsXlViewport] = useState(false);
  const restoreFrameRef = useRef<number | null>(null);

  const isFloatingIconVisible = isChatMinimized;

  const desktopGridColumns = isLeftPaneCollapsed
    ? isChatInGrid
      ? "xl:grid-cols-[60px_minmax(0,1fr)_340px]"
      : "xl:grid-cols-[60px_minmax(0,1fr)]"
    : isChatInGrid
      ? "xl:grid-cols-[280px_minmax(0,1fr)_340px]"
      : "xl:grid-cols-[280px_minmax(0,1fr)]";

  const desktopGridTemplateColumns = isLeftPaneCollapsed
    ? isXlViewport && isChatInGrid
      ? isChatMinimized
        ? "60px minmax(0,1fr) 0px"
        : "60px minmax(0,1fr) 340px"
      : "60px minmax(0,1fr)"
    : isXlViewport && isChatInGrid
      ? isChatMinimized
        ? "280px minmax(0,1fr) 0px"
        : "280px minmax(0,1fr) 340px"
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

  useEffect(() => {
    return () => {
      if (restoreFrameRef.current !== null) {
        window.cancelAnimationFrame(restoreFrameRef.current);
      }
    };
  }, []);

  const handleHideChat = () => {
    if (isChatMinimized) {
      return;
    }
    setIsChatMinimized(true);
  };

  const handleRestoreChat = () => {
    if (!isChatMinimized) {
      return;
    }
    if (restoreFrameRef.current !== null) {
      window.cancelAnimationFrame(restoreFrameRef.current);
      restoreFrameRef.current = null;
    }
    setIsChatInGrid(true);
    restoreFrameRef.current = window.requestAnimationFrame(() => {
      setIsChatMinimized(false);
      restoreFrameRef.current = null;
    });
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
      <motion.div
        initial={false}
        animate={isLgViewport ? { gridTemplateColumns: desktopGridTemplateColumns } : {}}
        transition={
          prefersReducedMotion
            ? { duration: 0.01, ease: "linear" }
            : { duration: 0.52, ease: [0.22, 1, 0.36, 1] }
        }
        className={`grid min-h-0 flex-1 grid-cols-1 ${isLeftPaneCollapsed ? "lg:grid-cols-[60px_minmax(0,1fr)]" : "lg:grid-cols-[250px_minmax(0,1fr)]"} ${desktopGridColumns}`}
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
        {isChatInGrid ? (
          <div className="relative h-full min-h-0 min-w-0 overflow-hidden lg:col-span-2 xl:col-span-1">
            <AnimatePresence
              initial={false}
              mode="wait"
              onExitComplete={() => {
                if (isChatMinimized) {
                  setIsChatInGrid(false);
                }
              }}
            >
              {!isChatMinimized ? (
                <motion.div
                  key={`chat-${classId}`}
                  variants={{
                    hidden: {
                      opacity: 0,
                      scale: prefersReducedMotion ? 0.97 : 0.88,
                      x: prefersReducedMotion ? 2 : 10,
                      y: prefersReducedMotion ? 4 : 14,
                      transition: prefersReducedMotion
                        ? { duration: 0.15, ease: "easeOut" }
                        : { duration: 0.15, ease: "easeOut" },
                    },
                    visible: {
                      opacity: 1,
                      scale: 1,
                      x: 0,
                      y: 0,
                      transition: prefersReducedMotion
                        ? { duration: 0.18, ease: "easeOut" }
                        : {
                            opacity: { duration: 0.34, ease: "easeOut" },
                            scale: { type: "spring", stiffness: 220, damping: 24, mass: 0.95 },
                            x: { type: "spring", stiffness: 220, damping: 26, mass: 0.95 },
                            y: { type: "spring", stiffness: 220, damping: 26, mass: 0.95 },
                          },
                    },
                    exiting: {
                      opacity: prefersReducedMotion ? 0 : 0,
                      scale: prefersReducedMotion ? 0.82 : 0.84,
                      x: prefersReducedMotion ? 4 : 10,
                      y: prefersReducedMotion ? 10 : 14,
                      transition: prefersReducedMotion
                        ? { duration: 0.16, ease: "easeIn" }
                        : {
                            opacity: { duration: 0.12, delay: 0.16, ease: "easeOut" },
                            scale: { type: "spring", stiffness: 170, damping: 18, mass: 1.08 },
                            x: { type: "spring", stiffness: 170, damping: 20, mass: 1.08 },
                            y: { type: "spring", stiffness: 170, damping: 20, mass: 1.08 },
                          },
                    },
                  }}
                  initial="hidden"
                  animate="visible"
                  exit="exiting"
                  className="h-full min-h-0 origin-bottom-right"
                >
                  <ChatPane
                    locked={lockIn}
                    onHide={handleHideChat}
                    scopeLabel={workspace.scopeLabel}
                    messages={workspace.messages}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </motion.div>

      <AnimatePresence initial={false}>
        {isFloatingIconVisible ? (
          <motion.button
            key="floating-chat-button"
            className="fixed right-15 bottom-10 z-50 grid h-14 w-14 place-items-center rounded-full border border-(--border-strong) bg-(--main) text-(--text-contrast) shadow-(--shadow-accent) hover:shadow-(--shadow-accent-strong)"
            initial={{ opacity: 0, scale: 0.75, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 6 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.16, ease: "easeOut" }
                : {
                    opacity: { duration: 0.12, ease: "easeOut" },
                    scale: { duration: 0.12, ease: [0.16, 1, 0.3, 1] },
                    y: { duration: 0.12, ease: [0.16, 1, 0.3, 1] },
                  }
            }
            onClick={handleRestoreChat}
            type="button"
            aria-label="Show chat"
          >
            <ChatBubbleLeftEllipsisIcon className="h-6 w-6" aria-hidden="true" />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
