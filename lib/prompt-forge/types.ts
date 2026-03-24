export interface FileNode {
  id: number
  name: string
  path: string
  type: "file"
}

export interface FolderNode {
  name: string
  path: string
  type: "directory"
  children: (FileNode | FolderNode)[]
}

export interface ParsedFile extends FileNode {
  handle: FileSystemFileHandle | null
  parentHandle?: FileSystemDirectoryHandle | null
  content: string | null
  bodyContent: string | null
  metadata: Record<string, unknown>
  rawFrontMatter: string
  hasFrontMatter?: boolean
}

export interface EditorState {
  isOpen: boolean
  isNew: boolean
  fileId: number | null
  content: string
  fileName: string
  parentHandle: FileSystemDirectoryHandle | null
}

export interface Parameter {
  name: string
  type: "textarea" | "text" | "number" | "checkbox" | "select" | "radio"
  label: string
  defaultValue: string | null
  height: number | null
  values: string[]
}

export interface FrontMatterResult {
  metadata: Record<string, unknown>
  body: string
  rawFrontMatter: string
  hasFrontMatter: boolean
}
