"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { buildPrompt, buildPromptSegments } from "@/lib/prompt-forge/parser";
import type { Parameter, ParsedFile } from "@/lib/prompt-forge/types";
import {
  BookOpen,
  Code,
  Copy,
  FileText,
  Folder,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface MainContentProps {
  currentFile: ParsedFile | null;
  currentParams: Parameter[];
  isLoading: boolean;
  onOpenDocs: () => void;
  onOpenTemplate: () => void;
  onEditFile: () => void;
  onMoveFile: () => void;
  onDeleteFile: () => void;
  onExportFile: () => void;
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
  onEditFile,
  onMoveFile,
  onDeleteFile,
  onExportFile,
  showNotification,
  onToggleSidebar,
  isSidebarOpen,
}: MainContentProps) {
  const [formValues, setFormValues] = useState<Map<string, string>>(new Map());
  const [preview, setPreview] = useState<string>("");
  const [previewSegments, setPreviewSegments] = useState<
    { text: string; isUserValue: boolean; paramName?: string }[]
  >([]);

  const getFormStorageKey = useCallback((file: ParsedFile | null) => {
    if (!file?.id) return null;
    return `prompt-forge-form-values:${file.id}`;
  }, []);

  const saveFormValues = useCallback(
    (file: ParsedFile | null, values: Map<string, string>) => {
      const key = getFormStorageKey(file);
      if (!key) return;

      try {
        localStorage.setItem(key, JSON.stringify(Object.fromEntries(values)));
      } catch {}
    },
    [getFormStorageKey],
  );

  const loadFormValues = useCallback(
    (file: ParsedFile | null): Map<string, string> | null => {
      const key = getFormStorageKey(file);
      if (!key) return null;

      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Record<string, string>;
        return new Map(Object.entries(parsed));
      } catch {
        return null;
      }
    },
    [getFormStorageKey],
  );

  useEffect(() => {
    if (!currentFile) {
      setFormValues(new Map());
      return;
    }

    const defaultValues = new Map<string, string>();
    for (const param of currentParams) {
      defaultValues.set(param.name, param.defaultValue ?? "");
    }

    const savedValues = loadFormValues(currentFile);

    if (!savedValues) {
      setFormValues(defaultValues);
      return;
    }

    const mergedValues = new Map<string, string>();
    for (const param of currentParams) {
      mergedValues.set(
        param.name,
        savedValues.get(param.name) ?? param.defaultValue ?? "",
      );
    }

    setFormValues(mergedValues);
  }, [currentFile, currentParams, loadFormValues]);

  useEffect(() => {
    if (!currentFile) return;
    saveFormValues(currentFile, formValues);
  }, [currentFile, formValues, saveFormValues]);

  useEffect(() => {
    if (currentFile) {
      const segments = buildPromptSegments(
        currentFile.bodyContent,
        currentFile.content,
        formValues,
      );

      const prompt = buildPrompt(
        currentFile.bodyContent,
        currentFile.content,
        currentParams,
        formValues,
      );

      setPreviewSegments(segments);
      setPreview(prompt ?? "");
    } else {
      setPreviewSegments([]);
      setPreview("");
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

  return (
    <main className="flex-1 min-h-0 overflow-hidden">
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <Spinner className="h-8 w-8 mx-auto mb-3" />
            <p className="text-muted-foreground">Loading template...</p>
          </div>
        </div>
      ) : currentFile ? (
        <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-2">
          <section className="min-w-0 min-h-0 flex flex-col lg:border-r border-border">
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
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {currentFile.name}
                  </h2>
                </div>
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

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={onOpenTemplate}>
                      <Code className="h-4 w-4 mr-2" />
                      Template
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onEditFile}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onMoveFile}>
                      <Folder className="h-4 w-4 mr-2" />
                      Move to…
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onExportFile}>
                      <Copy className="h-4 w-4 mr-2" />
                      Export
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onDeleteFile}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4 md:p-6 space-y-6">
                  {currentParams.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      This template has no parameters. The content will be used
                      as-is.
                    </p>
                  ) : (
                    <div className="space-y-6">
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
          </section>

          <aside className="hidden lg:flex min-w-0 min-h-0 flex-col bg-muted/30">
            <div className="px-6 py-4.5 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-foreground">Preview</h2>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <div className="p-6 min-h-full">
                {preview ? (
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed break-words">
                    {previewSegments.map((segment, index) =>
                      segment.isUserValue ? (
                        <span
                          key={index}
                          className="rounded border border-primary/25 bg-primary/5 px-0.5 text-foreground"
                          title={
                            segment.paramName
                              ? `From: ${segment.paramName}`
                              : undefined
                          }
                        >
                          {segment.text}
                        </span>
                      ) : (
                        <span key={index}>{segment.text}</span>
                      ),
                    )}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No preview available.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
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
