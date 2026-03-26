"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import type {
  FileNode,
  FolderNode,
  ParsedFile,
} from "@/lib/prompt-forge/types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Code,
  FileText,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "./theme-toggle";

interface SidebarProps {
  folderTree: FolderNode | null;
  currentFile: ParsedFile | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectFolder: () => void;
  onRefresh: () => void;
  onFileSelect: (fileId: string) => void;
  onEditFile: (fileId: string) => void;
  onOpenTemplate: (fileId: string) => void;
  onMoveFile: (fileId: string) => void;
  onMoveFolder: (folderId: string) => void;
  onCreateFile: (folderId?: string) => void;
  onCreateFolder: (
    name: string,
    parentId?: string | null,
  ) => void | Promise<void>;
  onRenameFolder: (folderId: string, name: string) => void | Promise<void>;
  onDeleteFolder: (folderId: string) => void | Promise<void>;
  onGetFolderDeleteSummary: (folderId: string) => Promise<{
    folderName: string;
    subfolderCount: number;
    promptCount: number;
  }>;
  onDeleteFile: (fileId: string) => void;
  isLoading: boolean;
  isOpen: boolean;
  onToggle: () => void;

  draggedItemType: "prompt" | "folder" | null;
  draggedItemId: string | null;
  hoveredFolderId: string | null;
  isHoveringRoot: boolean;
  canDropToFolder: (folderId: string) => boolean;
  canDropToRoot: boolean;
  onPromptDragStart: (fileId: string) => void;
  onFolderDragStart: (folderId: string) => void;
  onDragEnd: () => void;
  onFolderDragEnter: (folderId: string) => void;
  onFolderDragLeave: (folderId: string) => void;
  onFolderDrop: (folderId: string) => void | Promise<void>;
  onRootDragEnter: () => void;
  onRootDragLeave: () => void;
  onRootDrop: () => void | Promise<void>;
}

