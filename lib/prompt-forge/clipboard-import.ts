export type ClipboardImportFormat = "html" | "minified" | "markdown" | "plain_text";

export interface ClipboardImportSource {
  html: string | null;
  text: string | null;
}

const SUPPORTED_FORMATS: ClipboardImportFormat[] = [
  "html",
  "minified",
  "markdown",
  "plain_text",
];

const ATTR_WHITELIST: Record<string, string[]> = {
  a: ["href"],
  img: ["src", "alt", "width", "height"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
  ol: ["type", "start"],
  li: ["value"],
  // code: ["class"],
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

function cleanNode(node: Node): Node | DocumentFragment | null {
  if (node.nodeType === Node.TEXT_NODE) {
    node.textContent = decodeEncodedText(node.textContent ?? "");
    return node;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (FORBIDDEN_TAGS.has(tag)) {
    return null;
  }

  if (tag === "span") {
    const fragment = document.createDocumentFragment();
    Array.from(element.childNodes).forEach((child) => {
      const cleaned = cleanNode(child);
      if (cleaned) {
        fragment.appendChild(cleaned);
      }
    });
    return fragment;
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
    !element.querySelector("img, br, hr, input")
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
    if (cell.hasAttribute("colspan") || cell.hasAttribute("rowspan"))
      return false;
    for (const child of Array.from(cell.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = (child as HTMLElement).tagName.toLowerCase();
        if (BLOCK_ELEMENTS.has(tag) && tag !== "br") return false;
      }
    }
  }
  return true;
}

function inlineToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  const inner = Array.from(element.childNodes).map(inlineToMarkdown).join("");

  switch (tag) {
    case "strong":
    case "b":
      return `**${inner}**`;
    case "em":
    case "i":
      return `*${inner}*`;
    case "a": {
      const href = element.getAttribute("href") ?? "";
      return `[${inner}](${href})`;
    }
    case "code":
      return `\`${inner}\``;
    case "br":
      return "\n";
    case "img": {
      const alt = element.getAttribute("alt") ?? "";
      const src = element.getAttribute("src") ?? "";
      return `![${alt}](${src})`;
    }
    default:
      return inner;
  }
}

function tableToMarkdown(tableNode: HTMLTableElement): string {
  const rows = Array.from(tableNode.querySelectorAll("tr"));
  if (rows.length === 0) return "";

  const markdownRows = rows.map((row) => {
    const cells = Array.from(row.querySelectorAll("th, td"));
    return cells.map((cell) =>
      Array.from(cell.childNodes)
        .map(inlineToMarkdown)
        .join("")
        .replace(/\n/g, " ")
        .replace(/\|/g, "\\|")
        .trim(),
    );
  });

  const columnCount = Math.max(...markdownRows.map((row) => row.length));
  markdownRows.forEach((row) => {
    while (row.length < columnCount) row.push("");
  });

  const lines: string[] = [];
  lines.push(`| ${markdownRows[0].join(" | ")} |`);
  lines.push(`| ${Array(columnCount).fill("---").join(" | ")} |`);

  for (let index = 1; index < markdownRows.length; index += 1) {
    lines.push(`| ${markdownRows[index].join(" | ")} |`);
  }

  return lines.join("\n");
}

function nodeToMarkdown(
  node: Node,
  listDepth = 0,
  listType: string | null = null,
): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim() ?? "";
    return text || "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tag)) {
    const level = Number.parseInt(tag[1] ?? "1", 10);
    const prefix = "#".repeat(level);
    const text = Array.from(element.childNodes)
      .map(inlineToMarkdown)
      .join("")
      .trim();
    return `${prefix} ${text}`;
  }

  if (tag === "p") {
    return Array.from(element.childNodes).map(inlineToMarkdown).join("").trim();
  }

  if (tag === "blockquote") {
    const inner = Array.from(element.childNodes)
      .map((child) => nodeToMarkdown(child, listDepth, listType))
      .filter(Boolean)
      .join("\n\n");
    return inner
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }

  if (tag === "hr") return "---";

  if (tag === "pre") {
    const codeElement = element.querySelector("code");
    const content = codeElement ?? element;
    let language = "";
    if (codeElement) {
      const match = (codeElement.getAttribute("class") ?? "").match(
        /language-(\w+)/,
      );
      if (match) language = match[1] ?? "";
    }
    const text = content.textContent ?? "";
    return `\`\`\`${language}\n${text}\n\`\`\``;
  }

  if (tag === "code") return `\`${element.textContent ?? ""}\``;

  if (tag === "ul") {
    return Array.from(element.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child) => nodeToMarkdown(child, listDepth, "ul"))
      .filter(Boolean)
      .join("\n");
  }

  if (tag === "ol") {
    let index = Number.parseInt(element.getAttribute("start") ?? "1", 10);
    return Array.from(element.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child) => {
        const result = nodeToMarkdown(child, listDepth, `ol:${index}`);
        index += 1;
        return result;
      })
      .filter(Boolean)
      .join("\n");
  }

  if (tag === "li") {
    const indent = "  ".repeat(listDepth);
    const bullet = listType?.startsWith("ol:")
      ? `${listType.split(":")[1]}.`
      : "-";
    const inlineParts: string[] = [];
    const nestedLists: HTMLElement[] = [];

    Array.from(element.childNodes).forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childTag = (child as HTMLElement).tagName.toLowerCase();
        if (childTag === "ul" || childTag === "ol") {
          nestedLists.push(child as HTMLElement);
          return;
        }
      }
      inlineParts.push(inlineToMarkdown(child));
    });

    const inlineText = inlineParts.join("").trim();
    const lines = [`${indent}${bullet} ${inlineText}`.trimEnd()];

    nestedLists.forEach((nested) => {
      const nestedTag = nested.tagName.toLowerCase();
      let nestedIndex = Number.parseInt(
        nested.getAttribute("start") ?? "1",
        10,
      );
      Array.from(nested.children)
        .filter((child) => child.tagName.toLowerCase() === "li")
        .forEach((child) => {
          const nestedType = nestedTag === "ol" ? `ol:${nestedIndex}` : "ul";
          lines.push(nodeToMarkdown(child, listDepth + 1, nestedType));
          if (nestedTag === "ol") nestedIndex += 1;
        });
    });

    return lines.join("\n");
  }

  if (tag === "table") {
    return isSimpleTable(element as HTMLTableElement)
      ? tableToMarkdown(element as HTMLTableElement)
      : prettyPrint(element, 0);
  }

  if (["strong", "b", "em", "i", "a", "img"].includes(tag)) {
    return inlineToMarkdown(element);
  }

  if (["div", "section", "article", "main", "header", "footer"].includes(tag)) {
    return Array.from(element.childNodes)
      .map((child) => nodeToMarkdown(child, listDepth, listType))
      .filter(Boolean)
      .join("\n\n");
  }

  const inlineFallback = inlineToMarkdown(element).trim();
  return inlineFallback || "";
}

