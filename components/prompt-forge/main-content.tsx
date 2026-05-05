"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  readClipboardSource,
  readClipboardSourceFromDataTransfer,
  transformClipboardSource,
  type ClipboardImportFormat,
} from "@/lib/prompt-forge/clipboard-import";
import {
  buildFolderImportValue,
  readDroppedFolderImportContents,
  readFolderImportContents,
} from "@/lib/prompt-forge/folder-import";
import {
  buildPromptFromTemplate,
  buildPromptSegmentsFromTemplate,
  createInitialScopeState,
  parseTemplate,
  type PromptSegment,
} from "@/lib/prompt-forge/parser";
import type {
  Parameter,
  ParameterOption,
  ParameterOptionGroup,
  ParsedFile,
  ParsedTemplate,
  TemplateFieldDefinition,
  TemplateGroupDefinition,
  TemplateRenderItem,
  TemplateScopeState,
} from "@/lib/prompt-forge/types";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Check,
  ChevronsUpDown,
  Code,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Folder,
  Highlighter,
  MoreHorizontal,
  PanelLeftOpen,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type PreviewLinePart = {
  text: string;
  isUserValue: boolean;
  paramName?: string;
};


const PREVIEW_DEBOUNCE_MS = 250;
const MAX_RENDERED_PREVIEW_CHARS = 30_000;