export function Sidebar({
  folderTree,
  currentFile,
  searchQuery,
  onSearchChange,
  onRefresh,
  onFileSelect,
  onEditFile,
  onOpenTemplate,
  onMoveFile,
  onMoveFolder,
  onCreateFile,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onGetFolderDeleteSummary,
  onDeleteFile,
  isLoading,
  isOpen,
  onToggle,
  draggedItemType,
  draggedItemId,
  hoveredFolderId,
  isHoveringRoot,
  canDropToFolder,
  canDropToRoot,
  onPromptDragStart,
  onFolderDragStart,
  onDragEnd,
  onFolderDragEnter,
  onFolderDragLeave,
  onFolderDrop,
  onRootDragEnter,
  onRootDragLeave,
  onRootDrop,
}: SidebarProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [creatingFolderParentId, setCreatingFolderParentId] = useState<
    string | null
  >(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());
  const [folderDeleteState, setFolderDeleteState] = useState<{
    isOpen: boolean;
    folderId: string | null;
    folderName: string;
    subfolderCount: number;
    promptCount: number;
    isLoading: boolean;
  }>({
    isOpen: false,
    folderId: null,
    folderName: "",
    subfolderCount: 0,
    promptCount: 0,
    isLoading: false,
  });

  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const creatingFolderSubmitRef = useRef(false);
  const ignoreCreateBlurRef = useRef(false);
  const suppressMenuRestoreFocusRef = useRef(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (creatingFolderParentId === null) return;

    ignoreCreateBlurRef.current = true;

    requestAnimationFrame(() => {
      newFolderInputRef.current?.focus();

      setTimeout(() => {
        ignoreCreateBlurRef.current = false;
      }, 0);
    });
  }, [creatingFolderParentId]);

  if (!isOpen) return null;

  const handleFileSelect = (fileId: string) => {
    onFileSelect(fileId);
    if (isMobile) onToggle();
  };

  const toggleFolder = (folderId: string) => {
    setOpenFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const ensureFolderOpen = (folderId: string) => {
    setOpenFolderIds((prev) => {
      if (prev.has(folderId)) return prev;
      const next = new Set(prev);
      next.add(folderId);
      return next;
    });
  };

  const startCreatingRootFolder = () => {
    setCreatingFolderParentId("root");
    setNewFolderName("");
  };

  const startCreatingFolderInFolder = (folderId: string) => {
    ensureFolderOpen(folderId);
    setCreatingFolderParentId(folderId);
    setNewFolderName("");
  };

  const cancelCreatingFolder = () => {
    setCreatingFolderParentId(null);
    setNewFolderName("");
  };

  const submitCreatingFolder = async () => {
    if (creatingFolderSubmitRef.current) return;

    const trimmed = newFolderName.trim();
    const parentId = creatingFolderParentId;

    if (!trimmed) {
      cancelCreatingFolder();
      return;
    }

    creatingFolderSubmitRef.current = true;
    setCreatingFolderParentId(null);
    setNewFolderName("");

    try {
      await onCreateFolder(trimmed, parentId === "root" ? undefined : parentId);
    } finally {
      creatingFolderSubmitRef.current = false;
    }
  };

  const resetFolderDeleteState = () => {
    setFolderDeleteState({
      isOpen: false,
      folderId: null,
      folderName: "",
      subfolderCount: 0,
      promptCount: 0,
      isLoading: false,
    });
  };

  const openDeleteFolderConfirm = async (folderId: string) => {
    setFolderDeleteState({
      isOpen: true,
      folderId,
      folderName: "",
      subfolderCount: 0,
      promptCount: 0,
      isLoading: true,
    });

    try {
      const summary = await onGetFolderDeleteSummary(folderId);
      setFolderDeleteState({
        isOpen: true,
        folderId,
        folderName: summary.folderName,
        subfolderCount: summary.subfolderCount,
        promptCount: summary.promptCount,
        isLoading: false,
      });
    } catch {
      resetFolderDeleteState();
    }
  };

  const confirmDeleteFolder = async () => {
    if (!folderDeleteState.folderId) return;
    await onDeleteFolder(folderDeleteState.folderId);
    resetFolderDeleteState();
  };

  const deleteDescription = folderDeleteState.isLoading
    ? "Loading folder details..."
    : (() => {
        const parts: string[] = [];

        if (folderDeleteState.subfolderCount > 0) {
          parts.push(
            `${folderDeleteState.subfolderCount} subfolder${
              folderDeleteState.subfolderCount === 1 ? "" : "s"
            }`,
          );
        }

        if (folderDeleteState.promptCount > 0) {
          parts.push(
            `${folderDeleteState.promptCount} template${
              folderDeleteState.promptCount === 1 ? "" : "s"
            }`,
          );
        }

        const details =
          parts.length > 0 ? `, including ${parts.join(" and ")}` : "";

        return `This will permanently delete “${folderDeleteState.folderName}”${details}. This action cannot be undone.`;
      })();

  const sidebarContent = (
    <aside
      className={cn(
        "bg-card flex h-full shrink-0 flex-col",
        isMobile
          ? "fixed inset-y-0 left-0 z-50 w-80 border-r border-border shadow-xl"
          : "w-80 border-r border-border",
      )}
    >
      <div className="border-b border-border p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">
            Prompt Forge
          </h1>
          <div className="flex items-center gap-1">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            )}

            <ThemeToggle />

            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-8 w-8"
              title="Refresh (Alt+R)"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="border-border bg-background pl-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCreateFile()}
              className="justify-start"
            >
              <Plus className="mr-2 h-4 w-4" />
              Template
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={startCreatingRootFolder}
              className="justify-start"
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              Folder
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading && !folderTree ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Spinner className="mb-2 h-6 w-6" />
            <p className="text-sm">Loading prompts...</p>
          </div>
        ) : folderTree ? (
          <div className="p-2">
            <div
              className={cn(
                "mb-1 min-h-[calc(100vh-180px)] rounded-md transition-colors",
                draggedItemId && canDropToRoot && isHoveringRoot
                  ? "bg-accent ring-1 ring-primary"
                  : "",
              )}
              onDragOver={(e) => {
                if (!canDropToRoot || hoveredFolderId) return;
                e.preventDefault();
              }}
              onDragEnter={(e) => {
                if (!canDropToRoot || hoveredFolderId) return;
                e.preventDefault();
                onRootDragEnter();
              }}
              onDragLeave={(e) => {
                if (hoveredFolderId) return;

                const related = e.relatedTarget as Node | null;
                if (related && e.currentTarget.contains(related)) return;
                onRootDragLeave();
              }}
              onDrop={(e) => {
                if (!canDropToRoot || hoveredFolderId) return;
                e.preventDefault();
                void onRootDrop();
              }}
            >
              {creatingFolderParentId === "root" && (
                <div className="mb-1">
                  <div className="flex w-full items-center gap-2 rounded-md px-2 py-1.25 text-sm text-foreground">
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Input
                      ref={newFolderInputRef}
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void submitCreatingFolder();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelCreatingFolder();
                        }
                      }}
                      onBlur={() => {
                        if (ignoreCreateBlurRef.current) return;
                        void submitCreatingFolder();
                      }}
                      placeholder="Folder name"
                      className="h-6 flex-1 border border-border bg-background px-2 text-sm shadow-none focus-visible:ring-1"
                    />
                  </div>
                </div>
              )}

              <FolderContents
                nodes={folderTree.children}
                currentFile={currentFile}
                searchQuery={searchQuery}
                onFileSelect={handleFileSelect}
                onEditFile={onEditFile}
                onOpenTemplate={onOpenTemplate}
                onMoveFile={onMoveFile}
                onDeleteFile={onDeleteFile}
                onCreateFile={onCreateFile}
                onDeleteFolder={onDeleteFolder}
                onMoveFolder={onMoveFolder}
                onOpenDeleteFolderConfirm={openDeleteFolderConfirm}
                creatingFolderParentId={creatingFolderParentId}
                newFolderName={newFolderName}
                newFolderInputRef={newFolderInputRef}
                onNewFolderNameChange={setNewFolderName}
                onStartFolderCreate={startCreatingFolderInFolder}
                onCancelFolderCreate={cancelCreatingFolder}
                onSubmitFolderCreate={submitCreatingFolder}
                editingFolderId={editingFolderId}
                editingFolderName={editingFolderName}
                onEditingFolderNameChange={setEditingFolderName}
                onStartFolderRename={(folderId, name) => {
                  ensureFolderOpen(folderId);
                  setEditingFolderId(folderId);
                  setEditingFolderName(name);
                }}
                onCancelFolderRename={() => {
                  setEditingFolderId(null);
                  setEditingFolderName("");
                }}
                onSubmitFolderRename={async () => {
                  if (!editingFolderId) return;

                  const trimmed = editingFolderName.trim();
                  if (!trimmed) {
                    setEditingFolderId(null);
                    setEditingFolderName("");
                    return;
                  }

                  await onRenameFolder(editingFolderId, trimmed);
                  setEditingFolderId(null);
                  setEditingFolderName("");
                }}
                openFolderIds={openFolderIds}
                onToggleFolder={toggleFolder}
                ignoreCreateBlurRef={ignoreCreateBlurRef}
                suppressMenuRestoreFocusRef={suppressMenuRestoreFocusRef}
                level={0}
                draggedItemType={draggedItemType}
                draggedItemId={draggedItemId}
                hoveredFolderId={hoveredFolderId}
                canDropToFolder={canDropToFolder}
                onPromptDragStart={onPromptDragStart}
                onFolderDragStart={onFolderDragStart}
                onDragEnd={onDragEnd}
                onFolderDragEnter={onFolderDragEnter}
                onFolderDragLeave={onFolderDragLeave}
                onFolderDrop={onFolderDrop}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <Folder className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="mb-1 text-sm text-muted-foreground">No prompts yet</p>
            <p className="text-xs text-muted-foreground">
              Create a new template or folder to get started
            </p>
          </div>
        )}
      </ScrollArea>

      <Dialog
        open={folderDeleteState.isOpen}
        onOpenChange={(open) => !open && resetFolderDeleteState()}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete folder and all contents?
            </DialogTitle>
            <DialogDescription>{deleteDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={resetFolderDeleteState}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDeleteFolder()}
              disabled={folderDeleteState.isLoading}
            >
              Delete folder and contents
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );

  if (isMobile) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/50" onClick={onToggle} />
        {sidebarContent}
      </>
    );
  }

  return sidebarContent;
}

