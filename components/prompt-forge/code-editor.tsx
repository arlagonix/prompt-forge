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
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlertTriangle, FileText, Save, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface CodeEditorProps {
  content: string;
  fileName: string;
  isNew: boolean;
  onSave: (content: string, newFileName?: string) => Promise<void>;
  onClose: () => void;
  onDelete?: () => void;
  showNotification: (message: string, type?: "success" | "error") => void;
}

export function CodeEditor({
  content: initialContent,
  fileName,
  isNew,
  onSave,
  onClose,
  onDelete,
  showNotification,
}: CodeEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [newFileName, setNewFileName] = useState(fileName);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  useEffect(() => {
    setNewFileName(fileName);
  }, [fileName]);

  useEffect(() => {
    setHasChanges(content !== initialContent || newFileName !== fileName);
  }, [content, initialContent, newFileName, fileName]);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!newFileName.trim()) {
      showNotification("Please enter a prompt name", "error");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(content, newFileName.trim());
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [content, newFileName, onSave, showNotification]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      setShowDeleteConfirm(false);
      onDelete();
    }
  }, [onDelete]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleClose]);

  const handleKeyDownTextarea = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent =
        content.substring(0, start) + "  " + content.substring(end);

      setContent(newContent);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const lineCount = content.split("\n").length;

  return (
    <>
      <Dialog open={true} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent
          showCloseButton={false}
          className="h-[92vh] p-0 overflow-hidden"
          onOpenAutoFocus={(e) => {
            e.preventDefault();

            if (isNew) {
              const filenameInput = document.getElementById("editor-filename");
              if (filenameInput instanceof HTMLInputElement) {
                filenameInput.focus();
                filenameInput.setSelectionRange(
                  filenameInput.value.length,
                  filenameInput.value.length,
                );
              }
              return;
            }

            const textarea = textareaRef.current;
            if (textarea) {
              textarea.focus();

              const end = textarea.value.length;
              textarea.setSelectionRange(end, end);

              requestAnimationFrame(() => {
                textarea.scrollTop = 0;
                if (lineNumbersRef.current) {
                  lineNumbersRef.current.scrollTop = 0;
                }
              });
            }
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              {isNew ? "Create template" : `Edit ${fileName}`}
            </DialogTitle>
            <DialogDescription>
              Template editor dialog for editing template name and content.
            </DialogDescription>
          </DialogHeader>

          <div className="flex h-full min-h-0 flex-col bg-background">
            <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex items-center gap-2">
                  <Label htmlFor="editor-filename" className="sr-only">
                    Prompt name
                  </Label>
                  <Input
                    id="editor-filename"
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="Prompt name"
                    className="w-64 h-8 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!isNew && onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    Delete
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleClose}>
                  <X className="h-4 w-4 mr-1.5" />
                  Close
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-1.5" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </header>

            <div className="flex-1 min-h-0 flex overflow-hidden">
              <div
                ref={lineNumbersRef}
                className="w-12 bg-muted/50 border-r border-border overflow-hidden shrink-0 select-none"
                aria-hidden="true"
              >
                <div className="py-3 px-2 font-mono text-xs text-muted-foreground text-right leading-6">
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i + 1}>{i + 1}</div>
                  ))}
                </div>
              </div>

              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onScroll={handleScroll}
                onKeyDown={handleKeyDownTextarea}
                spellCheck={false}
                className={cn(
                  "flex-1 min-h-0 overflow-auto p-3 font-mono text-sm leading-6 resize-none",
                  "bg-background text-foreground",
                  "focus:outline-none",
                  "placeholder:text-muted-foreground",
                )}
                placeholder="Enter your prompt content here..."
              />
            </div>

            <footer className="flex items-center justify-between px-4 py-2 border-t border-border bg-card text-xs text-muted-foreground shrink-0">
              <div className="flex items-center gap-4">
                <span>{lineCount} lines</span>
                <span>{content.length} characters</span>
              </div>
              <div className="flex items-center gap-3">
                <span>
                  <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> Save
                </span>
                <span>
                  <Kbd>Esc</Kbd> Close
                </span>
              </div>
            </footer>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Unsaved Changes
            </DialogTitle>
            <DialogDescription>
              You have unsaved changes. Are you sure you want to close the
              editor? Your changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmClose(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={onClose}>
              Discard Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Prompt
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{fileName}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
