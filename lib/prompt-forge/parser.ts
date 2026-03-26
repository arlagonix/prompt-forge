import YAML from "yaml";
import type { FrontMatterResult, Parameter } from "./types";

function formatParamName(p: string): string {
  return p.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isSupportedParamType(value: unknown): value is Parameter["type"] {
  return (
    value === "textarea" ||
    value === "text" ||
    value === "number" ||
    value === "checkbox" ||
    value === "select" ||
    value === "radio"
  );
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeMetadataParam(raw: unknown): Parameter | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as Record<string, unknown>;
  const name = typeof item.name === "string" ? item.name.trim() : "";

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return null;

  const type = isSupportedParamType(item.type) ? item.type : "textarea";

  const label =
    typeof item.label === "string" && item.label.trim()
      ? item.label.trim()
      : formatParamName(name);

  const defaultValue = item.default == null ? null : String(item.default);

  const height =
    typeof item.height === "number" && Number.isFinite(item.height)
      ? item.height
      : null;

  const values = normalizeStringArray(item.values);

  const finalDefaultValue =
    defaultValue == null
      ? type === "checkbox"
        ? "false"
        : (type === "select" || type === "radio") && values.length > 0
          ? values[0]
          : null
      : defaultValue;

  return {
    name,
    type,
    label,
    defaultValue: finalDefaultValue,
    height,
    values,
  };
}

function extractPlaceholderNames(content: string | null): string[] {
  if (typeof content !== "string") return [];

  const out: string[] = [];
  const seen = new Set<string>();
  let i = 0;

  while (i < content.length) {
    const s = content.indexOf("{{", i);
    if (s === -1) break;

    const e = content.indexOf("}}", s + 2);
    if (e === -1) break;

    const inner = content.slice(s + 2, e).trim();

    if (/^[a-zA-Z0-9_-]+$/.test(inner) && !seen.has(inner)) {
      seen.add(inner);
      out.push(inner);
    }

    i = e + 2;
  }

  return out;
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

export function extractParameters(content: string | null): Parameter[] {
  if (typeof content !== "string") return [];

  const { metadata, body } = parseFrontMatter(content);
  const placeholderNames = extractPlaceholderNames(body);

  const metadataParamsRaw = Array.isArray(metadata.params)
    ? metadata.params
    : [];

  const metadataParams = metadataParamsRaw
    .map(normalizeMetadataParam)
    .filter((p): p is Parameter => !!p);

  const byName = new Map(metadataParams.map((p) => [p.name, p]));

  return placeholderNames.map((name) => {
    const existing = byName.get(name);
    if (existing) return existing;

    return {
      name,
      type: "textarea" as const,
      label: formatParamName(name),
      defaultValue: null,
      height: null,
      values: [],
    };
  });
}

export function buildPrompt(
  bodyContent: string | null,
  content: string | null,
  _params: Parameter[],
  formValues: Map<string, string>,
): string | null {
  return buildPromptSegments(bodyContent, content, formValues)
    .map((segment) => segment.text)
    .join("")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

export interface PromptSegment {
  text: string;
  isUserValue: boolean;
  paramName?: string;
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
        out.push({
          text: tmpl.slice(i),
          isUserValue: false,
        });
      }
      break;
    }

    if (s > i) {
      out.push({
        text: tmpl.slice(i, s),
        isUserValue: false,
      });
    }

    const e = tmpl.indexOf("}}", s + 2);
    if (e === -1) {
      out.push({
        text: tmpl.slice(s),
        isUserValue: false,
      });
      break;
    }

    const name = tmpl.slice(s + 2, e).trim();

    if (/^[a-zA-Z0-9_-]+$/.test(name) && formValues.has(name)) {
      out.push({
        text: formValues.get(name) || "",
        isUserValue: true,
        paramName: name,
      });
    } else {
      out.push({
        text: tmpl.slice(s, e + 2),
        isUserValue: false,
      });
    }

    i = e + 2;
  }

  return out;
}
