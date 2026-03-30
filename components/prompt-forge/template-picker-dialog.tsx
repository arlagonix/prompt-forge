"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FileText } from "lucide-react";

export interface ReusableTemplateOption {
  id: string;
  name: string;
  content: string;
  path: string;
}

interface TemplatePickerDialogProps {
  isOpen: boolean;
  templates: ReusableTemplateOption[];
  onClose: () => void;
  onSelect: (template: ReusableTemplateOption) => void;
}

function displaySearchPath(path: string) {
  const normalized = path.replace(/^\/Workspace(?=\/|$)/, "");
  return normalized || "/";
}

export function TemplatePickerDialog({
  isOpen,
  templates,
  onClose,
  onSelect,
}: TemplatePickerDialogProps) {
  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Use Template"
      description="Choose a reusable template"
      className="sm:max-w-2xl"
      showCloseButton={false}
    >
      <CommandInput placeholder="Search reusable templates..." />
      <CommandList>
        <CommandEmpty>No reusable templates found.</CommandEmpty>
        <CommandGroup heading="Reusable Templates">
          {templates.map((template) => (
            <CommandItem
              key={template.id}
              value={`${template.name} ${displaySearchPath(template.path)}`}
              onSelect={() => {
                onSelect(template);
                onClose();
              }}
              className="flex items-start gap-3 py-3"
            >
              <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate">{template.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {displaySearchPath(template.path)}
                </p>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
