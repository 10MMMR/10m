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
  const seededClassId = isSeededClassId(normalizedClassId)
    ? normalizedClassId
    : DEFAULT_CLASS_ID;

  return {
    normalizedClassId,
    seededClassId,
    usedFallback: !isSeededClassId(normalizedClassId),
    workspace: getWorkspaceSeed(normalizedClassId),
  };
}

export async function generateMetadata({
  params,
}: EditorClassPageProps): Promise<Metadata> {
  const { "class-id": requestedClassId } = await params;
  const { seededClassId, workspace } = resolveSeed(requestedClassId);

  return {
    title: `${workspace.classLabel} (${seededClassId}) | Lumina Study`,
    description: `Editor workspace for ${workspace.classLabel}.`,
  };
}

export default async function EditorClassPage({
  params,
}: EditorClassPageProps) {
  const { "class-id": requestedClassId } = await params;
  const { seededClassId, usedFallback } = resolveSeed(requestedClassId);

  return (
    <WorkspaceShell
      classId={seededClassId}
      requestedClassId={requestedClassId}
      usedFallback={usedFallback}
    />
  );
}
