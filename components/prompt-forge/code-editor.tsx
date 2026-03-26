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
import { stripReusableFlag } from "@/lib/prompt-forge/parser";
import { cn } from "@/lib/utils";
import { AlertTriangle, FileText, Library, Save, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReusableTemplateOption,
  TemplatePickerDialog,
} from "./template-picker-dialog";

interface CodeEditorProps {
  content: string;
  fileName: string;
  isNew: boolean;
  onSave: (content: string, newFileName?: string) => Promise<void>;
  onClose: () => void;
  onDelete?: () => void;
  showNotification: (message: string, type?: "success" | "error") => void;
  reusableTemplates: ReusableTemplateOption[];
}

export function CodeEditor({
  content: initialContent,
  fileName,
  isNew,
  onSave,
  onClose,
  onDelete,
  showNotification,
  reusableTemplates,
}: CodeEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [newFileName, setNewFileName] = useState(fileName);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [showReplaceTemplateConfirm, setShowReplaceTemplateConfirm] =
    useState(false);
  const [pendingTemplate, setPendingTemplate] =
    useState<ReusableTemplateOption | null>(null);

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

  const applyReusableTemplate = useCallback(
    (template: ReusableTemplateOption) => {
      const cleanedContent = stripReusableFlag(template.content);
      setContent(cleanedContent);

      if (!newFileName.trim()) {
        setNewFileName(template.name);
      }

      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = 0;
        textarea.scrollTop = 0;

        if (lineNumbersRef.current) {
          lineNumbersRef.current.scrollTop = 0;
        }
      });
    },
    [newFileName],
  );

  const shouldConfirmTemplateReplace = useCallback(() => {
    if (!isNew) return true;
    return hasChanges;
  }, [hasChanges, isNew]);

  const handleSelectReusableTemplate = useCallback(
    (template: ReusableTemplateOption) => {
      if (shouldConfirmTemplateReplace()) {
        setPendingTemplate(template);
        setShowReplaceTemplateConfirm(true);
        return;
      }

      applyReusableTemplate(template);
    },
    [applyReusableTemplate, shouldConfirmTemplateReplace],
  );

  const confirmReplaceWithTemplate = useCallback(() => {
    if (!pendingTemplate) return;

    applyReusableTemplate(pendingTemplate);
    setPendingTemplate(null);
    setShowReplaceTemplateConfirm(false);
  }, [applyReusableTemplate, pendingTemplate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
        return;
      }

      if (ctrl && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setIsTemplatePickerOpen(true);
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
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation?.();

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (e.shiftKey) {
        const lineStart = content.lastIndexOf("\n", start - 1) + 1;
        const selectedText = content.slice(lineStart, end);
        const lines = selectedText.split("\n");

        const updatedLines = lines.map((line) => {
          if (line.startsWith("  ")) return line.slice(2);
          if (line.startsWith("\t")) return line.slice(1);
          return line;
        });

        const replacement = updatedLines.join("\n");
        const newContent =
          content.slice(0, lineStart) + replacement + content.slice(end);

        setContent(newContent);

        requestAnimationFrame(() => {
          const removed = selectedText.length - replacement.length;
          textarea.selectionStart = lineStart;
          textarea.selectionEnd = end - removed;
        });

        return;
      }

      if (start !== end) {
        const lineStart = content.lastIndexOf("\n", start - 1) + 1;
        const selectedText = content.slice(lineStart, end);
        const lines = selectedText.split("\n");
        const replacement = lines.map((line) => `  ${line}`).join("\n");

        const newContent =
          content.slice(0, lineStart) + replacement + content.slice(end);

        setContent(newContent);

        requestAnimationFrame(() => {
          textarea.selectionStart = lineStart;
          textarea.selectionEnd = lineStart + replacement.length;
        });

        return;
      }

      const newContent = content.slice(0, start) + "  " + content.slice(end);
      setContent(newContent);

      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });

      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation?.();

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const lineStart = content.lastIndexOf("\n", start - 1) + 1;
      const currentLine = content.slice(lineStart, start);

      const indentMatch = currentLine.match(/^[\t ]*/);
      const baseIndent = indentMatch?.[0] ?? "";

      const trimmedLine = currentLine.trimEnd();

      let extraIndent = "";
      if (trimmedLine.endsWith(":")) {
        extraIndent = "  ";
      } else if (trimmedLine.startsWith("- ")) {
        const bulletIndentMatch = currentLine.match(/^([\t ]*)-\s/);
        if (bulletIndentMatch) {
          extraIndent = "  ";
        }
      }

      const insertion = "\n" + baseIndent + extraIndent;
      const newContent =
        content.slice(0, start) + insertion + content.slice(end);

      setContent(newContent);

      requestAnimationFrame(() => {
        const nextPos = start + insertion.length;
        textarea.selectionStart = textarea.selectionEnd = nextPos;
      });
    }
  };

  const lineCount = content.split("\n").length;

  return (
    <>
      <Dialog open={true} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent
          showCloseButton={false}
          className="h-[92vh] overflow-hidden p-0"
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
            <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
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
                    className="h-8 w-64 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTemplatePickerOpen(true)}
                >
                  <Library className="mr-1.5 h-4 w-4" />
                  Use template
                </Button>

                {!isNew && onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    Delete
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleClose}>
                  <X className="mr-1.5 h-4 w-4" />
                  Close
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  <Save className="mr-1.5 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </header>

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div
                ref={lineNumbersRef}
                className="w-12 shrink-0 select-none overflow-hidden border-r border-border bg-muted/50"
                aria-hidden="true"
              >
                <div className="px-2 py-3 text-right font-mono text-xs leading-6 text-muted-foreground">
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
                onKeyDownCapture={handleKeyDownTextarea}
                spellCheck={false}
                className={cn(
                  "flex-1 min-h-0 resize-none overflow-auto p-3 font-mono text-sm leading-6",
                  "bg-background text-foreground",
                  "focus:outline-none",
                  "placeholder:text-muted-foreground",
                )}
                placeholder="Enter your prompt content here..."
              />
            </div>

            <footer className="flex shrink-0 items-center justify-between border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>{lineCount} lines</span>
                <span>{content.length} characters</span>
              </div>
              <div className="flex items-center gap-3">
                <span>
                  <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> Save
                </span>
                <span>
                  <Kbd>Ctrl</Kbd>+<Kbd>T</Kbd> Use template
                </span>
                <span>
                  <Kbd>Esc</Kbd> Close
                </span>
              </div>
            </footer>
          </div>
        </DialogContent>
      </Dialog>

      <TemplatePickerDialog
        isOpen={isTemplatePickerOpen}
        templates={reusableTemplates}
        onClose={() => setIsTemplatePickerOpen(false)}
        onSelect={handleSelectReusableTemplate}
      />

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

      <Dialog
        open={showReplaceTemplateConfirm}
        onOpenChange={setShowReplaceTemplateConfirm}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Replace Current Draft
            </DialogTitle>
            <DialogDescription>
              Replace current draft with selected template?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingTemplate(null);
                setShowReplaceTemplateConfirm(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReplaceWithTemplate}>
              Replace
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
