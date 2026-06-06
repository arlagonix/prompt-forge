import type { PromptForgeExportV1 } from "@/lib/prompt-forge/types";

export const AUTO_BACKUP_SETTINGS_KEY = "auto-backup-settings";
export const AUTO_BACKUP_DIRECTORY_HANDLE_KEY =
  "auto-backup-directory-handle";
export const AUTO_BACKUP_FILENAME_PREFIX = "prompt-forge-backup-";
export const AUTO_BACKUP_FILENAME_SUFFIX = ".json";

export interface AutoBackupSettings {
  enabled: boolean;
  cooldownMinutes: number;
  maxBackups: number;
  lastBackupAt: number | null;
}

export const DEFAULT_AUTO_BACKUP_SETTINGS: AutoBackupSettings = {
  enabled: false,
  cooldownMinutes: 5,
  maxBackups: 10,
  lastBackupAt: null,
};

export function normalizeAutoBackupSettings(
  value: unknown,
): AutoBackupSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return DEFAULT_AUTO_BACKUP_SETTINGS;
  }

  const candidate = value as Partial<AutoBackupSettings>;
  const cooldownMinutes =
    typeof candidate.cooldownMinutes === "number" &&
    Number.isFinite(candidate.cooldownMinutes) &&
    candidate.cooldownMinutes > 0
      ? Math.max(1, Math.floor(candidate.cooldownMinutes))
      : DEFAULT_AUTO_BACKUP_SETTINGS.cooldownMinutes;
  const maxBackups =
    typeof candidate.maxBackups === "number" &&
    Number.isFinite(candidate.maxBackups) &&
    candidate.maxBackups > 0
      ? Math.max(1, Math.floor(candidate.maxBackups))
      : DEFAULT_AUTO_BACKUP_SETTINGS.maxBackups;
  const lastBackupAt =
    typeof candidate.lastBackupAt === "number" &&
    Number.isFinite(candidate.lastBackupAt)
      ? candidate.lastBackupAt
      : null;

  return {
    enabled: candidate.enabled === true,
    cooldownMinutes,
    maxBackups,
    lastBackupAt,
  };
}

export function isAutoBackupFolderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.showDirectoryPicker === "function"
  );
}

export async function chooseAutoBackupFolder(): Promise<FileSystemDirectoryHandle> {
  if (!isAutoBackupFolderSupported()) {
    throw new Error("Auto backup folders are not supported by this browser");
  }

  return await window.showDirectoryPicker({ mode: "readwrite" });
}

export function isAutoBackupDirectoryHandle(
  value: unknown,
): value is FileSystemDirectoryHandle {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<FileSystemDirectoryHandle>).kind === "directory" &&
    typeof (value as Partial<FileSystemDirectoryHandle>).name === "string" &&
    typeof (value as FileSystemDirectoryHandle).getFileHandle === "function" &&
    typeof (value as FileSystemDirectoryHandle).values === "function"
  );
}

export async function getAutoBackupFolderPermission(
  directoryHandle: FileSystemDirectoryHandle,
): Promise<PermissionState> {
  if (typeof directoryHandle.queryPermission !== "function") {
    return "prompt";
  }

  return await directoryHandle.queryPermission({ mode: "readwrite" });
}

export async function ensureAutoBackupFolderPermission(
  directoryHandle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const currentPermission = await getAutoBackupFolderPermission(directoryHandle);
  if (currentPermission === "granted") return true;
  if (currentPermission === "denied") return false;

  if (typeof directoryHandle.requestPermission !== "function") {
    return true;
  }

  const nextPermission = await directoryHandle.requestPermission({
    mode: "readwrite",
  });
  return nextPermission === "granted";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function buildAutoBackupFilename(date = new Date()): string {
  return `${AUTO_BACKUP_FILENAME_PREFIX}${date.getFullYear()}-${pad(
    date.getMonth() + 1,
  )}-${pad(date.getDate())}.${pad(date.getHours())}-${pad(
    date.getMinutes(),
  )}-${pad(date.getSeconds())}${AUTO_BACKUP_FILENAME_SUFFIX}`;
}

function isAutoBackupFilename(name: string): boolean {
  return (
    name.startsWith(AUTO_BACKUP_FILENAME_PREFIX) &&
    name.endsWith(AUTO_BACKUP_FILENAME_SUFFIX)
  );
}

async function listAutoBackupFiles(
  directoryHandle: FileSystemDirectoryHandle,
): Promise<FileSystemFileHandle[]> {
  const files: FileSystemFileHandle[] = [];

  for await (const entry of directoryHandle.values()) {
    if (entry.kind === "file" && isAutoBackupFilename(entry.name)) {
      files.push(entry);
    }
  }

  return files;
}

export async function writeAutoBackupFile({
  data,
  directoryHandle,
  maxBackups,
}: {
  data: PromptForgeExportV1;
  directoryHandle: FileSystemDirectoryHandle;
  maxBackups: number;
}): Promise<{ filename: string; deletedCount: number }> {
  const filename = buildAutoBackupFilename();
  const fileHandle = await directoryHandle.getFileHandle(filename, {
    create: true,
  });
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(
      new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      }),
    );
  } finally {
    await writable.close();
  }

  const deletedCount = await pruneAutoBackupFiles(directoryHandle, maxBackups);
  return { filename, deletedCount };
}

export async function pruneAutoBackupFiles(
  directoryHandle: FileSystemDirectoryHandle,
  maxBackups: number,
): Promise<number> {
  const safeMaxBackups = Math.max(1, Math.floor(maxBackups));
  const files = await listAutoBackupFiles(directoryHandle);

  if (files.length <= safeMaxBackups) return 0;

  files.sort((a, b) => a.name.localeCompare(b.name));
  const filesToDelete = files.slice(0, files.length - safeMaxBackups);

  let deletedCount = 0;
  for (const file of filesToDelete) {
    await directoryHandle.removeEntry(file.name);
    deletedCount += 1;
  }

  return deletedCount;
}
