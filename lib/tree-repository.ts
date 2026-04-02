export type TreeNodeKind = "root" | "folder" | "note" | "file";

export type TreeNode = {
  id: string;
  classId: string;
  parentId: string | null;
  kind: TreeNodeKind;
  noteId?: string;
  title: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  fileStoragePath?: string;
  fileMimeType?: string;
  fileSize?: number;
  body?: string;
};

export type DropPosition = "before" | "inside" | "after";

function sortByOrder(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((left, right) => left.order - right.order);
}

export function sortTreeNodes(nodes: TreeNode[]) {
  return sortByOrder(nodes);
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

export function ensureTreeRoot(nodes: TreeNode[], classId: string): TreeNode[] {
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

export function createNodeInTree(
  nodes: TreeNode[],
  node: Omit<TreeNode, "order"> & { order?: number },
) {
  const classNodes = sortByOrder(ensureTreeRoot(nodes, node.classId));
  const siblings = sortByOrder(
    classNodes.filter((item) => item.parentId === node.parentId),
  );
  const nextOrder = node.order ?? siblings.length;
  const nextNode: TreeNode = {
    ...node,
    order: nextOrder,
  };

  return reindexSiblings(
    [...classNodes.filter((item) => item.id !== node.id), nextNode],
    node.parentId,
  );
}

export function updateNodeInTree(nodes: TreeNode[], node: TreeNode) {
  const allNodes = ensureTreeRoot(nodes, node.classId);
  const index = allNodes.findIndex(
    (item) => item.classId === node.classId && item.id === node.id,
  );

  if (index < 0) {
    return allNodes;
  }

  const nextNodes = [...allNodes];
  nextNodes[index] = node;
  return nextNodes;
}

export function deleteNodeCascadeFromTree(
  nodes: TreeNode[],
  classId: string,
  nodeId: string,
) {
  const classNodes = sortByOrder(ensureTreeRoot(nodes, classId));
  const map = buildNodeMap(classNodes);
  const rootId = rootIdForClass(classId);

  if (nodeId === rootId) {
    return classNodes;
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
  const parentIds = new Set<string | null>(
    [...toDelete].map((id) => map.get(id)?.parentId ?? null),
  );
  let normalized = remainingClassNodes;

  parentIds.forEach((parentId) => {
    normalized = reindexSiblings(normalized, parentId);
  });

  return normalized;
}

export function moveNodeInTree(
  nodes: TreeNode[],
  classId: string,
  dragId: string,
  targetId: string,
  position: DropPosition,
) {
  const classNodes = sortByOrder(ensureTreeRoot(nodes, classId));

  if (!canDropNode(classNodes, dragId, targetId, position)) {
    return classNodes;
  }

  const nodeMap = buildNodeMap(classNodes);
  const dragNode = nodeMap.get(dragId);
  const targetNode = nodeMap.get(targetId);

  if (!dragNode || !targetNode) {
    return classNodes;
  }

  const oldParentId = dragNode.parentId;
  const nextParentId = position === "inside" ? targetNode.id : targetNode.parentId;

  if (!nextParentId) {
    return classNodes;
  }

  const siblingsWithoutDrag = sortByOrder(
    classNodes.filter((node) => node.parentId === nextParentId && node.id !== dragId),
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

  return nextClassNodes;
}
export function createTreeNoteNode(
  classId: string,
  parentId: string,
  title = "Untitled note",
): TreeNode {
  const timestamp = new Date().toISOString();
  const noteId = crypto.randomUUID();

  return {
    id: crypto.randomUUID(),
    classId,
    parentId,
    kind: "note",
    noteId,
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
