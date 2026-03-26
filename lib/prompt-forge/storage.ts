import { parseFrontMatter } from "@/lib/prompt-forge/parser";
import type {
  AppStateRecord,
  FolderNode,
  FolderRecord,
  ParsedFile,
  PromptRecord,
} from "@/lib/prompt-forge/types";

const DB_NAME = "prompt-forge-db";
const DB_VERSION = 2;

const FOLDERS_STORE = "folders";
const PROMPTS_STORE = "prompts";
const APP_STATE_STORE = "appState";

const ROOT_FOLDER_ID = "root";
const DEFAULT_PROMPT_ID = "prompt-welcome";

const DEFAULT_TEMPLATE = `---
title: Welcome Template
description: A starter prompt template
params:
  - name: name
    label: Name
    type: text
    default: John
  - name: goal
    label: Goal
    type: textarea
    default: ""
---

# Welcome

Hello, {{name}}!

Your goal:
{{goal}}
`;

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

export async function openPromptForgeDb(): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
        const folders = db.createObjectStore(FOLDERS_STORE, { keyPath: "id" });
        folders.createIndex("by_parentId", "parentId", { unique: false });
      }

      if (!db.objectStoreNames.contains(PROMPTS_STORE)) {
        const prompts = db.createObjectStore(PROMPTS_STORE, { keyPath: "id" });
        prompts.createIndex("by_folderId", "folderId", { unique: false });
      }

      if (!db.objectStoreNames.contains(APP_STATE_STORE)) {
        db.createObjectStore(APP_STATE_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function ensureSeedData(): Promise<void> {
  const db = await openPromptForgeDb();
  const tx = db.transaction(
    [FOLDERS_STORE, PROMPTS_STORE, APP_STATE_STORE],
    "readwrite",
  );

  const foldersStore = tx.objectStore(FOLDERS_STORE);
  const promptsStore = tx.objectStore(PROMPTS_STORE);

  const existingRoot = await requestToPromise(foldersStore.get(ROOT_FOLDER_ID));
  if (existingRoot) {
    await transactionDone(tx);
    return;
  }

  const now = Date.now();

  const rootFolder: FolderRecord = {
    id: ROOT_FOLDER_ID,
    name: "Workspace",
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };

  const welcomePrompt: PromptRecord = {
    id: DEFAULT_PROMPT_ID,
    name: "welcome-template.md",
    folderId: ROOT_FOLDER_ID,
    content: DEFAULT_TEMPLATE,
    createdAt: now,
    updatedAt: now,
  };

  foldersStore.put(rootFolder);
  promptsStore.put(welcomePrompt);

  await transactionDone(tx);
}

export async function getAllFolders(): Promise<FolderRecord[]> {
  const db = await openPromptForgeDb();
  const tx = db.transaction(FOLDERS_STORE, "readonly");
  const store = tx.objectStore(FOLDERS_STORE);
  return (await requestToPromise(store.getAll())) as FolderRecord[];
}

export async function getAllPrompts(): Promise<PromptRecord[]> {
  const db = await openPromptForgeDb();
  const tx = db.transaction(PROMPTS_STORE, "readonly");
  const store = tx.objectStore(PROMPTS_STORE);
  return (await requestToPromise(store.getAll())) as PromptRecord[];
}

export async function getPromptById(id: string): Promise<PromptRecord | null> {
  const db = await openPromptForgeDb();
  const tx = db.transaction(PROMPTS_STORE, "readonly");
  const store = tx.objectStore(PROMPTS_STORE);
  return (
    ((await requestToPromise(store.get(id))) as PromptRecord | undefined) ??
    null
  );
}

export async function createPrompt(
  name: string,
  folderId: string | null,
  content: string,
): Promise<PromptRecord> {
  const db = await openPromptForgeDb();
  const tx = db.transaction(PROMPTS_STORE, "readwrite");
  const store = tx.objectStore(PROMPTS_STORE);

  const now = Date.now();
  const prompt: PromptRecord = {
    id: randomId("prompt"),
    name,
    folderId,
    content,
    createdAt: now,
    updatedAt: now,
  };

  store.put(prompt);
  await transactionDone(tx);
  return prompt;
}

export async function updatePromptContent(
  id: string,
  content: string,
): Promise<PromptRecord> {
  const db = await openPromptForgeDb();
  const tx = db.transaction(PROMPTS_STORE, "readwrite");
  const store = tx.objectStore(PROMPTS_STORE);

  const existing = (await requestToPromise(store.get(id))) as
    | PromptRecord
    | undefined;
  if (!existing) {
    throw new Error("Prompt not found");
  }

  const updated: PromptRecord = {
    ...existing,
    content,
    updatedAt: Date.now(),
  };

  store.put(updated);
  await transactionDone(tx);
  return updated;
}

export async function renamePrompt(
  id: string,
  name: string,
): Promise<PromptRecord> {
  const db = await openPromptForgeDb();
  const tx = db.transaction(PROMPTS_STORE, "readwrite");
  const store = tx.objectStore(PROMPTS_STORE);

  const existing = (await requestToPromise(store.get(id))) as
    | PromptRecord
    | undefined;
  if (!existing) {
    throw new Error("Prompt not found");
  }

  const updated: PromptRecord = {
    ...existing,
    name,
    updatedAt: Date.now(),
  };

  store.put(updated);
  await transactionDone(tx);
  return updated;
}

export async function deletePrompt(id: string): Promise<void> {
  const db = await openPromptForgeDb();
  const tx = db.transaction(PROMPTS_STORE, "readwrite");
  tx.objectStore(PROMPTS_STORE).delete(id);
  await transactionDone(tx);
}

export async function getAppState<T = unknown>(key: string): Promise<T | null> {
  const db = await openPromptForgeDb();
  const tx = db.transaction(APP_STATE_STORE, "readonly");
  const store = tx.objectStore(APP_STATE_STORE);
  const result = (await requestToPromise(store.get(key))) as
    | AppStateRecord<T>
    | undefined;
  return result?.value ?? null;
}

export async function setAppState<T = unknown>(
  key: string,
  value: T,
): Promise<void> {
  const db = await openPromptForgeDb();
  const tx = db.transaction(APP_STATE_STORE, "readwrite");
  tx.objectStore(APP_STATE_STORE).put({ key, value });
  await transactionDone(tx);
}

function buildFolderPath(
  folderId: string | null,
  folderMap: Map<string, FolderRecord>,
): string {
  if (!folderId) return "";
  const parts: string[] = [];
  let currentId: string | null = folderId;

  while (currentId) {
    const folder = folderMap.get(currentId);
    if (!folder) break;
    parts.unshift(folder.name);
    currentId = folder.parentId;
  }

  return `/${parts.join("/")}`;
}

export function promptToParsedFile(
  prompt: PromptRecord,
  folderMap: Map<string, FolderRecord>,
  numericId: number,
): ParsedFile {
  const frontMatter = parseFrontMatter(prompt.content);
  const folderPath = buildFolderPath(prompt.folderId, folderMap);

  return {
    id: prompt.id,
    numericId,
    name: prompt.name,
    path: `${folderPath}/${prompt.name}`,
    type: "file",
    content: prompt.content,
    bodyContent: frontMatter.body,
    metadata: frontMatter.metadata,
    rawFrontMatter: frontMatter.rawFrontMatter,
    hasFrontMatter: frontMatter.hasFrontMatter,
    folderId: prompt.folderId,
    createdAt: prompt.createdAt,
    updatedAt: prompt.updatedAt,
  };
}

export function buildFolderTree(
  folders: FolderRecord[],
  prompts: PromptRecord[],
): {
  folderTree: FolderNode | null;
  fileMap: Map<string, ParsedFile>;
} {
  if (!folders.length) {
    return { folderTree: null, fileMap: new Map() };
  }

  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const childrenByFolderId = new Map<string | null, FolderRecord[]>();

  for (const folder of folders) {
    const list = childrenByFolderId.get(folder.parentId) ?? [];
    list.push(folder);
    childrenByFolderId.set(folder.parentId, list);
  }

  for (const list of childrenByFolderId.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const promptsByFolderId = new Map<string | null, PromptRecord[]>();
  for (const prompt of prompts) {
    const list = promptsByFolderId.get(prompt.folderId) ?? [];
    list.push(prompt);
    promptsByFolderId.set(prompt.folderId, list);
  }

  for (const list of promptsByFolderId.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  const root = folders.find((f) => f.parentId === null) ?? folders[0];
  const fileMap = new Map<string, ParsedFile>();
  let numericId = 0;

  function makeFolderNode(folder: FolderRecord): FolderNode {
    const folderPath = buildFolderPath(folder.id, folderMap);
    const childFolders = (childrenByFolderId.get(folder.id) ?? []).map(
      makeFolderNode,
    );
    const childFiles = (promptsByFolderId.get(folder.id) ?? []).map(
      (prompt) => {
        const parsed = promptToParsedFile(prompt, folderMap, numericId++);
        fileMap.set(parsed.id, parsed);
        return {
          id: parsed.id,
          numericId: parsed.numericId,
          name: parsed.name,
          path: parsed.path,
          type: "file" as const,
        };
      },
    );

    return {
      id: folder.id,
      name: folder.name,
      path: folderPath || `/${folder.name}`,
      type: "directory",
      children: [...childFolders, ...childFiles],
    };
  }

  return {
    folderTree: makeFolderNode(root),
    fileMap,
  };
}

export async function createFolder(
  name: string,
  parentId: string | null,
): Promise<FolderRecord> {
  const db = await openPromptForgeDb();
  const tx = db.transaction(FOLDERS_STORE, "readwrite");
  const store = tx.objectStore(FOLDERS_STORE);

  const now = Date.now();
  const folder: FolderRecord = {
    id: randomId("folder"),
    name,
    parentId,
    createdAt: now,
    updatedAt: now,
  };

  store.put(folder);
  await transactionDone(tx);
  return folder;
}

export async function renameFolder(
  id: string,
  name: string,
): Promise<FolderRecord> {
  const db = await openPromptForgeDb();
  const tx = db.transaction(FOLDERS_STORE, "readwrite");
  const store = tx.objectStore(FOLDERS_STORE);

  const existing = (await requestToPromise(store.get(id))) as
    | FolderRecord
    | undefined;

  if (!existing) {
    throw new Error("Folder not found");
  }

  const updated: FolderRecord = {
    ...existing,
    name,
    updatedAt: Date.now(),
  };

  store.put(updated);
  await transactionDone(tx);
  return updated;
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await openPromptForgeDb();
  const tx = db.transaction([FOLDERS_STORE, PROMPTS_STORE], "readwrite");

  const foldersStore = tx.objectStore(FOLDERS_STORE);
  const promptsStore = tx.objectStore(PROMPTS_STORE);

  const folder = (await requestToPromise(foldersStore.get(id))) as
    | FolderRecord
    | undefined;

  if (!folder) {
    throw new Error("Folder not found");
  }

  const childFolders = (await requestToPromise(
    foldersStore.index("by_parentId").getAll(id),
  )) as FolderRecord[];

  if (childFolders.length > 0) {
    throw new Error("Folder is not empty");
  }

  const childPrompts = (await requestToPromise(
    promptsStore.index("by_folderId").getAll(id),
  )) as PromptRecord[];

  if (childPrompts.length > 0) {
    throw new Error("Folder is not empty");
  }

  foldersStore.delete(id);
  await transactionDone(tx);
}

export async function movePrompt(
  id: string,
  folderId: string | null,
): Promise<PromptRecord> {
  const db = await openPromptForgeDb();
  const tx = db.transaction(PROMPTS_STORE, "readwrite");
  const store = tx.objectStore(PROMPTS_STORE);

  const existing = (await requestToPromise(store.get(id))) as
    | PromptRecord
    | undefined;

  if (!existing) {
    throw new Error("Prompt not found");
  }

  const updated: PromptRecord = {
    ...existing,
    folderId,
    updatedAt: Date.now(),
  };

  store.put(updated);
  await transactionDone(tx);
  return updated;
}

export async function moveFolder(
  id: string,
  parentId: string | null,
): Promise<FolderRecord> {
  const db = await openPromptForgeDb();
  const tx = db.transaction(FOLDERS_STORE, "readwrite");
  const store = tx.objectStore(FOLDERS_STORE);

  const existing = (await requestToPromise(store.get(id))) as
    | FolderRecord
    | undefined;

  if (!existing) {
    throw new Error("Folder not found");
  }

  const updated: FolderRecord = {
    ...existing,
    parentId,
    updatedAt: Date.now(),
  };

  store.put(updated);
  await transactionDone(tx);
  return updated;
}
