import TurndownService from "turndown";

export type ClipboardImportFormat = "html" | "minified" | "markdown";

export interface ClipboardImportSource {
  html: string | null;
  text: string | null;
}

const SUPPORTED_FORMATS: ClipboardImportFormat[] = [
  "html",
  "minified",
  "markdown",
];

const ATTR_WHITELIST: Record<string, string[]> = {
  a: ["href"],
  img: ["src", "alt", "width", "height"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
  ol: ["type", "start"],
  li: ["value"],
  code: ["class"],
  table: [],
  thead: [],
  tbody: [],
  tfoot: [],
  tr: [],
  p: [],
  summary: [],
  time: [],
};

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const TABLE_CELL_ELEMENTS = new Set(["td", "th"]);

const BLOCK_ELEMENTS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "details",
  "dialog",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);

const FORBIDDEN_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "template",
  "link",
  "meta",
]);

const UI_UNWRAP_TAGS = new Set(["span", "button"]);

const UI_ROLE_HINTS = new Set([
  "button",
  "menu",
  "menuitem",
  "tab",
  "tooltip",
  "dialog",
]);

const UI_CLASS_HINTS = [
  "dropdown",
  "menu",
  "toolbar",
  "popover",
  "tooltip",
  "modal",
  "dialog",
  "controls",
  "actions",
  "button",
  "btn",
];

const UI_REMOVE_TAGS = new Set(["img"]);

function canUseDom(): boolean {
  return typeof document !== "undefined";
}

function assertBrowserApis(): void {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("Clipboard access is not available in this browser.");
  }
}

function decodeUrl(url: string): string {
  try {
    return decodeURIComponent(url.replace(/\+/g, " "));
  } catch {
    return url;
  }
}

function decodeEncodedText(text: string): string {
  return text.replace(/((?:%[0-9A-Fa-f]{2}|\+)+)/g, (match) => {
    try {
      return decodeURIComponent(match.replace(/\+/g, " "));
    } catch {
      return match;
    }
  });
}

function hasUiClassHint(element: HTMLElement): boolean {
  const className = element.getAttribute("class") ?? "";
  const id = element.getAttribute("id") ?? "";
  const value = `${className} ${id}`.toLowerCase();
  return UI_CLASS_HINTS.some((hint) => value.includes(hint));
}

function isProbablyUiOnlyElement(element: HTMLElement): boolean {
  const tag = element.tagName.toLowerCase();

  if (tag === "img") {
    const src = (element.getAttribute("src") ?? "").toLowerCase();
    const alt = (element.getAttribute("alt") ?? "").trim().toLowerCase();
    const width = Number.parseInt(element.getAttribute("width") ?? "", 10);
    const height = Number.parseInt(element.getAttribute("height") ?? "", 10);

    const looksLikeIconSrc =
      src.includes("/edit") ||
      src.includes("icon") ||
      src.includes("button") ||
      src.includes("toolbar") ||
      src.includes("menu");

    const looksTiny =
      (Number.isFinite(width) && width > 0 && width <= 24) ||
      (Number.isFinite(height) && height > 0 && height <= 24);

    const altSuggestsUi =
      alt === "" ||
      alt === "edit" ||
      alt === "menu" ||
      alt === "button" ||
      alt === "icon";

    return looksLikeIconSrc || looksTiny || altSuggestsUi;
  }

  return false;
}

function unwrapElement(element: HTMLElement): DocumentFragment {
  const fragment = document.createDocumentFragment();
  Array.from(element.childNodes).forEach((child) => {
    const cleaned = cleanNode(child);
    if (cleaned) {
      fragment.appendChild(cleaned);
    }
  });
  return fragment;
}

function cleanNode(node: Node): Node | DocumentFragment | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const decoded = decodeEncodedText(node.textContent ?? "");
    if (!decoded.trim()) {
      return null;
    }
    node.textContent = decoded;
    return node;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (FORBIDDEN_TAGS.has(tag)) {
    return null;
  }

  if (
    element.hasAttribute("hidden") ||
    element.getAttribute("aria-hidden") === "true"
  ) {
    return null;
  }

  if (UI_REMOVE_TAGS.has(tag) && isProbablyUiOnlyElement(element)) {
    return null;
  }

  const role = (element.getAttribute("role") ?? "").toLowerCase();
  if (role && UI_ROLE_HINTS.has(role)) {
    return unwrapElement(element);
  }

  if (UI_UNWRAP_TAGS.has(tag)) {
    return unwrapElement(element);
  }

  if (["div", "aside", "nav"].includes(tag) && hasUiClassHint(element)) {
    return unwrapElement(element);
  }

  Array.from(element.attributes).forEach((attribute) => {
    if (attribute.name.startsWith("on")) {
      element.removeAttribute(attribute.name);
    }
  });

  const allowed = ATTR_WHITELIST[tag] ?? [];
  Array.from(element.attributes).forEach((attribute) => {
    if (!allowed.includes(attribute.name)) {
      element.removeAttribute(attribute.name);
    }
  });

  if (tag === "a" && element.hasAttribute("href")) {
    element.setAttribute("href", decodeUrl(element.getAttribute("href") ?? ""));
  }

  const childrenToRemove: Node[] = [];
  Array.from(element.childNodes).forEach((child) => {
    const cleaned = cleanNode(child);
    if (cleaned === null) {
      childrenToRemove.push(child);
    } else if (cleaned !== child) {
      element.replaceChild(cleaned, child);
    }
  });
  childrenToRemove.forEach((child) => element.removeChild(child));

  if (
    !VOID_ELEMENTS.has(tag) &&
    !TABLE_CELL_ELEMENTS.has(tag) &&
    element.textContent?.trim() === "" &&
    !element.querySelector("img, br, hr")
  ) {
    return null;
  }

  return element;
}

