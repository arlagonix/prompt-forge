"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Copy, FileText, X } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { TemplateMonacoEditor } from "./template-monaco-editor";

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
  const isMobile = useIsMobile();

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
        className={cn(
          "overflow-hidden p-0",
          isMobile
            ? "h-[100dvh] w-screen max-w-none rounded-none border-0"
            : "h-[92vh]",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Template Source</DialogTitle>
        </DialogHeader>

        <div className="flex h-full min-h-0 flex-col bg-background">
          <header
            className={cn(
              "shrink-0 border-b border-border bg-card px-4 py-3",
              isMobile ? "space-y-3" : "flex items-center justify-between",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="text-sm font-medium text-foreground">
                Template Source
              </div>
            </div>

            <div
              className={cn(
                "shrink-0 gap-2",
                isMobile ? "grid grid-cols-2" : "flex items-center",
              )}
            >
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

          <div className="min-h-0 flex-1 overflow-hidden bg-background">
            <TemplateMonacoEditor initialValue={content || ""} readOnly />
          </div>

          <footer className="shrink-0 border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
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
            </div>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
