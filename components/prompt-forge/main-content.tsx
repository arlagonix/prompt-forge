"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { buildPrompt } from "@/lib/prompt-forge/parser";
import type { Parameter, ParsedFile } from "@/lib/prompt-forge/types";
import {
  BookOpen,
  Code,
  Copy,
  FileText,
  PanelLeft,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface MainContentProps {
  currentFile: ParsedFile | null;
  currentParams: Parameter[];
  isLoading: boolean;
  onOpenDocs: () => void;
  onOpenTemplate: () => void;
  showNotification: (message: string, type?: "success" | "error") => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
}

export function MainContent({
  currentFile,
  currentParams,
  isLoading,
  onOpenDocs,
  onOpenTemplate,
  showNotification,
  onToggleSidebar,
  isSidebarOpen,
}: MainContentProps) {
  const [formValues, setFormValues] = useState<Map<string, string>>(new Map());
  const [preview, setPreview] = useState<string>("");

  // Initialize form values when file changes
  useEffect(() => {
    if (currentFile && currentParams.length > 0) {
      const initialValues = new Map<string, string>();
      for (const param of currentParams) {
        initialValues.set(param.name, param.defaultValue ?? "");
      }
      setFormValues(initialValues);
    } else {
      setFormValues(new Map());
    }
  }, [currentFile, currentParams]);

  // Update preview when form values change
  useEffect(() => {
    if (currentFile) {
      const prompt = buildPrompt(
        currentFile.bodyContent,
        currentFile.content,
        currentParams,
        formValues,
      );
      setPreview(prompt ?? "");
    }
  }, [currentFile, currentParams, formValues]);

  const updateFormValue = useCallback((name: string, value: string) => {
    setFormValues((prev) => {
      const next = new Map(prev);
      next.set(name, value);
      return next;
    });
  }, []);

  const handleCopy = useCallback(async () => {
    if (!preview) {
      showNotification("No content to copy", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(preview);
      showNotification("Copied to clipboard!");
    } catch {
      showNotification("Failed to copy", "error");
    }
  }, [preview, showNotification]);

  const handleClear = useCallback(() => {
    const initialValues = new Map<string, string>();
    for (const param of currentParams) {
      initialValues.set(param.name, param.defaultValue ?? "");
    }
    setFormValues(initialValues);
  }, [currentParams]);

  // Global Ctrl+Enter to copy
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && currentFile) {
        e.preventDefault();
        handleCopy();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentFile, handleCopy]);

  const hasUserInput =
    formValues.size > 0 &&
    Array.from(formValues.entries()).some(([name, value]) => {
      const param = currentParams.find((p) => p.name === name);
      if (!param) return false;
      const defaultVal = param.defaultValue ?? "";
      return value !== defaultVal && value !== "";
    });

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          {!isSidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              className="h-8 w-8"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}
          {currentFile ? (
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {currentFile.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {currentFile.path}
              </p>
            </div>
          ) : (
            <h2 className="text-lg font-semibold text-foreground">
              Prompt Forge
            </h2>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenDocs}
            className="text-muted-foreground hover:text-foreground"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Docs
          </Button>
          {currentFile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenTemplate}
              className="text-muted-foreground hover:text-foreground"
            >
              <Code className="h-4 w-4 mr-2" />
              Template
            </Button>
          )}
        </div>
      </header>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Spinner className="h-8 w-8 mx-auto mb-3" />
            <p className="text-muted-foreground">Loading template...</p>
          </div>
        </div>
      ) : currentFile ? (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Form Section */}
          <div className="flex-1 flex flex-col overflow-hidden lg:border-r border-border">
            <ScrollArea className="flex-1">
              <div className="p-4 md:p-6 space-y-6">
                {/* Metadata */}
                {Object.keys(currentFile.metadata).length > 0 && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="bg-secondary px-4 py-2 border-b border-border">
                      <h3 className="text-sm font-medium text-foreground">
                        Metadata
                      </h3>
                    </div>
                    <div className="divide-y divide-border">
                      {Object.entries(currentFile.metadata).map(
                        ([key, value]) => (
                          <div key={key} className="flex">
                            <div className="w-32 shrink-0 px-4 py-2 bg-secondary/50 text-sm font-mono text-muted-foreground">
                              {key}
                            </div>
                            <div className="flex-1 px-4 py-2 text-sm text-foreground">
                              {Array.isArray(value)
                                ? value.join(", ")
                                : String(value)}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {/* Form Fields */}
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">
                      Parameters
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClear}
                      className="h-8 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3 w-3 mr-1.5" />
                      Reset
                    </Button>
                  </div>

                  {currentParams.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      This template has no parameters. The content will be used
                      as-is.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {currentParams.map((param) => (
                        <ParameterField
                          key={param.name}
                          param={param}
                          value={
                            formValues.get(param.name) ??
                            param.defaultValue ??
                            ""
                          }
                          onChange={(value) =>
                            updateFormValue(param.name, value)
                          }
                          onCopy={handleCopy}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Copy Button */}
                <div className="pt-2">
                  <Button onClick={handleCopy} className="w-full" size="lg">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Prompt
                  </Button>
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> to copy
                  </p>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Preview Section */}
          <div className="hidden lg:flex w-1/2 flex-col overflow-hidden max-w-xl border-t lg:border-t-0 border-border bg-muted/30">
            <div className="px-4 py-3 border-b border-border shrink-0 bg-card">
              <h3 className="text-sm font-medium text-foreground">Preview</h3>
            </div>
            <div className="flex-1 overflow-auto">
              <div className="p-4 min-h-full">
                {preview ? (
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed break-words">
                    {preview}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No preview available.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Select a template
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Choose a markdown template from the sidebar to get started
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
              <span>
                <Kbd>Ctrl</Kbd>+<Kbd>O</Kbd> Open folder
              </span>
              <span>
                <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd> Quick open
              </span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

interface ParameterFieldProps {
  param: Parameter;
  value: string;
  onChange: (value: string) => void;
  onCopy: () => void;
}

function ParameterField({
  param,
  value,
  onChange,
  onCopy,
}: ParameterFieldProps) {
  const id = `param-${param.name}`;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      if (param.type === "text" || param.type === "number") {
        e.preventDefault();
        onCopy();
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="text-sm font-medium text-foreground">
          {param.label}
        </Label>
        <code className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono text-muted-foreground">
          {`{{${param.name}}}`}
        </code>
      </div>

      {param.type === "textarea" && (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${param.label.toLowerCase()}...`}
          rows={param.height ?? 4}
          className="bg-card border-border resize-y min-h-[100px]"
          style={{
            minHeight: param.height ? `${param.height * 1.5}rem` : undefined,
          }}
        />
      )}

      {param.type === "text" && (
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Enter ${param.label.toLowerCase()}...`}
          className="bg-card border-border"
        />
      )}

      {param.type === "number" && (
        <Input
          id={id}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Enter ${param.label.toLowerCase()}...`}
          className="bg-card border-border"
        />
      )}

      {param.type === "checkbox" && (
        <div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
          <Checkbox
            id={id}
            checked={value === "true"}
            onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
          />
          <Label
            htmlFor={id}
            className="text-sm text-muted-foreground cursor-pointer"
          >
            {value === "true" ? "true" : "false"}
          </Label>
        </div>
      )}

      {param.type === "select" && (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="bg-card border-border">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {param.values.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {param.type === "radio" && (
        <RadioGroup
          value={value}
          onValueChange={onChange}
          className="space-y-2"
        >
          {param.values.map((v) => (
            <div key={v} className="flex items-center gap-2">
              <RadioGroupItem value={v} id={`${id}-${v}`} />
              <Label
                htmlFor={`${id}-${v}`}
                className="text-sm text-foreground cursor-pointer"
              >
                {v}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}
    </div>
  );
}
