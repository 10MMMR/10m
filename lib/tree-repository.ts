export type TreeNodeKind = "root" | "folder" | "note" | "file";

export type TreeNode = {
  id: string;
  classId: string;
  parentId: string | null;
  kind: TreeNodeKind;
  title: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  fileDataUrl?: string;
  fileMimeType?: string;
  fileSize?: number;
  body?: string;
};

export type DropPosition = "before" | "inside" | "after";

const STORAGE_KEY = "10m.tree.v1";

function isTreeNodeKind(value: unknown): value is TreeNodeKind {
  return (
    value === "root" ||
    value === "folder" ||
    value === "note" ||
    value === "file"
  );
}

function isTreeNode(value: unknown): value is TreeNode {
  if (!value || typeof value !== "object") {
    return false;
  }

  const node = value as Record<string, unknown>;

  return (
    typeof node.id === "string" &&
    typeof node.classId === "string" &&
    (typeof node.parentId === "string" || node.parentId === null) &&
    isTreeNodeKind(node.kind) &&
    typeof node.title === "string" &&
    typeof node.order === "number" &&
    typeof node.createdAt === "string" &&
    typeof node.updatedAt === "string"
  );
}

function sortByOrder(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((left, right) => left.order - right.order);
}

function reindexSiblings(nodes: TreeNode[], parentId: string | null): TreeNode[] {
  const siblings = sortByOrder(nodes.filter((node) => node.parentId === parentId));
  const orderMap = new Map(siblings.map((node, index) => [node.id, index]));

  return nodes.map((node) => {
    const nextOrder = orderMap.get(node.id);

    if (nextOrder === undefined || node.order === nextOrder) {
      return node;
    }

    return {
      ...node,
      order: nextOrder,
    };
  });
}

function rootIdForClass(classId: string) {
  return `root:${classId}`;
}

export function canParentContainChild(
  parentKind: TreeNodeKind,
  childKind: TreeNodeKind,
): boolean {
  if (parentKind === "root" || parentKind === "folder") {
    return childKind === "folder" || childKind === "note" || childKind === "file";
  }

  if (parentKind === "file") {
    return childKind === "note";
  }

  return false;
}

function buildNodeMap(nodes: TreeNode[]) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function isDescendant(
  map: Map<string, TreeNode>,
  nodeId: string,
  maybeAncestorId: string,
): boolean {
  let current = map.get(nodeId);

  while (current?.parentId) {
    if (current.parentId === maybeAncestorId) {
      return true;
    }

    current = map.get(current.parentId);
  }

  return false;
}

export function canDropNode(
  nodes: TreeNode[],
  dragId: string,
  targetId: string,
  position: DropPosition,
): boolean {
  const nodeMap = buildNodeMap(nodes);
  const dragNode = nodeMap.get(dragId);
  const targetNode = nodeMap.get(targetId);

  if (!dragNode || !targetNode || dragNode.kind === "root") {
    return false;
  }

  if (dragId === targetId) {
    return false;
  }

  let nextParentId: string | null = null;

  if (position === "inside") {
    nextParentId = targetNode.id;
  } else {
    nextParentId = targetNode.parentId;
  }

  if (!nextParentId) {
    return false;
  }

  const nextParent = nodeMap.get(nextParentId);

  if (!nextParent) {
    return false;
  }

  if (!canParentContainChild(nextParent.kind, dragNode.kind)) {
    return false;
  }

  if (nextParent.id === dragNode.id || isDescendant(nodeMap, nextParent.id, dragNode.id)) {
    return false;
  }

  return true;
}

