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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FolderOption {
  id: string;
  name: string;
  path: string;
}

interface MovePromptDialogProps {
  isOpen: boolean;
  promptName: string;
  folders: FolderOption[];
  currentFolderPath: string;
  selectedFolderId: string;
  onSelectedFolderIdChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

function displayFolderPath(path: string) {
  if (path === "/Workspace") return "/root";
  return path.replace("/Workspace/", "/root/");
}

export function MovePromptDialog({
  isOpen,
  promptName,
  folders,
  currentFolderPath,
  selectedFolderId,
  onSelectedFolderIdChange,
  onClose,
  onConfirm,
}: MovePromptDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Move template</DialogTitle>
          <DialogDescription>
            Choose a new location for &quot;{promptName}&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Move from</Label>
            <div className="flex min-h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground">
              {displayFolderPath(currentFolderPath)}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Move to</Label>
            <Select
              value={selectedFolderId}
              onValueChange={onSelectedFolderIdChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a destination folder" />
              </SelectTrigger>
              <SelectContent>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {displayFolderPath(folder.path)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!selectedFolderId}>
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
