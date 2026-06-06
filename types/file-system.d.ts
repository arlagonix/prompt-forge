interface FileSystemHandle {
  kind: "file" | "directory"
  name: string
  queryPermission?(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>
  requestPermission?(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>
}

interface FileSystemWritableFileStream {
  write(data: Blob | string | BufferSource): Promise<void>
  close(): Promise<void>
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: "file"
  getFile(): Promise<File>
  createWritable(): Promise<FileSystemWritableFileStream>
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: "directory"
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
}

interface Window {
  showDirectoryPicker(options?: { mode?: "read" | "readwrite" }): Promise<FileSystemDirectoryHandle>
}

interface File {
  webkitRelativePath: string
}

interface HTMLInputElement {
  webkitdirectory?: boolean
}

interface FileSystemEntry {
  readonly isFile: boolean
  readonly isDirectory: boolean
  readonly name: string
  readonly fullPath: string
}

interface FileSystemFileEntry extends FileSystemEntry {
  readonly isFile: true
  readonly isDirectory: false
  file(successCallback: (file: File) => void, errorCallback?: (error: DOMException) => void): void
}

interface FileSystemDirectoryEntry extends FileSystemEntry {
  readonly isFile: false
  readonly isDirectory: true
  createReader(): FileSystemDirectoryReader
}

interface FileSystemDirectoryReader {
  readEntries(successCallback: (entries: FileSystemEntry[]) => void, errorCallback?: (error: DOMException) => void): void
}

interface DataTransferItem {
  webkitGetAsEntry?(): FileSystemEntry | null
}

