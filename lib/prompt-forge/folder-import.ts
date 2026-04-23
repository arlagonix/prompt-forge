export interface FolderImportBlock {
  relativePath: string;
  content: string;
}

function normalizeDisplayedPath(path: string): string {
  return path.replace(/\\+/g, "/").replace(/^\/+/, "");
}

function normalizeFileContent(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\n+$/g, "");
}

function getExtension(path: string): string {
  const normalized = normalizeDisplayedPath(path);
  const lastSlash = normalized.lastIndexOf("/");
  const name = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return "";
  return name.slice(lastDot).toLowerCase();
}

function sortBlocks(blocks: FolderImportBlock[]): FolderImportBlock[] {
  return blocks.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, undefined, {
      sensitivity: "base",
    }),
  );
}

async function readMatchingFile(
  file: File,
  relativePath: string,
  formats: Set<string>,
): Promise<FolderImportBlock | null> {
  const normalizedPath = normalizeDisplayedPath(relativePath);
  if (!formats.has(getExtension(normalizedPath))) return null;

  const content = normalizeFileContent(await file.text());
  if (!content.trim()) return null;

  return {
    relativePath: normalizedPath,
    content,
  };
}

function hasDirectoryPicker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.showDirectoryPicker === "function"
  );
}

async function collectFromDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  formats: Set<string>,
  basePath = "",
): Promise<FolderImportBlock[]> {
  const entries: FolderImportBlock[] = [];

  for await (const child of handle.values()) {
    const childPath = basePath ? `${basePath}/${child.name}` : child.name;

    if (child.kind === "directory") {
      entries.push(
        ...(await collectFromDirectoryHandle(child, formats, childPath)),
      );
      continue;
    }

    const block = await readMatchingFile(
      await child.getFile(),
      childPath,
      formats,
    );
    if (block) entries.push(block);
  }

  return entries;
}

function readEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
}

function readFileEntry(fileEntry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    fileEntry.file(resolve, reject);
  });
}

async function collectFromEntry(
  entry: FileSystemEntry,
  formats: Set<string>,
  basePath = "",
): Promise<FolderImportBlock[]> {
  const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

  if (entry.isFile) {
    const file = await readFileEntry(entry as FileSystemFileEntry);
    const block = await readMatchingFile(file, entryPath, formats);
    return block ? [block] : [];
  }

  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const blocks: FolderImportBlock[] = [];

  while (true) {
    const children = await readEntries(reader);
    if (children.length === 0) break;

    for (const child of children) {
      blocks.push(...(await collectFromEntry(child, formats, entryPath)));
    }
  }

  return blocks;
}

function pickDirectoryViaInput(
  formats: Set<string>,
): Promise<FolderImportBlock[]> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Folder selection is not available in this browser."));
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.webkitdirectory = true;

    const cleanup = () => {
      input.remove();
      window.removeEventListener("focus", handleWindowFocus);
    };

    const finish = (blocks: FolderImportBlock[]) => {
      cleanup();
      resolve(blocks);
    };

    const handleWindowFocus = () => {
      window.setTimeout(() => {
        if ((input.files?.length ?? 0) === 0) {
          finish([]);
        }
      }, 0);
    };

    input.addEventListener(
      "change",
      async () => {
        try {
          const files = Array.from(input.files ?? []);
          if (files.length === 0) {
            finish([]);
            return;
          }

          const blocks: FolderImportBlock[] = [];

          for (const file of files) {
            const relativePath = normalizeDisplayedPath(
              file.webkitRelativePath || file.name,
            );
            const parts = relativePath.split("/");
            const displayPath =
              parts.length > 1 ? parts.slice(1).join("/") : relativePath;

            const block = await readMatchingFile(file, displayPath, formats);
            if (block) blocks.push(block);
          }

          finish(blocks);
        } catch (error) {
          cleanup();
          reject(error);
        }
      },
      { once: true },
    );

    window.addEventListener("focus", handleWindowFocus, { once: true });
    input.click();
  });
}

function getDroppedEntries(
  items: DataTransferItemList | DataTransferItem[],
): FileSystemEntry[] {
  const source = Array.from(items);
  return source
    .map((item) => item.webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is FileSystemEntry => entry !== null);
}

export async function readDroppedFolderImportContents(
  items: DataTransferItemList | DataTransferItem[],
  formats: string[],
): Promise<FolderImportBlock[]> {
  const normalizedFormats = new Set(
    (formats.length > 0 ? formats : [".md"]).map((format) =>
      format.toLowerCase(),
    ),
  );

  const entries = getDroppedEntries(items);
  if (entries.length === 0) {
    throw new Error(
      "Folder drag-and-drop is not supported in this browser. Use the folder picker instead.",
    );
  }

  const blocks: FolderImportBlock[] = [];

  for (const entry of entries) {
    blocks.push(...(await collectFromEntry(entry, normalizedFormats)));
  }

  return sortBlocks(blocks);
}

export async function readFolderImportContents(
  formats: string[],
): Promise<FolderImportBlock[]> {
  const normalizedFormats = new Set(
    (formats.length > 0 ? formats : [".md"]).map((format) =>
      format.toLowerCase(),
    ),
  );

  try {
    const blocks = hasDirectoryPicker()
      ? await collectFromDirectoryHandle(
          await window.showDirectoryPicker(),
          normalizedFormats,
        )
      : await pickDirectoryViaInput(normalizedFormats);

    return sortBlocks(blocks);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return [];
    }
    throw error;
  }
}

export function buildFolderImportValue(blocks: FolderImportBlock[]): string {
  return blocks
    .map((block) => `[File: ${block.relativePath}]\n${block.content}`)
    .join("\n\n");
}
