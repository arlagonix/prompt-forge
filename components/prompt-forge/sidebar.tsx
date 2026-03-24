"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  FolderOpen,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  X,
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
} from "lucide-react"
import type { FileNode, FolderNode, ParsedFile } from "@/lib/prompt-forge/types"

interface SidebarProps {
  folderTree: FolderNode | null
  currentFile: ParsedFile | null
  searchQuery: string
  onSearchChange: (query: string) => void
  onSelectFolder: () => void
  onRefresh: () => void
  onFileSelect: (fileId: number) => void
  onEditFile: (fileId: number) => void
  onCreateFile: () => void
  onDeleteFile: (fileId: number) => void
  isLoading: boolean
  isOpen: boolean
  onToggle: () => void
}

export function Sidebar({
  folderTree,
  currentFile,
  searchQuery,
  onSearchChange,
  onSelectFolder,
  onRefresh,
  onFileSelect,
  onEditFile,
  onCreateFile,
  onDeleteFile,
  isLoading,
  isOpen,
  onToggle,
}: SidebarProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  if (!isOpen) return null

  const handleFileSelect = (fileId: number) => {
    onFileSelect(fileId)
    if (isMobile) onToggle()
  }

  const sidebarContent = (
    <aside className={cn(
      "bg-card flex flex-col h-full shrink-0",
      isMobile 
        ? "fixed inset-y-0 left-0 z-50 w-80 border-r border-border shadow-xl" 
        : "w-80 border-r border-border"
    )}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-foreground">Prompt Forge</h1>
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
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={!folderTree || isLoading}
              className="h-8 w-8"
              title="Refresh (Alt+R)"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onSelectFolder}
              className="h-8 w-8"
              title="Choose Folder (Ctrl+O)"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {folderTree && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 bg-background border-border"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateFile}
              className="w-full justify-start"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        {isLoading && !folderTree ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Spinner className="h-6 w-6 mb-2" />
            <p className="text-sm">Loading templates...</p>
          </div>
        ) : folderTree ? (
          <div className="p-2">
            <FolderContents
              nodes={folderTree.children}
              currentFile={currentFile}
              searchQuery={searchQuery}
              onFileSelect={handleFileSelect}
              onEditFile={onEditFile}
              onDeleteFile={onDeleteFile}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No folder selected</p>
            <p className="text-xs text-muted-foreground">
              Press{" "}
              <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs font-mono">Ctrl+O</kbd>{" "}
              to open
            </p>
          </div>
        )}
      </ScrollArea>
    </aside>
  )

  if (isMobile) {
    return (
      <>
        <div 
          className="fixed inset-0 z-40 bg-black/50"
          onClick={onToggle}
        />
        {sidebarContent}
      </>
    )
  }

  return sidebarContent
}

interface FolderContentsProps {
  nodes: (FileNode | FolderNode)[]
  currentFile: ParsedFile | null
  searchQuery: string
  onFileSelect: (fileId: number) => void
  onEditFile: (fileId: number) => void
  onDeleteFile: (fileId: number) => void
  level?: number
}

function FolderContents({
  nodes,
  currentFile,
  searchQuery,
  onFileSelect,
  onEditFile,
  onDeleteFile,
  level = 0,
}: FolderContentsProps) {
  return (
    <div className="space-y-0.5">
      {nodes.map((node, index) =>
        node.type === "directory" ? (
          <FolderItem
            key={`folder-${index}-${node.name}`}
            folder={node as FolderNode}
            currentFile={currentFile}
            searchQuery={searchQuery}
            onFileSelect={onFileSelect}
            onEditFile={onEditFile}
            onDeleteFile={onDeleteFile}
            level={level}
          />
        ) : (
          <FileItem
            key={`file-${(node as FileNode).id}`}
            file={node as FileNode}
            isActive={currentFile?.id === (node as FileNode).id}
            searchQuery={searchQuery}
            onSelect={() => onFileSelect((node as FileNode).id)}
            onEdit={() => onEditFile((node as FileNode).id)}
            onDelete={() => onDeleteFile((node as FileNode).id)}
            level={level}
          />
        )
      )}
    </div>
  )
}

interface FolderItemProps {
  folder: FolderNode
  currentFile: ParsedFile | null
  searchQuery: string
  onFileSelect: (fileId: number) => void
  onEditFile: (fileId: number) => void
  onDeleteFile: (fileId: number) => void
  level: number
}

function FolderItem({ folder, currentFile, searchQuery, onFileSelect, onEditFile, onDeleteFile, level }: FolderItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const hasMatchingFiles = searchQuery
    ? folderHasMatchingFiles(folder, searchQuery)
    : true

  if (searchQuery && !hasMatchingFiles) return null

  const shouldAutoExpand = searchQuery && hasMatchingFiles

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm",
          "hover:bg-accent text-foreground transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {isOpen || shouldAutoExpand ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="truncate">{folder.name}</span>
      </button>
      {(isOpen || shouldAutoExpand) && (
        <FolderContents
          nodes={folder.children}
          currentFile={currentFile}
          searchQuery={searchQuery}
          onFileSelect={onFileSelect}
          onEditFile={onEditFile}
          onDeleteFile={onDeleteFile}
          level={level + 1}
        />
      )}
    </div>
  )
}

interface FileItemProps {
  file: FileNode
  isActive: boolean
  searchQuery: string
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  level: number
}

function FileItem({ file, isActive, searchQuery, onSelect, onEdit, onDelete, level }: FileItemProps) {
  const isVisible = searchQuery
    ? file.name.toLowerCase().includes(searchQuery.toLowerCase())
    : true

  if (!isVisible) return null

  return (
    <div
      className={cn(
        "flex items-center gap-1 w-full rounded-md text-sm group",
        "transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "hover:bg-accent text-foreground"
      )}
      style={{ paddingLeft: `${level * 12 + 28}px` }}
    >
      <button
        onClick={onSelect}
        className="flex items-center gap-2 flex-1 py-1.5 pr-1 focus-visible:outline-none"
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
              "h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
              isActive ? "hover:bg-primary-foreground/20" : "hover:bg-accent"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function folderHasMatchingFiles(folder: FolderNode, query: string): boolean {
  return folder.children.some((node) => {
    if (node.type === "file") {
      return node.name.toLowerCase().includes(query.toLowerCase())
    }
    return folderHasMatchingFiles(node as FolderNode, query)
  })
}
