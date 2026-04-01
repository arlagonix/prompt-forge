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

type EditorSection = "frontmatter" | "body";

type EditResult = {
  newContent: string;
  selectionStart: number;
  selectionEnd: number;
};

type EditorContext = {
  content: string;
  start: number;
  end: number;
};

type MarkdownContinuation = {
  indent: string;
  continuation: string | null;
  isEmptyStructure: boolean;
};

type HistoryEntry = {
  content: string;
  selectionStart: number;
  selectionEnd: number;
};

type HistoryState = {
  past: HistoryEntry[];
  future: HistoryEntry[];
};

type TypingBatchState = {
  active: boolean;
  timeoutId: number | null;
};

const INDENT = "  ";
const MAX_HISTORY = 100;
const TYPING_BATCH_MS = 700;

function normalizeLeadingIndent(raw: string): string {
  return raw.replace(/\t/g, INDENT);
}

function getLineStart(content: string, pos: number): number {
  return content.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
}

function getLeadingWhitespace(line: string): string {
  const match = line.match(/^[\t ]*/);
  return normalizeLeadingIndent(match?.[0] ?? "");
}

function detectEditorSection(content: string, cursor: number): EditorSection {
  const match = content.match(
    /^(\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
  );
  if (!match) return "body";
  return cursor <= match[0].length ? "frontmatter" : "body";
}

function replaceRange(
  content: string,
  start: number,
  end: number,
  replacement: string,
): string {
  return content.slice(0, start) + replacement + content.slice(end);
}

function applyEditResult(
  textarea: HTMLTextAreaElement,
  setContent: (value: string) => void,
  result: EditResult,
) {
  setContent(result.newContent);

  requestAnimationFrame(() => {
    textarea.selectionStart = result.selectionStart;
    textarea.selectionEnd = result.selectionEnd;
  });
}

function createSingleInsertionResult(
  content: string,
  start: number,
  end: number,
  insertion: string,
): EditResult {
  return {
    newContent: replaceRange(content, start, end, insertion),
    selectionStart: start + insertion.length,
    selectionEnd: start + insertion.length,
  };
}

function handleEnterInFrontmatter(ctx: EditorContext): EditResult {
  const lineStart = getLineStart(ctx.content, ctx.start);
  const currentLine = ctx.content.slice(lineStart, ctx.start);
  const trimmedLine = currentLine.trimEnd();
  const baseIndent = getLeadingWhitespace(currentLine);
  const extraIndent = trimmedLine.endsWith(":") ? INDENT : "";

  return createSingleInsertionResult(
    ctx.content,
    ctx.start,
    ctx.end,
    "\n" + baseIndent + extraIndent,
  );
}

function parseMarkdownContinuation(line: string): MarkdownContinuation {
  const indent = getLeadingWhitespace(line);
  const normalizedLine = normalizeLeadingIndent(line);

  const taskMatch = normalizedLine.match(
    /^([ ]*)([-*+])\s+\[(?: |x|X)\](?:\s+(.*))?$/,
  );
  if (taskMatch) {
    const [, taskIndent, marker, text = ""] = taskMatch;
    return {
      indent: taskIndent,
      continuation: `${taskIndent}${marker} [ ] `,
      isEmptyStructure: text.trim().length === 0,
    };
  }

  const bulletMatch = normalizedLine.match(/^([ ]*)([-*+])(?:\s+(.*))?$/);
  if (bulletMatch) {
    const [, bulletIndent, marker, text = ""] = bulletMatch;
    return {
      indent: bulletIndent,
      continuation: `${bulletIndent}${marker} `,
      isEmptyStructure: text.trim().length === 0,
    };
  }

  const numberedMatch = normalizedLine.match(/^([ ]*)(\d+)([.)])(?:\s+(.*))?$/);
  if (numberedMatch) {
    const [, numberIndent, rawNumber, delimiter, text = ""] = numberedMatch;
    const nextNumber = Number.parseInt(rawNumber, 10) + 1;
    return {
      indent: numberIndent,
      continuation: `${numberIndent}${nextNumber}${delimiter} `,
      isEmptyStructure: text.trim().length === 0,
    };
  }

  const quoteMatch = normalizedLine.match(/^([ ]*)>(?:\s?(.*))?$/);
  if (quoteMatch) {
    const [, quoteIndent, text = ""] = quoteMatch;
    return {
      indent: quoteIndent,
      continuation: `${quoteIndent}> `,
      isEmptyStructure: text.trim().length === 0,
    };
  }

  return {
    indent,
    continuation: null,
    isEmptyStructure: false,
  };
}

