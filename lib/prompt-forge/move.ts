import type { FolderRecord } from "@/lib/prompt-forge/types";

export interface FolderOption {
  id: string;
  name: string;
  path: string;
}

const ROOT_FOLDER_ID = "root";

export function getDescendantFolderIds(
  folderId: string,
  folders: Pick<FolderRecord, "id" | "parentId">[],
): Set<string> {
  const result = new Set<string>();
  const childrenByParent = new Map<string | null, string[]>();

  for (const folder of folders) {
    const list = childrenByParent.get(folder.parentId) ?? [];
    list.push(folder.id);
    childrenByParent.set(folder.parentId, list);
  }

  const stack = [...(childrenByParent.get(folderId) ?? [])];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (result.has(current)) continue;
    result.add(current);
    stack.push(...(childrenByParent.get(current) ?? []));
  }

  return result;
}

export function canMovePromptToFolder(
  currentFolderId: string | null,
  targetFolderId: string | null,
): { ok: true } | { ok: false; reason: string } {
  if (!targetFolderId) {
    return { ok: false, reason: "Destination folder not found" };
  }

  if (currentFolderId === targetFolderId) {
    return { ok: false, reason: "Template is already in that folder" };
  }

  return { ok: true };
}

export function canMoveFolderToFolder(
  folderId: string,
  targetFolderId: string | null,
  folders: Pick<FolderRecord, "id" | "parentId">[],
): { ok: true } | { ok: false; reason: string } {
  const currentFolder = folders.find((folder) => folder.id === folderId);

  if (!currentFolder) {
    return { ok: false, reason: "Folder not found" };
  }

  if (currentFolder.parentId === null || folderId === ROOT_FOLDER_ID) {
    return { ok: false, reason: "Root folder cannot be moved" };
  }

  if (!targetFolderId) {
    return { ok: false, reason: "Destination folder not found" };
  }

  if (targetFolderId === folderId) {
    return { ok: false, reason: "Cannot move a folder into itself" };
  }

  if (currentFolder.parentId === targetFolderId) {
    return { ok: false, reason: "Folder is already in that location" };
  }

  const descendants = getDescendantFolderIds(folderId, folders);
  if (descendants.has(targetFolderId)) {
    return { ok: false, reason: "Cannot move a folder into its child" };
  }

  return { ok: true };
}

export function getAvailablePromptDestinationFolders(
  folders: FolderOption[],
  currentFolderId: string | null,
): FolderOption[] {
  return folders.filter(
    (folder) => canMovePromptToFolder(currentFolderId, folder.id).ok,
  );
}

export function getAvailableFolderDestinationFolders(
  folders: FolderOption[],
  allFolders: Pick<FolderRecord, "id" | "parentId">[],
  folderId: string | null,
): FolderOption[] {
  if (!folderId) return [];

  return folders.filter(
    (folder) => canMoveFolderToFolder(folderId, folder.id, allFolders).ok,
  );
}