interface FolderContentsProps {
  nodes: (FileNode | FolderNode)[];
  currentFile: ParsedFile | null;
  searchQuery: string;
  onFileSelect: (fileId: string) => void;
  onEditFile: (fileId: string) => void;
  onOpenTemplate: (fileId: string) => void;
  onMoveFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onCreateFile: (folderId?: string) => void;
  onDeleteFolder: (folderId: string) => void | Promise<void>;
  onMoveFolder: (folderId: string) => void;
  onOpenDeleteFolderConfirm: (folderId: string) => void | Promise<void>;
  creatingFolderParentId: string | null;
  newFolderName: string;
  newFolderInputRef: React.RefObject<HTMLInputElement | null>;
  onNewFolderNameChange: (value: string) => void;
  onStartFolderCreate: (folderId: string) => void;
  onCancelFolderCreate: () => void;
  onSubmitFolderCreate: () => void | Promise<void>;
  editingFolderId: string | null;
  editingFolderName: string;
  onEditingFolderNameChange: (value: string) => void;
  onStartFolderRename: (folderId: string, name: string) => void;
  onCancelFolderRename: () => void;
  onSubmitFolderRename: () => void | Promise<void>;
  openFolderIds: Set<string>;
  onToggleFolder: (folderId: string) => void;
  ignoreCreateBlurRef: React.RefObject<boolean>;
  suppressMenuRestoreFocusRef: React.RefObject<boolean>;
  level?: number;

