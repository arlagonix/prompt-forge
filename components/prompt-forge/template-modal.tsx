"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] gap-0 p-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle>Template Source</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(85vh-80px)]">
          <pre className="bg-secondary p-4 rounded-b-md text-sm font-mono text-foreground whitespace-pre-wrap leading-relaxed">
            {content || "No content"}
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
