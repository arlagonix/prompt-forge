import YAML from "yaml";
import type {
  ClipboardImportConfig,
  ClipboardImportFormat,
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

  const rootNodes: TemplateBodyNode[] = [];
  const nodesStack: TemplateBodyNode[][] = [rootNodes];
  const scopeStack: TemplateGroupDefinition[] = [rootGroup];
  const openGroupNodeStack: TemplateGroupNode[] = [];

  let cursor = 0;
  while (cursor < body.length) {
    const start = body.indexOf("{{", cursor);
    if (start === -1) {
      if (cursor < body.length) {
        nodesStack[nodesStack.length - 1].push({
          kind: "text",
          text: body.slice(cursor),
        });
      }
      break;
    }

    if (start > cursor) {
      nodesStack[nodesStack.length - 1].push({
        kind: "text",
        text: body.slice(cursor, start),
      });
    }

    const end = body.indexOf("}}", start + 2);
    if (end === -1) {
      nodesStack[nodesStack.length - 1].push({
        kind: "text",
        text: body.slice(start),
      });
      break;
    }

    const inner = body.slice(start + 2, end).trim();
    const currentScope = scopeStack[scopeStack.length - 1];
    const groupStartMatch = inner.match(/^([a-zA-Z0-9_-]+):start$/);
    const groupEndMatch = inner.match(/^([a-zA-Z0-9_-]+):end$/);

    if (groupStartMatch) {
      const groupName = groupStartMatch[1];
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
      nodesStack[nodesStack.length - 1].push(groupNode);
      openGroupNodeStack.push(groupNode);
      nodesStack.push(groupNode.children);
      scopeStack.push(childGroup);
      cursor = end + 2;
      continue;
    }

    if (groupEndMatch) {
      const groupName = groupEndMatch[1];
      const openGroup = openGroupNodeStack[openGroupNodeStack.length - 1];
      if (!openGroup || openGroup.name !== groupName) {
        throw new Error(`Unexpected group end "${groupName}".`);
      }
      openGroupNodeStack.pop();
      nodesStack.pop();
      scopeStack.pop();
      cursor = end + 2;
      continue;
    }

    if (NAME_RE.test(inner)) {
      const resolved = resolveFieldReference(scopeStack, inner);
      ensureRenderItem(resolved.owner, {
        kind: "field",
        field: resolved.definition,
      });
      const fieldNode: TemplateFieldReferenceNode = {
        kind: "field-ref",
        name: inner,
        definition: resolved.definition,
        lookupDepth: resolved.lookupDepth,
      };
      nodesStack[nodesStack.length - 1].push(fieldNode);
      cursor = end + 2;
      continue;
    }

    nodesStack[nodesStack.length - 1].push({
      kind: "text",
      text: body.slice(start, end + 2),
    });
    cursor = end + 2;
  }

  if (openGroupNodeStack.length > 0) {
    throw new Error(
      `Group "${openGroupNodeStack[openGroupNodeStack.length - 1].name}" was not closed.`,
    );
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