  draggedItemType: "prompt" | "folder" | null;
  draggedItemId: string | null;
  hoveredFolderId: string | null;
  canDropToFolder: (folderId: string) => boolean;
  onPromptDragStart: (fileId: string) => void;
  onFolderDragStart: (folderId: string) => void;
  onDragEnd: () => void;
  onFolderDragEnter: (folderId: string) => void;
  onFolderDragLeave: (folderId: string) => void;
  onFolderDrop: (folderId: string) => void | Promise<void>;
}

function FolderContents({
  nodes,
  currentFile,
  searchQuery,
  onFileSelect,
  onEditFile,
  onOpenTemplate,
  onMoveFile,
  onDeleteFile,
  onCreateFile,
  onDeleteFolder,
  onMoveFolder,
  onOpenDeleteFolderConfirm,
  creatingFolderParentId,
  newFolderName,
  newFolderInputRef,
  onNewFolderNameChange,
  onStartFolderCreate,
  onCancelFolderCreate,
  onSubmitFolderCreate,
  editingFolderId,
  editingFolderName,
  onEditingFolderNameChange,
  onStartFolderRename,
  onCancelFolderRename,
  onSubmitFolderRename,
  openFolderIds,
  onToggleFolder,
  ignoreCreateBlurRef,
  suppressMenuRestoreFocusRef,
  level = 0,
  draggedItemType,
  draggedItemId,
  hoveredFolderId,
  canDropToFolder,
  onPromptDragStart,
  onFolderDragStart,
  onDragEnd,
  onFolderDragEnter,
  onFolderDragLeave,
  onFolderDrop,
}: FolderContentsProps) {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) =>
        node.type === "directory" ? (
          <FolderItem
            key={`folder-${node.id}`}
            folder={node}
            currentFile={currentFile}
            searchQuery={searchQuery}
            onFileSelect={onFileSelect}
            onEditFile={onEditFile}
            onOpenTemplate={onOpenTemplate}
            onMoveFile={onMoveFile}
            onDeleteFile={onDeleteFile}
            onCreateFile={onCreateFile}
            onDeleteFolder={onDeleteFolder}
            onMoveFolder={onMoveFolder}
            onOpenDeleteFolderConfirm={onOpenDeleteFolderConfirm}
            creatingFolderParentId={creatingFolderParentId}
            newFolderName={newFolderName}
            newFolderInputRef={newFolderInputRef}
            onNewFolderNameChange={onNewFolderNameChange}
            onStartFolderCreate={onStartFolderCreate}
            onCancelFolderCreate={onCancelFolderCreate}
            onSubmitFolderCreate={onSubmitFolderCreate}
            editingFolderId={editingFolderId}
            editingFolderName={editingFolderName}
            onEditingFolderNameChange={onEditingFolderNameChange}
            onStartFolderRename={onStartFolderRename}
            onCancelFolderRename={onCancelFolderRename}
            onSubmitFolderRename={onSubmitFolderRename}
            openFolderIds={openFolderIds}
            onToggleFolder={onToggleFolder}
            ignoreCreateBlurRef={ignoreCreateBlurRef}
            suppressMenuRestoreFocusRef={suppressMenuRestoreFocusRef}
            level={level}
            draggedItemType={draggedItemType}
            draggedItemId={draggedItemId}
            hoveredFolderId={hoveredFolderId}
            canDropToFolder={canDropToFolder}
            onPromptDragStart={onPromptDragStart}
            onFolderDragStart={onFolderDragStart}
            onDragEnd={onDragEnd}
            onFolderDragEnter={onFolderDragEnter}
            onFolderDragLeave={onFolderDragLeave}
            onFolderDrop={onFolderDrop}
          />
        ) : (
          <FileItem
            key={`file-${node.id}`}
            file={node}
            isActive={currentFile?.id === node.id}
            searchQuery={searchQuery}
            onSelect={() => onFileSelect(node.id)}
            onEdit={() => onEditFile(node.id)}
            onOpenTemplate={() => onOpenTemplate(node.id)}
            onMove={() => onMoveFile(node.id)}
            onDelete={() => onDeleteFile(node.id)}
            level={level}
            isDragging={
              draggedItemType === "prompt" && draggedItemId === node.id
            }
            onDragStart={() => onPromptDragStart(node.id)}
            onDragEnd={onDragEnd}
          />
        ),
      )}
    </div>
  );
}

