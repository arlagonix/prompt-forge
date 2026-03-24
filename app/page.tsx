"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Sidebar } from "@/components/prompt-forge/sidebar"
import { MainContent } from "@/components/prompt-forge/main-content"
import { CommandPalette } from "@/components/prompt-forge/command-palette"
import { DocsModal } from "@/components/prompt-forge/docs-modal"
import { TemplateModal } from "@/components/prompt-forge/template-modal"
import { CodeEditor } from "@/components/prompt-forge/code-editor"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import type { FileNode, FolderNode, ParsedFile, Parameter, EditorState } from "@/lib/prompt-forge/types"
import { parseFrontMatter, extractParameters } from "@/lib/prompt-forge/parser"

const DEFAULT_TEMPLATE = `---
title: New Template
description: A new prompt template
---

# Your Template

Write your prompt template here. Use {{parameter_name}} syntax for parameters.

Example: Hello, {{name}}! How can I help you today?
`

export default function PromptForge() {
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [folderTree, setFolderTree] = useState<FolderNode | null>(null)
  const [fileMap, setFileMap] = useState<Map<number, ParsedFile>>(new Map())
  const [currentFile, setCurrentFile] = useState<ParsedFile | null>(null)
  const [currentParams, setCurrentParams] = useState<Parameter[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [isDocsOpen, setIsDocsOpen] = useState(false)
  const [isTemplateOpen, setIsTemplateOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [editorState, setEditorState] = useState<EditorState>({
    isOpen: false,
    isNew: false,
    fileId: null,
    content: "",
    fileName: "",
    parentHandle: null,
  })
  
  const fileIdCounter = useRef(0)

  // Handle initial sidebar state based on screen size
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false)
    }
  }, [])

  const showNotification = useCallback((message: string, type: "success" | "error" = "success") => {
    if (type === "error") {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }, [])

  const selectFolder = useCallback(async () => {
    if (!("showDirectoryPicker" in window)) {
      showNotification("File System Access API is not supported. Use Chrome, Edge, or Opera.", "error")
      return
    }

    try {
      setIsLoading(true)
      const handle = await window.showDirectoryPicker()
      setFolderHandle(handle)
      
      const newFileMap = new Map<number, ParsedFile>()
      fileIdCounter.current = 0
      
      const root: FolderNode = {
        name: handle.name,
        path: "/" + handle.name,
        type: "directory",
        children: [],
      }
      
      await readDirectoryRecursive(handle, root.children, "", newFileMap, handle)
      setFolderTree(root)
      setFileMap(newFileMap)
      setCurrentFile(null)
      setCurrentParams([])
      showNotification(`Folder loaded: ${handle.name}`)
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        showNotification("Failed to select folder", "error")
      }
    } finally {
      setIsLoading(false)
    }
  }, [showNotification])

  const readDirectoryRecursive = async (
    dirHandle: FileSystemDirectoryHandle,
    arr: (FileNode | FolderNode)[],
    currentPath: string,
    fileMapRef: Map<number, ParsedFile>,
    parentDir: FileSystemDirectoryHandle
  ) => {
    const dirs: FolderNode[] = []
    const files: FileNode[] = []

    for await (const entry of dirHandle.values()) {
      if (entry.kind === "directory") {
        const dir: FolderNode = {
          name: entry.name,
          path: currentPath + "/" + entry.name,
          type: "directory",
          children: [],
        }
        await readDirectoryRecursive(entry, dir.children, dir.path, fileMapRef, entry)
        if (directoryHasFiles(dir)) dirs.push(dir)
      } else {
        const low = entry.name.toLowerCase()
        if (low.endsWith(".md") || low.endsWith(".markdown")) {
          const id = fileIdCounter.current++
          const file: ParsedFile = {
            id,
            name: entry.name,
            handle: entry,
            parentHandle: dirHandle,
            path: currentPath + "/" + entry.name,
            type: "file",
            content: null,
            bodyContent: null,
            metadata: {},
            rawFrontMatter: "",
          }
          fileMapRef.set(id, file)
          files.push({
            id,
            name: entry.name,
            path: currentPath + "/" + entry.name,
            type: "file",
          })
        }
      }
    }

    dirs.sort((a, b) => a.name.localeCompare(b.name))
    files.sort((a, b) => a.name.localeCompare(b.name))
    arr.push(...dirs, ...files)
  }

  const directoryHasFiles = (dir: FolderNode): boolean =>
    dir.children.some(
      (c) => c.type === "file" || (c.type === "directory" && directoryHasFiles(c as FolderNode))
    )

  const loadFile = useCallback(async (fileId: number) => {
    const file = fileMap.get(fileId)
    if (!file || !file.handle) return

    try {
      setIsLoading(true)
      const fh = await file.handle.getFile()
      const content = await fh.text()

      const frontMatter = parseFrontMatter(content)
      const updatedFile: ParsedFile = {
        ...file,
        content,
        metadata: frontMatter.metadata,
        bodyContent: frontMatter.body,
        rawFrontMatter: frontMatter.rawFrontMatter,
        hasFrontMatter: frontMatter.hasFrontMatter,
      }

      setFileMap((prev) => {
        const next = new Map(prev)
        next.set(fileId, updatedFile)
        return next
      })

      const params = extractParameters(frontMatter.body)
      setCurrentFile(updatedFile)
      setCurrentParams(params)
    } catch (err) {
      showNotification("Failed to load template", "error")
    } finally {
      setIsLoading(false)
    }
  }, [fileMap, showNotification])

  const refreshFolder = useCallback(async () => {
    if (!folderHandle) return
    
    const currentFilePath = currentFile?.path
    const currentFileName = currentFile?.name
    
    setIsLoading(true)
    const newFileMap = new Map<number, ParsedFile>()
    fileIdCounter.current = 0
    
    const root: FolderNode = {
      name: folderHandle.name,
      path: "/" + folderHandle.name,
      type: "directory",
      children: [],
    }
    
    await readDirectoryRecursive(folderHandle, root.children, "", newFileMap, folderHandle)
    setFolderTree(root)
    setFileMap(newFileMap)
    
    if (currentFilePath && currentFileName) {
      for (const [id, f] of newFileMap) {
        if (f.name === currentFileName && f.path === currentFilePath) {
          await loadFile(id)
          break
        }
      }
    }
    
    setIsLoading(false)
    showNotification("Folder refreshed")
  }, [folderHandle, currentFile, loadFile, showNotification])

  // Editor functions
  const openEditor = useCallback(async (fileId: number) => {
    const file = fileMap.get(fileId)
    if (!file || !file.handle) return

    try {
      const fh = await file.handle.getFile()
      const content = await fh.text()
      
      setEditorState({
        isOpen: true,
        isNew: false,
        fileId,
        content,
        fileName: file.name,
        parentHandle: file.parentHandle || null,
      })
    } catch (err) {
      showNotification("Failed to open file for editing", "error")
    }
  }, [fileMap, showNotification])

  const createNewFile = useCallback(() => {
    if (!folderHandle) {
      showNotification("Please select a folder first", "error")
      return
    }

    setEditorState({
      isOpen: true,
      isNew: true,
      fileId: null,
      content: DEFAULT_TEMPLATE,
      fileName: "",
      parentHandle: folderHandle,
    })
  }, [folderHandle, showNotification])

  const saveFile = useCallback(async (content: string, newFileName?: string) => {
    try {
      if (editorState.isNew) {
        // Creating new file
        if (!newFileName || !editorState.parentHandle) {
          throw new Error("Missing file name or parent folder")
        }

        const fileHandle = await editorState.parentHandle.getFileHandle(newFileName, { create: true })
        const writable = await fileHandle.createWritable()
        await writable.write(content)
        await writable.close()
        
        showNotification(`Created: ${newFileName}`)
        setEditorState(prev => ({ ...prev, isOpen: false }))
        await refreshFolder()
      } else {
        // Editing existing file
        const file = fileMap.get(editorState.fileId!)
        if (!file || !file.handle) {
          throw new Error("File not found")
        }

        const writable = await file.handle.createWritable()
        await writable.write(content)
        await writable.close()
        
        showNotification(`Saved: ${file.name}`)
        
        // Update the file in the map with new content
        const frontMatter = parseFrontMatter(content)
        const updatedFile: ParsedFile = {
          ...file,
          content,
          metadata: frontMatter.metadata,
          bodyContent: frontMatter.body,
          rawFrontMatter: frontMatter.rawFrontMatter,
          hasFrontMatter: frontMatter.hasFrontMatter,
        }
        
        setFileMap(prev => {
          const next = new Map(prev)
          next.set(file.id, updatedFile)
          return next
        })
        
        // Update current file if it's the one being edited
        if (currentFile?.id === file.id) {
          setCurrentFile(updatedFile)
          const params = extractParameters(frontMatter.body)
          setCurrentParams(params)
        }
        
        setEditorState(prev => ({ ...prev, content, isOpen: false }))
      }
    } catch (err) {
      showNotification(`Failed to save file: ${(err as Error).message}`, "error")
      throw err
    }
  }, [editorState, fileMap, currentFile, showNotification, refreshFolder])

  const deleteFile = useCallback(async (fileId: number) => {
    const file = fileMap.get(fileId)
    if (!file || !file.parentHandle) {
      showNotification("Cannot delete file", "error")
      return
    }

    try {
      await file.parentHandle.removeEntry(file.name)
      showNotification(`Deleted: ${file.name}`)
      
      // Clear current file if it's the one being deleted
      if (currentFile?.id === fileId) {
        setCurrentFile(null)
        setCurrentParams([])
      }
      
      // Close editor if this file is being edited
      if (editorState.fileId === fileId) {
        setEditorState(prev => ({ ...prev, isOpen: false }))
      }
      
      await refreshFolder()
    } catch (err) {
      showNotification(`Failed to delete file: ${(err as Error).message}`, "error")
    }
  }, [fileMap, currentFile, editorState, showNotification, refreshFolder])

  const closeEditor = useCallback(() => {
    setEditorState(prev => ({ ...prev, isOpen: false }))
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when editor is open (editor handles its own)
      if (editorState.isOpen) return

      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && e.code === "KeyK") {
        e.preventDefault()
        setIsPaletteOpen((prev) => !prev)
        return
      }

      if (ctrl && e.code === "KeyO") {
        e.preventDefault()
        selectFolder()
        return
      }

      if (ctrl && e.code === "KeyN" && folderHandle) {
        e.preventDefault()
        createNewFile()
        return
      }

      if (ctrl && e.code === "KeyE" && currentFile) {
        e.preventDefault()
        openEditor(currentFile.id)
        return
      }

      if (e.key === "Escape") {
        if (isPaletteOpen) {
          setIsPaletteOpen(false)
          return
        }
        if (isDocsOpen) {
          setIsDocsOpen(false)
          return
        }
        if (isTemplateOpen) {
          setIsTemplateOpen(false)
          return
        }
      }

      if (e.altKey && e.code === "KeyR" && folderHandle) {
        e.preventDefault()
        refreshFolder()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isPaletteOpen, isDocsOpen, isTemplateOpen, folderHandle, currentFile, editorState.isOpen, selectFolder, refreshFolder, createNewFile, openEditor])

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        folderTree={folderTree}
        currentFile={currentFile}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectFolder={selectFolder}
        onRefresh={refreshFolder}
        onFileSelect={loadFile}
        onEditFile={openEditor}
        onCreateFile={createNewFile}
        onDeleteFile={deleteFile}
        isLoading={isLoading}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      
      <MainContent
        currentFile={currentFile}
        currentParams={currentParams}
        isLoading={isLoading}
        onOpenDocs={() => setIsDocsOpen(true)}
        onOpenTemplate={() => setIsTemplateOpen(true)}
        onEditFile={() => currentFile && openEditor(currentFile.id)}
        showNotification={showNotification}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
      />

      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        fileMap={fileMap}
        onFileSelect={(id) => {
          loadFile(id)
          setIsPaletteOpen(false)
        }}
      />

      <DocsModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} />
      
      <TemplateModal
        isOpen={isTemplateOpen}
        onClose={() => setIsTemplateOpen(false)}
        content={currentFile?.content ?? currentFile?.bodyContent ?? ""}
      />

      {editorState.isOpen && (
        <CodeEditor
          content={editorState.content}
          fileName={editorState.fileName}
          isNew={editorState.isNew}
          onSave={saveFile}
          onClose={closeEditor}
          onDelete={editorState.isNew ? undefined : () => editorState.fileId && deleteFile(editorState.fileId)}
          showNotification={showNotification}
        />
      )}

      <Toaster position="bottom-right" />
    </div>
  )
}
