import type { Metadata } from "next";
import { WorkspaceShell } from "./_components/workspace-shell";
import {
  DEFAULT_CLASS_ID,
  getWorkspaceSeed,
  isSeededClassId,
  normalizeClassId,
} from "./_lib/workspace-data";

type EditorClassPageProps = {
  params: Promise<{ "class-id": string }>;
};

function resolveSeed(requestedClassId: string) {
  const normalizedClassId = normalizeClassId(requestedClassId);
  const classId = normalizedClassId || DEFAULT_CLASS_ID;
  const seededClassId = isSeededClassId(classId) ? classId : DEFAULT_CLASS_ID;

  return {
    classId,
    normalizedClassId,
    seededClassId,
    usedFallback: !isSeededClassId(classId),
    workspace: getWorkspaceSeed(classId),
  };
}

export async function generateMetadata({
  params,
}: EditorClassPageProps): Promise<Metadata> {
  const { "class-id": requestedClassId } = await params;
  const { classId, workspace } = resolveSeed(requestedClassId);

  return {
    title: `${workspace.classLabel} (${classId}) | Lumina Study`,
    description: `Editor workspace for ${workspace.classLabel}.`,
  };
}

export default async function EditorClassPage({
  params,
}: EditorClassPageProps) {
  const { "class-id": requestedClassId } = await params;
  const { classId, usedFallback } = resolveSeed(requestedClassId);

  return (
    <WorkspaceShell
      classId={classId}
      requestedClassId={requestedClassId}
      usedFallback={usedFallback}
    />
  );
}
