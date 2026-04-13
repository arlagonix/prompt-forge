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
import { useIsMobile } from "@/hooks/use-mobile";
import { stripReusableFlag } from "@/lib/prompt-forge/parser";
import { cn } from "@/lib/utils";
import { AlertTriangle, FileText, Library, Save, X } from "lucide-react";
import type * as Monaco from "monaco-editor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TemplateMonacoEditor } from "./template-monaco-editor";
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
  title?: string;
  showNameInput?: boolean;
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
  title,
  showNameInput = true,
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

  const isMobile = useIsMobile();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  useEffect(() => {
    setNewFileName(fileName);
  }, [fileName]);

  useEffect(() => {
    setHasChanges(content !== initialContent || newFileName !== fileName);
  }, [content, initialContent, newFileName, fileName]);

  const handleSave = useCallback(async () => {
    if (showNameInput && !newFileName.trim()) {
      showNotification("Please enter a prompt name", "error");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(content, showNameInput ? newFileName.trim() : undefined);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [content, newFileName, onSave, showNameInput, showNotification]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  const handleDelete = useCallback(() => {
    if (!onDelete) return;
    setShowDeleteConfirm(false);
    onDelete();
  }, [onDelete]);

  const applyReusableTemplate = useCallback(
    (template: ReusableTemplateOption) => {
      const cleanedContent = stripReusableFlag(template.content);
      setContent(cleanedContent);

      if (!newFileName.trim()) {
        setNewFileName(template.name);
      }

      requestAnimationFrame(() => {
        const editor = editorRef.current;
        if (!editor) return;

        editor.focus();
        editor.setPosition({ lineNumber: 1, column: 1 });
        editor.setScrollTop(0);
        editor.setScrollLeft(0);
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
        void handleSave();
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
  }, [handleClose, handleSave]);

  const lineCount = useMemo(() => {
    return content.length === 0 ? 1 : content.split("\n").length;
  }, [content]);

  const wrapCurrentSelection = useCallback(
    (
      editor: Monaco.editor.IStandaloneCodeEditor,
      monaco: typeof Monaco,
      wrapper: string,
    ) => {
      const selection = editor.getSelection();
      const model = editor.getModel();

      if (!selection || !model || selection.isEmpty()) {
        return false;
      }

      const selectedText = model.getValueInRange(selection);
      const wrappedText = `${wrapper}${selectedText}${wrapper}`;

      editor.pushUndoStop();
      editor.executeEdits("wrap-selection", [
        {
          range: selection,
          text: wrappedText,
          forceMoveMarkers: true,
        },
      ]);

      editor.setSelection(
        new monaco.Selection(
          selection.startLineNumber,
          selection.startColumn + wrapper.length,
          selection.endLineNumber,
          selection.endColumn + wrapper.length,
        ),
      );
      editor.pushUndoStop();
      editor.focus();

      return true;
    },
    [],
  );

  const handleEditorDidMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      editorRef.current = editor;

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        void handleSave();
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyT, () => {
        setIsTemplatePickerOpen(true);
      });

      editor.addCommand(monaco.KeyCode.Escape, () => {
        handleClose();
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
        wrapCurrentSelection(editor, monaco, "*");
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
        wrapCurrentSelection(editor, monaco, "**");
      });

      editor.onKeyDown((e) => {
        const selection = editor.getSelection();
        const hasSelection = !!selection && !selection.isEmpty();

        if (!hasSelection) {
          return;
        }

        const key = e.browserEvent.key;
        if (key !== "*") {
          return;
        }

        if (e.ctrlKey || e.metaKey || e.altKey) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        const wrapper = e.shiftKey ? "**" : "*";
        wrapCurrentSelection(editor, monaco, wrapper);
      });

      if (!isNew) {
        const model = editor.getModel();
        const lastLine = model?.getLineCount() ?? 1;
        const lastColumn = model?.getLineMaxColumn(lastLine) ?? 1;

        editor.setPosition({ lineNumber: lastLine, column: lastColumn });
      }

      requestAnimationFrame(() => {
        editor.focus();
      });
    },
    [handleClose, handleSave, isNew, wrapCurrentSelection],
  );

  return (
    <>
      <Dialog open={true} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            "overflow-hidden p-0",
            isMobile
              ? "h-[100dvh] w-screen max-w-none rounded-none border-0"
              : "h-[92vh]",
          )}
          onOpenAutoFocus={(e) => {
            e.preventDefault();

            if (isNew && showNameInput) {
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

            requestAnimationFrame(() => {
              editorRef.current?.focus();
            });
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              {title ?? (isNew ? "Create template" : `Edit ${fileName}`)}
            </DialogTitle>
          </DialogHeader>

          <div className="flex h-full min-h-0 flex-col bg-background">
            <header
              className={cn(
                "shrink-0 border-b border-border bg-card px-4 py-3",
                isMobile ? "space-y-3" : "flex items-center justify-between gap-4",
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  {showNameInput ? (
                    <>
                      <Label htmlFor="editor-filename" className="sr-only">
                        Prompt name
                      </Label>
                      <Input
                        id="editor-filename"
                        type="text"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        placeholder="Prompt name"
                        className="h-9 w-full font-mono text-sm"
                      />
                    </>
                  ) : (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {title ?? fileName}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "shrink-0 gap-2",
                  isMobile ? "grid grid-cols-2" : "flex items-center",
                )}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTemplatePickerOpen(true)}
                >
                  <Library className="mr-1.5 h-4 w-4" />
                  Use template
                </Button>

                <Button variant="outline" size="sm" onClick={handleClose}>
                  <X className="mr-1.5 h-4 w-4" />
                  Close
                </Button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden bg-background">
              <TemplateMonacoEditor
                value={content}
                onChange={setContent}
                onMount={handleEditorDidMount}
              />
            </div>

            <div className="shrink-0 border-t border-border px-4 py-2 text-xs text-muted-foreground">
              <div
                className={cn(
                  "flex items-center justify-between gap-3",
                  isMobile && "flex-col items-start",
                )}
              >
                <div className="flex items-center gap-4">
                  <span>{lineCount} lines</span>
                  <span>{content.length} characters</span>
                </div>

                {!isMobile && (
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
                )}
              </div>
            </div>

            <footer
              className={cn(
                "shrink-0 border-t border-border bg-card px-4 py-3",
                isMobile ? "space-y-3" : "flex items-center justify-between gap-4",
              )}
            >
              <div className={cn(isMobile ? "grid" : "flex items-center") }>
                {!isNew && onDelete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    Delete
                  </Button>
                ) : (
                  <div />
                )}
              </div>

              <div
                className={cn(
                  "gap-2",
                  isMobile ? "grid grid-cols-1" : "flex items-center",
                )}
              >
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  <Save className="mr-1.5 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
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
          <DialogFooter className="flex-col sm:flex-row">
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
              This will replace the current editor content with the selected
              reusable template.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setPendingTemplate(null);
                setShowReplaceTemplateConfirm(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={confirmReplaceWithTemplate}>
              Replace Content
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Template
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this template? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
