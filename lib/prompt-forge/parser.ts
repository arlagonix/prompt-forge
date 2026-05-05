import YAML from "yaml";
import type {
  ClipboardImportConfig,
  ClipboardImportFormat,
  FolderImportConfig,
  FieldType,
  FrontMatterResult,
  Parameter,
  ParameterOption,
  ParameterOptionGroup,
  ParsedTemplate,
  TemplateBodyNode,
  TemplateDefinition,
  TemplateFieldDefinition,
  TemplateFieldReferenceNode,
  TemplateGroupDefinition,
  TemplateGroupNode,
  TemplateIfNode,
  TemplateCondition,
  TemplateRenderItem,
  TemplateScopeState,
} from "./types";

export interface PromptSegment {
  text: string;
  isUserValue: boolean;
  paramName?: string;
}

const NAME_RE = /^[a-zA-Z0-9_-]+$/;
const FIELD_TYPES: FieldType[] = [
  "textarea",
  "text",
  "number",
  "checkbox",
  "select",
  "combobox",
  "radio",
];

const CLIPBOARD_IMPORT_FORMATS: ClipboardImportFormat[] = [
  "html",
  "minified",
  "markdown",
  "plain_text",
];

function isClipboardImportFormat(
  value: unknown,
): value is ClipboardImportFormat {
  return CLIPBOARD_IMPORT_FORMATS.includes(value as ClipboardImportFormat);
}

function normalizeClipboardImportConfig(
  raw: unknown,
  fieldType: FieldType,
  fieldName: string,
): ClipboardImportConfig | null {
  if (raw == null) return null;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      `Field "${fieldName}" must define clipboard_import as an object.`,
    );
  }

  if (fieldType !== "textarea") {
    throw new Error(
      `Field "${fieldName}" can only use clipboard_import with textarea type.`,
    );
  }

  const item = raw as Record<string, unknown>;
  const enabled = item.enabled == null ? true : Boolean(item.enabled);

  const normalizedFormats = Array.isArray(item.formats)
    ? item.formats.filter(isClipboardImportFormat)
    : [];
  const formats = normalizedFormats.length > 0
    ? normalizedFormats
    : [...CLIPBOARD_IMPORT_FORMATS];

  const defaultFormat = isClipboardImportFormat(item.default_format)
    ? item.default_format
    : formats[0];

  return {
    enabled,
    formats,
    defaultFormat: formats.includes(defaultFormat) ? defaultFormat : formats[0],
  };
}

function normalizeFolderImportFormats(rawFormats: unknown): string[] {
  if (rawFormats == null) return [".md"];

  if (!Array.isArray(rawFormats) || rawFormats.length === 0) {
    throw new Error(
      'folder_import.formats must be a non-empty array of extensions like [".md", ".txt"].',
    );
  }

  const seen = new Set<string>();
  const formats: string[] = [];

  for (const entry of rawFormats) {
    if (typeof entry !== "string") {
      throw new Error(
        'folder_import.formats must be a non-empty array of extensions like [".md", ".txt"].',
      );
    }

    const normalized = entry.trim().toLowerCase();
    if (!/^\.[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(normalized)) {
      throw new Error(
        'folder_import.formats must be a non-empty array of extensions like [".md", ".txt"].',
      );
    }

    if (!seen.has(normalized)) {
      seen.add(normalized);
      formats.push(normalized);
    }
  }

  return formats.length > 0 ? formats : [".md"];
}

function normalizeFolderImportConfig(
  raw: unknown,
  fieldType: FieldType,
  fieldName: string,
): FolderImportConfig | null {
  if (raw == null) return null;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      `Field "${fieldName}" must define folder_import as an object.`,
    );
  }

  if (fieldType !== "textarea") {
    throw new Error(
      `Field "${fieldName}" can only use folder_import with textarea type.`,
    );
  }

  const item = raw as Record<string, unknown>;

  return {
    enabled: item.enabled == null ? true : Boolean(item.enabled),
    formats: normalizeFolderImportFormats(item.formats),
  };
}

function formatParamName(p: string): string {
  return p.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isSupportedParamType(value: unknown): value is FieldType {
  return FIELD_TYPES.includes(value as FieldType);
}

function normalizeScalarToDisplayString(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  return String(value ?? "").trim();
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeScalarToDisplayString).filter(Boolean);
}

