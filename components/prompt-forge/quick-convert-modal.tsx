"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  buildClipboardPreviewDocument,
  processClipboardHtml,
  readClipboardSource,
  readClipboardSourceFromDataTransfer,
  sanitizePastedHtml,
} from "@/lib/prompt-forge/clipboard-import";
import { cn } from "@/lib/utils";
import {
  Check,
  Clipboard,
  Eraser,
  Eye,
  FileCode2,
  Minimize2,
  ScanText,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface QuickConvertModalProps {
  isOpen: boolean;
  onClose: () => void;
  showNotification: (message: string, type?: "success" | "error") => void;
}

type OutputTab = "html" | "minified" | "markdown" | "preview";

const TAB_LABELS: Record<Exclude<OutputTab, "preview">, string> = {
  html: "HTML",
  minified: "Minified",
  markdown: "Markdown",
};

function getClipboardIncoming(data: DataTransfer | null): string {
  const source = readClipboardSourceFromDataTransfer(data);

  if (source.html) {
    return sanitizePastedHtml(source.html);
  }

  const text = source.text?.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) {
    return "";
  }

  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.split("\n").join("<br>"))
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("\n");
}

function SectionTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground leading-none",
        className,
      )}
      {...props}
    />
  );
}

function SectionDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-1 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function QuickConvertModal({
  isOpen,
  onClose,
  showNotification,
}: QuickConvertModalProps) {
  const isMobile = useIsMobile();
  const pasteBoxRef = useRef<HTMLDivElement | null>(null);
  const outputPanelRef = useRef<HTMLDivElement | null>(null);
  const [rawHtml, setRawHtml] = useState("");
  const [activeTab, setActiveTab] = useState<OutputTab>("html");
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => processClipboardHtml(rawHtml), [rawHtml]);
  const previewDocument = useMemo(
    () => buildClipboardPreviewDocument(result.pretty),
    [result.pretty],
  );
  const hasContent =
    rawHtml.replace(/<[^>]+>/g, "").trim().length > 0 ||
    result.pretty.length > 0;

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const syncFromPasteBox = useCallback(() => {
    setRawHtml(pasteBoxRef.current?.innerHTML ?? "");
  }, []);

  const focusPasteBoxEnd = useCallback(() => {
    const pasteBox = pasteBoxRef.current;
    if (!pasteBox) {
      return;
    }

    pasteBox.focus();

    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(pasteBox);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const replacePasteBoxContent = useCallback(
    (incoming: string) => {
      const sanitized = sanitizePastedHtml(incoming);
      const pasteBox = pasteBoxRef.current;
      if (!pasteBox) {
        return false;
      }

      pasteBox.innerHTML = sanitized;
      syncFromPasteBox();
      focusPasteBoxEnd();
      return true;
    },
    [focusPasteBoxEnd, syncFromPasteBox],
  );

  const handlePaste = useCallback(async () => {
    try {
      const source = await readClipboardSource();
      const incoming = source.html
        ? sanitizePastedHtml(source.html)
        : source.text
          ? source.text
              .replace(/\r\n/g, "\n")
              .replace(/\r/g, "\n")
              .split(/\n{2,}/)
              .map((paragraph) => paragraph.split("\n").join("<br>"))
              .map((paragraph) => `<p>${paragraph}</p>`)
              .join("\n")
          : "";

      if (!incoming) {
        showNotification("Clipboard is empty", "error");
        return;
      }

      replacePasteBoxContent(incoming);
    } catch {
      showNotification("Failed to read clipboard", "error");
    }
  }, [replacePasteBoxContent, showNotification]);

  const handleClear = useCallback(() => {
    if (pasteBoxRef.current) {
      pasteBoxRef.current.innerHTML = "";
      pasteBoxRef.current.focus();
    }
    setRawHtml("");
    setCopied(false);
  }, []);

  const shouldUseNativeCopy = useCallback(() => {
    const outputPanel = outputPanelRef.current;
    const activeElement = document.activeElement;

    if (!outputPanel || !(activeElement instanceof HTMLTextAreaElement)) {
      return false;
    }

    if (!outputPanel.contains(activeElement)) {
      return false;
    }

    return activeElement.selectionStart !== activeElement.selectionEnd;
  }, []);

  const getCopyValue = useCallback(() => {
    switch (activeTab) {
      case "html":
        return result.pretty;
      case "minified":
        return result.minified;
      case "markdown":
        return result.markdown;
      case "preview":
        return "";
    }
  }, [activeTab, result.markdown, result.minified, result.pretty]);

  const announceCopySuccess = useCallback(() => {
    if (activeTab === "preview") {
      return;
    }

    setCopied(true);
    showNotification(`${TAB_LABELS[activeTab]} copied`);
  }, [activeTab, showNotification]);

  const handleCopy = useCallback(async () => {
    const value = getCopyValue();
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      announceCopySuccess();
    } catch {
      showNotification("Failed to copy output", "error");
    }
  }, [announceCopySuccess, getCopyValue, showNotification]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleGlobalPaste = (event: ClipboardEvent) => {
      const incoming = getClipboardIncoming(event.clipboardData);
      if (!incoming) {
        return;
      }

      event.preventDefault();
      const replaced = replacePasteBoxContent(incoming);
      if (!replaced) {
        showNotification("Failed to paste into input", "error");
      }
    };

    const handleGlobalCopy = (event: ClipboardEvent) => {
      if (shouldUseNativeCopy()) {
        return;
      }

      const value = getCopyValue();
      if (!value || !event.clipboardData) {
        return;
      }

      event.preventDefault();
      event.clipboardData.setData("text/plain", value);
      announceCopySuccess();
    };

    document.addEventListener("paste", handleGlobalPaste, true);
    document.addEventListener("copy", handleGlobalCopy, true);

    return () => {
      document.removeEventListener("paste", handleGlobalPaste, true);
      document.removeEventListener("copy", handleGlobalCopy, true);
    };
  }, [
    announceCopySuccess,
    getCopyValue,
    isOpen,
    replacePasteBoxContent,
    shouldUseNativeCopy,
    showNotification,
  ]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          isMobile
            ? "h-[100dvh] w-screen max-w-none rounded-none border-0"
            : "h-[97vh] w-[98vw] max-h-[97vh] sm:max-w-[98vw]",
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          pasteBoxRef.current?.focus();
        }}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-4">
          <DialogTitle>Quick convert</DialogTitle>
        </DialogHeader>

        <div
          className={cn(
            "grid min-h-0 flex-1 gap-0 overflow-hidden",
            isMobile
              ? "grid-rows-[minmax(0,1fr)_minmax(0,1fr)]"
              : "grid-cols-2",
          )}
        >
          <div className="flex min-h-0 flex-col overflow-hidden border-b border-border md:border-b-0 md:border-r">
            <div className="shrink-0 border-b border-border px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SectionTitle>Input</SectionTitle>
                  <SectionDescription>
                    Paste rich text directly into the editor below.
                  </SectionDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handlePaste}>
                    Paste
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClear}>
                    <Eraser className="size-4" />
                    Clear
                  </Button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden p-4">
              <div
                ref={pasteBoxRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncFromPasteBox}
                className={cn(
                  "h-full min-h-0 overflow-y-auto rounded-lg border bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none transition-[border-color,box-shadow]",
                  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                  "empty:text-muted-foreground before:pointer-events-none before:text-muted-foreground before:content-[attr(data-placeholder)]",
                )}
                // data-placeholder="Paste page content here…"
              />
            </div>
          </div>

          <div
            ref={outputPanelRef}
            className="flex min-h-0 flex-col overflow-hidden"
          >
            <div className="shrink-0 border-b border-border px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SectionTitle>Output</SectionTitle>
                  <SectionDescription>
                    Switch between cleaned output formats and preview.
                  </SectionDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    disabled={!hasContent || activeTab === "preview"}
                  >
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Clipboard className="size-4" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden p-4">
              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as OutputTab)}
                className="flex h-full min-h-0 flex-col gap-0 overflow-hidden"
              >
                <TabsList className="mb-4 shrink-0 grid h-auto grid-cols-2 sm:grid-cols-4">
                  <TabsTrigger value="html">
                    <FileCode2 className="size-4" />
                    HTML
                  </TabsTrigger>
                  <TabsTrigger value="minified">
                    <Minimize2 className="size-4" />
                    Minified
                  </TabsTrigger>
                  <TabsTrigger value="markdown">
                    <ScanText className="size-4" />
                    Markdown
                  </TabsTrigger>
                  <TabsTrigger value="preview">
                    <Eye className="size-4" />
                    Preview
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="html"
                  className="min-h-0 flex-1 overflow-hidden"
                >
                  <Textarea
                    value={result.pretty}
                    readOnly
                    spellCheck={false}
                    className="h-full min-h-0 resize-none font-mono text-sm leading-6"
                  />
                </TabsContent>

                <TabsContent
                  value="minified"
                  className="min-h-0 flex-1 overflow-hidden"
                >
                  <Textarea
                    value={result.minified}
                    readOnly
                    spellCheck={false}
                    className="h-full min-h-0 resize-none font-mono text-sm leading-6"
                  />
                </TabsContent>

                <TabsContent
                  value="markdown"
                  className="min-h-0 flex-1 overflow-hidden"
                >
                  <Textarea
                    value={result.markdown}
                    readOnly
                    spellCheck={false}
                    className="h-full min-h-0 resize-none font-mono text-sm leading-6"
                  />
                </TabsContent>

                <TabsContent
                  value="preview"
                  className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-background"
                >
                  <iframe
                    title="Quick convert preview"
                    sandbox="allow-same-origin"
                    srcDoc={previewDocument}
                    className="h-full min-h-0 w-full bg-white"
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
