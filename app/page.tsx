"use client";

import { CodeEditor } from "@/components/prompt-forge/code-editor";
import { CommandPalette } from "@/components/prompt-forge/command-palette";
import { DocsModal } from "@/components/prompt-forge/docs-modal";
import { MainContent } from "@/components/prompt-forge/main-content";
import { QuickConvertModal } from "@/components/prompt-forge/quick-convert-modal";
import { MoveFolderDialog } from "@/components/prompt-forge/move-folder-dialog";
import { MovePromptDialog } from "@/components/prompt-forge/move-prompt-dialog";
import { Sidebar } from "@/components/prompt-forge/sidebar";
import { TemplateModal } from "@/components/prompt-forge/template-modal";
import type { ReusableTemplateOption } from "@/components/prompt-forge/template-picker-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  analyzeImportConflicts,
  buildExportFilename,
  downloadJsonFile,
  exportFolderTree,
  exportTemplateTree,
  exportWorkspaceTree,
  importExportTree,
  parseAndValidateImport,
  type ImportAnalysisResult,
  type ImportConflictResolution,
  type ImportResult,
} from "@/lib/prompt-forge/import-export";
import {
  AUTO_BACKUP_SETTINGS_KEY,
  DEFAULT_AUTO_BACKUP_SETTINGS,
  chooseAutoBackupFolder,
  isAutoBackupFolderSupported,
  normalizeAutoBackupSettings,
  type AutoBackupSettings,
  writeAutoBackupFile,
} from "@/lib/prompt-forge/auto-backup";
import {
  canMoveFolderToFolder,
  canMovePromptToFolder,
  getAvailableFolderDestinationFolders,
  getAvailablePromptDestinationFolders,
} from "@/lib/prompt-forge/move";
import { extractParameters } from "@/lib/prompt-forge/parser";
import {
  buildFolderTree,
  clonePrompt,
  createFolder,
  createPrompt,
  deleteFolder,
  deletePrompt,
  ensureSeedData,
  getAllFolders,
  getAllPrompts,
  getAppState,
  getFolderDeleteSummary,
  getTemplateStarter,
  moveFolder,
  movePrompt,
  renameFolder,
  renamePrompt,
  ROOT_FOLDER_ID,
  setAppState,
  setTemplateStarter,
  updatePromptContent,
} from "@/lib/prompt-forge/storage";
import type {
  EditorState,
  FolderNode,
  Parameter,
  ParsedFile,
  PromptForgeExportV1,
} from "@/lib/prompt-forge/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const LAST_FILE_KEY = "prompt-forge-last-file";

function flattenFolders(
  root: FolderNode,
): { id: string; name: string; path: string }[] {
  const result: { id: string; name: string; path: string }[] = [];

  function walk(folder: FolderNode) {
    result.push({
      id: folder.id,
      name: folder.name,
      path: folder.path,
    });

    for (const child of folder.children) {
      if (child.type === "directory") {
        walk(child);
      }
    }
  }

  walk(root);
  return result;
}

function buildImportSummary(result: ImportResult): string {
  const parts: string[] = [];

  if (result.importedPromptCount > 0) {
    parts.push(
      `${result.importedPromptCount} template${
        result.importedPromptCount === 1 ? "" : "s"
      } imported`,
    );
  }
  if (result.importedFolderCount > 0) {
    parts.push(
      `${result.importedFolderCount} folder${
        result.importedFolderCount === 1 ? "" : "s"
      } imported`,
    );
  }
  if (result.replacedPromptCount > 0) {
    parts.push(
      `${result.replacedPromptCount} template${
        result.replacedPromptCount === 1 ? "" : "s"
      } replaced`,
    );
  }
  if (result.copiedPromptCount > 0) {
    parts.push(
      `${result.copiedPromptCount} template cop${
        result.copiedPromptCount === 1 ? "y" : "ies"
      } created`,
    );
  }
  if (result.identicalPromptCount > 0) {
    parts.push(
      `${result.identicalPromptCount} identical template${
        result.identicalPromptCount === 1 ? "" : "s"
      } skipped`,
    );
  }

  return parts.length > 0 ? `Import completed: ${parts.join(", ")}.` : "Import completed: nothing changed.";
}

