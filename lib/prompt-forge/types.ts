export interface FileNode {
  id: string;
  numericId: number;
  name: string;
  path: string;
  type: "file";
}

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  type: "directory";
  children: (FileNode | FolderNode)[];
}

export interface ParsedFile extends FileNode {
  content: string;
  bodyContent: string;
  metadata: Record<string, unknown>;
  rawFrontMatter: string;
  hasFrontMatter?: boolean;
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface EditorState {
  isOpen: boolean;
  isNew: boolean;
  fileId: string | null;
  content: string;
  fileName: string;
  folderId: string | null;
}

export interface Parameter {
  name: string;
  type: "textarea" | "text" | "number" | "checkbox" | "select" | "radio";
  label: string;
  defaultValue: string | null;
  height: number | null;
  values: string[];
}

export interface FrontMatterResult {
  metadata: Record<string, unknown>;
  body: string;
  rawFrontMatter: string;
  hasFrontMatter: boolean;
}

export interface FolderRecord {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PromptRecord {
  id: string;
  name: string;
  folderId: string | null;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppStateRecord<T = unknown> {
  key: string;
  value: T;
}