function prettyPrint(node: Node, indent = 0): string {
  const pad = "  ".repeat(indent);

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim() ?? "";
    return text ? `${pad}${text}` : "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  const isBlock = BLOCK_ELEMENTS.has(tag);

  let attrs = "";
  for (const attr of Array.from(element.attributes)) {
    attrs += ` ${attr.name}="${attr.value}"`;
  }

  if (VOID_ELEMENTS.has(tag)) {
    return `${pad}<${tag}${attrs}>`;
  }

  const children = Array.from(element.childNodes);
  if (children.length === 0) {
    return `${pad}<${tag}${attrs}></${tag}>`;
  }

  const allText = children.every((child) => child.nodeType === Node.TEXT_NODE);

  if (allText || !isBlock) {
    const inner = children
      .map((child) => {
        if (child.nodeType === Node.TEXT_NODE) return child.textContent ?? "";
        return prettyPrint(child, 0).trim();
      })
      .join("")
      .trim();

    return inner ? `${pad}<${tag}${attrs}>${inner}</${tag}>` : "";
  }

  const innerLines = children
    .map((child) => prettyPrint(child, indent + 1))
    .filter((value) => value.trim() !== "");

  if (innerLines.length === 0) return "";

  return `${pad}<${tag}${attrs}>\n${innerLines.join("\n")}\n${pad}</${tag}>`;
}

function minifyHtml(html: string): string {
  return html.replace(/\n\s*/g, "").replace(/>\s+</g, "><").trim();
}

function isSimpleTable(tableNode: HTMLTableElement): boolean {
  const cells = tableNode.querySelectorAll("td, th");
  for (const cell of Array.from(cells)) {
    if (cell.hasAttribute("colspan") || cell.hasAttribute("rowspan")) {
      return false;
    }
    for (const child of Array.from(cell.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = (child as HTMLElement).tagName.toLowerCase();
        if (BLOCK_ELEMENTS.has(tag) && tag !== "br") return false;
      }
    }
  }
  return true;
}

function outerHtml(node: Node): string {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return (node as HTMLElement).outerHTML;
  }
  return node.textContent ?? "";
}

function prettyPrintHtmlFragment(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.trim() ?? "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  return prettyPrint(node, 0).trim();
}

function escapeMarkdownTableCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function getSimpleTableRows(table: HTMLTableElement): HTMLElement[][] {
  const sectionRows = Array.from(
    table.querySelectorAll(
      ":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr",
    ),
  ) as HTMLElement[];

  const directRows = Array.from(table.children).filter(
    (child) =>
      child instanceof HTMLElement && child.tagName.toLowerCase() === "tr",
  ) as HTMLElement[];

  const rows = (sectionRows.length > 0 ? sectionRows : directRows).map(
    (row) =>
      Array.from(row.children).filter(
        (cell) =>
          cell instanceof HTMLElement &&
          TABLE_CELL_ELEMENTS.has(cell.tagName.toLowerCase()),
      ) as HTMLElement[],
  );

  return rows.filter((row) => row.length > 0);
}