export class LocalStorageTreeRepository {
  private readAll(): TreeNode[] {
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

      return parsed.filter(isTreeNode);
    } catch {
      return [];
    }
  }

  private writeAll(nodes: TreeNode[]) {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
  }

  private ensureRoot(nodes: TreeNode[], classId: string): TreeNode[] {
    const rootId = rootIdForClass(classId);
    const existingRoot = nodes.find((node) => node.id === rootId);

    if (existingRoot) {
      return nodes;
    }

    const timestamp = new Date().toISOString();

    return [
      ...nodes,
      {
        id: rootId,
        classId,
        parentId: null,
        kind: "root",
        title: classId,
        order: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ];
  }

  listTreeByClass(classId: string): TreeNode[] {
    const nodes = this.ensureRoot(this.readAll(), classId);
    this.writeAll(nodes);

    return sortByOrder(nodes.filter((node) => node.classId === classId));
  }

  getNodeById(classId: string, nodeId: string): TreeNode | null {
    const node = this.listTreeByClass(classId).find((item) => item.id === nodeId);
    return node ?? null;
  }

  createNode(node: Omit<TreeNode, "order"> & { order?: number }): TreeNode {
    const nodes = this.listTreeByClass(node.classId);
    const siblings = sortByOrder(nodes.filter((item) => item.parentId === node.parentId));
    const nextOrder = node.order ?? siblings.length;
    const nextNode: TreeNode = {
      ...node,
      order: nextOrder,
    };

    const nextNodes = reindexSiblings(
      [...nodes.filter((item) => item.id !== node.id), nextNode],
      node.parentId,
    );

    this.writeAll([
      ...this.readAll().filter((item) => item.classId !== node.classId),
      ...nextNodes,
    ]);

    return nextNode;
  }

  updateNode(node: TreeNode): void {
    const allNodes = this.readAll();
    const index = allNodes.findIndex(
      (item) => item.classId === node.classId && item.id === node.id,
    );

    if (index < 0) {
      return;
    }

    allNodes[index] = node;
    this.writeAll(allNodes);
  }

  deleteNodeCascade(classId: string, nodeId: string): void {
    const classNodes = this.listTreeByClass(classId);
    const map = buildNodeMap(classNodes);
    const rootId = rootIdForClass(classId);

    if (nodeId === rootId) {
      return;
    }

    const toDelete = new Set<string>([nodeId]);
    let changed = true;

    while (changed) {
      changed = false;

      classNodes.forEach((node) => {
        if (node.parentId && toDelete.has(node.parentId) && !toDelete.has(node.id)) {
          toDelete.add(node.id);
          changed = true;
        }
      });
    }

    const remainingClassNodes = classNodes.filter((node) => !toDelete.has(node.id));
    const parentIds = new Set<string | null>([...toDelete].map((id) => map.get(id)?.parentId ?? null));
    let normalized = remainingClassNodes;

    parentIds.forEach((parentId) => {
      normalized = reindexSiblings(normalized, parentId);
    });

    this.writeAll([
      ...this.readAll().filter((node) => node.classId !== classId),
      ...normalized,
    ]);
  }

  moveNode(
    classId: string,
    dragId: string,
    targetId: string,
    position: DropPosition,
  ): void {
    const classNodes = this.listTreeByClass(classId);

    if (!canDropNode(classNodes, dragId, targetId, position)) {
      return;
    }

    const nodeMap = buildNodeMap(classNodes);
    const dragNode = nodeMap.get(dragId);
    const targetNode = nodeMap.get(targetId);

    if (!dragNode || !targetNode) {
      return;
    }

    const oldParentId = dragNode.parentId;
    const nextParentId = position === "inside" ? targetNode.id : targetNode.parentId;

    if (!nextParentId) {
      return;
    }

    const siblingsWithoutDrag = sortByOrder(
      classNodes.filter(
        (node) => node.parentId === nextParentId && node.id !== dragId,
      ),
    );

    let insertIndex = siblingsWithoutDrag.length;

    if (position !== "inside") {
      const targetIndex = siblingsWithoutDrag.findIndex((node) => node.id === targetId);
      insertIndex = targetIndex < 0 ? siblingsWithoutDrag.length : targetIndex;

      if (position === "after") {
        insertIndex += 1;
      }
    }

    const safeInsertIndex = Math.max(0, Math.min(insertIndex, siblingsWithoutDrag.length));
    const updatedDragNode: TreeNode = {
      ...dragNode,
      parentId: nextParentId,
      updatedAt: new Date().toISOString(),
      order: safeInsertIndex,
    };

    const newSiblingNodes = [...siblingsWithoutDrag];
    newSiblingNodes.splice(safeInsertIndex, 0, updatedDragNode);
    const newOrderMap = new Map(newSiblingNodes.map((node, index) => [node.id, index]));

    let nextClassNodes = classNodes.map((node) => {
      if (newOrderMap.has(node.id)) {
        const nextOrder = newOrderMap.get(node.id);
        if (nextOrder === undefined) {
          return node;
        }

        if (node.id === dragId) {
          return {
            ...updatedDragNode,
            order: nextOrder,
          };
        }

        if (node.order !== nextOrder) {
          return {
            ...node,
            order: nextOrder,
          };
        }
      }

      return node;
    });

    if (oldParentId !== nextParentId) {
      nextClassNodes = reindexSiblings(nextClassNodes, oldParentId);
    }

    this.writeAll([
      ...this.readAll().filter((node) => node.classId !== classId),
      ...nextClassNodes,
    ]);
  }
}

export function createTreeNoteNode(
  classId: string,
  parentId: string,
  title = "Untitled note",
): TreeNode {
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    classId,
    parentId,
    kind: "note",
    title,
    body: "<p></p>",
    order: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createTreeFolderNode(
  classId: string,
  parentId: string,
  title = "Untitled folder",
): TreeNode {
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    classId,
    parentId,
    kind: "folder",
    title,
    order: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
