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
import { AlertTriangle } from "lucide-react";

interface FolderDeleteDialogProps {
  isOpen: boolean;
  folderName: string;
  subfolderCount: number;
  promptCount: number;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

function buildDescription(
  folderName: string,
  subfolderCount: number,
  promptCount: number,
  isLoading: boolean,
) {
  if (isLoading) {
    return "Loading folder details...";
  }

  const parts: string[] = [];

  if (subfolderCount > 0) {
    parts.push(`${subfolderCount} subfolder${subfolderCount === 1 ? "" : "s"}`);
  }

  if (promptCount > 0) {
    parts.push(`${promptCount} template${promptCount === 1 ? "" : "s"}`);
  }

  const details = parts.length > 0 ? `, including ${parts.join(" and ")}` : "";

  return `This will permanently delete “${folderName}”${details}. This action cannot be undone.`;
}

export function FolderDeleteDialog({
  isOpen,
  folderName,
  subfolderCount,
  promptCount,
  isLoading,
  onClose,
  onConfirm,
}: FolderDeleteDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete folder and all contents?
          </DialogTitle>
          <DialogDescription>
            {buildDescription(
              folderName,
              subfolderCount,
              promptCount,
              isLoading,
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={isLoading}
          >
            Delete folder and contents
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