function simpleTableToMarkdown(table: HTMLTableElement): string {
  const rows = getSimpleTableRows(table);
  if (rows.length === 0) return "";

  const columnCount = Math.max(...rows.map((row) => row.length));
  if (columnCount === 0) return "";

  const normalizedRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => {
      const cell = row[index];
      const text = cell?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      return escapeMarkdownTableCell(text);
    }),
  );

  const firstRowHasHeader = rows[0].every(
    (cell) => cell.tagName.toLowerCase() === "th",
  );

  const header = firstRowHasHeader
    ? normalizedRows[0]
    : Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`);

  const body = firstRowHasHeader ? normalizedRows.slice(1) : normalizedRows;

  const headerLine = `| ${header.join(" | ")} |`;
  const separatorLine = `| ${header.map(() => "---").join(" | ")} |`;
  const bodyLines = body.map((row) => `| ${row.join(" | ")} |`);

  return [headerLine, separatorLine, ...bodyLines].join("\n").trim();
}

function createTurndownService(): TurndownService {
  const service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
    hr: "---",
  });

  service.remove([
    "script",
    "style",
    "noscript",
    "template",
    "iframe",
    "object",
    "embed",
  ]);

  service.addRule("simpleTables", {
    filter(node) {
      return (
        node instanceof HTMLElement &&
        node.tagName.toLowerCase() === "table" &&
        isSimpleTable(node as HTMLTableElement)
      );
    },
    replacement(_content, node) {
      const markdownTable = simpleTableToMarkdown(node as HTMLTableElement);
      return markdownTable ? `\n\n${markdownTable}\n\n` : "";
    },
  });

  service.addRule("preserveComplexTables", {
    filter(node) {
      if (!(node instanceof HTMLElement)) return false;
      if (node.tagName.toLowerCase() !== "table") return false;
      return !isSimpleTable(node as HTMLTableElement);
    },
    replacement(_content, node) {
      const prettyHtml = prettyPrintHtmlFragment(node);
      return prettyHtml ? `\n\n${prettyHtml}\n\n` : "";
    },
  });

  service.addRule("simpleTime", {
    filter(node) {
      return (
        node instanceof HTMLElement && node.tagName.toLowerCase() === "time"
      );
    },
    replacement(content) {
      return content;
    },
  });

  service.addRule("summaryAsBlock", {
    filter(node) {
      return (
        node instanceof HTMLElement && node.tagName.toLowerCase() === "summary"
      );
    },
    replacement(content) {
      const trimmed = content.trim();
      return trimmed ? `\n\n${trimmed}\n\n` : "";
    },
  });

  return service;
}

function convertToMarkdown(container: HTMLElement): string {
  const turndown = createTurndownService();
  return turndown
    .turndown(container)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeParagraphText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainTextToParagraphHtml(text: string): string {
  const normalized = normalizeParagraphText(text);
  if (!normalized) return "";

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.split("\n").map(escapeHtml).join("<br>"))
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("\n");
}

function processHtml(rawHtml: string): {
  pretty: string;
  minified: string;
  markdown: string;
} {
  if (!canUseDom() || !rawHtml.trim()) {
    return { pretty: "", minified: "", markdown: "" };
  }

  const container = document.createElement("div");
  container.innerHTML = rawHtml;

  const nodesToRemove: Node[] = [];

  Array.from(container.childNodes).forEach((child) => {
    const cleaned = cleanNode(child);
    if (cleaned === null) {
      nodesToRemove.push(child);
    } else if (cleaned !== child) {
      container.replaceChild(cleaned, child);
    }
  });

  nodesToRemove.forEach((child) => container.removeChild(child));

  const pretty = Array.from(container.childNodes)
    .map((child) => prettyPrint(child, 0))
    .filter((value) => value.trim() !== "")
    .join("\n");

  return {
    pretty,
    minified: minifyHtml(pretty),
    markdown: convertToMarkdown(container),
  };
}

function assertSupportedFormat(format: ClipboardImportFormat): void {
  if (!SUPPORTED_FORMATS.includes(format)) {
    throw new Error("Unsupported clipboard import format.");
  }
}

export async function readClipboardSource(): Promise<ClipboardImportSource> {
  assertBrowserApis();

  let html: string | null = null;
  let text: string | null = null;

  if (typeof navigator.clipboard.read === "function") {
    try {
      const items = await navigator.clipboard.read();

      for (const item of items) {
        if (!html && item.types.includes("text/html")) {
          const blob = await item.getType("text/html");
          html = await blob.text();
        }

        if (!text && item.types.includes("text/plain")) {
          const blob = await item.getType("text/plain");
          text = await blob.text();
        }

        if (html && text) break;
      }
    } catch {
      // Fall back to readText below when richer clipboard reads are unavailable.
    }
  }

  if (!text && typeof navigator.clipboard.readText === "function") {
    text = await navigator.clipboard.readText();
  }

  return {
    html: html?.trim() ? html : null,
    text: text?.trim() ? text : null,
  };
}

export function transformClipboardSource(
  source: ClipboardImportSource,
  format: ClipboardImportFormat,
): string {
  assertSupportedFormat(format);

  if (source.html) {
    const result = processHtml(source.html);
    const htmlResult =
      format === "html"
        ? result.pretty.trim()
        : format === "minified"
          ? result.minified.trim()
          : result.markdown.trim();

    if (htmlResult) {
      return htmlResult;
    }
  }

  const text = source.text?.trim() ?? "";
  if (!text) return "";

  if (format === "markdown") {
    return normalizeParagraphText(text);
  }

  const html = plainTextToParagraphHtml(text);
  return format === "minified" ? minifyHtml(html) : html.trim();
}