function normalizeOptionEntry(
  raw: unknown,
  fieldName: string,
): ParameterOption {
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    const normalized = normalizeScalarToDisplayString(raw);
    if (!normalized) {
      throw new Error(`Field "${fieldName}" contains an empty option.`);
    }
    return { label: normalized, value: normalized };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Field "${fieldName}" contains an invalid option entry.`);
  }

  const item = raw as Record<string, unknown>;
  const label = typeof item.label === "string" ? item.label.trim() : "";
  if (!label) {
    throw new Error(`Field "${fieldName}" option objects must include a non-empty label.`);
  }

  const value = item.value == null
    ? label
    : normalizeScalarToDisplayString(item.value);

  if (!value) {
    throw new Error(`Field "${fieldName}" contains an option with an empty value.`);
  }

  return { label, value };
}

function normalizeOptionGroups(
  fieldType: FieldType,
  fieldName: string,
  rawValues: unknown,
  rawGroups: unknown,
): ParameterOptionGroup[] {
  const supportsChoiceOptions =
    fieldType === "select" || fieldType === "combobox" || fieldType === "radio";

  if (rawValues != null && rawGroups != null) {
    throw new Error(
      `Field "${fieldName}" cannot define both values and groups at the same time.`,
    );
  }

  if (!supportsChoiceOptions) {
    return [];
  }

  const groups: ParameterOptionGroup[] = [];

  if (rawGroups != null) {
    if (fieldType !== "select" && fieldType !== "combobox") {
      throw new Error(
        `Field "${fieldName}" can only use groups with select or combobox type.`,
      );
    }

    if (!Array.isArray(rawGroups)) {
      throw new Error(`Field "${fieldName}" must define groups as an array.`);
    }

    for (const rawGroup of rawGroups) {
      if (!rawGroup || typeof rawGroup !== "object" || Array.isArray(rawGroup)) {
        throw new Error(`Field "${fieldName}" contains an invalid group entry.`);
      }

      const group = rawGroup as Record<string, unknown>;
      const label = typeof group.label === "string" ? group.label.trim() : "";
      if (!label) {
        throw new Error(`Field "${fieldName}" group entries must include a non-empty label.`);
      }

      const rawOptions = Array.isArray(group.options) ? group.options : null;
      if (!rawOptions || rawOptions.length === 0) {
        throw new Error(`Field "${fieldName}" group "${label}" must include a non-empty options array.`);
      }

      groups.push({
        label,
        options: rawOptions.map((option) => normalizeOptionEntry(option, fieldName)),
      });
    }
  } else if (rawValues != null) {
    if (!Array.isArray(rawValues)) {
      throw new Error(`Field "${fieldName}" must define values as an array.`);
    }

    groups.push({
      label: null,
      options: rawValues.map((option) => normalizeOptionEntry(option, fieldName)),
    });
  }

  const seenValues = new Set<string>();
  for (const group of groups) {
    for (const option of group.options) {
      const key = option.value.toLowerCase();
      if (seenValues.has(key)) {
        throw new Error(`Field "${fieldName}" contains duplicate option value "${option.value}".`);
      }
      seenValues.add(key);
    }
  }

  return groups;
}

function flattenOptionGroups(groups: ParameterOptionGroup[]): string[] {
  return groups.flatMap((group) => group.options.map((option) => option.value));
}

function defaultValueForType(
  type: FieldType,
  rawDefaultValue: unknown,
  values: string[],
): string | null {
  if (rawDefaultValue != null) {
    const normalizedDefault = normalizeScalarToDisplayString(rawDefaultValue);

    if ((type === "select" || type === "combobox" || type === "radio") && values.length > 0) {
      const matched = values.find(
        (value) => value.toLowerCase() === normalizedDefault.toLowerCase(),
      );
      return matched ?? normalizedDefault;
    }

    return normalizedDefault;
  }

  if (type === "checkbox") return "false";
  if ((type === "select" || type === "combobox" || type === "radio") && values.length > 0) {
    return values[0];
  }
  return null;
}

function createFieldDefinition(
  name: string,
  options: Partial<TemplateFieldDefinition> = {},
): TemplateFieldDefinition {
  const type = isSupportedParamType(options.type) ? options.type : "textarea";
  const optionGroups = Array.isArray(options.optionGroups)
    ? options.optionGroups
    : [];
  const values = optionGroups.length > 0
    ? flattenOptionGroups(optionGroups)
    : normalizeStringArray(options.values);
  return {
    kind: "field",
    name,
    type,
    label:
      typeof options.label === "string" && options.label.trim()
        ? options.label.trim()
        : formatParamName(name),
    defaultValue: defaultValueForType(type, options.defaultValue, values),
    height:
      typeof options.height === "number" && Number.isFinite(options.height)
        ? options.height
        : type === "textarea"
          ? 4
          : null,
    values,
    optionGroups,
    clipboardImport: options.clipboardImport ?? null,
    folderImport: options.folderImport ?? null,
    inline: Boolean(options.inline),
    explicit: options.explicit ?? false,
  };
}

function createGroupDefinition(
  name: string,
  options: Partial<TemplateGroupDefinition> = {},
): TemplateGroupDefinition {
  return {
    kind: "group",
    name,
    label:
      typeof options.label === "string" && options.label.trim()
        ? options.label.trim()
        : formatParamName(name),
    repeat: Boolean(options.repeat),
    explicit: options.explicit ?? false,
    children: options.children ?? [],
    renderOrder: options.renderOrder ?? [],
  };
}

function getDefinitionByName(
  group: TemplateGroupDefinition,
  name: string,
): TemplateDefinition | null {
  return group.children.find((child) => child.name === name) ?? null;
}

function getFieldDefinitionByName(
  group: TemplateGroupDefinition,
  name: string,
): TemplateFieldDefinition | null {
  const found = getDefinitionByName(group, name);
  return found?.kind === "field" ? found : null;
}

function getGroupDefinitionByName(
  group: TemplateGroupDefinition,
  name: string,
): TemplateGroupDefinition | null {
  const found = getDefinitionByName(group, name);
  return found?.kind === "group" ? found : null;
}

function ensureUniqueChildName(group: TemplateGroupDefinition, name: string) {
  if (getDefinitionByName(group, name)) {
    throw new Error(`Duplicate name "${name}" in scope "${group.name}".`);
  }
}

function normalizeMetadataParam(
  raw: unknown,
  ancestorGroupNames: string[] = [],
): TemplateDefinition | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as Record<string, unknown>;
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!NAME_RE.test(name)) return null;

  if (item.type === "group") {
    if (ancestorGroupNames.includes(name)) {
      throw new Error(
        `Group name "${name}" must be unique along the nesting path.`,
      );
    }

    const childGroup = createGroupDefinition(name, {
      label: typeof item.label === "string" ? item.label : undefined,
      repeat: Boolean(item.repeat),
      explicit: true,
      children: [],
      renderOrder: [],
    });

    const rawChildren = Array.isArray(item.fields) ? item.fields : [];
    for (const rawChild of rawChildren) {
      const normalizedChild = normalizeMetadataParam(rawChild, [
        ...ancestorGroupNames,
        name,
      ]);
      if (!normalizedChild) continue;
      ensureUniqueChildName(childGroup, normalizedChild.name);
      childGroup.children.push(normalizedChild);
    }

    return childGroup;
  }

  const type = isSupportedParamType(item.type) ? item.type : "textarea";
  const optionGroups = normalizeOptionGroups(type, name, item.values, item.groups);
  const values = flattenOptionGroups(optionGroups);
  const rawDefaultValue =
    item.default == null
      ? null
      : normalizeScalarToDisplayString(item.default);

  if (
    rawDefaultValue != null &&
    values.length > 0 &&
    (type === "select" || type === "combobox" || type === "radio")
  ) {
    const hasMatch = values.some(
      (value) => value.toLowerCase() === rawDefaultValue.toLowerCase(),
    );
    if (!hasMatch) {
      throw new Error(
        `Field "${name}" default value "${rawDefaultValue}" does not match any option value.`,
      );
    }
  }

  return createFieldDefinition(name, {
    type,
    label: typeof item.label === "string" ? item.label : undefined,
    defaultValue: rawDefaultValue,
    height: typeof item.height === "number" ? item.height : undefined,
    values,
    optionGroups,
    clipboardImport: normalizeClipboardImportConfig(
      item.clipboard_import,
      type,
      name,
    ),
    folderImport: normalizeFolderImportConfig(
      item.folder_import,
      type,
      name,
    ),
    inline: Boolean(item.inline),
    explicit: true,
  });
}

export function parseFrontMatter(content: string): FrontMatterResult {
  if (typeof content !== "string") {
    return {
      metadata: {},
      body: "",
      rawFrontMatter: "",
      hasFrontMatter: false,
    };
  }

  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^(\uFEFF)?---\n([\s\S]*?)\n---(?:\n|$)/);

  if (!match) {
    return {
      metadata: {},
      body: content,
      rawFrontMatter: "",
      hasFrontMatter: false,
    };
  }

  const rawFrontMatter = match[0];
  const rawBody = normalized.slice(rawFrontMatter.length);
  const metadataBlock = match[2];

  let metadata: Record<string, unknown> = {};

  try {
    const parsed = YAML.parse(metadataBlock);
    metadata =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
  } catch {
    metadata = {};
  }

  return {
    metadata,
    body: rawBody.replace(/^\n+/, ""),
    rawFrontMatter,
    hasFrontMatter: true,
  };
}

function ensureRenderItem(
  group: TemplateGroupDefinition,
  item: TemplateRenderItem,
): void {
  const exists = group.renderOrder.some((current) => {
    if (current.kind !== item.kind) return false;
    if (current.kind === "field" && item.kind === "field") {
      return current.field.name === item.field.name;
    }
    if (current.kind === "group" && item.kind === "group") {
      return current.group.name === item.group.name;
    }
    return false;
  });

  if (!exists) {
    group.renderOrder.push(item);
  }
}

function resolveFieldReference(
  scopeStack: TemplateGroupDefinition[],
  name: string,
): {
  definition: TemplateFieldDefinition;
  lookupDepth: number;
  owner: TemplateGroupDefinition;
} {
  for (let depth = 0; depth < scopeStack.length; depth += 1) {
    const group = scopeStack[scopeStack.length - 1 - depth];
    const field = getFieldDefinitionByName(group, name);
    if (field) {
      return { definition: field, lookupDepth: depth, owner: group };
    }
  }

  const currentScope = scopeStack[scopeStack.length - 1];
  if (getGroupDefinitionByName(currentScope, name)) {
    throw new Error(
      `Placeholder "${name}" conflicts with group "${name}" in scope "${currentScope.name}".`,
    );
  }

  const implicitField = createFieldDefinition(name, { explicit: false });
  currentScope.children.push(implicitField);
  return { definition: implicitField, lookupDepth: 0, owner: currentScope };
}

type TemplateToken =
  | { kind: "field"; start: number; end: number; inner: string }
  | { kind: "control"; start: number; end: number; inner: string };

function findNextTemplateToken(body: string, cursor: number): TemplateToken | null {
  const fieldStart = body.indexOf("{{", cursor);
  const controlStart = body.indexOf("{%", cursor);

  if (fieldStart === -1 && controlStart === -1) return null;

  if (controlStart !== -1 && (fieldStart === -1 || controlStart < fieldStart)) {
    const end = body.indexOf("%}", controlStart + 2);
    if (end === -1) {
      return null;
    }
    return {
      kind: "control",
      start: controlStart,
      end: end + 2,
      inner: body.slice(controlStart + 2, end).trim(),
    };
  }

  const end = body.indexOf("}}", fieldStart + 2);
  if (end === -1) {
    return null;
  }
  return {
    kind: "field",
    start: fieldStart,
    end: end + 2,
    inner: body.slice(fieldStart + 2, end).trim(),
  };
}

function parseConditionValue(raw: string): string | boolean {
  const trimmed = raw.trim();
  if (/^true$/i.test(trimmed)) return true;
  if (/^false$/i.test(trimmed)) return false;

  const quoted = trimmed.match(/^("([\s\S]*)"|'([\s\S]*)')$/);
  if (quoted) {
    return quoted[2] ?? quoted[3] ?? "";
  }

  return trimmed;
}

function resolveConditionReference(
  scopeStack: TemplateGroupDefinition[],
  name: string,
): {
  definition: TemplateFieldDefinition | TemplateGroupDefinition;
  lookupDepth: number;
  owner: TemplateGroupDefinition;
} {
  for (let depth = 0; depth < scopeStack.length; depth += 1) {
    const group = scopeStack[scopeStack.length - 1 - depth];
    const found = getDefinitionByName(group, name);
    if (found) {
      return { definition: found, lookupDepth: depth, owner: group };
    }
  }

  const currentScope = scopeStack[scopeStack.length - 1];
  const implicitField = createFieldDefinition(name, { explicit: false });
  currentScope.children.push(implicitField);
  return { definition: implicitField, lookupDepth: 0, owner: currentScope };
}

function parseTemplateCondition(
  rawCondition: string,
  scopeStack: TemplateGroupDefinition[],
): TemplateCondition {
  const source = rawCondition.trim().replace(/^\((.*)\)$/s, "$1").trim();
  if (!source) {
    throw new Error("Condition cannot be empty.");
  }

  let match = source.match(/^([a-zA-Z0-9_-]+)$/);
  if (match) {
    const resolved = resolveConditionReference(scopeStack, match[1]);
    if (resolved.definition.kind === "field") {
      ensureRenderItem(resolved.owner, { kind: "field", field: resolved.definition });
    } else {
      ensureRenderItem(resolved.owner, { kind: "group", group: resolved.definition });
    }
    return {
      source,
      name: match[1],
      lookupDepth: resolved.lookupDepth,
      definition: resolved.definition,
      operator: "not_empty",
    };
  }

  match = source.match(/^([a-zA-Z0-9_-]+)\s+(empty|not_empty|checked|unchecked)$/i);
  if (match) {
    const resolved = resolveConditionReference(scopeStack, match[1]);
    if (resolved.definition.kind === "field") {
      ensureRenderItem(resolved.owner, { kind: "field", field: resolved.definition });
    } else {
      ensureRenderItem(resolved.owner, { kind: "group", group: resolved.definition });
    }
    return {
      source,
      name: match[1],
      lookupDepth: resolved.lookupDepth,
      definition: resolved.definition,
      operator: match[2].toLowerCase() as TemplateCondition["operator"],
    };
  }

  match = source.match(/^([a-zA-Z0-9_-]+)\s+(?:is|=)\s+([\s\S]+)$/i);
  if (match) {
    const resolved = resolveConditionReference(scopeStack, match[1]);
    if (resolved.definition.kind === "field") {
      ensureRenderItem(resolved.owner, { kind: "field", field: resolved.definition });
    } else {
      ensureRenderItem(resolved.owner, { kind: "group", group: resolved.definition });
    }
    return {
      source,
      name: match[1],
      lookupDepth: resolved.lookupDepth,
      definition: resolved.definition,
      operator: "is",
      expectedValue: parseConditionValue(match[2]),
    };
  }

  match = source.match(/^([a-zA-Z0-9_-]+)\s+(?:is_not|not)\s+([\s\S]+)$/i);
  if (match) {
    const resolved = resolveConditionReference(scopeStack, match[1]);
    if (resolved.definition.kind === "field") {
      ensureRenderItem(resolved.owner, { kind: "field", field: resolved.definition });
    } else {
      ensureRenderItem(resolved.owner, { kind: "group", group: resolved.definition });
    }
    return {
      source,
      name: match[1],
      lookupDepth: resolved.lookupDepth,
      definition: resolved.definition,
      operator: "is_not",
      expectedValue: parseConditionValue(match[2]),
    };
  }

  throw new Error(
    `Unsupported condition "${source}". Use forms like "field empty", "field not_empty", or "field is \"value\"".`,
  );
}

export function parseTemplate(content: string | null): ParsedTemplate {
  if (typeof content !== "string") {
    return {
      metadata: {},
      body: "",
      rootGroup: createGroupDefinition("root", { explicit: true }),
      nodes: [],
    };
  }

  const { metadata, body } = parseFrontMatter(content);
  const rootGroup = createGroupDefinition("root", {
    label: "Root",
    explicit: true,
  });

  const metadataParamsRaw = Array.isArray(metadata.params)
    ? metadata.params
    : [];
  for (const rawParam of metadataParamsRaw) {
    const normalized = normalizeMetadataParam(rawParam, []);
    if (!normalized) continue;
    ensureUniqueChildName(rootGroup, normalized.name);
    rootGroup.children.push(normalized);
  }

  type ParseFrame =
    | { kind: "root"; nodes: TemplateBodyNode[] }
    | { kind: "group"; name: string; node: TemplateGroupNode; nodes: TemplateBodyNode[] }
    | { kind: "if"; node: TemplateIfNode; nodes: TemplateBodyNode[]; inElse: boolean };

  const rootNodes: TemplateBodyNode[] = [];
  const frameStack: ParseFrame[] = [{ kind: "root", nodes: rootNodes }];
  const scopeStack: TemplateGroupDefinition[] = [rootGroup];

  const currentNodes = () => frameStack[frameStack.length - 1].nodes;

  let cursor = 0;
  while (cursor < body.length) {
    const token = findNextTemplateToken(body, cursor);

    if (!token) {
      if (cursor < body.length) {
        currentNodes().push({ kind: "text", text: body.slice(cursor) });
      }
      break;
    }

    if (token.start > cursor) {
      currentNodes().push({ kind: "text", text: body.slice(cursor, token.start) });
    }

    if (token.kind === "field") {
      const inner = token.inner;
      if (NAME_RE.test(inner)) {
        const resolved = resolveFieldReference(scopeStack, inner);
        ensureRenderItem(resolved.owner, {
          kind: "field",
          field: resolved.definition,
        });
        currentNodes().push({
          kind: "field-ref",
          name: inner,
          definition: resolved.definition,
          lookupDepth: resolved.lookupDepth,
        });
      } else {
        currentNodes().push({ kind: "text", text: body.slice(token.start, token.end) });
      }
      cursor = token.end;
      continue;
    }

    const control = token.inner;
    const groupStartMatch = control.match(/^group\s+([a-zA-Z0-9_-]+)$/i);

    if (groupStartMatch) {
      const groupName = groupStartMatch[1];
      const currentScope = scopeStack[scopeStack.length - 1];
      const childGroup = getGroupDefinitionByName(currentScope, groupName);
      if (!childGroup) {
        throw new Error(
          `Group "${groupName}" is not declared in scope "${currentScope.name}".`,
        );
      }

      ensureRenderItem(currentScope, { kind: "group", group: childGroup });
      const groupNode: TemplateGroupNode = {
        kind: "group",
        name: groupName,
        definition: childGroup,
        children: [],
      };
      currentNodes().push(groupNode);
      frameStack.push({ kind: "group", name: groupName, node: groupNode, nodes: groupNode.children });
      scopeStack.push(childGroup);
      cursor = token.end;
      continue;
    }

    if (/^end_group$/i.test(control)) {
      const frame = frameStack[frameStack.length - 1];
      if (frame.kind !== "group") {
        throw new Error("Unexpected end_group.");
      }
      frameStack.pop();
      scopeStack.pop();
      cursor = token.end;
      continue;
    }

    const ifStartMatch = control.match(/^if\s+([\s\S]+)$/i);
    if (ifStartMatch) {
      const condition = parseTemplateCondition(ifStartMatch[1], scopeStack);
      const ifNode: TemplateIfNode = {
        kind: "if",
        branches: [{ condition, children: [] }],
        elseChildren: [],
      };
      currentNodes().push(ifNode);
      frameStack.push({
        kind: "if",
        node: ifNode,
        nodes: ifNode.branches[0].children,
        inElse: false,
      });
      cursor = token.end;
      continue;
    }

    const elseIfMatch = control.match(/^else_if\s+([\s\S]+)$/i);
    if (elseIfMatch) {
      const frame = frameStack[frameStack.length - 1];
      if (frame.kind !== "if") {
        throw new Error("Unexpected else_if without an open if block.");
      }
      if (frame.inElse) {
        throw new Error("else_if cannot appear after else in the same if block.");
      }
      const condition = parseTemplateCondition(elseIfMatch[1], scopeStack);
      const branch = { condition, children: [] as TemplateBodyNode[] };
      frame.node.branches.push(branch);
      frame.nodes = branch.children;
      cursor = token.end;
      continue;
    }

    if (/^else$/i.test(control)) {
      const frame = frameStack[frameStack.length - 1];
      if (frame.kind !== "if") {
        throw new Error("Unexpected else without an open if block.");
      }
      if (frame.inElse) {
        throw new Error("Only one else block is allowed inside an if block.");
      }
      frame.inElse = true;
      frame.nodes = frame.node.elseChildren;
      cursor = token.end;
      continue;
    }

    if (/^end_if$/i.test(control)) {
      const frame = frameStack[frameStack.length - 1];
      if (frame.kind !== "if") {
        throw new Error("Unexpected end_if.");
      }
      frameStack.pop();
      cursor = token.end;
      continue;
    }

    currentNodes().push({ kind: "text", text: body.slice(token.start, token.end) });
    cursor = token.end;
  }

  const openFrame = frameStack[frameStack.length - 1];
  if (openFrame.kind === "group") {
    throw new Error(`Group "${openFrame.name}" was not closed.`);
  }
  if (openFrame.kind === "if") {
    throw new Error("If block was not closed.");
  }

  return {
    metadata,
    body,
    rootGroup,
    nodes: rootNodes,
  };
}

export function extractParameters(content: string | null): Parameter[] {
  try {
    const parsed = parseTemplate(content);
    return parsed.rootGroup.renderOrder
      .filter(
        (item): item is { kind: "field"; field: TemplateFieldDefinition } =>
          item.kind === "field",
      )
      .map((item) => ({
        name: item.field.name,
        type: item.field.type,
        label: item.field.label,
        defaultValue: item.field.defaultValue,
        height: item.field.height,
        values: item.field.values,
        optionGroups: item.field.optionGroups,
        clipboardImport: item.field.clipboardImport,
        folderImport: item.field.folderImport,
        inline: item.field.inline,
      }));
  } catch {
    return [];
  }
}

export function createInitialScopeState(
  group: TemplateGroupDefinition,
): TemplateScopeState {
  const fields: Record<string, string> = {};
  const groups: Record<string, TemplateScopeState[]> = {};

  for (const item of group.renderOrder) {
    if (item.kind === "field") {
      fields[item.field.name] = item.field.defaultValue ?? "";
      continue;
    }

    groups[item.group.name] = [createInitialScopeState(item.group)];
  }

  return { fields, groups };
}

function hasNonEmptySegmentText(segments: PromptSegment[]): boolean {
  return segments.some((segment) => segment.text.length > 0);
}

function splitRepeatGroupNodes(nodes: TemplateBodyNode[]): {
  itemNodes: TemplateBodyNode[];
  separatorText: string;
} {
  if (nodes.length === 0) {
    return { itemNodes: nodes, separatorText: "" };
  }

  const lastNode = nodes[nodes.length - 1];
  if (lastNode.kind !== "text") {
    return { itemNodes: nodes, separatorText: "" };
  }

  return {
    itemNodes: nodes.slice(0, -1),
    separatorText: lastNode.text,
  };
}

function getConditionRuntimeValue(
  condition: TemplateCondition,
  scopeStack: TemplateScopeState[],
): unknown {
  const targetScopeIndex = Math.max(
    0,
    scopeStack.length - 1 - condition.lookupDepth,
  );
  const targetScope = scopeStack[targetScopeIndex];

  if (condition.definition.kind === "group") {
    return targetScope.groups[condition.definition.name] ?? [];
  }

  return targetScope.fields[condition.definition.name] ?? "";
}

function isRuntimeValueEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "boolean") return !value;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

function normalizeConditionComparable(value: unknown): string | boolean {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  return String(value ?? "").trim();
}

function compareConditionValue(value: unknown, expectedValue: unknown): boolean {
  const actual = normalizeConditionComparable(value);

  if (typeof expectedValue === "boolean") {
    if (typeof actual === "boolean") return actual === expectedValue;
    return String(actual).trim().toLowerCase() === String(expectedValue);
  }

  return String(actual) === String(expectedValue ?? "");
}

function evaluateCondition(
  condition: TemplateCondition,
  scopeStack: TemplateScopeState[],
): boolean {
  const value = getConditionRuntimeValue(condition, scopeStack);

  switch (condition.operator) {
    case "empty":
      return isRuntimeValueEmpty(value);
    case "not_empty":
      return !isRuntimeValueEmpty(value);
    case "checked":
      return String(value).trim().toLowerCase() === "true";
    case "unchecked":
      return String(value).trim().toLowerCase() !== "true";
    case "is":
      return compareConditionValue(value, condition.expectedValue);
    case "is_not":
      return !compareConditionValue(value, condition.expectedValue);
    default:
      return false;
  }
}

function buildSegmentsFromNodes(
  nodes: TemplateBodyNode[],
  scopeStack: TemplateScopeState[],
): PromptSegment[] {
  const segments: PromptSegment[] = [];

  for (const node of nodes) {
    if (node.kind === "text") {
      segments.push({ text: node.text, isUserValue: false });
      continue;
    }

    if (node.kind === "field-ref") {
      const targetScopeIndex = Math.max(
        0,
        scopeStack.length - 1 - node.lookupDepth,
      );
      const targetScope = scopeStack[targetScopeIndex];
      const value = targetScope.fields[node.definition.name] ?? "";
      segments.push({
        text: value,
        isUserValue: true,
        paramName: node.definition.name,
      });
      continue;
    }

    if (node.kind === "if") {
      const matchingBranch = node.branches.find((branch) =>
        evaluateCondition(branch.condition, scopeStack),
      );
      segments.push(
        ...buildSegmentsFromNodes(
          matchingBranch ? matchingBranch.children : node.elseChildren,
          scopeStack,
        ),
      );
      continue;
    }

    const currentScope = scopeStack[scopeStack.length - 1];
    const instances = currentScope.groups[node.definition.name] ?? [];
    const groupSegments: PromptSegment[] = [];

    const repeatParts = node.definition.repeat
      ? splitRepeatGroupNodes(node.children)
      : { itemNodes: node.children, separatorText: "" };

    let renderedInstanceCount = 0;

    for (const instance of instances) {
      const instanceSegments = buildSegmentsFromNodes(repeatParts.itemNodes, [
        ...scopeStack,
        instance,
      ]);

      if (!hasNonEmptySegmentText(instanceSegments)) {
        continue;
      }

      if (renderedInstanceCount > 0 && repeatParts.separatorText.length > 0) {
        groupSegments.push({
          text: repeatParts.separatorText,
          isUserValue: false,
        });
      }

      groupSegments.push(...instanceSegments);
      renderedInstanceCount += 1;
    }

    segments.push(...groupSegments);
  }

  return segments;
}

export function buildPromptSegmentsFromTemplate(
  template: ParsedTemplate,
  state: TemplateScopeState,
): PromptSegment[] {
  return buildSegmentsFromNodes(template.nodes, [state]);
}

export function buildPromptFromTemplate(
  template: ParsedTemplate,
  state: TemplateScopeState,
): string {
  return buildPromptSegmentsFromTemplate(template, state)
    .map((segment) => segment.text)
    .join("");
}

export function buildPromptSegments(
  bodyContent: string | null,
  content: string | null,
  formValues: Map<string, string>,
): PromptSegment[] {
  const tmpl = bodyContent ?? content ?? "";
  const out: PromptSegment[] = [];
  let i = 0;

  while (i < tmpl.length) {
    const s = tmpl.indexOf("{{", i);
    if (s === -1) {
      if (i < tmpl.length) {
        out.push({ text: tmpl.slice(i), isUserValue: false });
      }
      break;
    }

    if (s > i) {
      out.push({ text: tmpl.slice(i, s), isUserValue: false });
    }

    const e = tmpl.indexOf("}}", s + 2);
    if (e === -1) {
      out.push({ text: tmpl.slice(s), isUserValue: false });
      break;
    }

    const name = tmpl.slice(s + 2, e).trim();

    if (NAME_RE.test(name) && formValues.has(name)) {
      out.push({
        text: formValues.get(name) || "",
        isUserValue: true,
        paramName: name,
      });
    } else {
      out.push({ text: tmpl.slice(s, e + 2), isUserValue: false });
    }

    i = e + 2;
  }

  return out;
}

export function buildPrompt(
  bodyContent: string | null,
  content: string | null,
  _params: Parameter[],
  formValues: Map<string, string>,
): string | null {
  return buildPromptSegments(bodyContent, content, formValues)
    .map((segment) => segment.text)
    .join("");
}

export function stripReusableFlag(content: string): string {
  if (typeof content !== "string" || !content.trim()) return content;

  const { metadata, body, hasFrontMatter } = parseFrontMatter(content);

  if (!hasFrontMatter) {
    return content;
  }

  const nextMetadata = { ...metadata };
  delete nextMetadata.reusable;

  const metadataKeys = Object.keys(nextMetadata);

  if (metadataKeys.length === 0) {
    return body;
  }

  const serialized = YAML.stringify(nextMetadata).trimEnd();
  return `---\n${serialized}\n---\n\n${body}`;
}