function handleEnterInMarkdown(ctx: EditorContext): EditResult {
  const lineStart = getLineStart(ctx.content, ctx.start);
  const currentLine = ctx.content.slice(lineStart, ctx.start);
  const parsed = parseMarkdownContinuation(currentLine);

  if (parsed.continuation) {
    if (parsed.isEmptyStructure) {
      return {
        newContent: replaceRange(
          ctx.content,
          lineStart,
          ctx.end,
          parsed.indent,
        ),
        selectionStart: lineStart + parsed.indent.length,
        selectionEnd: lineStart + parsed.indent.length,
      };
    }

    return createSingleInsertionResult(
      ctx.content,
      ctx.start,
      ctx.end,
      "\n" + parsed.continuation,
    );
  }

  return createSingleInsertionResult(
    ctx.content,
    ctx.start,
    ctx.end,
    "\n" + parsed.indent,
  );
}

function handleTabIndent(ctx: EditorContext): EditResult {
  if (ctx.start !== ctx.end) {
    const lineStart = getLineStart(ctx.content, ctx.start);
    const selectedText = ctx.content.slice(lineStart, ctx.end);
    const lines = selectedText.split("\n");
    const replacement = lines.map((line) => `${INDENT}${line}`).join("\n");

    return {
      newContent: replaceRange(ctx.content, lineStart, ctx.end, replacement),
      selectionStart: lineStart,
      selectionEnd: lineStart + replacement.length,
    };
  }

  return createSingleInsertionResult(ctx.content, ctx.start, ctx.end, INDENT);
}

function removeSingleIndentStep(line: string): string {
  if (line.startsWith(INDENT)) return line.slice(INDENT.length);
  if (line.startsWith("\t")) return line.slice(1);
  if (line.startsWith(" ")) return line.slice(1);
  return line;
}

