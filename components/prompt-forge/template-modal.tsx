"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, FileText, X } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}

export function TemplateModal({
  isOpen,
  onClose,
  content,
}: TemplateModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (scrollRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollRef.current.scrollTop;
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!content) {
      toast.error("No content to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      toast.success("Copied to clipboard!");
    } catch {
      toast.error("Failed to copy");
    }
  }, [content]);

  const lineCount = useMemo(
    () => Math.max(1, content.split("\n").length),
    [content],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="h-[92vh] overflow-hidden p-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Template Source</DialogTitle>
        </DialogHeader>

        <div className="flex h-full min-h-0 flex-col bg-background">
          <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="text-sm font-medium text-foreground">
                Template Source
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="mr-1.5 h-4 w-4" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="mr-1.5 h-4 w-4" />
                Close
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

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 min-h-0 overflow-auto bg-background"
            >
              <pre className="min-h-full whitespace-pre-wrap p-3 font-mono text-sm leading-6 text-foreground">
                {content || "No content"}
              </pre>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
