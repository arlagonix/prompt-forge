import {
  buildUniqueCopyName,
  getAllFolders,
  getAllPrompts,
  openPromptForgeDb,
  ROOT_FOLDER_ID,
} from "@/lib/prompt-forge/storage";
import type {
  ExportFolderNode,
  ExportNode,
  ExportTemplateNode,
  FolderRecord,
  PromptForgeExportV1,
  PromptRecord,
} from "@/lib/prompt-forge/types";

const EXPORT_VERSION = 1;
const FOLDERS_STORE = "folders";
const PROMPTS_STORE = "prompts";

function randomId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function buildExportedAt(): string {
  return new Date().toISOString();
}

function formatFilenameTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

export function buildExportFilename(kind: "template" | "folder" | "workspace"): string {
  return `export.${kind}.${formatFilenameTimestamp()}.json`;
}

export function downloadJsonFile(data: PromptForgeExportV1, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function promptToExportNode(prompt: PromptRecord): ExportTemplateNode {
  return {
    type: "template",
    name: prompt.name,
    content: prompt.content,
    createdAt: prompt.createdAt,
    updatedAt: prompt.updatedAt,
  };
}

function folderToExportNode(
  folder: FolderRecord,
  childrenByParentId: Map<string | null, FolderRecord[]>,
  promptsByFolderId: Map<string | null, PromptRecord[]>,
): ExportFolderNode {
  const childFolders = (childrenByParentId.get(folder.id) ?? []).map((child) =>
    folderToExportNode(child, childrenByParentId, promptsByFolderId),
  );
  const childPrompts = (promptsByFolderId.get(folder.id) ?? []).map(promptToExportNode);

  return {
    type: "folder",
    name: folder.name,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    children: [...childFolders, ...childPrompts],
  };
}

function sortFolders(folders: FolderRecord[]): void {
  folders.sort((a, b) => a.name.localeCompare(b.name));
}

function sortPrompts(prompts: PromptRecord[]): void {
  prompts.sort((a, b) => a.name.localeCompare(b.name));
}

export async function exportWorkspaceTree(): Promise<PromptForgeExportV1> {
  const [folders, prompts] = await Promise.all([getAllFolders(), getAllPrompts()]);

  const childrenByParentId = new Map<string | null, FolderRecord[]>();
  for (const folder of folders) {
    const list = childrenByParentId.get(folder.parentId) ?? [];
    list.push(folder);
    childrenByParentId.set(folder.parentId, list);
  }
  for (const list of childrenByParentId.values()) sortFolders(list);

  const promptsByFolderId = new Map<string | null, PromptRecord[]>();
  for (const prompt of prompts) {
    const list = promptsByFolderId.get(prompt.folderId) ?? [];
    list.push(prompt);
    promptsByFolderId.set(prompt.folderId, list);
  }
  for (const list of promptsByFolderId.values()) sortPrompts(list);

  const rootChildren = [
    ...(childrenByParentId.get(ROOT_FOLDER_ID) ?? []).map((folder) =>
      folderToExportNode(folder, childrenByParentId, promptsByFolderId),
    ),
    ...(promptsByFolderId.get(ROOT_FOLDER_ID) ?? []).map(promptToExportNode),
  ];

  return {
    version: EXPORT_VERSION,
    exportedAt: buildExportedAt(),
    root: {
      type: "root",
      children: rootChildren,
    },
  };
}

export async function exportFolderTree(folderId: string): Promise<PromptForgeExportV1> {
  const [folders, prompts] = await Promise.all([getAllFolders(), getAllPrompts()]);
  const target = folders.find((folder) => folder.id === folderId);
  if (!target) throw new Error("Folder not found");

  const childrenByParentId = new Map<string | null, FolderRecord[]>();
  for (const folder of folders) {
    const list = childrenByParentId.get(folder.parentId) ?? [];
    list.push(folder);
    childrenByParentId.set(folder.parentId, list);
  }
  for (const list of childrenByParentId.values()) sortFolders(list);

  const promptsByFolderId = new Map<string | null, PromptRecord[]>();
  for (const prompt of prompts) {
    const list = promptsByFolderId.get(prompt.folderId) ?? [];
    list.push(prompt);
    promptsByFolderId.set(prompt.folderId, list);
  }
  for (const list of promptsByFolderId.values()) sortPrompts(list);

  return {
    version: EXPORT_VERSION,
    exportedAt: buildExportedAt(),
    root: {
      type: "root",
      children: [folderToExportNode(target, childrenByParentId, promptsByFolderId)],
    },
  };
}

export async function exportTemplateTree(promptId: string): Promise<PromptForgeExportV1> {
  const prompts = await getAllPrompts();
  const prompt = prompts.find((item) => item.id === promptId);
  if (!prompt) throw new Error("Template not found");

  return {
    version: EXPORT_VERSION,
    exportedAt: buildExportedAt(),
    root: {
      type: "root",
      children: [promptToExportNode(prompt)],
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateNode(value: unknown, path: string): ExportNode {
  if (!isObject(value) || typeof value.type !== "string") {
    throw new Error(`${path} must be an object with a valid type`);
  }

  if (value.type === "folder") {
    if (typeof value.name !== "string") {
      throw new Error(`${path}.name must be a string`);
    }
    if (!Array.isArray(value.children)) {
      throw new Error(`${path}.children must be an array`);
    }
    if (
      value.createdAt !== undefined &&
      typeof value.createdAt !== "number"
    ) {
      throw new Error(`${path}.createdAt must be a number when present`);
    }
    if (
      value.updatedAt !== undefined &&
      typeof value.updatedAt !== "number"
    ) {
      throw new Error(`${path}.updatedAt must be a number when present`);
    }

    return {
      type: "folder",
      name: value.name,
      createdAt: value.createdAt as number | undefined,
      updatedAt: value.updatedAt as number | undefined,
      children: value.children.map((child, index) =>
        validateNode(child, `${path}.children[${index}]`),
      ),
    };
  }

  if (value.type === "template") {
    if (typeof value.name !== "string") {
      throw new Error(`${path}.name must be a string`);
    }
    if (typeof value.content !== "string") {
      throw new Error(`${path}.content must be a string`);
    }
    if (
      value.createdAt !== undefined &&
      typeof value.createdAt !== "number"
    ) {
      throw new Error(`${path}.createdAt must be a number when present`);
    }
    if (
      value.updatedAt !== undefined &&
      typeof value.updatedAt !== "number"
    ) {
      throw new Error(`${path}.updatedAt must be a number when present`);
    }

    return {
      type: "template",
      name: value.name,
      content: value.content,
      createdAt: value.createdAt as number | undefined,
      updatedAt: value.updatedAt as number | undefined,
    };
  }

  throw new Error(`${path}.type must be "folder" or "template"`);
}

export function parseAndValidateImport(jsonText: string): PromptForgeExportV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Import failed: invalid export schema");
  }

  try {
    if (!isObject(parsed)) {
      throw new Error("Top-level value must be an object");
    }
    if (parsed.version !== EXPORT_VERSION) {
      throw new Error("Unsupported export version");
    }
    if (typeof parsed.exportedAt !== "string") {
      throw new Error("exportedAt must be a string");
    }
    if (!isObject(parsed.root)) {
      throw new Error("root must be an object");
    }
    if (parsed.root.type !== "root") {
      throw new Error('root.type must be "root"');
    }
    if (!Array.isArray(parsed.root.children)) {
      throw new Error("root.children must be an array");
    }

    return {
      version: EXPORT_VERSION,
      exportedAt: parsed.exportedAt,
      root: {
        type: "root",
        children: parsed.root.children.map((child, index) =>
          validateNode(child, `root.children[${index}]`),
        ),
      },
    };
  } catch (error) {
    throw new Error(`Import failed: invalid export schema${error instanceof Error && error.message ? ` (${error.message})` : ""}`);
  }
}

export type ImportConflictResolution = "replace" | "copy";

export interface ImportAnalysisResult {
  conflictingPromptCount: number;
  identicalPromptCount: number;
  folderMergeCount: number;
}

export interface ImportResult extends ImportAnalysisResult {
  importedPromptCount: number;
  importedFolderCount: number;
  replacedPromptCount: number;
  copiedPromptCount: number;
}

function normalizeEntityName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function findFolderByName(
  folders: FolderRecord[],
  parentId: string,
  name: string,
): FolderRecord | null {
  const normalizedName = normalizeEntityName(name);
  return (
    folders.find(
      (folder) =>
        folder.parentId === parentId &&
        normalizeEntityName(folder.name) === normalizedName,
    ) ?? null
  );
}

function findPromptByName(
  prompts: PromptRecord[],
  folderId: string,
  name: string,
): PromptRecord | null {
  const normalizedName = normalizeEntityName(name);
  return (
    prompts.find(
      (prompt) =>
        prompt.folderId === folderId &&
        normalizeEntityName(prompt.name) === normalizedName,
    ) ?? null
  );
}

export async function analyzeImportConflicts(
  data: PromptForgeExportV1,
  targetFolderId: string,
): Promise<ImportAnalysisResult> {
  const [folders, prompts] = await Promise.all([getAllFolders(), getAllPrompts()]);

  if (!folders.some((folder) => folder.id === targetFolderId)) {
    throw new Error("Target folder not found");
  }

  const simulatedFolders = [...folders];
  const simulatedPrompts = [...prompts];
  const result: ImportAnalysisResult = {
    conflictingPromptCount: 0,
    identicalPromptCount: 0,
    folderMergeCount: 0,
  };

  const simulateNode = (node: ExportNode, parentId: string): void => {
    if (node.type === "folder") {
      const existingFolder = findFolderByName(simulatedFolders, parentId, node.name);
      const folderId = existingFolder?.id ?? randomId("simulated_folder");

      if (existingFolder) {
        result.folderMergeCount += 1;
      } else {
        simulatedFolders.push({
          id: folderId,
          name: node.name,
          parentId,
          createdAt: node.createdAt ?? Date.now(),
          updatedAt: node.updatedAt ?? Date.now(),
        });
      }

      for (const child of node.children) {
        simulateNode(child, folderId);
      }
      return;
    }

    const existingPrompt = findPromptByName(simulatedPrompts, parentId, node.name);
    if (existingPrompt) {
      if (existingPrompt.content === node.content) {
        result.identicalPromptCount += 1;
        return;
      }

      result.conflictingPromptCount += 1;
      const siblingNames = simulatedPrompts
        .filter((prompt) => prompt.folderId === parentId)
        .map((prompt) => prompt.name);
      simulatedPrompts.push({
        id: randomId("simulated_prompt"),
        name: buildUniqueCopyName(node.name, siblingNames),
        folderId: parentId,
        content: node.content,
        createdAt: node.createdAt ?? Date.now(),
        updatedAt: node.updatedAt ?? Date.now(),
      });
      return;
    }

    simulatedPrompts.push({
      id: randomId("simulated_prompt"),
      name: node.name,
      folderId: parentId,
      content: node.content,
      createdAt: node.createdAt ?? Date.now(),
      updatedAt: node.updatedAt ?? Date.now(),
    });
  };

  for (const child of data.root.children) {
    simulateNode(child, targetFolderId);
  }

  return result;
}

export async function importExportTree(
  data: PromptForgeExportV1,
  targetFolderId: string,
  conflictResolution: ImportConflictResolution = "copy",
): Promise<ImportResult> {
  const db = await openPromptForgeDb();
  const tx = db.transaction([FOLDERS_STORE, PROMPTS_STORE], "readwrite");
  const foldersStore = tx.objectStore(FOLDERS_STORE);
  const promptsStore = tx.objectStore(PROMPTS_STORE);

  const targetFolder = await requestToPromise(foldersStore.get(targetFolderId));
  if (!targetFolder) {
    tx.abort();
    throw new Error("Target folder not found");
  }

  const folders = (await requestToPromise(foldersStore.getAll())) as FolderRecord[];
  const prompts = (await requestToPromise(promptsStore.getAll())) as PromptRecord[];
  const now = Date.now();
  const result: ImportResult = {
    conflictingPromptCount: 0,
    identicalPromptCount: 0,
    folderMergeCount: 0,
    importedPromptCount: 0,
    importedFolderCount: 0,
    replacedPromptCount: 0,
    copiedPromptCount: 0,
  };

  const importNode = (node: ExportNode, parentId: string): void => {
    if (node.type === "folder") {
      const existingFolder = findFolderByName(folders, parentId, node.name);
      let folderId: string;

      if (existingFolder) {
        folderId = existingFolder.id;
        result.folderMergeCount += 1;
      } else {
        folderId = randomId("folder");
        const folder: FolderRecord = {
          id: folderId,
          name: node.name,
          parentId,
          createdAt: node.createdAt ?? now,
          updatedAt: node.updatedAt ?? now,
        };
        folders.push(folder);
        foldersStore.put(folder);
        result.importedFolderCount += 1;
      }

      for (const child of node.children) {
        importNode(child, folderId);
      }
      return;
    }

    const existingPrompt = findPromptByName(prompts, parentId, node.name);

    if (existingPrompt) {
      if (existingPrompt.content === node.content) {
        result.identicalPromptCount += 1;
        return;
      }

      result.conflictingPromptCount += 1;

      if (conflictResolution === "replace") {
        const updated: PromptRecord = {
          ...existingPrompt,
          content: node.content,
          updatedAt: node.updatedAt ?? now,
        };
        const index = prompts.findIndex((prompt) => prompt.id === existingPrompt.id);
        if (index !== -1) prompts[index] = updated;
        promptsStore.put(updated);
        result.replacedPromptCount += 1;
        return;
      }

      const siblingNames = prompts
        .filter((prompt) => prompt.folderId === parentId)
        .map((prompt) => prompt.name);
      const prompt: PromptRecord = {
        id: randomId("prompt"),
        name: buildUniqueCopyName(node.name, siblingNames),
        folderId: parentId,
        content: node.content,
        createdAt: node.createdAt ?? now,
        updatedAt: node.updatedAt ?? now,
      };
      prompts.push(prompt);
      promptsStore.put(prompt);
      result.copiedPromptCount += 1;
      return;
    }

    const prompt: PromptRecord = {
      id: randomId("prompt"),
      name: node.name,
      folderId: parentId,
      content: node.content,
      createdAt: node.createdAt ?? now,
      updatedAt: node.updatedAt ?? now,
    };
    prompts.push(prompt);
    promptsStore.put(prompt);
    result.importedPromptCount += 1;
  };

  for (const child of data.root.children) {
    importNode(child, targetFolderId);
  }

  await transactionDone(tx);
  return result;
}