function handleShiftTabOutdent(ctx: EditorContext): EditResult {
  const lineStart = getLineStart(ctx.content, ctx.start);
  const effectiveEnd =
    ctx.start === ctx.end
      ? ctx.content.indexOf("\n", ctx.end) === -1
        ? ctx.content.length
        : ctx.content.indexOf("\n", ctx.end)
      : ctx.end;
  const selectedText = ctx.content.slice(lineStart, effectiveEnd);
  const lines = selectedText.split("\n");
  const updatedLines = lines.map(removeSingleIndentStep);
  const replacement = updatedLines.join("\n");
  const removed = selectedText.length - replacement.length;

  if (ctx.start === ctx.end) {
    const removedFromCurrentLine = lines[0].length - updatedLines[0].length;
    const nextPos = Math.max(lineStart, ctx.start - removedFromCurrentLine);
    return {
      newContent: replaceRange(
        ctx.content,
        lineStart,
        effectiveEnd,
        replacement,
      ),
      selectionStart: nextPos,
      selectionEnd: nextPos,
    };
  }

  return {
    newContent: replaceRange(ctx.content, lineStart, effectiveEnd, replacement),
    selectionStart: lineStart,
    selectionEnd: Math.max(lineStart, ctx.end - removed),
  };
}

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
  const contentRef = useRef(initialContent);
  const historyRef = useRef<HistoryState>({ past: [], future: [] });
  const typingBatchRef = useRef<TypingBatchState>({
    active: false,
    timeoutId: null,
  });
  const skipNextTypingBatchRef = useRef(false);

  const syncContent = useCallback((value: string) => {
    contentRef.current = value;
    setContent(value);
  }, []);

  const clearTypingBatchTimer = useCallback(() => {
    const timeoutId = typingBatchRef.current.timeoutId;
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      typingBatchRef.current.timeoutId = null;
    }
  }, []);

  const flushTypingBatch = useCallback(() => {
    clearTypingBatchTimer();
    typingBatchRef.current.active = false;
  }, [clearTypingBatchTimer]);

  const getCurrentSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      const end = contentRef.current.length;
      return { selectionStart: end, selectionEnd: end };
    }

    return {
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
    };
  }, []);

  const createHistoryEntry = useCallback(
    (
      snapshotContent = contentRef.current,
      selection = getCurrentSelection(),
    ): HistoryEntry => ({
      content: snapshotContent,
      selectionStart: selection.selectionStart,
      selectionEnd: selection.selectionEnd,
    }),
    [getCurrentSelection],
  );

  const pushPastEntry = useCallback((entry: HistoryEntry) => {
    const history = historyRef.current;
    const lastEntry = history.past[history.past.length - 1];

    if (
      lastEntry &&
      lastEntry.content === entry.content &&
      lastEntry.selectionStart === entry.selectionStart &&
      lastEntry.selectionEnd === entry.selectionEnd
    ) {
      history.future = [];
      return;
    }

    history.past.push(entry);
    if (history.past.length > MAX_HISTORY) {
      history.past.splice(0, history.past.length - MAX_HISTORY);
    }
    history.future = [];
  }, []);

  const restoreHistoryEntry = useCallback(
    (entry: HistoryEntry) => {
      syncContent(entry.content);

      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.focus();
        textarea.selectionStart = entry.selectionStart;
        textarea.selectionEnd = entry.selectionEnd;
      });
    },
    [syncContent],
  );

  const applyHistoryTrackedEdit = useCallback(
    (result: EditResult) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      flushTypingBatch();
      pushPastEntry(createHistoryEntry());
      applyEditResult(textarea, syncContent, result);
    },
    [createHistoryEntry, flushTypingBatch, pushPastEntry, syncContent],
  );

  const handleUndo = useCallback(() => {
    flushTypingBatch();

    const history = historyRef.current;
    const previous = history.past.pop();
    if (!previous) return;

    history.future.push(createHistoryEntry());
    restoreHistoryEntry(previous);
  }, [createHistoryEntry, flushTypingBatch, restoreHistoryEntry]);

  const handleRedo = useCallback(() => {
    flushTypingBatch();

    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return;

    history.past.push(createHistoryEntry());
    if (history.past.length > MAX_HISTORY) {
      history.past.splice(0, history.past.length - MAX_HISTORY);
    }

    restoreHistoryEntry(next);
  }, [createHistoryEntry, flushTypingBatch, restoreHistoryEntry]);

  const beginTypingBatchIfNeeded = useCallback(() => {
    if (!typingBatchRef.current.active) {
      pushPastEntry(createHistoryEntry());
      typingBatchRef.current.active = true;
    }

    clearTypingBatchTimer();
    typingBatchRef.current.timeoutId = window.setTimeout(() => {
      typingBatchRef.current.active = false;
      typingBatchRef.current.timeoutId = null;
    }, TYPING_BATCH_MS);
  }, [clearTypingBatchTimer, createHistoryEntry, pushPastEntry]);

  useEffect(() => {
    syncContent(initialContent);
    historyRef.current = { past: [], future: [] };
    flushTypingBatch();
  }, [flushTypingBatch, initialContent, syncContent]);

  useEffect(() => {
    return () => {
      clearTypingBatchTimer();
    };
  }, [clearTypingBatchTimer]);

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
      flushTypingBatch();
      pushPastEntry(createHistoryEntry());

      const cleanedContent = stripReusableFlag(template.content);
      syncContent(cleanedContent);

      if (!newFileName.trim()) {
        setNewFileName(template.name);
      }

      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.focus();
        textarea.selectionStart = 0;
        textarea.selectionEnd = 0;
        textarea.scrollTop = 0;

        if (lineNumbersRef.current) {
          lineNumbersRef.current.scrollTop = 0;
        }
      });
    },
    [
      createHistoryEntry,
      flushTypingBatch,
      newFileName,
      pushPastEntry,
      syncContent,
    ],
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

  const handleTextAreaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (skipNextTypingBatchRef.current) {
        skipNextTypingBatchRef.current = false;
        syncContent(e.target.value);
        return;
      }

      beginTypingBatchIfNeeded();
      syncContent(e.target.value);
    },
    [beginTypingBatchIfNeeded, syncContent],
  );

  const handlePasteTextarea = useCallback(() => {
    flushTypingBatch();
    pushPastEntry(createHistoryEntry());
    skipNextTypingBatchRef.current = true;
  }, [createHistoryEntry, flushTypingBatch, pushPastEntry]);

  const handleKeyDownTextarea = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (ctrl && !e.shiftKey && key === "z") {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation?.();
      handleUndo();
      return;
    }

    if ((ctrl && key === "y") || (ctrl && e.shiftKey && key === "z")) {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation?.();
      handleRedo();
      return;
    }

    const ctx: EditorContext = {
      content,
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };

    if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation?.();

      const result = e.shiftKey
        ? handleShiftTabOutdent(ctx)
        : handleTabIndent(ctx);

      applyHistoryTrackedEdit(result);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation?.();

      const section = detectEditorSection(content, ctx.start);
      const result =
        section === "frontmatter"
          ? handleEnterInFrontmatter(ctx)
          : handleEnterInMarkdown(ctx);

      applyHistoryTrackedEdit(result);
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
                onChange={handleTextAreaChange}
                onPaste={handlePasteTextarea}
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
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
