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
  TemplateCondition,
  TemplateFieldDefinition,
  TemplateFormNode,
  TemplateGroupDefinition,
  TemplateIfNode,
  TemplateRepeaterDefinition,
  TemplateRepeaterNode,
  TemplateScopeState,
} from "./types";

export interface PromptSegment {
  text: string;
  isUserValue: boolean;
  paramName?: string;
}

const ID_RE = /^[a-zA-Z0-9_-]+$/;
const FIELD_TYPES: FieldType[] = [
  "textarea",
  "text",
  "number",
  "date",
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
  fieldId: string,
): ClipboardImportConfig | null {
  if (raw == null) return null;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      `Field "${fieldId}" must define clipboard_import as an object.`,
    );
  }

  if (fieldType !== "textarea") {
    throw new Error(
      `Field "${fieldId}" can only use clipboard_import with textarea type.`,
    );
  }

  const item = raw as Record<string, unknown>;
  const enabled = item.enabled == null ? true : Boolean(item.enabled);
  const normalizedFormats = Array.isArray(item.formats)
    ? item.formats.filter(isClipboardImportFormat)
    : [];
  const formats =
    normalizedFormats.length > 0
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
  fieldId: string,
): FolderImportConfig | null {
  if (raw == null) return null;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      `Field "${fieldId}" must define folder_import as an object.`,
    );
  }

  if (fieldType !== "textarea") {
    throw new Error(
      `Field "${fieldId}" can only use folder_import with textarea type.`,
    );
  }

  const item = raw as Record<string, unknown>;
  return {
    enabled: item.enabled == null ? true : Boolean(item.enabled),
    formats: normalizeFolderImportFormats(item.formats),
  };
}

function formatParamName(id: string): string {
  return id.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isSupportedParamType(value: unknown): value is FieldType {
  return FIELD_TYPES.includes(value as FieldType);
}

function normalizeScalarToDisplayString(value: unknown): string {
  if (typeof value === "boolean") return value ? "True" : "False";
  return String(value ?? "").trim();
}

function normalizeOptionEntry(raw: unknown, fieldId: string): ParameterOption {
  if (
    typeof raw === "string" ||
    typeof raw === "number" ||
    typeof raw === "boolean"
  ) {
    const normalized = normalizeScalarToDisplayString(raw);
    if (!normalized) {
      throw new Error(`Field "${fieldId}" contains an empty option.`);
    }
    return { label: normalized, value: normalized };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Field "${fieldId}" contains an invalid option entry.`);
  }

  const item = raw as Record<string, unknown>;
  const label = typeof item.label === "string" ? item.label.trim() : "";
  if (!label) {
    throw new Error(
      `Field "${fieldId}" option objects must include a non-empty label.`,
    );
  }

  const value =
    item.value == null ? label : normalizeScalarToDisplayString(item.value);
  if (!value) {
    throw new Error(
      `Field "${fieldId}" contains an option with an empty value.`,
    );
  }

  return { label, value };
}

function normalizeOptionGroups(
  fieldType: FieldType,
  fieldId: string,
  rawValues: unknown,
  rawGroups: unknown,
): ParameterOptionGroup[] {
  const supportsChoiceOptions =
    fieldType === "select" ||
    fieldType === "combobox" ||
    fieldType === "radio";

  if (rawValues != null && rawGroups != null) {
    throw new Error(
      `Field "${fieldId}" cannot define both values and groups at the same time.`,
    );
  }

  if (!supportsChoiceOptions) return [];

  const groups: ParameterOptionGroup[] = [];

  if (rawGroups != null) {
    if (fieldType !== "select" && fieldType !== "combobox") {
      throw new Error(
        `Field "${fieldId}" can only use groups with select or combobox type.`,
      );
    }
    if (!Array.isArray(rawGroups)) {
      throw new Error(`Field "${fieldId}" must define groups as an array.`);
    }

    for (const rawGroup of rawGroups) {
      if (!rawGroup || typeof rawGroup !== "object" || Array.isArray(rawGroup)) {
        throw new Error(
          `Field "${fieldId}" contains an invalid group entry.`,
        );
      }
      const group = rawGroup as Record<string, unknown>;
      const label = typeof group.label === "string" ? group.label.trim() : "";
      if (!label) {
        throw new Error(
          `Field "${fieldId}" group entries must include a non-empty label.`,
        );
      }
      const rawOptions = Array.isArray(group.options) ? group.options : null;
      if (!rawOptions || rawOptions.length === 0) {
        throw new Error(
          `Field "${fieldId}" group "${label}" must include a non-empty options array.`,
        );
      }
      groups.push({
        label,
        options: rawOptions.map((option) => normalizeOptionEntry(option, fieldId)),
      });
    }
  } else if (rawValues != null) {
    if (!Array.isArray(rawValues)) {
      throw new Error(`Field "${fieldId}" must define values as an array.`);
    }
    groups.push({
      label: null,
      options: rawValues.map((option) => normalizeOptionEntry(option, fieldId)),
    });
  }

  const seenValues = new Set<string>();
  for (const group of groups) {
    for (const option of group.options) {
      const key = option.value.toLowerCase();
      if (seenValues.has(key)) {
        throw new Error(
          `Field "${fieldId}" contains duplicate option value "${option.value}".`,
        );
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
    if (
      (type === "select" || type === "combobox" || type === "radio") &&
      values.length > 0
    ) {
      const matched = values.find(
        (value) => value.toLowerCase() === normalizedDefault.toLowerCase(),
      );
      return matched ?? normalizedDefault;
    }
    return normalizedDefault;
  }

  if (type === "checkbox") return "false";
  if (
    (type === "select" || type === "combobox" || type === "radio") &&
    values.length > 0
  ) {
    return values[0];
  }
  return null;
}

interface DefinitionRegistry {
  fields: Map<string, TemplateFieldDefinition>;
  repeaters: Map<string, TemplateRepeaterDefinition>;
  dataIds: Set<string>;
}

function requireObject(raw: unknown, path: string): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${path} must be an object.`);
  }
  return raw as Record<string, unknown>;
}

