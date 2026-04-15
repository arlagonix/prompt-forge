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

export type EditorMode = "prompt" | "template-starter";

export interface EditorState {
  isOpen: boolean;
  isNew: boolean;
  mode: EditorMode;
  fileId: string | null;
  content: string;
  fileName: string;
  folderId: string | null;
}

export type ClipboardImportFormat = "html" | "minified" | "markdown";

export interface ClipboardImportConfig {
  enabled: boolean;
  formats: ClipboardImportFormat[];
  defaultFormat: ClipboardImportFormat;
}

export interface Parameter {
  name: string;
  type: "textarea" | "text" | "number" | "checkbox" | "select" | "radio";
  label: string;
  defaultValue: string | null;
  height: number | null;
  values: string[];
  clipboardImport: ClipboardImportConfig | null;
  inline: boolean;
}

export type FieldType = Parameter["type"];

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

export interface TemplateFieldDefinition {
  kind: "field";
  name: string;
  type: FieldType;
  label: string;
  defaultValue: string | null;
  height: number | null;
  values: string[];
  clipboardImport: ClipboardImportConfig | null;
  inline: boolean;
  explicit: boolean;
}

export interface TemplateGroupDefinition {
  kind: "group";
  name: string;
  label: string;
  repeat: boolean;
  explicit: boolean;
  children: TemplateDefinition[];
  renderOrder: TemplateRenderItem[];
}

export type TemplateDefinition = TemplateFieldDefinition | TemplateGroupDefinition;
export type TemplateRenderItem =
  | { kind: "field"; field: TemplateFieldDefinition }
  | { kind: "group"; group: TemplateGroupDefinition };

export interface TemplateTextNode {
  kind: "text";
  text: string;
}

export interface TemplateFieldReferenceNode {
  kind: "field-ref";
  name: string;
  lookupDepth: number;
  definition: TemplateFieldDefinition;
}

export interface TemplateGroupNode {
  kind: "group";
  name: string;
  definition: TemplateGroupDefinition;
  children: TemplateBodyNode[];
}

export type TemplateBodyNode =
  | TemplateTextNode
  | TemplateFieldReferenceNode
  | TemplateGroupNode;

export interface ParsedTemplate {
  metadata: Record<string, unknown>;
  body: string;
  rootGroup: TemplateGroupDefinition;
  nodes: TemplateBodyNode[];
}

export interface TemplateScopeState {
  fields: Record<string, string>;
  groups: Record<string, TemplateScopeState[]>;
}

export interface ExportRootNode {
  type: "root";
  children: ExportNode[];
}

export interface ExportFolderNode {
  type: "folder";
  name: string;
  children: ExportNode[];
  createdAt?: number;
  updatedAt?: number;
}

export interface ExportTemplateNode {
  type: "template";
  name: string;
  content: string;
  createdAt?: number;
  updatedAt?: number;
}

export type ExportNode = ExportFolderNode | ExportTemplateNode;

export interface PromptForgeExportV1 {
  version: 1;
  exportedAt: string;
  root: ExportRootNode;
}