function useDebouncedValue<T>(
  value: T,
  delayMs: number,
  immediateKey: unknown,
): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const immediateKeyRef = useRef(immediateKey);

  useEffect(() => {
    if (immediateKeyRef.current !== immediateKey) {
      immediateKeyRef.current = immediateKey;
      setDebouncedValue(value);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [value, delayMs, immediateKey]);

  return debouncedValue;
}

function getSegmentsTextLength(segments: PromptSegment[]): number {
  return segments.reduce((total, segment) => total + segment.text.length, 0);
}

function truncatePreviewSegments(
  segments: PromptSegment[],
  maxLength: number,
): PromptSegment[] {
  if (maxLength <= 0) return [];

  const truncated: PromptSegment[] = [];
  let remaining = maxLength;

  for (const segment of segments) {
    if (remaining <= 0) break;

    if (segment.text.length <= remaining) {
      truncated.push(segment);
      remaining -= segment.text.length;
      continue;
    }

    truncated.push({
      ...segment,
      text: segment.text.slice(0, remaining),
    });
    break;
  }

  return truncated;
}

function getFieldOptionGroups(
  param: TemplateFieldDefinition,
): ParameterOptionGroup[] {
  if (param.optionGroups.length > 0) {
    return param.optionGroups;
  }

  if (param.values.length === 0) {
    return [];
  }

  return [
    {
      label: null,
      options: param.values.map((value) => ({ label: value, value })),
    },
  ];
}

function findFieldOptionByValue(
  param: TemplateFieldDefinition,
  value: string,
): ParameterOption | null {
  for (const group of getFieldOptionGroups(param)) {
    const match = group.options.find((option) => option.value === value);
    if (match) return match;
  }
  return null;
}

function buildPreviewLines(segments: PromptSegment[]): PreviewLinePart[][] {
  if (segments.length === 0) return [];

  const lines: PreviewLinePart[][] = [[]];

  for (const segment of segments) {
    const parts = segment.text.split("\n");

    parts.forEach((part, index) => {
      if (part.length > 0) {
        lines[lines.length - 1].push({
          text: part,
          isUserValue: segment.isUserValue,
          paramName: segment.paramName,
        });
      } else if (segment.isUserValue) {
        lines[lines.length - 1].push({
          text: "",
          isUserValue: true,
          paramName: segment.paramName,
        });
      }

      if (index < parts.length - 1) {
        lines.push([]);
      }
    });
  }

  return lines;
}

function PromptPreview({
  segments,
  preview,
  className = "",
  showHighlights = true,
  isTruncated = false,
}: {
  segments: PromptSegment[];
  preview: string;
  className?: string;
  showHighlights?: boolean;
  isTruncated?: boolean;
}) {
  if (!preview) {
    return (
      <p className="text-sm italic text-muted-foreground">
        No preview available.
      </p>
    );
  }

  const lines = buildPreviewLines(segments);

  return (
    <div className={className}>
      {isTruncated && (
        <div className="mb-4 rounded-lg border border-dashed border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
          Preview truncated due to large length. Copy still uses the full prompt.
        </div>
      )}
      <div className="font-mono text-sm leading-relaxed text-foreground">
        {lines.map((line, lineIndex) => {
          const hasContent = line.length > 0;

          return (
            <div
              key={lineIndex}
              className="min-h-[1.6em] whitespace-pre-wrap break-words"
            >
              {hasContent ? (
                line.map((part, partIndex) =>
                  part.isUserValue ? (
                    <span
                      key={partIndex}
                      className={cn(
                        showHighlights &&
                          "rounded border border-primary/50 bg-primary/15 px-0.5 text-foreground [box-decoration-break:clone] [-webkit-box-decoration-break:clone]",
                      )}
                      title={
                        part.paramName ? `From: ${part.paramName}` : undefined
                      }
                    >
                      {part.text === "" ? " " : part.text}
                    </span>
                  ) : (
                    <span key={partIndex}>{part.text}</span>
                  ),
                )
              ) : (
                <span> </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MainContentProps {
  currentFile: ParsedFile | null;
  currentParams: Parameter[];
  isLoading: boolean;
  onOpenDocs: () => void;
  onOpenTemplate: () => void;
  onEditFile: () => void;
  onMoveFile: () => void;
  onDeleteFile: () => void;
  onCopyTemplate: () => void;
  onExportFile: () => void;
  onCreateFile: () => void;
  showNotification: (message: string, type?: "success" | "error") => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onSetPreviewOpen: (isOpen: boolean) => void;
  isPreviewOpen: boolean;
}

type GroupPathSegment = { groupName: string; index: number };
type ClipboardUiState = {
  clipboardFormats: Record<string, ClipboardImportFormat>;
};

const DEFAULT_CLIPBOARD_UI_STATE: ClipboardUiState = {
  clipboardFormats: {},
};

function isClipboardImportFormatValue(
  value: unknown,
): value is ClipboardImportFormat {
  return value === "html" || value === "minified" || value === "markdown" || value === "plain_text";
}

function normalizeClipboardUiState(raw: unknown): ClipboardUiState {
  if (!raw || typeof raw !== "object") return DEFAULT_CLIPBOARD_UI_STATE;

  const item = raw as { clipboardFormats?: Record<string, unknown> };
  const clipboardFormats = Object.fromEntries(
    Object.entries(item.clipboardFormats ?? {}).filter(([, value]) =>
      isClipboardImportFormatValue(value),
    ),
  ) as Record<string, ClipboardImportFormat>;

  return { clipboardFormats };
}

function buildScopePathKey(
  path: GroupPathSegment[],
  fieldName: string,
): string {
  if (path.length === 0) return `root/${fieldName}`;

  return `${path
    .map((segment) => `${segment.groupName}[${segment.index}]`)
    .join("/")}/${fieldName}`;
}

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
        rawValue == null
          ? base.fields[renderItem.field.name]
          : String(rawValue);
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
  clipboardFormats: Record<string, ClipboardImportFormat>;
  onClipboardFormatChange: (
    pathKey: string,
    format: ClipboardImportFormat,
  ) => void;
  group: TemplateGroupDefinition;
  state: TemplateScopeState;
  path: GroupPathSegment[];
  onFieldChange: (
    path: GroupPathSegment[],
    fieldName: string,
    value: string,
  ) => void;
  onAddGroupInstance: (
    path: GroupPathSegment[],
    group: TemplateGroupDefinition,
  ) => void;
  onRemoveGroupInstance: (
    path: GroupPathSegment[],
    groupName: string,
    index: number,
  ) => void;
  onCopy: () => void;
  showTechnicalNames: boolean;
  showNotification: (message: string, type?: "success" | "error") => void;
}

function GroupEditor({
  group,
  state,
  path,
  onFieldChange,
  onAddGroupInstance,
  onRemoveGroupInstance,
  onCopy,
  showTechnicalNames,
  clipboardFormats,
  onClipboardFormatChange,
  showNotification,
}: GroupEditorProps) {
  const renderItem = useCallback(
    (item: TemplateRenderItem) => {
      if (item.kind === "field") {
        return (
          <ParameterField
            key={`field-${item.field.name}`}
            param={item.field}
            pathKey={buildScopePathKey(path, item.field.name)}
            clipboardFormat={
              item.field.clipboardImport?.formats.includes(
                clipboardFormats[buildScopePathKey(path, item.field.name)] ??
                  item.field.clipboardImport?.defaultFormat ??
                  "markdown",
              )
                ? (clipboardFormats[buildScopePathKey(path, item.field.name)] ??
                  item.field.clipboardImport?.defaultFormat ??
                  "markdown")
                : (item.field.clipboardImport?.defaultFormat ?? "markdown")
            }
            onClipboardFormatChange={onClipboardFormatChange}
            value={
              state.fields[item.field.name] ?? item.field.defaultValue ?? ""
            }
            onChange={(value) => onFieldChange(path, item.field.name, value)}
            onCopy={onCopy}
            showTechnicalNames={showTechnicalNames}
            showNotification={showNotification}
          />
        );
      }

      const instances = state.groups[item.group.name] ?? [
        createInitialScopeState(item.group),
      ];
      return (
        <div
          key={`group-${item.group.name}`}
          className="rounded-xl border border-border bg-card/60 p-4 space-y-4"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-semibold text-foreground">
              {item.group.label}
            </div>
            {showTechnicalNames && (
              <code className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono text-muted-foreground">
                {`{{${item.group.name}:start}}`}
              </code>
            )}
          </div>

          {instances.map((instanceState, index) => {
            const instancePath = [
              ...path,
              { groupName: item.group.name, index },
            ];
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
                  showTechnicalNames={showTechnicalNames}
                  clipboardFormats={clipboardFormats}
                  onClipboardFormatChange={onClipboardFormatChange}
                  showNotification={showNotification}
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
      showTechnicalNames,
      state.fields,
      state.groups,
      clipboardFormats,
      onClipboardFormatChange,
      showNotification,
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
  onCopyTemplate,
  onExportFile,
  showNotification,
  onToggleSidebar,
  isSidebarOpen,
  onSetPreviewOpen,
  isPreviewOpen,
  onCreateFile,
}: MainContentProps) {
  const [parsedTemplate, setParsedTemplate] = useState<ParsedTemplate | null>(
    null,
  );
  const [templateState, setTemplateState] = useState<TemplateScopeState | null>(
    null,
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [previewSegments, setPreviewSegments] = useState<PromptSegment[]>([]);
  const [isPreviewTruncated, setIsPreviewTruncated] = useState(false);
  const [showTechnicalNames, setShowTechnicalNames] = useState<boolean>(true);
  const [clipboardUiState, setClipboardUiState] = useState<ClipboardUiState>(
    DEFAULT_CLIPBOARD_UI_STATE,
  );
  const [showPreviewHighlights, setShowPreviewHighlights] =
    useState<boolean>(true);
  const actionsMenuSuppressRestoreFocusRef = useRef(false);
  const isMobile = useIsMobile();
  const debouncedTemplateState = useDebouncedValue(
    templateState,
    PREVIEW_DEBOUNCE_MS,
    currentFile?.id ?? null,
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem("prompt-forge-show-tech-names");
      if (raw != null) setShowTechnicalNames(raw === "true");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "prompt-forge-show-tech-names",
        showTechnicalNames ? "true" : "false",
      );
    } catch {}
  }, [showTechnicalNames]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("prompt-forge-show-preview-highlights");
      if (raw != null) setShowPreviewHighlights(raw === "true");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "prompt-forge-show-preview-highlights",
        showPreviewHighlights ? "true" : "false",
      );
    } catch {}
  }, [showPreviewHighlights]);

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

  const getClipboardUiStorageKey = useCallback((file: ParsedFile | null) => {
    if (!file?.id) return null;
    return `prompt-forge-field-ui:${file.id}`;
  }, []);

  const saveClipboardUiState = useCallback(
    (file: ParsedFile | null, value: ClipboardUiState) => {
      const key = getClipboardUiStorageKey(file);
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    },
    [getClipboardUiStorageKey],
  );

  const loadClipboardUiState = useCallback(
    (file: ParsedFile | null): ClipboardUiState => {
      const key = getClipboardUiStorageKey(file);
      if (!key) return DEFAULT_CLIPBOARD_UI_STATE;
      try {
        const raw = localStorage.getItem(key);
        return raw
          ? normalizeClipboardUiState(JSON.parse(raw))
          : DEFAULT_CLIPBOARD_UI_STATE;
      } catch {
        return DEFAULT_CLIPBOARD_UI_STATE;
      }
    },
    [getClipboardUiStorageKey],
  );

  useEffect(() => {
    if (!currentFile) {
      setParsedTemplate(null);
      setTemplateState(null);
      setClipboardUiState(DEFAULT_CLIPBOARD_UI_STATE);
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
      setClipboardUiState(loadClipboardUiState(currentFile));
      setParseError(null);
    } catch (error) {
      setParsedTemplate(null);
      setTemplateState(null);
      setClipboardUiState(DEFAULT_CLIPBOARD_UI_STATE);
      setParseError(
        error instanceof Error ? error.message : "Failed to parse template.",
      );
    }
  }, [currentFile, loadClipboardUiState, loadFormValues]);

  useEffect(() => {
    if (!currentFile || !templateState || parseError) return;
    saveFormValues(currentFile, templateState);
  }, [currentFile, parseError, saveFormValues, templateState]);

  useEffect(() => {
    if (!currentFile) return;
    saveClipboardUiState(currentFile, clipboardUiState);
  }, [clipboardUiState, currentFile, saveClipboardUiState]);

  useEffect(() => {
    if (!currentFile) {
      setPreview("");
      setPreviewSegments([]);
      setIsPreviewTruncated(false);
      return;
    }

    if (parseError || !parsedTemplate || !debouncedTemplateState) {
      const fallback = currentFile.bodyContent || currentFile.content || "";
      const isFallbackTruncated = fallback.length > MAX_RENDERED_PREVIEW_CHARS;
      const visibleFallback = fallback.slice(0, MAX_RENDERED_PREVIEW_CHARS);
      setPreview(visibleFallback);
      setPreviewSegments([{ text: visibleFallback, isUserValue: false }]);
      setIsPreviewTruncated(isFallbackTruncated);
      return;
    }

    const nextSegments = buildPromptSegmentsFromTemplate(
      parsedTemplate,
      debouncedTemplateState,
    );
    const isTruncated =
      getSegmentsTextLength(nextSegments) > MAX_RENDERED_PREVIEW_CHARS;
    const visibleSegments = isTruncated
      ? truncatePreviewSegments(nextSegments, MAX_RENDERED_PREVIEW_CHARS)
      : nextSegments;

    setPreviewSegments(visibleSegments);
    setPreview(visibleSegments.map((segment) => segment.text).join(""));
    setIsPreviewTruncated(isTruncated);
  }, [currentFile, debouncedTemplateState, parseError, parsedTemplate]);

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
            [group.name]: [
              ...(scope.groups[group.name] ?? []),
              createInitialScopeState(group),
            ],
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
              [groupName]: current.filter(
                (_, currentIndex) => currentIndex !== index,
              ),
            },
          };
        });
      });
    },
    [],
  );

  const handleClipboardFormatChange = useCallback(
    (pathKey: string, format: ClipboardImportFormat) => {
      setClipboardUiState((prev) => ({
        clipboardFormats: {
          ...prev.clipboardFormats,
          [pathKey]: format,
        },
      }));
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    const fullPrompt =
      currentFile && !parseError && parsedTemplate && templateState
        ? buildPromptFromTemplate(parsedTemplate, templateState)
        : currentFile?.bodyContent || currentFile?.content || "";

    if (!fullPrompt) {
      showNotification("No content to copy", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(fullPrompt);
      showNotification("Copied to clipboard!");
    } catch {
      showNotification("Failed to copy", "error");
    }
  }, [currentFile, parseError, parsedTemplate, showNotification, templateState]);

  const handleClear = useCallback(() => {
    if (!parsedTemplate) return;
    setTemplateState(createInitialScopeState(parsedTemplate.rootGroup));
  }, [parsedTemplate]);

  const handleToggleTechnicalNames = useCallback(() => {
    setShowTechnicalNames((prev) => !prev);
  }, []);

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

  const isPreviewUpdating =
    currentFile != null &&
    !parseError &&
    templateState != null &&
    debouncedTemplateState !== templateState;
  const centeredMainContentClassName =
    !isMobile && !isPreviewOpen ? "mx-auto w-full max-w-3xl" : undefined;

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
        <div
          className={cn(
            "h-full min-h-0",
            isMobile
              ? "grid grid-cols-1"
              : isPreviewOpen
                ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
                : "block",
          )}
        >
          <section
            className={cn(
              "min-w-0 min-h-0 h-full flex flex-col bg-background",
              isPreviewOpen ? "border-r border-border" : "w-full",
            )}
          >
            <header className="border-b border-border shrink-0">
              <div
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4",
                  centeredMainContentClassName,
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {isMobile && !isSidebarOpen && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onToggleSidebar}
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label="Show menu"
                      title="Show menu"
                    >
                      <PanelLeftOpen className="h-4 w-4" />
                    </Button>
                  )}

                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-foreground md:text-lg">
                      {currentFile.name}
                    </h2>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {!isMobile && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onOpenDocs}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <BookOpen className="mr-2 h-4 w-4" />
                        Docs
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="text-muted-foreground hover:text-foreground"
                        disabled={!parsedTemplate || !!parseError}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset
                      </Button>
                    </>
                  )}

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
                    <DropdownMenuContent
                      align="end"
                      className="w-48"
                      onCloseAutoFocus={(e) => {
                        if (actionsMenuSuppressRestoreFocusRef.current) {
                          e.preventDefault();
                          actionsMenuSuppressRestoreFocusRef.current = false;
                        }
                      }}
                    >
                      {isMobile && (
                        <>
                          <DropdownMenuItem onClick={onOpenDocs}>
                            <BookOpen className="mr-2 h-4 w-4" />
                            Docs
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={handleClear}
                            disabled={!parsedTemplate || !!parseError}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reset
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        onSelect={() => {
                          actionsMenuSuppressRestoreFocusRef.current = true;
                          setTimeout(() => {
                            onEditFile();
                          }, 0);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onOpenTemplate}>
                        <Code className="mr-2 h-4 w-4" />
                        View source
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onMoveFile}>
                        <Folder className="mr-2 h-4 w-4" />
                        Move to…
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onCopyTemplate}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy template source
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onExportFile}>
                        <Upload className="mr-2 h-4 w-4" />
                        Export
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleToggleTechnicalNames}>
                        {showTechnicalNames ? (
                          <EyeOff className="mr-2 h-4 w-4" />
                        ) : (
                          <Eye className="mr-2 h-4 w-4" />
                        )}
                        {showTechnicalNames
                          ? "Hide tech names"
                          : "Show tech names"}
                      </DropdownMenuItem>
                      {!isSidebarOpen && (
                        <DropdownMenuItem onClick={onToggleSidebar}>
                          <Eye className="mr-2 h-4 w-4" />
                          Show menu
                        </DropdownMenuItem>
                      )}
                      {!isPreviewOpen && (
                        <DropdownMenuItem
                          onClick={() => onSetPreviewOpen(true)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Show preview
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={onDeleteFile}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div
                  className={cn(
                    "p-4 md:p-6 space-y-6",
                    centeredMainContentClassName,
                  )}
                >
                  {parseError ? (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                      <div className="font-medium mb-1">
                        Template parse error
                      </div>
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
                      showTechnicalNames={showTechnicalNames}
                      clipboardFormats={clipboardUiState.clipboardFormats}
                      onClipboardFormatChange={handleClipboardFormatChange}
                      showNotification={showNotification}
                    />
                  )}

                  <div className="pt-2">
                    <Button onClick={handleCopy} className="w-full" size="lg">
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Prompt
                    </Button>
                    {!isMobile && (
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> to copy
                      </p>
                    )}
                  </div>

                  {isMobile && isPreviewOpen && (
                    <section className="rounded-xl border border-border bg-muted/30">
                      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-semibold text-foreground">
                            Preview
                          </h2>
                          {isPreviewUpdating && (
                            <Spinner
                              className="h-3.5 w-3.5 text-muted-foreground"
                              aria-label="Updating preview"
                            />
                          )}
                        </div>
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
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem
                              onClick={() =>
                                setShowPreviewHighlights((value) => !value)
                              }
                            >
                              {showPreviewHighlights ? (
                                <EyeOff className="mr-2 h-4 w-4" />
                              ) : (
                                <Highlighter className="mr-2 h-4 w-4" />
                              )}
                              {showPreviewHighlights
                                ? "Hide highlights"
                                : "Show highlights"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onSetPreviewOpen(false)}
                            >
                              <EyeOff className="mr-2 h-4 w-4" />
                              Hide preview
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="max-h-[50vh] overflow-auto p-4">
                        <PromptPreview
                          preview={preview}
                          segments={previewSegments}
                          showHighlights={showPreviewHighlights}
                          isTruncated={isPreviewTruncated}
                        />
                      </div>
                    </section>
                  )}
                </div>
              </ScrollArea>
            </div>
          </section>

          {isPreviewOpen && (
            <aside className="hidden min-w-0 min-h-0 flex-col bg-muted/30 lg:flex">
              <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4 shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    Preview
                  </h2>
                  {isPreviewUpdating && (
                    <Spinner
                      className="h-4 w-4 text-muted-foreground"
                      aria-label="Updating preview"
                    />
                  )}
                </div>
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
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem
                      onClick={() =>
                        setShowPreviewHighlights((value) => !value)
                      }
                    >
                      {showPreviewHighlights ? (
                        <EyeOff className="mr-2 h-4 w-4" />
                      ) : (
                        <Highlighter className="mr-2 h-4 w-4" />
                      )}
                      {showPreviewHighlights
                        ? "Hide highlights"
                        : "Show highlights"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSetPreviewOpen(false)}>
                      <EyeOff className="mr-2 h-4 w-4" />
                      Hide preview
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <div className="min-h-full p-6">
                  <PromptPreview
                    preview={preview}
                    segments={previewSegments}
                    showHighlights={showPreviewHighlights}
                    isTruncated={isPreviewTruncated}
                  />
                </div>
              </div>
            </aside>
          )}
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6 md:py-4 shrink-0">
            <div className="flex min-w-0 items-center gap-2">
              {isMobile && !isSidebarOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleSidebar}
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Show menu"
                  title="Show menu"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
              )}

              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-foreground md:text-lg">
                  Prompt Forge
                </h2>
              </div>
            </div>

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
              <DropdownMenuContent align="end" className="w-48">
                {!isSidebarOpen && (
                  <DropdownMenuItem onClick={onToggleSidebar}>
                    <Eye className="mr-2 h-4 w-4" />
                    Show menu
                  </DropdownMenuItem>
                )}
                {!isPreviewOpen && (
                  <DropdownMenuItem onClick={() => onSetPreviewOpen(true)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Show preview
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <div className="flex flex-1 items-center justify-center p-6">
            <div className="max-w-sm text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium text-foreground">
                Open a template
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Choose a template from the sidebar to fill its fields, preview the rendered result, and copy the final prompt.
              </p>

              <div className="mb-5 flex justify-center">
                <Button onClick={onCreateFile} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create template
                </Button>
              </div>

              <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                <span>
                  <Kbd>Ctrl</Kbd>+<Kbd>O</Kbd> Quick convert
                </span>
                <span>
                  <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd> Quick open
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

interface ParameterFieldProps {
  param: TemplateFieldDefinition;
  pathKey: string;
  clipboardFormat: ClipboardImportFormat;
  onClipboardFormatChange: (
    pathKey: string,
    format: ClipboardImportFormat,
  ) => void;
  value: string;
  onChange: (value: string) => void;
  onCopy: () => void;
  showTechnicalNames: boolean;
  showNotification: (message: string, type?: "success" | "error") => void;
}

function ParameterField({
  param,
  pathKey,
  clipboardFormat,
  onClipboardFormatChange,
  value,
  onChange,
  onCopy,
  showTechnicalNames,
  showNotification,
}: ParameterFieldProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingFolder, setIsImportingFolder] = useState(false);
  const [isFolderDragActive, setIsFolderDragActive] = useState(false);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const id = `param-${param.name}`;
  const isInlineField =
    param.inline &&
    (param.type === "text" ||
      param.type === "number" ||
      param.type === "select" ||
      param.type === "combobox" ||
      param.type === "checkbox" ||
      param.type === "radio");
  const fieldContainerClassName = isInlineField
    ? "flex flex-col gap-2 sm:flex-row sm:items-center"
    : "space-y-2";
  const fieldLabelClassName = isInlineField
    ? "flex items-center gap-2 flex-wrap min-w-0 sm:w-40 sm:min-w-40 sm:flex-none"
    : "flex items-center gap-2 flex-wrap min-w-0";

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      if (param.type === "text" || param.type === "number") {
        e.preventDefault();
        onCopy();
      }
    }
  };

  const isClipboardImportResultEmpty = useCallback(
    (nextValue: string) =>
      clipboardFormat === "plain_text"
        ? nextValue.length === 0
        : nextValue.trim().length === 0,
    [clipboardFormat],
  );

  const handleImportFromClipboard = useCallback(async () => {
    if (!param.clipboardImport?.enabled) return;

    try {
      setIsImporting(true);
      const source = await readClipboardSource();
      const nextValue = transformClipboardSource(source, clipboardFormat);

      if (isClipboardImportResultEmpty(nextValue)) {
        showNotification(
          "Clipboard is empty or could not be converted",
          "error",
        );
        return;
      }

      onChange(nextValue);
      showNotification("Imported from clipboard");
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to import from clipboard";
      showNotification(message, "error");
    } finally {
      setIsImporting(false);
    }
  }, [
    clipboardFormat,
    isClipboardImportResultEmpty,
    onChange,
    param.clipboardImport,
    showNotification,
  ]);

  const applyImportedFolderBlocks = useCallback(
    (blocks: Awaited<ReturnType<typeof readFolderImportContents>>) => {
      if (blocks.length === 0) {
        showNotification("No matching files found in selected folder", "error");
        return;
      }

      onChange(buildFolderImportValue(blocks));
      showNotification(
        `Imported ${blocks.length} file${blocks.length === 1 ? "" : "s"} from folder`,
      );
    },
    [onChange, showNotification],
  );

  const handleImportFromFolder = useCallback(async () => {
    if (!param.folderImport?.enabled) return;

    try {
      setIsImportingFolder(true);
      const blocks = await readFolderImportContents(param.folderImport.formats);
      applyImportedFolderBlocks(blocks);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to import from folder";
      showNotification(message, "error");
    } finally {
      setIsImportingFolder(false);
    }
  }, [applyImportedFolderBlocks, param.folderImport, showNotification]);

  const handleFolderDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!param.folderImport?.enabled || isImportingFolder) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsFolderDragActive(true);
    },
    [isImportingFolder, param.folderImport],
  );

  const handleFolderDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!param.folderImport?.enabled) return;
      const nextTarget = e.relatedTarget;
      if (nextTarget instanceof Node && e.currentTarget.contains(nextTarget)) {
        return;
      }
      setIsFolderDragActive(false);
    },
    [param.folderImport],
  );

  const handleFolderDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      if (!param.folderImport?.enabled || isImportingFolder) return;

      e.preventDefault();
      setIsFolderDragActive(false);

      try {
        setIsImportingFolder(true);
        const blocks = await readDroppedFolderImportContents(
          e.dataTransfer.items,
          param.folderImport.formats,
        );
        applyImportedFolderBlocks(blocks);
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Failed to import from folder";
        showNotification(message, "error");
      } finally {
        setIsImportingFolder(false);
      }
    },
    [applyImportedFolderBlocks, isImportingFolder, param.folderImport, showNotification],
  );

  const handleTextareaPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!param.clipboardImport?.enabled) return;

      e.preventDefault();

      try {
        const source = readClipboardSourceFromDataTransfer(e.clipboardData);
        const insertedValue = transformClipboardSource(source, clipboardFormat);

        if (isClipboardImportResultEmpty(insertedValue)) {
          showNotification(
            "Clipboard is empty or could not be converted",
            "error",
          );
          return;
        }

        const target = e.currentTarget;
        const selectionStart = target.selectionStart ?? value.length;
        const selectionEnd = target.selectionEnd ?? value.length;
        const nextValue =
          value.slice(0, selectionStart) +
          insertedValue +
          value.slice(selectionEnd);

        onChange(nextValue);

        requestAnimationFrame(() => {
          const textarea = textareaRef.current;
          if (!textarea) return;

          const nextCaretPosition = selectionStart + insertedValue.length;
          textarea.focus();
          textarea.setSelectionRange(nextCaretPosition, nextCaretPosition);
        });
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Failed to import from clipboard";
        showNotification(message, "error");
      }
    },
    [
      clipboardFormat,
      isClipboardImportResultEmpty,
      onChange,
      param.clipboardImport,
      showNotification,
      value,
    ],
  );

  const meta = (
    <div className={fieldLabelClassName}>
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {param.label}
      </Label>
      {showTechnicalNames && (
        <code className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono text-muted-foreground">
          {`{{${param.name}}}`}
        </code>
      )}
    </div>
  );

  if (param.type === "textarea") {
    const clipboardImport = param.clipboardImport;
    const folderImport = param.folderImport;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Label htmlFor={id} className="text-sm font-medium text-foreground">
            {param.label}
          </Label>
          {showTechnicalNames && (
            <code className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono text-muted-foreground">
              {`{{${param.name}}}`}
            </code>
          )}
        </div>

        <Textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handleTextareaPaste}
          placeholder={`Enter ${param.label.toLowerCase()}...`}
          rows={param.height ?? 4}
          className="bg-card border-border resize-y min-h-[100px]"
          style={{
            minHeight: param.height ? `${param.height * 1.5}rem` : undefined,
          }}
        />

        {folderImport?.enabled && (
          <button
            type="button"
            onClick={handleImportFromFolder}
            onDragOver={handleFolderDragOver}
            onDragEnter={handleFolderDragOver}
            onDragLeave={handleFolderDragLeave}
            onDrop={handleFolderDrop}
            disabled={isImportingFolder}
            className={cn(
              "flex min-h-[84px] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isImportingFolder && "pointer-events-none opacity-60",
              isFolderDragActive
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
              <Folder className="h-4 w-4" />
              <span>
                {isImportingFolder
                  ? "Importing..."
                  : isFolderDragActive
                    ? "Drop folder to import"
                    : "Insert folder contents"}
              </span>
            </div>
            <div className="text-xs sm:text-sm">
              {isImportingFolder
                ? "Reading matching files from the selected folder"
                : isFolderDragActive
                  ? "Release to replace this field"
                  : "Click to choose or drag a folder here"}
            </div>
          </button>
        )}

        {clipboardImport?.enabled && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleImportFromClipboard}
              disabled={isImporting}
              className="sm:w-auto grow"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isImporting ? "Importing..." : "Import from clipboard"}
            </Button>
            <Select
              value={clipboardFormat}
              onValueChange={(format) =>
                onClipboardFormatChange(
                  pathKey,
                  format as ClipboardImportFormat,
                )
              }
            >
              <SelectTrigger className="bg-card border-border sm:w-[200px]">
                <SelectValue placeholder="Select a format" />
              </SelectTrigger>
              <SelectContent>
                {clipboardImport.formats.map((format) => (
                  <SelectItem key={format} value={format}>
                    {format === "html"
                      ? "HTML"
                      : format === "minified"
                        ? "Minified HTML"
                        : format === "markdown"
                          ? "Markdown"
                          : "Plain text"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  }

  if (param.type === "text") {
    return (
      <div className={fieldContainerClassName}>
        {meta}
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Enter ${param.label.toLowerCase()}...`}
          className="bg-card border-border flex-1 min-w-0"
        />
      </div>
    );
  }

  if (param.type === "number") {
    return (
      <div className={fieldContainerClassName}>
        {meta}
        <Input
          id={id}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Enter ${param.label.toLowerCase()}...`}
          className="bg-card border-border flex-1 min-w-0"
        />
      </div>
    );
  }

  if (param.type === "checkbox") {
    return (
      <div className={fieldContainerClassName}>
        {meta}
        <div className="flex flex-1 items-center gap-3 rounded-md border border-border bg-card p-3 min-w-0">
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
      </div>
    );
  }

  if (param.type === "select") {
    const optionGroups = getFieldOptionGroups(param);

    return (
      <div className={fieldContainerClassName}>
        {meta}
        <div className="flex-1 min-w-0">
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-full min-w-0 bg-card border-border">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {optionGroups.map((group, groupIndex) => (
                <SelectGroup key={`${param.name}-group-${groupIndex}`}>
                  {group.label && <SelectLabel>{group.label}</SelectLabel>}
                  {group.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (param.type === "combobox") {
    const optionGroups = getFieldOptionGroups(param);
    const selectedOption = findFieldOptionByValue(param, value);

    return (
      <div className={fieldContainerClassName}>
        {meta}
        <div className="flex-1 min-w-0">
          <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={isComboboxOpen}
                className="w-full min-w-0 justify-between bg-card border-border px-3 font-normal"
              >
                <span className="truncate text-left">
                  {selectedOption?.label ?? "Select an option"}
                </span>
                <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0"
              align="start"
            >
              <Command
                filter={(_, search, keywords) => {
                  const normalizedSearch = search.trim().toLowerCase();
                  if (!normalizedSearch) return 1;
                  return (keywords ?? []).some((keyword) =>
                    keyword.toLowerCase().includes(normalizedSearch),
                  )
                    ? 1
                    : 0;
                }}
              >
                <CommandInput placeholder="Search..." />
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>
                  {optionGroups.map((group, groupIndex) => (
                    <CommandGroup
                      key={`${param.name}-combobox-group-${groupIndex}`}
                      heading={group.label ?? undefined}
                    >
                      {group.options.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          keywords={[option.label]}
                          onSelect={(selectedValue) => {
                            onChange(selectedValue);
                            setIsComboboxOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {option.label}
                          </span>
                          <Check
                            className={cn(
                              "size-4",
                              value === option.value
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    );
  }

  if (param.type === "radio") {
    const options = getFieldOptionGroups(param).flatMap(
      (group) => group.options,
    );

    return (
      <div className={fieldContainerClassName}>
        {meta}
        <RadioGroup
          value={value}
          onValueChange={onChange}
          className={cn(
            "flex flex-1 flex-wrap gap-3 min-w-0",
            isInlineField ? "sm:pt-1" : undefined,
          )}
        >
          {options.map((option) => (
            <div key={option.value} className="inline-flex items-center gap-2">
              <RadioGroupItem
                value={option.value}
                id={`${id}-${option.value}`}
              />
              <Label
                htmlFor={`${id}-${option.value}`}
                className="text-sm text-foreground cursor-pointer"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    );
  }

  return null;
}
