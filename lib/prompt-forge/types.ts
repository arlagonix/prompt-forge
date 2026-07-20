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

export type ClipboardImportFormat = "html" | "minified" | "markdown" | "plain_text";

export interface ClipboardImportConfig {
  enabled: boolean;
  formats: ClipboardImportFormat[];
  defaultFormat: ClipboardImportFormat;
}

export interface FolderImportConfig {
  enabled: boolean;
  formats: string[];
}

export interface ParameterOption {
  label: string;
  value: string;
}

export interface ParameterOptionGroup {
  label: string | null;
  options: ParameterOption[];
}

export interface Parameter {
  id: string;
  type:
    | "textarea"
    | "text"
    | "number"
    | "date"
    | "checkbox"
    | "select"
    | "combobox"
    | "radio";
  name: string;
  defaultValue: string | null;
  height: number | null;
  values: string[];
  optionGroups: ParameterOptionGroup[];
  clipboardImport: ClipboardImportConfig | null;
  folderImport: FolderImportConfig | null;
  inline: boolean;
  random: boolean;
}

export type FieldType = Parameter["type"];

export interface FrontMatterResult {
  metadata: Record<string, unknown>;
  body: string;
  rawFrontMatter: string;
  hasFrontMatter: boolean;
  error?: string;
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
  id: string;
  type: FieldType;
  name: string;
  defaultValue: string | null;
  height: number | null;
  values: string[];
  optionGroups: ParameterOptionGroup[];
  clipboardImport: ClipboardImportConfig | null;
  folderImport: FolderImportConfig | null;
  inline: boolean;
  random: boolean;
  scopeId: string | null;
}

export interface TemplateGroupDefinition {
  kind: "group";
  name: string | null;
  description: string | null;
  style: "solid" | "dashed" | "none";
  children: TemplateFormNode[];
}

export interface TemplateHeaderDefinition {
  kind: "header";
  name: string | null;
  description: string | null;
}

export interface TemplateHorizontalRuleDefinition {
  kind: "hr";
  style: "solid" | "dashed";
}

export interface TemplateRepeaterDefinition {
  kind: "repeater";
  id: string;
  name: string;
  description: string | null;
  children: TemplateFormNode[];
  scopeId: string | null;
}

export type TemplateFormNode =
  | TemplateFieldDefinition
  | TemplateGroupDefinition
  | TemplateHeaderDefinition
  | TemplateHorizontalRuleDefinition
  | TemplateRepeaterDefinition;

// Kept as an alias because the main renderer treats config nodes as render items.
export type TemplateRenderItem = TemplateFormNode;

export interface TemplateTextNode {
  kind: "text";
  text: string;
}

export interface TemplateFieldReferenceNode {
  kind: "field-ref";
  id: string;
  lookupDepth: number;
  definition: TemplateFieldDefinition;
}

export interface TemplateRepeaterNode {
  kind: "repeater";
  id: string;
  definition: TemplateRepeaterDefinition;
  children: TemplateBodyNode[];
}

export type TemplateConditionOperator =
  | "not_empty"
  | "empty"
  | "checked"
  | "unchecked"
  | "is"
  | "is_not";

export interface TemplateCondition {
  source: string;
  id: string;
  lookupDepth: number;
  definition: TemplateFieldDefinition | TemplateRepeaterDefinition;
  operator: TemplateConditionOperator;
  expectedValue?: string | boolean;
}

export interface TemplateIfBranch {
  condition: TemplateCondition;
  children: TemplateBodyNode[];
}

export interface TemplateIfNode {
  kind: "if";
  branches: TemplateIfBranch[];
  elseChildren: TemplateBodyNode[];
}

export type TemplateBodyNode =
  | TemplateTextNode
  | TemplateFieldReferenceNode
  | TemplateRepeaterNode
  | TemplateIfNode;

export interface ParsedTemplate {
  metadata: Record<string, unknown>;
  body: string;
  rootGroup: TemplateGroupDefinition;
  nodes: TemplateBodyNode[];
}

export interface TemplateScopeState {
  fields: Record<string, string>;
  repeaters: Record<string, TemplateScopeState[]>;
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