function requireName(raw: unknown, path: string): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) throw new Error(`${path} must define a non-empty name.`);
  return name;
}

function requireDataId(raw: unknown, path: string, registry: DefinitionRegistry): string {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!ID_RE.test(id)) {
    throw new Error(
      `${path} must define an id containing only letters, numbers, underscores, or hyphens.`,
    );
  }
  if (registry.dataIds.has(id)) {
    throw new Error(`Duplicate field or repeater id "${id}".`);
  }
  registry.dataIds.add(id);
  return id;
}

function normalizeFormNodes(
  rawNodes: unknown,
  scopeId: string | null,
  registry: DefinitionRegistry,
  path = "form",
): TemplateFormNode[] {
  if (!Array.isArray(rawNodes)) {
    throw new Error(`${path} must be an array.`);
  }

  return rawNodes.map((rawNode, index) => {
    const nodePath = `${path}[${index}]`;
    const item = requireObject(rawNode, nodePath);
    const type = typeof item.type === "string" ? item.type.trim() : "";

    if (!type) throw new Error(`${nodePath} must define a type.`);

    if (isSupportedParamType(type)) {
      const id = requireDataId(item.id, nodePath, registry);
      const name = requireName(item.name, `Field "${id}"`);
      const optionGroups = normalizeOptionGroups(
        type,
        id,
        item.values,
        item.groups,
      );
      const values = flattenOptionGroups(optionGroups);
      const rawDefaultValue = item.default;
      const defaultValue = defaultValueForType(type, rawDefaultValue, values);

      if (
        defaultValue != null &&
        values.length > 0 &&
        (type === "select" || type === "combobox" || type === "radio") &&
        !values.some((value) => value.toLowerCase() === defaultValue.toLowerCase())
      ) {
        throw new Error(
          `Field "${id}" default value "${defaultValue}" does not match any option value.`,
        );
      }

      const field: TemplateFieldDefinition = {
        kind: "field",
        id,
        type,
        name,
        defaultValue,
        height:
          typeof item.height === "number" && Number.isFinite(item.height)
            ? item.height
            : type === "textarea"
              ? 4
              : null,
        values,
        optionGroups,
        clipboardImport: normalizeClipboardImportConfig(
          item.clipboard_import,
          type,
          id,
        ),
        folderImport: normalizeFolderImportConfig(item.folder_import, type, id),
        inline: Boolean(item.inline),
        random:
          (type === "select" || type === "combobox") && Boolean(item.random),
        scopeId,
      };
      registry.fields.set(id, field);
      return field;
    }

    if (type === "group") {
      const name =
        typeof item.name === "string" && item.name.trim()
          ? item.name.trim()
          : null;
      const description =
        typeof item.description === "string" && item.description.trim()
          ? item.description.trim()
          : null;
      const style = item.style == null ? "solid" : item.style;
      if (style !== "solid" && style !== "dashed" && style !== "none") {
        throw new Error(
          `${nodePath}.style must be "solid", "dashed", or "none".`,
        );
      }
      const group: TemplateGroupDefinition = {
        kind: "group",
        name,
        description,
        style,
        children: normalizeFormNodes(
          item.children,
          scopeId,
          registry,
          `${nodePath}.children`,
        ),
      };
      return group;
    }

    if (type === "header") {
      const name =
        typeof item.name === "string" && item.name.trim()
          ? item.name.trim()
          : null;
      const description =
        typeof item.description === "string" && item.description.trim()
          ? item.description.trim()
          : null;
      if (!name && !description) {
        throw new Error(
          `${nodePath} must define at least one of "name" or "description".`,
        );
      }
      return {
        kind: "header",
        name,
        description,
      };
    }

    if (type === "hr") {
      const style = item.style == null ? "solid" : item.style;
      if (style !== "solid" && style !== "dashed") {
        throw new Error(`${nodePath}.style must be "solid" or "dashed".`);
      }
      return { kind: "hr", style };
    }

    if (type === "repeater") {
      const id = requireDataId(item.id, nodePath, registry);
      const repeater: TemplateRepeaterDefinition = {
        kind: "repeater",
        id,
        name: requireName(item.name, `Repeater "${id}"`),
        description:
          typeof item.description === "string" && item.description.trim()
            ? item.description.trim()
            : null,
        children: [],
        scopeId,
      };
      registry.repeaters.set(id, repeater);
      repeater.children = normalizeFormNodes(
        item.children,
        id,
        registry,
        `${nodePath}.children`,
      );
      return repeater;
    }

    throw new Error(`Unsupported form node type "${type}" at ${nodePath}.`);
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
  const body = normalized.slice(rawFrontMatter.length).replace(/^\n+/, "");
  const source = match[2].trim();

  if (!source) {
    return {
      metadata: {},
      body,
      rawFrontMatter,
      hasFrontMatter: true,
    };
  }

  try {
    const parsed = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        metadata: {},
        body,
        rawFrontMatter,
        hasFrontMatter: true,
        error: "Front matter must contain a JSON object.",
      };
    }
    return {
      metadata: parsed as Record<string, unknown>,
      body,
      rawFrontMatter,
      hasFrontMatter: true,
    };
  } catch (error) {
    return {
      metadata: {},
      body,
      rawFrontMatter,
      hasFrontMatter: true,
      error:
        error instanceof Error
          ? `Invalid JSON front matter: ${error.message}`
          : "Invalid JSON front matter.",
    };
  }
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
    if (end === -1) return null;
    return {
      kind: "control",
      start: controlStart,
      end: end + 2,
      inner: body.slice(controlStart + 2, end).trim(),
    };
  }

  const end = body.indexOf("}}", fieldStart + 2);
  if (end === -1) return null;
  return {
    kind: "field",
    start: fieldStart,
    end: end + 2,
    inner: body.slice(fieldStart + 2, end).trim(),
  };
}

