"use client";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface MobileTemplateTextareaProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

export const MobileTemplateTextarea = forwardRef<
  HTMLTextAreaElement,
  MobileTemplateTextareaProps
>(({ value, onChange, readOnly = false, placeholder }, ref) => {
  return (
    <Textarea
      ref={ref}
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      className={cn(
        "h-full min-h-0 resize-none rounded-none border-0 shadow-none",
        "bg-background px-4 py-3 font-mono text-[15px] leading-6",
        "focus-visible:border-transparent focus-visible:ring-0",
        "selection:bg-primary/20",
        readOnly && "cursor-text",
      )}
    />
  );
});

MobileTemplateTextarea.displayName = "MobileTemplateTextarea";