function convertToMarkdown(container: HTMLElement): string {
  return Array.from(container.childNodes)
    .map((child) => nodeToMarkdown(child).trim())
    .filter(Boolean)
    .join("\n\n")
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

export function processClipboardHtml(rawHtml: string): {
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

export function sanitizePastedHtml(html: string): string {
  if (!canUseDom()) {
    return html;
  }

  const container = document.createElement("div");
  container.innerHTML = html;

  container.querySelectorAll("*").forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (FORBIDDEN_TAGS.has(tag)) {
      element.remove();
      return;
    }

    element.removeAttribute("style");
    Array.from(element.attributes).forEach((attribute) => {
      if (attribute.name.startsWith("on")) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return container.innerHTML;
}

const PREVIEW_STYLES = `
<style>
  :root {
    color-scheme: light;
  }
  body {
    margin: 0;
    padding: 20px;
    font-family: Arial, Helvetica, sans-serif;
    color: #111827;
    background: #ffffff;
    line-height: 1.6;
  }
  img {
    max-width: 100%;
    height: auto;
  }
  table {
    border-collapse: collapse;
  }
  th, td {
    border: 1px solid #d1d5db;
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
  }
  pre {
    white-space: pre-wrap;
  }
</style>
`;

export function buildClipboardPreviewDocument(html: string): string {
  return `${PREVIEW_STYLES}${html}`;
}

function assertSupportedFormat(format: ClipboardImportFormat): void {
  if (!SUPPORTED_FORMATS.includes(format)) {
    throw new Error("Unsupported clipboard import format.");
  }
}



export function readClipboardSourceFromDataTransfer(
  data: DataTransfer | null,
): ClipboardImportSource {
  if (!data) {
    return { html: null, text: null };
  }

  const html = data.getData("text/html");
  const text = data.getData("text/plain");

  return {
    html: html ? html : null,
    text: text ? text : null,
  };
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
    html: html != null && html !== "" ? html : null,
    text: text != null && text !== "" ? text : null,
  };
}

export function transformClipboardSource(
  source: ClipboardImportSource,
  format: ClipboardImportFormat,
): string {
  assertSupportedFormat(format);

  if (format === "plain_text") {
    return source.text ?? "";
  }

  if (source.html) {
    const result = processClipboardHtml(source.html);
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