function isStandaloneTrimmedControl(inner: string): boolean {
  return /^(?:repeat\s+[a-zA-Z0-9_-]+|end_repeat|if\s+[\s\S]+|else_if\s+[\s\S]+|else|end_if)$/i.test(
    inner.trim(),
  );
}

function getStandaloneControlLineRange(
  body: string,
  token: TemplateToken,
): { start: number; end: number } | null {
  if (token.kind !== "control" || !isStandaloneTrimmedControl(token.inner)) {
    return null;
  }

  const lineStart = body.lastIndexOf("\n", token.start - 1) + 1;
  const nextLineBreak = body.indexOf("\n", token.end);
  const lineContentEnd =
    nextLineBreak === -1
      ? body.length
      : body[nextLineBreak - 1] === "\r"
        ? nextLineBreak - 1
        : nextLineBreak;
  const lineEnd = nextLineBreak === -1 ? body.length : nextLineBreak + 1;
  const beforeToken = body.slice(lineStart, token.start);
  const afterToken = body.slice(token.end, lineContentEnd);

  return /^[ \t]*$/.test(beforeToken) && /^[ \t]*$/.test(afterToken)
    ? { start: lineStart, end: lineEnd }
    : null;
}

function getScopeLookupDepth(
  targetScopeId: string | null,
  scopeStack: Array<string | null>,
): number | null {
  for (let index = scopeStack.length - 1; index >= 0; index -= 1) {
    if (scopeStack[index] === targetScopeId) {
      return scopeStack.length - 1 - index;
    }
  }
  return null;
}