interface FolderItemProps {
  folder: FolderNode;
  currentFile: ParsedFile | null;
  searchQuery: string;
  onFileSelect: (fileId: string) => void;
  onEditFile: (fileId: string) => void;
  onOpenTemplate: (fileId: string) => void;
  onMoveFile: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onCreateFile: (folderId?: string) => void;
  onDeleteFolder: (folderId: string) => void | Promise<void>;
  onMoveFolder: (folderId: string) => void;
  onOpenDeleteFolderConfirm: (folderId: string) => void | Promise<void>;
  creatingFolderParentId: string | null;
  newFolderName: string;
  newFolderInputRef: React.RefObject<HTMLInputElement | null>;
  onNewFolderNameChange: (value: string) => void;
  onStartFolderCreate: (folderId: string) => void;
  onCancelFolderCreate: () => void;
  onSubmitFolderCreate: () => void | Promise<void>;
  editingFolderId: string | null;
  editingFolderName: string;
  onEditingFolderNameChange: (value: string) => void;
  onStartFolderRename: (folderId: string, name: string) => void;
  onCancelFolderRename: () => void;
  onSubmitFolderRename: () => void | Promise<void>;
  openFolderIds: Set<string>;
  onToggleFolder: (folderId: string) => void;
  ignoreCreateBlurRef: React.RefObject<boolean>;
  suppressMenuRestoreFocusRef: React.RefObject<boolean>;
  level: number;

  draggedItemType: "prompt" | "folder" | null;
  draggedItemId: string | null;
  hoveredFolderId: string | null;
  canDropToFolder: (folderId: string) => boolean;
  onPromptDragStart: (fileId: string) => void;
  onFolderDragStart: (folderId: string) => void;
  onDragEnd: () => void;
  onFolderDragEnter: (folderId: string) => void;
  onFolderDragLeave: (folderId: string) => void;
  onFolderDrop: (folderId: string) => void | Promise<void>;
}