export default function PromptForge() {
  const [folderTree, setFolderTree] = useState<FolderNode | null>(null);
  const [fileMap, setFileMap] = useState<Map<string, ParsedFile>>(new Map());
  const [allFolders, setAllFolders] = useState<
    { id: string; parentId: string | null }[]
  >([]);
  const [currentFile, setCurrentFile] = useState<ParsedFile | null>(null);
  const [currentParams, setCurrentParams] = useState<Parameter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isQuickConvertOpen, setIsQuickConvertOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [editorState, setEditorState] = useState<EditorState>({
    isOpen: false,
    isNew: false,
    mode: "prompt",
    fileId: null,
    content: "",
    fileName: "",
    folderId: null,
  });
  const [templateStarterContent, setTemplateStarterContent] = useState("");
  const [movePromptState, setMovePromptState] = useState<{
    isOpen: boolean;
    promptId: string | null;
    promptName: string;
    currentFolderId: string | null;
    currentFolderPath: string;
    selectedFolderId: string;
  }>({
    isOpen: false,
    promptId: null,
    promptName: "",
    currentFolderId: null,
    currentFolderPath: "/Workspace",
    selectedFolderId: "",
  });
  const [moveFolderState, setMoveFolderState] = useState<{
    isOpen: boolean;
    folderId: string | null;
    folderName: string;
    currentParentId: string | null;
    currentParentPath: string;
    selectedFolderId: string;
  }>({
    isOpen: false,
    folderId: null,
    folderName: "",
    currentParentId: null,
    currentParentPath: "/Workspace",
    selectedFolderId: "",
  });
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const importTargetFolderIdRef = useRef<string>(ROOT_FOLDER_ID);
  const [importConflictState, setImportConflictState] = useState<{
    isOpen: boolean;
    data: PromptForgeExportV1 | null;
    targetFolderId: string;
    analysis: ImportAnalysisResult | null;
    isImporting: boolean;
  }>({
    isOpen: false,
    data: null,
    targetFolderId: ROOT_FOLDER_ID,
    analysis: null,
    isImporting: false,
  });
  const [isAutoBackupOpen, setIsAutoBackupOpen] = useState(false);
  const [autoBackupSettings, setAutoBackupSettings] = useState<AutoBackupSettings>(
    DEFAULT_AUTO_BACKUP_SETTINGS,
  );
  const [autoBackupMaxBackupsInput, setAutoBackupMaxBackupsInput] = useState(
    String(DEFAULT_AUTO_BACKUP_SETTINGS.maxBackups),
  );
  const [autoBackupFolderName, setAutoBackupFolderName] = useState<string | null>(
    null,
  );
  const [isAutoBackupSaving, setIsAutoBackupSaving] = useState(false);
  const autoBackupDirectoryHandleRef =
    useRef<FileSystemDirectoryHandle | null>(null);
  const autoBackupSettingsRef = useRef<AutoBackupSettings>(
    DEFAULT_AUTO_BACKUP_SETTINGS,
  );
  const autoBackupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoBackupMissingFolderNotifiedRef = useRef(false);
  const autoBackupInProgressRef = useRef(false);
  const isMobile = useIsMobile();

  const [dragState, setDragState] = useState<{
    type: "prompt" | "folder" | null;
    itemId: string | null;
    sourceFolderId: string | null;
    hoveredFolderId: string | null;
    isHoveringRoot: boolean;
  }>({
    type: null,
    itemId: null,
    sourceFolderId: null,
    hoveredFolderId: null,
    isHoveringRoot: false,
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    try {
      const savedSidebar = localStorage.getItem("prompt-forge-sidebar-open");
      if (savedSidebar != null) {
        setIsSidebarOpen(savedSidebar === "true");
      } else {
        setIsSidebarOpen(!isMobile);
      }
    } catch {
      setIsSidebarOpen(!isMobile);
    }

    try {
      const savedPreview = localStorage.getItem("prompt-forge-preview-open");
      if (savedPreview != null) {
        setIsPreviewOpen(savedPreview === "true");
      }
    } catch {}
  }, [isMobile, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(
        "prompt-forge-sidebar-open",
        isSidebarOpen ? "true" : "false",
      );
    } catch {}
  }, [isSidebarOpen, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(
        "prompt-forge-preview-open",
        isPreviewOpen ? "true" : "false",
      );
    } catch {}
  }, [isPreviewOpen, mounted]);

  const showNotification = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      if (type === "error") {
        toast.error(message);
      } else {
        toast.success(message);
      }
    },
    [],
  );

  const persistAutoBackupSettings = useCallback(
    async (settings: AutoBackupSettings) => {
      const normalized = normalizeAutoBackupSettings(settings);
      autoBackupSettingsRef.current = normalized;
      setAutoBackupSettings(normalized);
      await setAppState(AUTO_BACKUP_SETTINGS_KEY, normalized);
    },
    [],
  );

  const connectAutoBackupFolder = useCallback(async () => {
    if (!isAutoBackupFolderSupported()) {
      showNotification(
        "Auto backup folders are not supported by this browser",
        "error",
      );
      return null;
    }

    try {
      const handle = await chooseAutoBackupFolder();
      autoBackupDirectoryHandleRef.current = handle;
      autoBackupMissingFolderNotifiedRef.current = false;
      setAutoBackupFolderName(handle.name);
      showNotification(`Backup folder connected: ${handle.name}`);
      return handle;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return null;
      }

      showNotification(
        `Failed to choose backup folder: ${(err as Error).message}`,
        "error",
      );
      return null;
    }
  }, [showNotification]);

  const runAutoBackup = useCallback(
    async ({ manual = false }: { manual?: boolean } = {}) => {
      const settings = autoBackupSettingsRef.current;

      if (!manual && !settings.enabled) return false;

      if (!isAutoBackupFolderSupported()) {
        if (manual) {
          showNotification(
            "Auto backup folders are not supported by this browser",
            "error",
          );
        }
        return false;
      }

      let directoryHandle = autoBackupDirectoryHandleRef.current;
      if (!directoryHandle) {
        if (manual) {
          directoryHandle = await connectAutoBackupFolder();
        } else if (!autoBackupMissingFolderNotifiedRef.current) {
          autoBackupMissingFolderNotifiedRef.current = true;
          showNotification(
            "Auto backup is enabled, but the backup folder is not connected",
            "error",
          );
        }
      }

      if (!directoryHandle) return false;
      if (autoBackupInProgressRef.current) return false;

      autoBackupInProgressRef.current = true;
      setIsAutoBackupSaving(true);

      try {
        const data = await exportWorkspaceTree();
        await writeAutoBackupFile({
          data,
          directoryHandle,
          maxBackups: settings.maxBackups,
        });

        const nextSettings = {
          ...settings,
          lastBackupAt: Date.now(),
        };
        await persistAutoBackupSettings(nextSettings);

        if (manual) {
          showNotification("Backup saved");
        }

        return true;
      } catch (err) {
        showNotification(
          `Failed to save backup: ${(err as Error).message}`,
          "error",
        );
        return false;
      } finally {
        autoBackupInProgressRef.current = false;
        setIsAutoBackupSaving(false);
      }
    },
    [connectAutoBackupFolder, persistAutoBackupSettings, showNotification],
  );

  const scheduleAutoBackup = useCallback(() => {
    const settings = autoBackupSettingsRef.current;
    if (!settings.enabled) return;
    if (autoBackupTimerRef.current) return;

    if (!isAutoBackupFolderSupported()) return;

    if (!autoBackupDirectoryHandleRef.current) {
      if (!autoBackupMissingFolderNotifiedRef.current) {
        autoBackupMissingFolderNotifiedRef.current = true;
        showNotification(
          "Auto backup is enabled, but the backup folder is not connected",
          "error",
        );
      }
      return;
    }

    const cooldownMs = settings.cooldownMinutes * 60_000;
    const nextAllowedBackupAt = (settings.lastBackupAt ?? 0) + cooldownMs;
    const delay = Math.max(0, nextAllowedBackupAt - Date.now());

    autoBackupTimerRef.current = setTimeout(() => {
      autoBackupTimerRef.current = null;
      void runAutoBackup();
    }, delay);
  }, [runAutoBackup, showNotification]);

  useEffect(() => {
    autoBackupSettingsRef.current = autoBackupSettings;
    setAutoBackupMaxBackupsInput(String(autoBackupSettings.maxBackups));
  }, [autoBackupSettings]);

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      try {
        const savedSettings = await getAppState<AutoBackupSettings>(
          AUTO_BACKUP_SETTINGS_KEY,
        );
        if (isCancelled) return;
        const normalized = normalizeAutoBackupSettings(savedSettings);
        autoBackupSettingsRef.current = normalized;
        setAutoBackupSettings(normalized);
      } catch {
        // Keep defaults if settings cannot be read.
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (autoBackupTimerRef.current) {
        clearTimeout(autoBackupTimerRef.current);
        autoBackupTimerRef.current = null;
      }
    };
  }, []);

  const enableAutoBackup = useCallback(async () => {
    if (!isAutoBackupFolderSupported()) {
      showNotification(
        "Auto backup folders are not supported by this browser",
        "error",
      );
      return;
    }

    const directoryHandle =
      autoBackupDirectoryHandleRef.current ?? (await connectAutoBackupFolder());
    if (!directoryHandle) return;

    await persistAutoBackupSettings({
      ...autoBackupSettingsRef.current,
      enabled: true,
    });
    showNotification("Auto backup enabled");
  }, [connectAutoBackupFolder, persistAutoBackupSettings, showNotification]);

  const disableAutoBackup = useCallback(async () => {
    if (autoBackupTimerRef.current) {
      clearTimeout(autoBackupTimerRef.current);
      autoBackupTimerRef.current = null;
    }

    await persistAutoBackupSettings({
      ...autoBackupSettingsRef.current,
      enabled: false,
    });
    showNotification("Auto backup disabled");
  }, [persistAutoBackupSettings, showNotification]);

  const setAutoBackupEnabled = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        await enableAutoBackup();
      } else {
        await disableAutoBackup();
      }
    },
    [disableAutoBackup, enableAutoBackup],
  );

  const saveAutoBackupMaxBackups = useCallback(async () => {
    const nextMaxBackups = Number(autoBackupMaxBackupsInput);

    if (!Number.isFinite(nextMaxBackups) || nextMaxBackups < 1) {
      showNotification("Maximum backups must be at least 1", "error");
      setAutoBackupMaxBackupsInput(
        String(autoBackupSettingsRef.current.maxBackups),
      );
      return;
    }

    await persistAutoBackupSettings({
      ...autoBackupSettingsRef.current,
      maxBackups: Math.floor(nextMaxBackups),
    });
  }, [autoBackupMaxBackupsInput, persistAutoBackupSettings, showNotification]);

  const saveLastFile = useCallback((file: ParsedFile) => {
    try {
      localStorage.setItem(
        LAST_FILE_KEY,
        JSON.stringify({
          id: file.id,
          name: file.name,
          path: file.path,
          ts: Date.now(),
        }),
      );
    } catch {}
  }, []);

  const loadLastFile = useCallback((): {
    id?: string;
    name?: string;
    path?: string;
  } | null => {
    try {
      const raw = localStorage.getItem(LAST_FILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const clearLastFile = useCallback(() => {
    try {
      localStorage.removeItem(LAST_FILE_KEY);
    } catch {}
  }, []);

  const applyCurrentFile = useCallback(
    (file: ParsedFile | null) => {
      setCurrentFile(file);
      setCurrentParams(file ? extractParameters(file.content) : []);
      if (file) {
        saveLastFile(file);
      }
    },
    [saveLastFile],
  );

  const loadWorkspace = useCallback(
    async ({
      preserveFileId,
      restoreLastFile = false,
    }: {
      preserveFileId?: string | null;
      restoreLastFile?: boolean;
    } = {}) => {
      setIsLoading(true);

      try {
        await ensureSeedData();

        const [folders, prompts, nextTemplateStarter] = await Promise.all([
          getAllFolders(),
          getAllPrompts(),
          getTemplateStarter(),
        ]);

        const { folderTree: nextFolderTree, fileMap: nextFileMap } =
          buildFolderTree(folders, prompts);

        setTemplateStarterContent(nextTemplateStarter);

        setAllFolders(
          folders.map((folder) => ({
            id: folder.id,
            parentId: folder.parentId,
          })),
        );

        setFolderTree(nextFolderTree);
        setFileMap(nextFileMap);

        let nextCurrentFile: ParsedFile | null = null;

        if (preserveFileId && nextFileMap.has(preserveFileId)) {
          nextCurrentFile = nextFileMap.get(preserveFileId) ?? null;
        } else if (restoreLastFile) {
          const lastFile = loadLastFile();
          if (lastFile?.id && nextFileMap.has(lastFile.id)) {
            nextCurrentFile = nextFileMap.get(lastFile.id) ?? null;
          } else if (lastFile?.path) {
            for (const file of nextFileMap.values()) {
              if (file.path === lastFile.path) {
                nextCurrentFile = file;
                break;
              }
            }
          }
        }

        if (
          !nextCurrentFile &&
          currentFile?.id &&
          nextFileMap.has(currentFile.id)
        ) {
          nextCurrentFile = nextFileMap.get(currentFile.id) ?? null;
        }

        if (nextCurrentFile) {
          applyCurrentFile(nextCurrentFile);
        } else {
          setCurrentFile(null);
          setCurrentParams([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [applyCurrentFile, currentFile?.id, loadLastFile],
  );

  const selectFolder = useCallback(() => {
    showNotification(
      "Folder selection is no longer used. Prompts are now stored inside the app.",
      "error",
    );
  }, [showNotification]);

  const loadFile = useCallback(
    async (fileId: string) => {
      const file = fileMap.get(fileId);
      if (!file) {
        showNotification("Prompt not found", "error");
        return;
      }

      applyCurrentFile(file);
    },
    [fileMap, applyCurrentFile, showNotification],
  );

  const refreshFolder = useCallback(async () => {
    await loadWorkspace({ preserveFileId: currentFile?.id ?? null });
    showNotification("Workspace refreshed");
  }, [loadWorkspace, currentFile?.id, showNotification]);

  const openEditor = useCallback(
    async (fileId: string) => {
      const file = fileMap.get(fileId);
      if (!file) {
        showNotification("Failed to open prompt for editing", "error");
        return;
      }

      setEditorState({
        isOpen: true,
        isNew: false,
        mode: "prompt",
        fileId,
        content: file.content,
        fileName: file.name,
        folderId: file.folderId,
      });
    },
    [fileMap, showNotification],
  );

  const createNewFile = useCallback(
    (folderId?: string) => {
      setEditorState({
        isOpen: true,
        isNew: true,
        mode: "prompt",
        fileId: null,
        content: templateStarterContent,
        fileName: "",
        folderId: folderId ?? ROOT_FOLDER_ID,
      });
    },
    [templateStarterContent],
  );

  const openTemplateStarterEditor = useCallback(() => {
    setEditorState({
      isOpen: true,
      isNew: false,
      mode: "template-starter",
      fileId: null,
      content: templateStarterContent,
      fileName: "Template starter",
      folderId: null,
    });
  }, [templateStarterContent]);

  const createNewFolder = useCallback(
    async (name: string, parentId?: string | null) => {
      const trimmed = name.trim();
      if (!trimmed) {
        showNotification("Folder name cannot be empty", "error");
        return;
      }

      try {
        await createFolder(trimmed, parentId ?? ROOT_FOLDER_ID);
        showNotification(`Created folder: ${trimmed}`);
        await loadWorkspace({ preserveFileId: currentFile?.id ?? null });
        scheduleAutoBackup();
      } catch (err) {
        showNotification(
          `Failed to create folder: ${(err as Error).message}`,
          "error",
        );
      }
    },
    [currentFile?.id, loadWorkspace, scheduleAutoBackup, showNotification],
  );

  const renameExistingFolder = useCallback(
    async (folderId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        showNotification("Folder name cannot be empty", "error");
        return;
      }

      try {
        const updated = await renameFolder(folderId, trimmed);
        showNotification(`Renamed folder: ${updated.name}`);
        await loadWorkspace({ preserveFileId: currentFile?.id ?? null });
        scheduleAutoBackup();
      } catch (err) {
        showNotification(
          `Failed to rename folder: ${(err as Error).message}`,
          "error",
        );
      }
    },
    [currentFile?.id, loadWorkspace, scheduleAutoBackup, showNotification],
  );

  const deleteExistingFolder = useCallback(
    async (folderId: string) => {
      try {
        await deleteFolder(folderId);
        showNotification("Folder deleted");
        await loadWorkspace({ preserveFileId: currentFile?.id ?? null });
        scheduleAutoBackup();
      } catch (err) {
        showNotification(
          `Failed to delete folder: ${(err as Error).message}`,
          "error",
        );
      }
    },
    [currentFile?.id, loadWorkspace, scheduleAutoBackup, showNotification],
  );

  const saveFile = useCallback(
    async (content: string, newFileName?: string) => {
      try {
        if (editorState.mode === "template-starter") {
          await setTemplateStarter(content);
          setTemplateStarterContent(content);
          showNotification("Saved template starter");
          setEditorState((prev) => ({ ...prev, content, isOpen: false }));
          scheduleAutoBackup();
          return;
        }

        const finalFileName = newFileName?.trim();

        if (!finalFileName) {
          throw new Error("Missing prompt name");
        }

        if (editorState.isNew) {
          const created = await createPrompt(
            finalFileName,
            editorState.folderId ?? ROOT_FOLDER_ID,
            content,
          );

          showNotification(`Created: ${created.name}`);
          setEditorState((prev) => ({ ...prev, isOpen: false }));

          await loadWorkspace({ preserveFileId: created.id });
          scheduleAutoBackup();
        } else {
          if (!editorState.fileId) {
            throw new Error("Prompt not found");
          }

          const file = fileMap.get(editorState.fileId);
          if (!file) {
            throw new Error("Prompt not found");
          }

          let resultingName = file.name;

          if (finalFileName !== file.name) {
            const renamed = await renamePrompt(
              editorState.fileId,
              finalFileName,
            );
            resultingName = renamed.name;
          }

          const updated = await updatePromptContent(
            editorState.fileId,
            content,
          );

          showNotification(`Saved: ${resultingName}`);
          setEditorState((prev) => ({
            ...prev,
            content,
            fileName: resultingName,
            isOpen: false,
          }));

          await loadWorkspace({ preserveFileId: updated.id });
          scheduleAutoBackup();
        }
      } catch (err) {
        showNotification(
          `Failed to save ${editorState.mode === "template-starter" ? "template starter" : "prompt"}: ${(err as Error).message}`,
          "error",
        );
        throw err;
      }
    },
    [
      editorState,
      fileMap,
      loadWorkspace,
      scheduleAutoBackup,
      showNotification,
      setTemplateStarterContent,
    ],
  );

  const deleteFile = useCallback(
    async (fileId: string) => {
      const file = fileMap.get(fileId);
      if (!file) {
        showNotification("Cannot delete prompt", "error");
        return;
      }

      try {
        await deletePrompt(fileId);
        showNotification(`Deleted: ${file.name}`);

        if (currentFile?.id === fileId) {
          setCurrentFile(null);
          setCurrentParams([]);
          clearLastFile();
        }

        if (editorState.fileId === fileId) {
          setEditorState((prev) => ({ ...prev, isOpen: false }));
        }

        await loadWorkspace();
        scheduleAutoBackup();
      } catch (err) {
        showNotification(
          `Failed to delete prompt: ${(err as Error).message}`,
          "error",
        );
      }
    },
    [
      fileMap,
      currentFile,
      editorState.fileId,
      loadWorkspace,
      scheduleAutoBackup,
      showNotification,
      clearLastFile,
    ],
  );

  const closeEditor = useCallback(() => {
    setEditorState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const movePromptToFolder = useCallback(
    async (
      promptId: string,
      currentFolderId: string | null,
      targetFolderId: string,
    ) => {
      const validation = canMovePromptToFolder(currentFolderId, targetFolderId);

      if (!validation.ok) {
        throw new Error(validation.reason);
      }

      return await movePrompt(promptId, targetFolderId);
    },
    [],
  );

  const moveFolderToFolder = useCallback(
    async (folderId: string, targetFolderId: string) => {
      const folders = await getAllFolders();
      const validation = canMoveFolderToFolder(
        folderId,
        targetFolderId,
        folders,
      );

      if (!validation.ok) {
        throw new Error(validation.reason);
      }

      return await moveFolder(folderId, targetFolderId);
    },
    [],
  );

  const startPromptDrag = useCallback(
    (promptId: string) => {
      const file = fileMap.get(promptId);
      if (!file) return;

      setDragState({
        type: "prompt",
        itemId: promptId,
        sourceFolderId: file.folderId,
        hoveredFolderId: null,
        isHoveringRoot: false,
      });
    },
    [fileMap],
  );

  const startFolderDrag = useCallback(
    (folderId: string) => {
      const folder = allFolders.find((item) => item.id === folderId);
      if (!folder) return;
      if (folder.parentId === null || folderId === ROOT_FOLDER_ID) return;

      setDragState({
        type: "folder",
        itemId: folderId,
        sourceFolderId: folder.parentId,
        hoveredFolderId: null,
        isHoveringRoot: false,
      });
    },
    [allFolders],
  );

  const endDrag = useCallback(() => {
    setDragState({
      type: null,
      itemId: null,
      sourceFolderId: null,
      hoveredFolderId: null,
      isHoveringRoot: false,
    });
  }, []);

  const canDropToFolder = useCallback(
    (targetFolderId: string) => {
      if (!dragState.type || !dragState.itemId) return false;

      if (dragState.type === "prompt") {
        return canMovePromptToFolder(dragState.sourceFolderId, targetFolderId)
          .ok;
      }

      return canMoveFolderToFolder(dragState.itemId, targetFolderId, allFolders)
        .ok;
    },
    [allFolders, dragState],
  );

  const canDropToRoot = useCallback(() => {
    if (!dragState.type || !dragState.itemId) return false;

    if (dragState.type === "prompt") {
      return canMovePromptToFolder(dragState.sourceFolderId, ROOT_FOLDER_ID).ok;
    }

    return canMoveFolderToFolder(dragState.itemId, ROOT_FOLDER_ID, allFolders)
      .ok;
  }, [allFolders, dragState]);

  const handleFolderDragEnter = useCallback(
    (targetFolderId: string) => {
      if (!canDropToFolder(targetFolderId)) {
        setDragState((prev) => ({
          ...prev,
          hoveredFolderId: null,
          isHoveringRoot: false,
        }));
        return;
      }

      setDragState((prev) => ({
        ...prev,
        hoveredFolderId: targetFolderId,
        isHoveringRoot: false,
      }));
    },
    [canDropToFolder],
  );

  const handleFolderDragLeave = useCallback((targetFolderId: string) => {
    setDragState((prev) =>
      prev.hoveredFolderId === targetFolderId
        ? {
            ...prev,
            hoveredFolderId: null,
          }
        : prev,
    );
  }, []);

  const handleFolderDrop = useCallback(
    async (targetFolderId: string) => {
      if (
        !dragState.type ||
        !dragState.itemId ||
        !canDropToFolder(targetFolderId)
      ) {
        endDrag();
        return;
      }

      try {
        if (dragState.type === "prompt") {
          const updated = await movePromptToFolder(
            dragState.itemId,
            dragState.sourceFolderId,
            targetFolderId,
          );
          showNotification("Template moved");
          await loadWorkspace({ preserveFileId: updated.id });
          scheduleAutoBackup();
        } else {
          await moveFolderToFolder(dragState.itemId, targetFolderId);
          showNotification("Folder moved");
          await loadWorkspace({ preserveFileId: currentFile?.id ?? null });
          scheduleAutoBackup();
        }
      } catch (err) {
        showNotification(
          `Failed to move ${dragState.type === "prompt" ? "template" : "folder"}: ${
            (err as Error).message
          }`,
          "error",
        );
      } finally {
        endDrag();
      }
    },
    [
      canDropToFolder,
      currentFile?.id,
      dragState,
      endDrag,
      loadWorkspace,
      moveFolderToFolder,
      movePromptToFolder,
      scheduleAutoBackup,
      showNotification,
    ],
  );

  const handleRootDragEnter = useCallback(() => {
    if (!canDropToRoot()) {
      setDragState((prev) => ({
        ...prev,
        hoveredFolderId: null,
        isHoveringRoot: false,
      }));
      return;
    }

    setDragState((prev) => ({
      ...prev,
      hoveredFolderId: null,
      isHoveringRoot: true,
    }));
  }, [canDropToRoot]);

  const handleRootDragLeave = useCallback(() => {
    setDragState((prev) => ({
      ...prev,
      isHoveringRoot: false,
    }));
  }, []);

  const handleRootDrop = useCallback(async () => {
    if (!dragState.type || !dragState.itemId || !canDropToRoot()) {
      endDrag();
      return;
    }

    try {
      if (dragState.type === "prompt") {
        const updated = await movePromptToFolder(
          dragState.itemId,
          dragState.sourceFolderId,
          ROOT_FOLDER_ID,
        );
        showNotification("Template moved");
        await loadWorkspace({ preserveFileId: updated.id });
        scheduleAutoBackup();
      } else {
        await moveFolderToFolder(dragState.itemId, ROOT_FOLDER_ID);
        showNotification("Folder moved");
        await loadWorkspace({ preserveFileId: currentFile?.id ?? null });
        scheduleAutoBackup();
      }
    } catch (err) {
      showNotification(
        `Failed to move ${dragState.type === "prompt" ? "template" : "folder"}: ${
          (err as Error).message
        }`,
        "error",
      );
    } finally {
      endDrag();
    }
  }, [
    canDropToRoot,
    currentFile?.id,
    dragState,
    endDrag,
    loadWorkspace,
    moveFolderToFolder,
    movePromptToFolder,
    scheduleAutoBackup,
    showNotification,
  ]);

  const openMovePromptDialog = useCallback(
    (fileId: string) => {
      const file = fileMap.get(fileId);
      if (!file) {
        showNotification("Prompt not found", "error");
        return;
      }

      const currentFolderPath = file.path.includes("/")
        ? file.path.substring(0, file.path.lastIndexOf("/"))
        : "/Workspace";

      setMovePromptState({
        isOpen: true,
        promptId: file.id,
        promptName: file.name,
        currentFolderId: file.folderId,
        currentFolderPath,
        selectedFolderId: "",
      });
    },
    [fileMap, showNotification],
  );

  const confirmMovePrompt = useCallback(async () => {
    if (!movePromptState.promptId || !movePromptState.selectedFolderId) return;

    try {
      const updated = await movePromptToFolder(
        movePromptState.promptId,
        movePromptState.currentFolderId,
        movePromptState.selectedFolderId,
      );

      showNotification("Template moved");
      setMovePromptState({
        isOpen: false,
        promptId: null,
        promptName: "",
        currentFolderId: null,
        currentFolderPath: "/Workspace",
        selectedFolderId: "",
      });

      await loadWorkspace({ preserveFileId: updated.id });
      scheduleAutoBackup();
    } catch (err) {
      showNotification(
        `Failed to move template: ${(err as Error).message}`,
        "error",
      );
    }
  }, [loadWorkspace, movePromptState, movePromptToFolder, scheduleAutoBackup, showNotification]);

  const displayFolderParentPath = useCallback(
    (folderId: string | null, root: FolderNode | null) => {
      if (!root || !folderId) return "/Workspace";

      const all = flattenFolders(root);
      const found = all.find((folder) => folder.id === folderId);
      return found?.path ?? "/Workspace";
    },
    [],
  );

  const openMoveFolderDialog = useCallback(
    async (folderId: string) => {
      const folders = await getAllFolders();
      const target = folders.find((folder) => folder.id === folderId);

      if (!target) {
        showNotification("Folder not found", "error");
        return;
      }

      if (target.parentId === null) {
        showNotification("Root folder cannot be moved", "error");
        return;
      }

      setMoveFolderState({
        isOpen: true,
        folderId: target.id,
        folderName: target.name,
        currentParentId: target.parentId,
        currentParentPath: displayFolderParentPath(target.parentId, folderTree),
        selectedFolderId: "",
      });
    },
    [displayFolderParentPath, folderTree, showNotification],
  );

  const confirmMoveFolder = useCallback(async () => {
    if (!moveFolderState.folderId || !moveFolderState.selectedFolderId) return;

    try {
      await moveFolderToFolder(
        moveFolderState.folderId,
        moveFolderState.selectedFolderId,
      );

      showNotification("Folder moved");
      setMoveFolderState({
        isOpen: false,
        folderId: null,
        folderName: "",
        currentParentId: null,
        currentParentPath: "/Workspace",
        selectedFolderId: "",
      });

      await loadWorkspace({ preserveFileId: currentFile?.id ?? null });
      scheduleAutoBackup();
    } catch (err) {
      showNotification(
        `Failed to move folder: ${(err as Error).message}`,
        "error",
      );
    }
  }, [
    currentFile?.id,
    loadWorkspace,
    moveFolderState,
    moveFolderToFolder,
    scheduleAutoBackup,
    showNotification,
  ]);

  const openImportPicker = useCallback(
    (targetFolderId: string = ROOT_FOLDER_ID) => {
      importTargetFolderIdRef.current = targetFolderId;
      const input = importFileInputRef.current;
      if (!input) return;
      input.value = "";
      input.click();
    },
    [],
  );

  const handleImportFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = parseAndValidateImport(text);
        const targetFolderId = importTargetFolderIdRef.current;
        const analysis = await analyzeImportConflicts(data, targetFolderId);

        if (analysis.conflictingPromptCount > 0) {
          setImportConflictState({
            isOpen: true,
            data,
            targetFolderId,
            analysis,
            isImporting: false,
          });
          return;
        }

        const result = await importExportTree(data, targetFolderId, "copy");
        await loadWorkspace({ preserveFileId: currentFile?.id ?? null });
        showNotification(buildImportSummary(result));
      } catch (err) {
        showNotification(
          err instanceof Error
            ? err.message
            : "Import failed: invalid export schema",
          "error",
        );
      } finally {
        event.target.value = "";
      }
    },
    [currentFile?.id, loadWorkspace, showNotification],
  );

  const closeImportConflictDialog = useCallback(() => {
    setImportConflictState({
      isOpen: false,
      data: null,
      targetFolderId: ROOT_FOLDER_ID,
      analysis: null,
      isImporting: false,
    });
  }, []);

  const resolveImportConflicts = useCallback(
    async (resolution: ImportConflictResolution) => {
      if (!importConflictState.data) return;

      setImportConflictState((prev) => ({ ...prev, isImporting: true }));

      try {
        const result = await importExportTree(
          importConflictState.data,
          importConflictState.targetFolderId,
          resolution,
        );
        closeImportConflictDialog();
        await loadWorkspace({ preserveFileId: currentFile?.id ?? null });
        showNotification(buildImportSummary(result));
      } catch (err) {
        setImportConflictState((prev) => ({ ...prev, isImporting: false }));
        showNotification(
          err instanceof Error ? err.message : "Import failed",
          "error",
        );
      }
    },
    [
      closeImportConflictDialog,
      currentFile?.id,
      importConflictState.data,
      importConflictState.targetFolderId,
      loadWorkspace,
      showNotification,
    ],
  );

  const handleExportWorkspace = useCallback(async () => {
    try {
      const data = await exportWorkspaceTree();
      downloadJsonFile(data, buildExportFilename("workspace"));
      showNotification("Workspace exported");
    } catch (err) {
      showNotification(
        `Failed to export workspace: ${(err as Error).message}`,
        "error",
      );
    }
  }, [showNotification]);

  const handleExportFolder = useCallback(
    async (folderId: string) => {
      try {
        const data = await exportFolderTree(folderId);
        downloadJsonFile(data, buildExportFilename("folder"));
        showNotification("Folder exported");
      } catch (err) {
        showNotification(
          `Failed to export folder: ${(err as Error).message}`,
          "error",
        );
      }
    },
    [showNotification],
  );

  const handleCopyTemplate = useCallback(
    async (fileId: string): Promise<boolean> => {
      const file = fileMap.get(fileId);
      const content = file?.content ?? file?.bodyContent ?? "";

      if (!content) {
        showNotification("No content to copy", "error");
        return false;
      }

      try {
        await navigator.clipboard.writeText(content);
        return true;
      } catch {
        showNotification("Failed to copy", "error");
        return false;
      }
    },
    [fileMap, showNotification],
  );

  const handleCloneTemplate = useCallback(
    async (fileId: string) => {
      try {
        const created = await clonePrompt(fileId);
        showNotification(`Cloned: ${created.name}`);
        await loadWorkspace({ preserveFileId: created.id });
        scheduleAutoBackup();
      } catch (err) {
        showNotification(
          `Failed to clone template: ${(err as Error).message}`,
          "error",
        );
      }
    },
    [loadWorkspace, scheduleAutoBackup, showNotification],
  );

  const handleExportTemplate = useCallback(
    async (fileId: string) => {
      try {
        const data = await exportTemplateTree(fileId);
        downloadJsonFile(data, buildExportFilename("template"));
        showNotification("Template exported");
      } catch (err) {
        showNotification(
          `Failed to export template: ${(err as Error).message}`,
          "error",
        );
      }
    },
    [showNotification],
  );

  const reusableTemplates: ReusableTemplateOption[] = Array.from(
    fileMap.values(),
  )
    .filter((file) => file.metadata?.reusable === true)
    .map((file) => ({
      id: file.id,
      name: file.name,
      content: file.content,
      path: file.path,
    }));

  const isAutoBackupSupported = isAutoBackupFolderSupported();
  const autoBackupStatus = !isAutoBackupSupported
    ? "Not supported"
    : autoBackupSettings.enabled
      ? autoBackupFolderName
        ? "On"
        : "On, folder not connected"
      : "Off";
  const autoBackupLastBackupText = autoBackupSettings.lastBackupAt
    ? new Date(autoBackupSettings.lastBackupAt).toLocaleString()
    : "Never";

  useEffect(() => {
    loadWorkspace({ restoreLastFile: true });
  }, [loadWorkspace]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editorState.isOpen) return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.code === "KeyK") {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
        return;
      }

      if (ctrl && e.code === "KeyO") {
        e.preventDefault();
        setIsQuickConvertOpen(true);
        return;
      }

      if (ctrl && e.code === "KeyN") {
        e.preventDefault();
        createNewFile();
        return;
      }

      if (ctrl && e.code === "KeyE" && currentFile) {
        e.preventDefault();
        openEditor(currentFile.id);
        return;
      }

      if (e.key === "Escape") {
        if (isPaletteOpen) {
          setIsPaletteOpen(false);
          return;
        }
        if (isDocsOpen) {
          setIsDocsOpen(false);
          return;
        }
        if (isTemplateOpen) {
          setIsTemplateOpen(false);
          return;
        }
      }

      if (e.altKey && e.code === "KeyR") {
        e.preventDefault();
        refreshFolder();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isPaletteOpen,
    isDocsOpen,
    isTemplateOpen,
    currentFile,
    editorState.isOpen,
    selectFolder,
    refreshFolder,
    createNewFile,
    openEditor,
  ]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        folderTree={folderTree}
        currentFile={currentFile}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectFolder={selectFolder}
        onRefresh={refreshFolder}
        onFileSelect={loadFile as never}
        onEditFile={openEditor as never}
        onOpenTemplate={(fileId) => {
          loadFile(fileId as never);
          setIsTemplateOpen(true);
        }}
        onMoveFile={openMovePromptDialog as never}
        onCreateFile={createNewFile}
        onCreateFolder={createNewFolder}
        onImportRoot={() => openImportPicker(ROOT_FOLDER_ID)}
        onExportRoot={handleExportWorkspace}
        onOpenAutoBackup={() => setIsAutoBackupOpen(true)}
        onEditTemplateStarter={openTemplateStarterEditor}
        onOpenQuickConvert={() => setIsQuickConvertOpen(true)}
        onRenameFolder={renameExistingFolder}
        onMoveFolder={openMoveFolderDialog}
        onImportFolder={(folderId) => openImportPicker(folderId)}
        onExportFolder={handleExportFolder}
        onDeleteFolder={deleteExistingFolder}
        onGetFolderDeleteSummary={getFolderDeleteSummary}
        onDeleteFile={deleteFile as never}
        onCopyFile={handleCopyTemplate as never}
        onCloneFile={handleCloneTemplate as never}
        onExportFile={handleExportTemplate as never}
        isLoading={isLoading}
        isOpen={mounted ? isSidebarOpen : false}
        animate={mounted}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        draggedItemType={dragState.type}
        draggedItemId={dragState.itemId}
        hoveredFolderId={dragState.hoveredFolderId}
        isHoveringRoot={dragState.isHoveringRoot}
        canDropToFolder={canDropToFolder}
        canDropToRoot={canDropToRoot()}
        onPromptDragStart={startPromptDrag}
        onFolderDragStart={startFolderDrag}
        onDragEnd={endDrag}
        onFolderDragEnter={handleFolderDragEnter}
        onFolderDragLeave={handleFolderDragLeave}
        onFolderDrop={handleFolderDrop}
        onRootDragEnter={handleRootDragEnter}
        onRootDragLeave={handleRootDragLeave}
        onRootDrop={handleRootDrop}
      />

      <MainContent
        currentFile={currentFile}
        currentParams={currentParams}
        isLoading={isLoading}
        onOpenDocs={() => setIsDocsOpen(true)}
        onOpenTemplate={() => setIsTemplateOpen(true)}
        onEditFile={() => currentFile && openEditor(currentFile.id)}
        onMoveFile={() => currentFile && openMovePromptDialog(currentFile.id)}
        onDeleteFile={() => currentFile && deleteFile(currentFile.id)}
        onCopyTemplate={() => currentFile ? handleCopyTemplate(currentFile.id) : false}
        onCloneTemplate={() => currentFile && handleCloneTemplate(currentFile.id)}
        onExportFile={() => currentFile && handleExportTemplate(currentFile.id)}
        onCreateFile={() => createNewFile(ROOT_FOLDER_ID)}
        showNotification={showNotification}
        onToggleSidebar={() => setIsSidebarOpen((value) => !value)}
        isSidebarOpen={mounted ? isSidebarOpen : false}
        onSetPreviewOpen={setIsPreviewOpen}
        isPreviewOpen={mounted ? isPreviewOpen : true}
      />
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        fileMap={fileMap}
        onFileSelect={(id) => {
          loadFile(id as never);
          setIsPaletteOpen(false);
        }}
      />

      <DocsModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} />

      <TemplateModal
        isOpen={isTemplateOpen}
        onClose={() => setIsTemplateOpen(false)}
        content={currentFile?.content ?? currentFile?.bodyContent ?? ""}
      />

      <QuickConvertModal
        isOpen={isQuickConvertOpen}
        onClose={() => setIsQuickConvertOpen(false)}
        showNotification={showNotification}
      />

      {editorState.isOpen && (
        <CodeEditor
          content={editorState.content}
          fileName={editorState.fileName}
          isNew={editorState.isNew}
          onSave={saveFile}
          onClose={closeEditor}
          onDelete={
            editorState.mode === "prompt" && !editorState.isNew
              ? () => editorState.fileId && deleteFile(editorState.fileId)
              : undefined
          }
          showNotification={showNotification}
          reusableTemplates={reusableTemplates}
          title={
            editorState.mode === "template-starter"
              ? "Template starter"
              : undefined
          }
          showNameInput={editorState.mode === "prompt"}
        />
      )}

      <MovePromptDialog
        isOpen={movePromptState.isOpen}
        promptName={movePromptState.promptName}
        currentFolderPath={movePromptState.currentFolderPath}
        folders={getAvailablePromptDestinationFolders(
          folderTree ? flattenFolders(folderTree) : [],
          movePromptState.currentFolderId,
        )}
        selectedFolderId={movePromptState.selectedFolderId}
        onSelectedFolderIdChange={(value) =>
          setMovePromptState((prev) => ({ ...prev, selectedFolderId: value }))
        }
        onClose={() =>
          setMovePromptState({
            isOpen: false,
            promptId: null,
            promptName: "",
            currentFolderId: null,
            currentFolderPath: "/Workspace",
            selectedFolderId: "",
          })
        }
        onConfirm={confirmMovePrompt}
      />

      <MoveFolderDialog
        isOpen={moveFolderState.isOpen}
        folderName={moveFolderState.folderName}
        currentParentPath={moveFolderState.currentParentPath}
        folders={
          folderTree
            ? getAvailableFolderDestinationFolders(
                flattenFolders(folderTree),
                allFolders,
                moveFolderState.folderId,
              )
            : []
        }
        selectedFolderId={moveFolderState.selectedFolderId}
        onSelectedFolderIdChange={(value) =>
          setMoveFolderState((prev) => ({ ...prev, selectedFolderId: value }))
        }
        onClose={() =>
          setMoveFolderState({
            isOpen: false,
            folderId: null,
            folderName: "",
            currentParentId: null,
            currentParentPath: "/Workspace",
            selectedFolderId: "",
          })
        }
        onConfirm={confirmMoveFolder}
      />

      <Dialog open={isAutoBackupOpen} onOpenChange={setIsAutoBackupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Auto backup</DialogTitle>
            <DialogDescription>
              Save full workspace backup JSON files to a folder you choose.
              Automatic backups run after saved changes, with a 5-minute
              cooldown, and old backup files are rotated.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
              <div className="space-y-1">
                <Label htmlFor="auto-backup-enabled">Enable auto backup</Label>
                <p className="text-xs text-muted-foreground">
                  Status: {autoBackupStatus}
                </p>
              </div>
              <Switch
                id="auto-backup-enabled"
                checked={autoBackupSettings.enabled}
                disabled={!isAutoBackupSupported || isAutoBackupSaving}
                onCheckedChange={(checked) => {
                  void setAutoBackupEnabled(checked);
                }}
              />
            </div>

            {!isAutoBackupSupported && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                This browser does not support choosing a custom backup folder.
                Use Chrome or Edge for folder-based auto backup.
              </div>
            )}

            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Backup folder</span>
                <span className="truncate text-right">
                  {autoBackupFolderName ?? "Not connected"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Last backup</span>
                <span className="text-right">{autoBackupLastBackupText}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Cooldown</span>
                <span className="text-right">
                  {autoBackupSettings.cooldownMinutes} minutes
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auto-backup-max-backups">Maximum backups</Label>
              <Input
                id="auto-backup-max-backups"
                type="number"
                min={1}
                value={autoBackupMaxBackupsInput}
                onChange={(event) =>
                  setAutoBackupMaxBackupsInput(event.target.value)
                }
                onBlur={() => {
                  void saveAutoBackupMaxBackups();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                disabled={isAutoBackupSaving}
              />
              <p className="text-xs text-muted-foreground">
                Only files named prompt-forge-backup-*.json are rotated. Other
                files in the folder are left untouched.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => void connectAutoBackupFolder()}
              disabled={!isAutoBackupSupported || isAutoBackupSaving}
            >
              Choose folder
            </Button>
            <Button
              variant="outline"
              onClick={() => void runAutoBackup({ manual: true })}
              disabled={!isAutoBackupSupported || isAutoBackupSaving}
            >
              {isAutoBackupSaving ? "Saving..." : "Backup now"}
            </Button>
            <Button onClick={() => setIsAutoBackupOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importConflictState.isOpen}
        onOpenChange={(open) => !open && closeImportConflictDialog()}
      >
        <DialogContent showCloseButton={!importConflictState.isImporting}>
          <DialogHeader>
            <DialogTitle>Import conflicts found</DialogTitle>
            <DialogDescription>
              {importConflictState.analysis ? (
                <>
                  {importConflictState.analysis.conflictingPromptCount} template
                  {importConflictState.analysis.conflictingPromptCount === 1
                    ? ""
                    : "s"} with the same name already exist in the target
                  folder. Folders with the same name will be merged. Identical
                  templates will be skipped.
                </>
              ) : (
                "Some imported templates already exist in the target folder."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeImportConflictDialog}
              disabled={importConflictState.isImporting}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => void resolveImportConflicts("copy")}
              disabled={importConflictState.isImporting}
            >
              Create copies
            </Button>
            <Button
              onClick={() => void resolveImportConflicts("replace")}
              disabled={importConflictState.isImporting}
            >
              Replace conflicts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={importFileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFileSelected}
      />

      <Toaster position="bottom-right" />
    </div>
  );
}
