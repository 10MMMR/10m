const STORAGE_PREFIX = "editor-tree-ui-state";

type TreeUiState = {
  expandedIds: string[];
  selectedNodeId: string | null;
};

function buildStorageKey(userId: string, classId: string) {
  return `${STORAGE_PREFIX}:${userId}:${classId}`;
}

export function loadTreeUiState(userId: string, classId: string): TreeUiState {
  if (typeof window === "undefined") {
    return {
      expandedIds: [],
      selectedNodeId: null,
    };
  }

  try {
    const stored = window.localStorage.getItem(buildStorageKey(userId, classId));

    if (!stored) {
      return {
        expandedIds: [],
        selectedNodeId: null,
      };
    }

    const parsed = JSON.parse(stored) as Partial<TreeUiState>;

    return {
      expandedIds: Array.isArray(parsed.expandedIds)
        ? parsed.expandedIds.filter((value): value is string => typeof value === "string")
        : [],
      selectedNodeId:
        typeof parsed.selectedNodeId === "string" ? parsed.selectedNodeId : null,
    };
  } catch {
    return {
      expandedIds: [],
      selectedNodeId: null,
    };
  }
}

export function saveTreeUiState(
  userId: string,
  classId: string,
  state: TreeUiState,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    buildStorageKey(userId, classId),
    JSON.stringify(state),
  );
}

export function clearTreeUiState(userId: string, classId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(buildStorageKey(userId, classId));
}