function FolderItem({
  folder,
  currentFile,
  searchQuery,
  onFileSelect,
  onEditFile,
  onOpenTemplate,
  onMoveFile,
  onDeleteFile,
  onCreateFile,
  onDeleteFolder,
  onMoveFolder,
  onOpenDeleteFolderConfirm,
  creatingFolderParentId,
  newFolderName,
  newFolderInputRef,
  onNewFolderNameChange,
  onStartFolderCreate,
  onCancelFolderCreate,
  onSubmitFolderCreate,
  editingFolderId,
  editingFolderName,
  onEditingFolderNameChange,
  onStartFolderRename,
  onCancelFolderRename,
  onSubmitFolderRename,
  openFolderIds,
  onToggleFolder,
  ignoreCreateBlurRef,
  suppressMenuRestoreFocusRef,
  level,
  draggedItemType,
  draggedItemId,
  hoveredFolderId,
  canDropToFolder,
  onPromptDragStart,
  onFolderDragStart,
  onDragEnd,
  onFolderDragEnter,
  onFolderDragLeave,
  onFolderDrop,
}: FolderItemProps) {
  const renameInputRef = useRef<HTMLInputElement>(null);

  const hasMatchingFiles = searchQuery
    ? folderHasMatchingFiles(folder, searchQuery)
    : true;

  if (searchQuery && !hasMatchingFiles) return null;

  const shouldAutoExpand = !!searchQuery && hasMatchingFiles;
  const isOpen = openFolderIds.has(folder.id) || shouldAutoExpand;
  const isEditing = editingFolderId === folder.id;
  const isCreatingChildFolder = creatingFolderParentId === folder.id;
  const isDropAllowed = canDropToFolder(folder.id);
  const isDropHovered =
    !!draggedItemId && hoveredFolderId === folder.id && isDropAllowed;
  const isDraggingFolder =
    draggedItemType === "folder" && draggedItemId === folder.id;

  useEffect(() => {
    if (!isEditing) return;
    requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      const input = renameInputRef.current;
      if (input) {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  }, [isEditing]);

  return (
    <div
      draggable={!isEditing}
      onDragStart={(e) => {
        if (isEditing) {
          e.preventDefault();
          return;
        }

        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", folder.id);
        onFolderDragStart(folder.id);
      }}
      onDragEnd={(e) => {
        e.stopPropagation();
        onDragEnd();
      }}
      className={cn(
        isDropHovered ? "rounded-md bg-accent ring-1 ring-primary" : "",
        isDraggingFolder ? "opacity-50" : "",
      )}
      onDragOver={(e) => {
        if (!isDropAllowed) return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragEnter={(e) => {
        if (!isDropAllowed) return;
        e.preventDefault();
        e.stopPropagation();
        onFolderDragEnter(folder.id);
      }}
      onDragLeave={(e) => {
        if (!isDropAllowed) return;
        e.stopPropagation();

        const related = e.relatedTarget as Node | null;
        if (related && e.currentTarget.contains(related)) return;

        onFolderDragLeave(folder.id);
      }}
      onDrop={(e) => {
        if (!isDropAllowed) return;
        e.preventDefault();
        e.stopPropagation();
        void onFolderDrop(folder.id);
      }}
    >
      {isEditing ? (
        <div
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.25 text-sm text-foreground"
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={renameInputRef}
            value={editingFolderName}
            onChange={(e) => onEditingFolderNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onSubmitFolderRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancelFolderRename();
              }
            }}
            onBlur={() => {
              void onSubmitFolderRename();
            }}
            placeholder="Folder name"
            className="h-6 flex-1 border border-border bg-background px-2 text-sm shadow-none focus-visible:ring-1"
          />
        </div>
      ) : (
        <div
          className={cn(
            "group flex w-full items-center gap-1 rounded-md pr-2 text-sm transition-colors",
            "text-foreground hover:bg-accent",
          )}
        >
          <button
            onClick={() => onToggleFolder(folder.id)}
            className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            style={{ paddingLeft: `${level * 12 + 8}px` }}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{folder.name}</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-60 hover:bg-accent hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44"
              onCloseAutoFocus={(e) => {
                if (suppressMenuRestoreFocusRef.current) {
                  e.preventDefault();
                  suppressMenuRestoreFocusRef.current = false;
                }
              }}
            >
              <DropdownMenuItem onClick={() => onCreateFile(folder.id)}>
                <Plus className="mr-2 h-4 w-4" />
                New Template
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  suppressMenuRestoreFocusRef.current = true;
                  setTimeout(() => {
                    onStartFolderCreate(folder.id);
                  }, 0);
                }}
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                New Folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onStartFolderRename(folder.id, folder.name)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMoveFolder(folder.id)}>
                <Folder className="mr-2 h-4 w-4" />
                Move to…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onOpenDeleteFolderConfirm(folder.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {isOpen && !isEditing && (
        <>
          {isCreatingChildFolder && (
            <div className="mb-1">
              <div
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.25 text-sm text-foreground"
                style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
              >
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  ref={newFolderInputRef}
                  value={newFolderName}
                  onChange={(e) => onNewFolderNameChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void onSubmitFolderCreate();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      onCancelFolderCreate();
                    }
                  }}
                  onBlur={() => {
                    if (ignoreCreateBlurRef.current) return;
                    void onSubmitFolderCreate();
                  }}
                  placeholder="Folder name"
                  className="h-6 flex-1 border border-border bg-background px-2 text-sm shadow-none focus-visible:ring-1"
                />
              </div>
            </div>
          )}

          <FolderContents
            nodes={folder.children}
            currentFile={currentFile}
            searchQuery={searchQuery}
            onFileSelect={onFileSelect}
            onEditFile={onEditFile}
            onOpenTemplate={onOpenTemplate}
            onMoveFile={onMoveFile}
            onDeleteFile={onDeleteFile}
            onCreateFile={onCreateFile}
            onDeleteFolder={onDeleteFolder}
            onMoveFolder={onMoveFolder}
            onOpenDeleteFolderConfirm={onOpenDeleteFolderConfirm}
            creatingFolderParentId={creatingFolderParentId}
            newFolderName={newFolderName}
            newFolderInputRef={newFolderInputRef}
            onNewFolderNameChange={onNewFolderNameChange}
            onStartFolderCreate={onStartFolderCreate}
            onCancelFolderCreate={onCancelFolderCreate}
            onSubmitFolderCreate={onSubmitFolderCreate}
            editingFolderId={editingFolderId}
            editingFolderName={editingFolderName}
            onEditingFolderNameChange={onEditingFolderNameChange}
            onStartFolderRename={onStartFolderRename}
            onCancelFolderRename={onCancelFolderRename}
            onSubmitFolderRename={onSubmitFolderRename}
            openFolderIds={openFolderIds}
            onToggleFolder={onToggleFolder}
            ignoreCreateBlurRef={ignoreCreateBlurRef}
            suppressMenuRestoreFocusRef={suppressMenuRestoreFocusRef}
            level={level + 1}
            draggedItemType={draggedItemType}
            draggedItemId={draggedItemId}
            hoveredFolderId={hoveredFolderId}
            canDropToFolder={canDropToFolder}
            onPromptDragStart={onPromptDragStart}
            onFolderDragStart={onFolderDragStart}
            onDragEnd={onDragEnd}
            onFolderDragEnter={onFolderDragEnter}
            onFolderDragLeave={onFolderDragLeave}
            onFolderDrop={onFolderDrop}
          />
        </>
      )}
    </div>
  );
}