function parseConditionValue(raw: string): string | boolean {
  const trimmed = raw.trim();
  if (/^true$/i.test(trimmed)) return true;
  if (/^false$/i.test(trimmed)) return false;
  const quoted = trimmed.match(/^("([\s\S]*)"|'([\s\S]*)')$/);
  if (quoted) return quoted[2] ?? quoted[3] ?? "";
  return trimmed;
}

function resolveConditionDefinition(
  id: string,
  fields: Map<string, TemplateFieldDefinition>,
  repeaters: Map<string, TemplateRepeaterDefinition>,
  scopeStack: Array<string | null>,
): {
  definition: TemplateFieldDefinition | TemplateRepeaterDefinition;
  lookupDepth: number;
} {
  const definition = fields.get(id) ?? repeaters.get(id);
  if (!definition) {
    throw new Error(`Condition references unknown field or repeater "${id}".`);
  }
  const lookupDepth = getScopeLookupDepth(definition.scopeId, scopeStack);
  if (lookupDepth == null) {
    throw new Error(
      `"${id}" cannot be referenced outside its repeater scope.`,
    );
  }
  return { definition, lookupDepth };
}

function parseTemplateCondition(
  rawCondition: string,
  fields: Map<string, TemplateFieldDefinition>,
  repeaters: Map<string, TemplateRepeaterDefinition>,
  scopeStack: Array<string | null>,
): TemplateCondition {
  const source = rawCondition.trim().replace(/^\(([\s\S]*)\)$/, "$1").trim();
  if (!source) throw new Error("Condition cannot be empty.");

  let match = source.match(/^([a-zA-Z0-9_-]+)$/);
  if (match) {
    const resolved = resolveConditionDefinition(
      match[1],
      fields,
      repeaters,
      scopeStack,
    );
    return {
      source,
      id: match[1],
      ...resolved,
      operator: "not_empty",
    };
  }

  match = source.match(
    /^([a-zA-Z0-9_-]+)\s+(empty|not_empty|checked|unchecked)$/i,
  );
  if (match) {
    const resolved = resolveConditionDefinition(
      match[1],
      fields,
      repeaters,
      scopeStack,
    );
    return {
      source,
      id: match[1],
      ...resolved,
      operator: match[2].toLowerCase() as TemplateCondition["operator"],
    };
  }

  match = source.match(/^([a-zA-Z0-9_-]+)\s+(?:is|=)\s+([\s\S]+)$/i);
  if (match) {
    const resolved = resolveConditionDefinition(
      match[1],
      fields,
      repeaters,
      scopeStack,
    );
    return {
      source,
      id: match[1],
      ...resolved,
      operator: "is",
      expectedValue: parseConditionValue(match[2]),
    };
  }

  match = source.match(/^([a-zA-Z0-9_-]+)\s+(?:is_not|not)\s+([\s\S]+)$/i);
  if (match) {
    const resolved = resolveConditionDefinition(
      match[1],
      fields,
      repeaters,
      scopeStack,
    );
    return {
      source,
      id: match[1],
      ...resolved,
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
      rootGroup: {
        kind: "group",
        name: null,
        description: null,
        style: "none",
        children: [],
      },
      nodes: [],
    };
  }

  const frontMatter = parseFrontMatter(content);
  if (frontMatter.error) throw new Error(frontMatter.error);

  const registry: DefinitionRegistry = {
    fields: new Map(),
    repeaters: new Map(),
    dataIds: new Set(),
  };
  const formRaw = frontMatter.metadata.form ?? [];
  const rootGroup: TemplateGroupDefinition = {
    kind: "group",
    name: null,
    description: null,
    style: "none",
    children: normalizeFormNodes(formRaw, null, registry),
  };

  type ParseFrame =
    | { kind: "root"; nodes: TemplateBodyNode[] }
    | {
        kind: "repeater";
        id: string;
        node: TemplateRepeaterNode;
        nodes: TemplateBodyNode[];
      }
    | { kind: "if"; node: TemplateIfNode; nodes: TemplateBodyNode[]; inElse: boolean };

  const rootNodes: TemplateBodyNode[] = [];
  const frameStack: ParseFrame[] = [{ kind: "root", nodes: rootNodes }];
  const scopeStack: Array<string | null> = [null];
  const currentNodes = () => frameStack[frameStack.length - 1].nodes;

  let cursor = 0;
  while (cursor < frontMatter.body.length) {
    const token = findNextTemplateToken(frontMatter.body, cursor);
    if (!token) {
      if (cursor < frontMatter.body.length) {
        currentNodes().push({
          kind: "text",
          text: frontMatter.body.slice(cursor),
        });
      }
      break;
    }

    const standaloneControlLine = getStandaloneControlLineRange(
      frontMatter.body,
      token,
    );
    const textEnd = standaloneControlLine?.start ?? token.start;
    const nextCursor = standaloneControlLine?.end ?? token.end;

    if (textEnd > cursor) {
      currentNodes().push({
        kind: "text",
        text: frontMatter.body.slice(cursor, textEnd),
      });
    }

    if (token.kind === "field") {
      const id = token.inner;
      const definition = ID_RE.test(id) ? registry.fields.get(id) : undefined;
      if (!definition) {
        currentNodes().push({
          kind: "text",
          text: frontMatter.body.slice(token.start, token.end),
        });
      } else {
        const lookupDepth = getScopeLookupDepth(definition.scopeId, scopeStack);
        if (lookupDepth == null) {
          throw new Error(
            `Field "${id}" cannot be referenced outside its repeater scope.`,
          );
        }
        currentNodes().push({
          kind: "field-ref",
          id,
          definition,
          lookupDepth,
        });
      }
      cursor = nextCursor;
      continue;
    }

    const control = token.inner;
    const repeatStartMatch = control.match(/^repeat\s+([a-zA-Z0-9_-]+)$/i);
    if (repeatStartMatch) {
      const id = repeatStartMatch[1];
      const definition = registry.repeaters.get(id);
      if (!definition) throw new Error(`Unknown repeater "${id}".`);
      const currentScopeId = scopeStack[scopeStack.length - 1];
      if (definition.scopeId !== currentScopeId) {
        throw new Error(
          `Repeater "${id}" cannot be opened outside its parent repeater scope.`,
        );
      }
      const node: TemplateRepeaterNode = {
        kind: "repeater",
        id,
        definition,
        children: [],
      };
      currentNodes().push(node);
      frameStack.push({ kind: "repeater", id, node, nodes: node.children });
      scopeStack.push(id);
      cursor = nextCursor;
      continue;
    }

    if (/^end_repeat$/i.test(control)) {
      const frame = frameStack[frameStack.length - 1];
      if (frame.kind !== "repeater") throw new Error("Unexpected end_repeat.");
      frameStack.pop();
      scopeStack.pop();
      cursor = nextCursor;
      continue;
    }

    const ifStartMatch = control.match(/^if\s+([\s\S]+)$/i);
    if (ifStartMatch) {
      const condition = parseTemplateCondition(
        ifStartMatch[1],
        registry.fields,
        registry.repeaters,
        scopeStack,
      );
      const node: TemplateIfNode = {
        kind: "if",
        branches: [{ condition, children: [] }],
        elseChildren: [],
      };
      currentNodes().push(node);
      frameStack.push({
        kind: "if",
        node,
        nodes: node.branches[0].children,
        inElse: false,
      });
      cursor = nextCursor;
      continue;
    }

    const elseIfMatch = control.match(/^else_if\s+([\s\S]+)$/i);
    if (elseIfMatch) {
      const frame = frameStack[frameStack.length - 1];
      if (frame.kind !== "if" || frame.inElse) {
        throw new Error("Unexpected else_if without an open if block.");
      }
      const branch = {
        condition: parseTemplateCondition(
          elseIfMatch[1],
          registry.fields,
          registry.repeaters,
          scopeStack,
        ),
        children: [] as TemplateBodyNode[],
      };
      frame.node.branches.push(branch);
      frame.nodes = branch.children;
      cursor = nextCursor;
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
      cursor = nextCursor;
      continue;
    }

    if (/^end_if$/i.test(control)) {
      const frame = frameStack[frameStack.length - 1];
      if (frame.kind !== "if") throw new Error("Unexpected end_if.");
      frameStack.pop();
      cursor = nextCursor;
      continue;
    }

    currentNodes().push({
      kind: "text",
      text: frontMatter.body.slice(token.start, token.end),
    });
    cursor = nextCursor;
  }

  const openFrame = frameStack[frameStack.length - 1];
  if (openFrame.kind === "repeater") {
    throw new Error(`Repeater "${openFrame.id}" was not closed.`);
  }
  if (openFrame.kind === "if") throw new Error("If block was not closed.");

  return {
    metadata: frontMatter.metadata,
    body: frontMatter.body,
    rootGroup,
    nodes: rootNodes,
  };
}

