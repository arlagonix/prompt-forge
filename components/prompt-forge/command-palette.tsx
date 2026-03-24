"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { FileText } from "lucide-react"
import type { ParsedFile } from "@/lib/prompt-forge/types"

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  fileMap: Map<number, ParsedFile>
  onFileSelect: (fileId: number) => void
}

export function CommandPalette({
  isOpen,
  onClose,
  fileMap,
  onFileSelect,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("")

  // Reset search when opening
  useEffect(() => {
    if (isOpen) {
      setSearch("")
    }
  }, [isOpen])

  const files = useMemo(() => {
    return Array.from(fileMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [fileMap])

  const filteredFiles = useMemo(() => {
    if (!search.trim()) return files.slice(0, 20)
    
    const query = search.toLowerCase()
    return files
      .filter((file) => file.name.toLowerCase().includes(query))
      .slice(0, 20)
  }, [files, search])

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Command className="rounded-lg border border-border shadow-lg">
        <CommandInput
          placeholder="Search templates..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>
            {files.length === 0
              ? "No folder opened. Press Ctrl+O to open a folder."
              : "No templates found."}
          </CommandEmpty>
          <CommandGroup heading="Templates">
            {filteredFiles.map((file) => (
              <CommandItem
                key={file.id}
                value={file.name}
                onSelect={() => onFileSelect(file.id)}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {file.path}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