interface FileItemProps {
  file: FileNode;
  isActive: boolean;
  searchQuery: string;
  onSelect: () => void;
  onEdit: () => void;
  onOpenTemplate: () => void;
  onMove: () => void;
  onDelete: () => void;
  level: number;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function FileItem({
  file,
  isActive,
  searchQuery,
  onSelect,
  onEdit,
  onOpenTemplate,
  onMove,
  onDelete,
  level,
  isDragging,
  onDragStart,
  onDragEnd,
}: FileItemProps) {
  const isVisible = searchQuery
    ? file.name.toLowerCase().includes(searchQuery.toLowerCase())
    : true;

  if (!isVisible) return null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", file.id);
        onDragStart();
      }}
      onDragEnd={(e) => {
        e.stopPropagation();
        onDragEnd();
      }}
      className={cn(
        "group flex w-full items-center gap-1 rounded-md pr-2 text-sm transition-colors",
        isDragging ? "opacity-50" : "",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-accent",
      )}
      style={{ paddingLeft: `${level * 12 + 28}px` }}
    >
      <button
        onClick={onSelect}
        className="flex flex-1 items-center gap-2 py-1.5 pr-1 focus-visible:outline-none"
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate">{file.name}</span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 shrink-0 opacity-60 hover:opacity-100",
              isActive ? "hover:bg-primary-foreground/20" : "hover:bg-accent",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenTemplate}>
            <Code className="mr-2 h-4 w-4" />
            Template
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onMove}>
            <Folder className="mr-2 h-4 w-4" />
            Move to…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function folderHasMatchingFiles(folder: FolderNode, query: string): boolean {
  return folder.children.some((node) => {
    if (node.type === "file") {
      return node.name.toLowerCase().includes(query.toLowerCase());
    }
    return folderHasMatchingFiles(node, query);
  });
}