function walkFormNodes(
  nodes: TemplateFormNode[],
  visitor: (node: TemplateFormNode) => void,
): void {
  for (const node of nodes) {
    visitor(node);
    if (node.kind === "group" || node.kind === "repeater") {
      walkFormNodes(node.children, visitor);
    }
  }
}

export function extractParameters(content: string | null): Parameter[] {
  try {
    const parsed = parseTemplate(content);
    const parameters: Parameter[] = [];
    walkFormNodes(parsed.rootGroup.children, (node) => {
      if (node.kind !== "field") return;
      parameters.push({
        id: node.id,
        type: node.type,
        name: node.name,
        defaultValue: node.defaultValue,
        height: node.height,
        values: node.values,
        optionGroups: node.optionGroups,
        clipboardImport: node.clipboardImport,
        folderImport: node.folderImport,
        inline: node.inline,
        random: node.random,
      });
    });
    return parameters;
  } catch {
    return [];
  }
}

function populateInitialState(
  nodes: TemplateFormNode[],
  state: TemplateScopeState,
): void {
  for (const node of nodes) {
    if (node.kind === "field") {
      state.fields[node.id] = node.defaultValue ?? "";
      continue;
    }
    if (node.kind === "group") {
      populateInitialState(node.children, state);
      continue;
    }
    if (node.kind === "repeater") {
      state.repeaters[node.id] = [createInitialScopeState(node)];
    }
  }
}

