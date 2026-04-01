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
import {
  buildPromptFromTemplate,
  buildPromptSegmentsFromTemplate,
  createInitialScopeState,
  parseTemplate,
  type PromptSegment,
} from "@/lib/prompt-forge/parser";
import type {
  Parameter,
  ParsedFile,
  ParsedTemplate,
  TemplateFieldDefinition,
  TemplateGroupDefinition,
  TemplateRenderItem,
  TemplateScopeState,
} from "@/lib/prompt-forge/types";
import {
  BookOpen,
  Code,
  Copy,
  FileText,
  Folder,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Plus,
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

type GroupPathSegment = { groupName: string; index: number };

function cloneScopeState(state: TemplateScopeState): TemplateScopeState {
  return {
    fields: { ...state.fields },
    groups: Object.fromEntries(
      Object.entries(state.groups).map(([name, instances]) => [
        name,
        instances.map(cloneScopeState),
      ]),
    ),
  };
}

function normalizeLoadedScopeState(
  group: TemplateGroupDefinition,
  raw: unknown,
): TemplateScopeState {
  const base = createInitialScopeState(group);
  if (!raw || typeof raw !== "object") return base;

  const item = raw as {
    fields?: Record<string, unknown>;
    groups?: Record<string, unknown>;
  };

  for (const renderItem of group.renderOrder) {
    if (renderItem.kind === "field") {
      const rawValue = item.fields?.[renderItem.field.name];
      base.fields[renderItem.field.name] =
        rawValue == null ? base.fields[renderItem.field.name] : String(rawValue);
      continue;
    }

    const rawInstances = item.groups?.[renderItem.group.name];
    const instances = Array.isArray(rawInstances) ? rawInstances : [];
    const normalized =
      instances.length > 0
        ? instances.map((instance) =>
            normalizeLoadedScopeState(renderItem.group, instance),
          )
        : [createInitialScopeState(renderItem.group)];

    base.groups[renderItem.group.name] = renderItem.group.repeat
      ? normalized
      : [normalized[0]];
  }

  return base;
}

function updateScopeAtPath(
  rootState: TemplateScopeState,
  path: GroupPathSegment[],
  updater: (scope: TemplateScopeState) => TemplateScopeState,
): TemplateScopeState {
  if (path.length === 0) {
    return updater(cloneScopeState(rootState));
  }

  const nextRoot = cloneScopeState(rootState);
  let current = nextRoot;

  for (let i = 0; i < path.length - 1; i += 1) {
    const segment = path[i];
    current = current.groups[segment.groupName][segment.index];
  }

  const last = path[path.length - 1];
  current.groups[last.groupName][last.index] = updater(
    cloneScopeState(current.groups[last.groupName][last.index]),
  );

  return nextRoot;
}

function countRenderedItems(group: TemplateGroupDefinition): number {
  return group.renderOrder.length;
}

interface GroupEditorProps {
  group: TemplateGroupDefinition;
  state: TemplateScopeState;
  path: GroupPathSegment[];
  onFieldChange: (path: GroupPathSegment[], fieldName: string, value: string) => void;
  onAddGroupInstance: (path: GroupPathSegment[], group: TemplateGroupDefinition) => void;
  onRemoveGroupInstance: (
    path: GroupPathSegment[],
    groupName: string,
    index: number,
  ) => void;
  onCopy: () => void;
}

function GroupEditor({
  group,
  state,
  path,
  onFieldChange,
  onAddGroupInstance,
  onRemoveGroupInstance,
  onCopy,
}: GroupEditorProps) {
  const renderItem = useCallback(
    (item: TemplateRenderItem) => {
      if (item.kind === "field") {
        return (
          <ParameterField
            key={`field-${item.field.name}`}
            param={item.field}
            value={state.fields[item.field.name] ?? item.field.defaultValue ?? ""}
            onChange={(value) => onFieldChange(path, item.field.name, value)}
            onCopy={onCopy}
          />
        );
      }

      const instances =
        state.groups[item.group.name] ?? [createInitialScopeState(item.group)];
      return (
        <div
          key={`group-${item.group.name}`}
          className="rounded-xl border border-border bg-card/60 p-4 space-y-4"
        >
          <div>
            <div className="text-sm font-semibold text-foreground">
              {item.group.label}
            </div>
            <code className="text-xs text-muted-foreground">{`{{ ${item.group.name}:start }}`}</code>
          </div>

          {instances.map((instanceState, index) => {
            const instancePath = [...path, { groupName: item.group.name, index }];
            const canRemove = item.group.repeat && instances.length > 1;
            const innerClass = item.group.repeat
              ? "rounded-lg border border-border/70 bg-background p-4 space-y-4"
              : "space-y-4";

            return (
              <div key={`${item.group.name}-${index}`} className={innerClass}>
                <GroupEditor
                  group={item.group}
                  state={instanceState}
                  path={instancePath}
                  onFieldChange={onFieldChange}
                  onAddGroupInstance={onAddGroupInstance}
                  onRemoveGroupInstance={onRemoveGroupInstance}
                  onCopy={onCopy}
                />

                {item.group.repeat && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={!canRemove}
                    onClick={() =>
                      onRemoveGroupInstance(path, item.group.name, index)
                    }
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
            );
          })}

          {item.group.repeat && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => onAddGroupInstance(path, item.group)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          )}
        </div>
      );
    },
    [
      onAddGroupInstance,
      onCopy,
      onFieldChange,
      onRemoveGroupInstance,
      path,
      state.fields,
      state.groups,
    ],
  );

  return <div className="space-y-6">{group.renderOrder.map(renderItem)}</div>;
}

export function MainContent({
  currentFile,
  currentParams: _currentParams,
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
  const [parsedTemplate, setParsedTemplate] = useState<ParsedTemplate | null>(null);
  const [templateState, setTemplateState] = useState<TemplateScopeState | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [previewSegments, setPreviewSegments] = useState<PromptSegment[]>([]);

  const getFormStorageKey = useCallback((file: ParsedFile | null) => {
    if (!file?.id) return null;
    return `prompt-forge-form-values:${file.id}`;
  }, []);

  const saveFormValues = useCallback(
    (file: ParsedFile | null, values: TemplateScopeState | null) => {
      const key = getFormStorageKey(file);
      if (!key || !values) return;
      try {
        localStorage.setItem(key, JSON.stringify(values));
      } catch {}
    },
    [getFormStorageKey],
  );

  const loadFormValues = useCallback(
    (file: ParsedFile | null): unknown | null => {
      const key = getFormStorageKey(file);
      if (!key) return null;
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    [getFormStorageKey],
  );

  useEffect(() => {
    if (!currentFile) {
      setParsedTemplate(null);
      setTemplateState(null);
      setParseError(null);
      return;
    }

    try {
      const nextTemplate = parseTemplate(currentFile.content);
      const savedValues = loadFormValues(currentFile);
      const nextState = normalizeLoadedScopeState(
        nextTemplate.rootGroup,
        savedValues,
      );
      setParsedTemplate(nextTemplate);
      setTemplateState(nextState);
      setParseError(null);
    } catch (error) {
      setParsedTemplate(null);
      setTemplateState(null);
      setParseError(
        error instanceof Error ? error.message : "Failed to parse template.",
      );
    }
  }, [currentFile, loadFormValues]);

  useEffect(() => {
    if (!currentFile || !templateState || parseError) return;
    saveFormValues(currentFile, templateState);
  }, [currentFile, parseError, saveFormValues, templateState]);

  useEffect(() => {
    if (!currentFile) {
      setPreview("");
      setPreviewSegments([]);
      return;
    }

    if (parseError || !parsedTemplate || !templateState) {
      const fallback = currentFile.bodyContent || currentFile.content || "";
      setPreview(fallback);
      setPreviewSegments([{ text: fallback, isUserValue: false }]);
      return;
    }

    setPreviewSegments(buildPromptSegmentsFromTemplate(parsedTemplate, templateState));
    setPreview(buildPromptFromTemplate(parsedTemplate, templateState));
  }, [currentFile, parseError, parsedTemplate, templateState]);

  const updateFieldValue = useCallback(
    (path: GroupPathSegment[], fieldName: string, value: string) => {
      setTemplateState((prev) => {
        if (!prev) return prev;
        return updateScopeAtPath(prev, path, (scope) => ({
          ...scope,
          fields: {
            ...scope.fields,
            [fieldName]: value,
          },
        }));
      });
    },
    [],
  );

  const addGroupInstance = useCallback(
    (path: GroupPathSegment[], group: TemplateGroupDefinition) => {
      setTemplateState((prev) => {
        if (!prev) return prev;
        return updateScopeAtPath(prev, path, (scope) => ({
          ...scope,
          groups: {
            ...scope.groups,
            [group.name]: [...(scope.groups[group.name] ?? []), createInitialScopeState(group)],
          },
        }));
      });
    },
    [],
  );

  const removeGroupInstance = useCallback(
    (path: GroupPathSegment[], groupName: string, index: number) => {
      setTemplateState((prev) => {
        if (!prev) return prev;
        return updateScopeAtPath(prev, path, (scope) => {
          const current = scope.groups[groupName] ?? [];
          if (current.length <= 1) return scope;
          return {
            ...scope,
            groups: {
              ...scope.groups,
              [groupName]: current.filter((_, currentIndex) => currentIndex !== index),
            },
          };
        });
      });
    },
    [],
  );

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
    if (!parsedTemplate) return;
    setTemplateState(createInitialScopeState(parsedTemplate.rootGroup));
  }, [parsedTemplate]);

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

  const hasVisibleInputs =
    parsedTemplate != null && countRenderedItems(parsedTemplate.rootGroup) > 0;

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
                  disabled={!parsedTemplate || !!parseError}
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
                  {parseError ? (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                      <div className="font-medium mb-1">Template parse error</div>
                      <div>{parseError}</div>
                    </div>
                  ) : !parsedTemplate || !templateState || !hasVisibleInputs ? (
                    <p className="text-sm text-muted-foreground py-4">
                      This template has no parameters. The content will be used
                      as-is.
                    </p>
                  ) : (
                    <GroupEditor
                      group={parsedTemplate.rootGroup}
                      state={templateState}
                      path={[]}
                      onFieldChange={updateFieldValue}
                      onAddGroupInstance={addGroupInstance}
                      onRemoveGroupInstance={removeGroupInstance}
                      onCopy={handleCopy}
                    />
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
  param: TemplateFieldDefinition;
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
      <div className="flex items-center gap-2 flex-wrap">
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
        <RadioGroup value={value} onValueChange={onChange} className="space-y-2">
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