export function createInitialScopeState(
  scope: TemplateGroupDefinition | TemplateRepeaterDefinition,
): TemplateScopeState {
  const state: TemplateScopeState = { fields: {}, repeaters: {} };
  populateInitialState(scope.children, state);
  return state;
}

function hasNonEmptySegmentText(segments: PromptSegment[]): boolean {
  return segments.some((segment) => segment.text.length > 0);
}

function splitRepeaterNodes(nodes: TemplateBodyNode[]): {
  itemNodes: TemplateBodyNode[];
  separatorText: string;
} {
  if (nodes.length === 0) return { itemNodes: nodes, separatorText: "" };
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
  return condition.definition.kind === "repeater"
    ? targetScope.repeaters[condition.definition.id] ?? []
    : targetScope.fields[condition.definition.id] ?? "";
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
      segments.push({
        text: targetScope.fields[node.id] ?? "",
        isUserValue: true,
        paramName: node.id,
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
    const instances = currentScope.repeaters[node.id] ?? [];
    const repeatParts = splitRepeaterNodes(node.children);
    let renderedInstanceCount = 0;

    for (const instance of instances) {
      const instanceSegments = buildSegmentsFromNodes(repeatParts.itemNodes, [
        ...scopeStack,
        instance,
      ]);
      if (!hasNonEmptySegmentText(instanceSegments)) continue;
      if (renderedInstanceCount > 0 && repeatParts.separatorText.length > 0) {
        segments.push({ text: repeatParts.separatorText, isUserValue: false });
      }
      segments.push(...instanceSegments);
      renderedInstanceCount += 1;
    }
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
    const start = tmpl.indexOf("{{", i);
    if (start === -1) {
      if (i < tmpl.length) out.push({ text: tmpl.slice(i), isUserValue: false });
      break;
    }
    if (start > i) out.push({ text: tmpl.slice(i, start), isUserValue: false });
    const end = tmpl.indexOf("}}", start + 2);
    if (end === -1) {
      out.push({ text: tmpl.slice(start), isUserValue: false });
      break;
    }
    const id = tmpl.slice(start + 2, end).trim();
    if (ID_RE.test(id) && formValues.has(id)) {
      out.push({
        text: formValues.get(id) || "",
        isUserValue: true,
        paramName: id,
      });
    } else {
      out.push({ text: tmpl.slice(start, end + 2), isUserValue: false });
    }
    i = end + 2;
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
  const frontMatter = parseFrontMatter(content);
  if (!frontMatter.hasFrontMatter) return content;
  if (frontMatter.error) throw new Error(frontMatter.error);

  const nextMetadata = { ...frontMatter.metadata };
  delete nextMetadata.reusable;
  if (Object.keys(nextMetadata).length === 0) return frontMatter.body;

  return `---\n${JSON.stringify(nextMetadata, null, 2)}\n---\n\n${frontMatter.body}`;
}
