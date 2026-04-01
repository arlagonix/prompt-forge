"use client";
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainContent = MainContent;
var button_1 = require("@/components/ui/button");
var checkbox_1 = require("@/components/ui/checkbox");
var dropdown_menu_1 = require("@/components/ui/dropdown-menu");
var input_1 = require("@/components/ui/input");
var kbd_1 = require("@/components/ui/kbd");
var label_1 = require("@/components/ui/label");
var radio_group_1 = require("@/components/ui/radio-group");
var scroll_area_1 = require("@/components/ui/scroll-area");
var select_1 = require("@/components/ui/select");
var spinner_1 = require("@/components/ui/spinner");
var textarea_1 = require("@/components/ui/textarea");
var parser_1 = require("@/lib/prompt-forge/parser");
var lucide_react_1 = require("lucide-react");
var react_1 = require("react");
function cloneScopeState(state) {
    return {
        fields: __assign({}, state.fields),
        groups: Object.fromEntries(Object.entries(state.groups).map(function (_a) {
            var name = _a[0], instances = _a[1];
            return [
                name,
                instances.map(cloneScopeState),
            ];
        })),
    };
}
function normalizeLoadedScopeState(group, raw) {
    var _a, _b;
    var base = (0, parser_1.createInitialScopeState)(group);
    if (!raw || typeof raw !== "object")
        return base;
    var item = raw;
    var _loop_1 = function (renderItem) {
        if (renderItem.kind === "field") {
            var rawValue = (_a = item.fields) === null || _a === void 0 ? void 0 : _a[renderItem.field.name];
            base.fields[renderItem.field.name] =
                rawValue == null ? base.fields[renderItem.field.name] : String(rawValue);
            return "continue";
        }
        var rawInstances = (_b = item.groups) === null || _b === void 0 ? void 0 : _b[renderItem.group.name];
        var instances = Array.isArray(rawInstances) ? rawInstances : [];
        var normalized = instances.length > 0
            ? instances.map(function (instance) {
                return normalizeLoadedScopeState(renderItem.group, instance);
            })
            : [(0, parser_1.createInitialScopeState)(renderItem.group)];
        base.groups[renderItem.group.name] = renderItem.group.repeat
            ? normalized
            : [normalized[0]];
    };
    for (var _i = 0, _c = group.renderOrder; _i < _c.length; _i++) {
        var renderItem = _c[_i];
        _loop_1(renderItem);
    }
    return base;
}
function updateScopeAtPath(rootState, path, updater) {
    if (path.length === 0) {
        return updater(cloneScopeState(rootState));
    }
    var nextRoot = cloneScopeState(rootState);
    var current = nextRoot;
    for (var i = 0; i < path.length - 1; i += 1) {
        var segment = path[i];
        current = current.groups[segment.groupName][segment.index];
    }
    var last = path[path.length - 1];
    current.groups[last.groupName][last.index] = updater(cloneScopeState(current.groups[last.groupName][last.index]));
    return nextRoot;
}
function countRenderedItems(group) {
    return group.renderOrder.length;
}
function GroupEditor(_a) {
    var group = _a.group, state = _a.state, path = _a.path, onFieldChange = _a.onFieldChange, onAddGroupInstance = _a.onAddGroupInstance, onRemoveGroupInstance = _a.onRemoveGroupInstance, onCopy = _a.onCopy;
    var renderItem = (0, react_1.useCallback)(function (item) {
        var _a, _b, _c;
        if (item.kind === "field") {
            return (<ParameterField key={"field-".concat(item.field.name)} param={item.field} value={(_b = (_a = state.fields[item.field.name]) !== null && _a !== void 0 ? _a : item.field.defaultValue) !== null && _b !== void 0 ? _b : ""} onChange={function (value) { return onFieldChange(path, item.field.name, value); }} onCopy={onCopy}/>);
        }
        var instances = (_c = state.groups[item.group.name]) !== null && _c !== void 0 ? _c : [(0, parser_1.createInitialScopeState)(item.group)];
        return (<div key={"group-".concat(item.group.name)} className="rounded-xl border border-border bg-card/60 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">
                {item.group.label}
              </div>
              <code className="text-xs text-muted-foreground">{"{{ ".concat(item.group.name, ":start }}")}</code>
            </div>
            {item.group.repeat && (<button_1.Button type="button" variant="outline" size="sm" onClick={function () { return onAddGroupInstance(path, item.group); }}>
                <lucide_react_1.Plus className="h-4 w-4 mr-2"/>
                Add
              </button_1.Button>)}
          </div>

          {instances.map(function (instanceState, index) {
                var instancePath = __spreadArray(__spreadArray([], path, true), [{ groupName: item.group.name, index: index }], false);
                var canRemove = item.group.repeat && instances.length > 1;
                var innerClass = item.group.repeat
                    ? "rounded-lg border border-border/70 bg-background p-4 space-y-4"
                    : "space-y-4";
                return (<div key={"".concat(item.group.name, "-").concat(index)} className={innerClass}>
                {item.group.repeat && (<div className="flex justify-end">
                    <button_1.Button type="button" variant="ghost" size="sm" disabled={!canRemove} onClick={function () {
                            return onRemoveGroupInstance(path, item.group.name, index);
                        }}>
                      <lucide_react_1.Trash2 className="h-4 w-4 mr-2"/>
                      Remove
                    </button_1.Button>
                  </div>)}

                <GroupEditor group={item.group} state={instanceState} path={instancePath} onFieldChange={onFieldChange} onAddGroupInstance={onAddGroupInstance} onRemoveGroupInstance={onRemoveGroupInstance} onCopy={onCopy}/>
              </div>);
            })}
        </div>);
    }, [onAddGroupInstance, onCopy, onFieldChange, onRemoveGroupInstance, path, state.fields, state.groups]);
    return <div className="space-y-6">{group.renderOrder.map(renderItem)}</div>;
}
function MainContent(_a) {
    var _this = this;
    var currentFile = _a.currentFile, _currentParams = _a.currentParams, isLoading = _a.isLoading, onOpenDocs = _a.onOpenDocs, onOpenTemplate = _a.onOpenTemplate, onEditFile = _a.onEditFile, onMoveFile = _a.onMoveFile, onDeleteFile = _a.onDeleteFile, onExportFile = _a.onExportFile, showNotification = _a.showNotification, onToggleSidebar = _a.onToggleSidebar, isSidebarOpen = _a.isSidebarOpen;
    var _b = (0, react_1.useState)(null), parsedTemplate = _b[0], setParsedTemplate = _b[1];
    var _c = (0, react_1.useState)(null), templateState = _c[0], setTemplateState = _c[1];
    var _d = (0, react_1.useState)(null), parseError = _d[0], setParseError = _d[1];
    var _e = (0, react_1.useState)(""), preview = _e[0], setPreview = _e[1];
    var _f = (0, react_1.useState)([]), previewSegments = _f[0], setPreviewSegments = _f[1];
    var getFormStorageKey = (0, react_1.useCallback)(function (file) {
        if (!(file === null || file === void 0 ? void 0 : file.id))
            return null;
        return "prompt-forge-form-values:".concat(file.id);
    }, []);
    var saveFormValues = (0, react_1.useCallback)(function (file, values) {
        var key = getFormStorageKey(file);
        if (!key || !values)
            return;
        try {
            localStorage.setItem(key, JSON.stringify(values));
        }
        catch (_a) { }
    }, [getFormStorageKey]);
    var loadFormValues = (0, react_1.useCallback)(function (file) {
        var key = getFormStorageKey(file);
        if (!key)
            return null;
        try {
            var raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        }
        catch (_a) {
            return null;
        }
    }, [getFormStorageKey]);
    (0, react_1.useEffect)(function () {
        if (!currentFile) {
            setParsedTemplate(null);
            setTemplateState(null);
            setParseError(null);
            return;
        }
        try {
            var nextTemplate = (0, parser_1.parseTemplate)(currentFile.content);
            var savedValues = loadFormValues(currentFile);
            var nextState = normalizeLoadedScopeState(nextTemplate.rootGroup, savedValues);
            setParsedTemplate(nextTemplate);
            setTemplateState(nextState);
            setParseError(null);
        }
        catch (error) {
            setParsedTemplate(null);
            setTemplateState(null);
            setParseError(error instanceof Error ? error.message : "Failed to parse template.");
        }
    }, [currentFile, loadFormValues]);
    (0, react_1.useEffect)(function () {
        if (!currentFile || !templateState || parseError)
            return;
        saveFormValues(currentFile, templateState);
    }, [currentFile, parseError, saveFormValues, templateState]);
    (0, react_1.useEffect)(function () {
        if (!currentFile) {
            setPreview("");
            setPreviewSegments([]);
            return;
        }
        if (parseError || !parsedTemplate || !templateState) {
            var fallback = currentFile.bodyContent || currentFile.content || "";
            setPreview(fallback);
            setPreviewSegments([{ text: fallback, isUserValue: false }]);
            return;
        }
        setPreviewSegments((0, parser_1.buildPromptSegmentsFromTemplate)(parsedTemplate, templateState));
        setPreview((0, parser_1.buildPromptFromTemplate)(parsedTemplate, templateState));
    }, [currentFile, parseError, parsedTemplate, templateState]);
    var updateFieldValue = (0, react_1.useCallback)(function (path, fieldName, value) {
        setTemplateState(function (prev) {
            if (!prev)
                return prev;
            return updateScopeAtPath(prev, path, function (scope) {
                var _a;
                return (__assign(__assign({}, scope), { fields: __assign(__assign({}, scope.fields), (_a = {}, _a[fieldName] = value, _a)) }));
            });
        });
    }, []);
    var addGroupInstance = (0, react_1.useCallback)(function (path, group) {
        setTemplateState(function (prev) {
            if (!prev)
                return prev;
            return updateScopeAtPath(prev, path, function (scope) {
                var _a;
                var _b;
                return (__assign(__assign({}, scope), { groups: __assign(__assign({}, scope.groups), (_a = {}, _a[group.name] = __spreadArray(__spreadArray([], ((_b = scope.groups[group.name]) !== null && _b !== void 0 ? _b : []), true), [(0, parser_1.createInitialScopeState)(group)], false), _a)) }));
            });
        });
    }, []);
    var removeGroupInstance = (0, react_1.useCallback)(function (path, groupName, index) {
        setTemplateState(function (prev) {
            if (!prev)
                return prev;
            return updateScopeAtPath(prev, path, function (scope) {
                var _a;
                var _b;
                var current = (_b = scope.groups[groupName]) !== null && _b !== void 0 ? _b : [];
                if (current.length <= 1)
                    return scope;
                return __assign(__assign({}, scope), { groups: __assign(__assign({}, scope.groups), (_a = {}, _a[groupName] = current.filter(function (_, currentIndex) { return currentIndex !== index; }), _a)) });
            });
        });
    }, []);
    var handleCopy = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!preview) {
                        showNotification("No content to copy", "error");
                        return [2 /*return*/];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, navigator.clipboard.writeText(preview)];
                case 2:
                    _b.sent();
                    showNotification("Copied to clipboard!");
                    return [3 /*break*/, 4];
                case 3:
                    _a = _b.sent();
                    showNotification("Failed to copy", "error");
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [preview, showNotification]);
    var handleClear = (0, react_1.useCallback)(function () {
        if (!parsedTemplate)
            return;
        setTemplateState((0, parser_1.createInitialScopeState)(parsedTemplate.rootGroup));
    }, [parsedTemplate]);
    (0, react_1.useEffect)(function () {
        var handleKeyDown = function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && currentFile) {
                e.preventDefault();
                handleCopy();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return function () { return window.removeEventListener("keydown", handleKeyDown); };
    }, [currentFile, handleCopy]);
    var hasVisibleInputs = parsedTemplate != null && countRenderedItems(parsedTemplate.rootGroup) > 0;
    return (<main className="flex-1 min-h-0 overflow-hidden">
      {isLoading ? (<div className="flex h-full items-center justify-center">
          <div className="text-center">
            <spinner_1.Spinner className="h-8 w-8 mx-auto mb-3"/>
            <p className="text-muted-foreground">Loading template...</p>
          </div>
        </div>) : currentFile ? (<div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-2">
          <section className="min-w-0 min-h-0 flex flex-col lg:border-r border-border">
            <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                {!isSidebarOpen && (<button_1.Button variant="ghost" size="icon" onClick={onToggleSidebar} className="h-8 w-8">
                    <lucide_react_1.PanelLeft className="h-4 w-4"/>
                  </button_1.Button>)}
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {currentFile.name}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button_1.Button variant="ghost" size="sm" onClick={onOpenDocs} className="text-muted-foreground hover:text-foreground">
                  <lucide_react_1.BookOpen className="h-4 w-4 mr-2"/>
                  Docs
                </button_1.Button>

                <button_1.Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground hover:text-foreground" disabled={!parsedTemplate || !!parseError}>
                  <lucide_react_1.RotateCcw className="h-4 w-4 mr-2"/>
                  Reset
                </button_1.Button>

                <dropdown_menu_1.DropdownMenu>
                  <dropdown_menu_1.DropdownMenuTrigger asChild>
                    <button_1.Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <lucide_react_1.MoreHorizontal className="h-4 w-4"/>
                    </button_1.Button>
                  </dropdown_menu_1.DropdownMenuTrigger>
                  <dropdown_menu_1.DropdownMenuContent align="end" className="w-40">
                    <dropdown_menu_1.DropdownMenuItem onClick={onOpenTemplate}>
                      <lucide_react_1.Code className="h-4 w-4 mr-2"/>
                      Template
                    </dropdown_menu_1.DropdownMenuItem>
                    <dropdown_menu_1.DropdownMenuItem onClick={onEditFile}>
                      <lucide_react_1.Pencil className="h-4 w-4 mr-2"/>
                      Edit
                    </dropdown_menu_1.DropdownMenuItem>
                    <dropdown_menu_1.DropdownMenuItem onClick={onMoveFile}>
                      <lucide_react_1.Folder className="h-4 w-4 mr-2"/>
                      Move to…
                    </dropdown_menu_1.DropdownMenuItem>
                    <dropdown_menu_1.DropdownMenuSeparator />
                    <dropdown_menu_1.DropdownMenuItem onClick={onExportFile}>
                      <lucide_react_1.Copy className="h-4 w-4 mr-2"/>
                      Export
                    </dropdown_menu_1.DropdownMenuItem>
                    <dropdown_menu_1.DropdownMenuSeparator />
                    <dropdown_menu_1.DropdownMenuItem onClick={onDeleteFile} className="text-destructive focus:text-destructive">
                      <lucide_react_1.Trash2 className="h-4 w-4 mr-2"/>
                      Delete
                    </dropdown_menu_1.DropdownMenuItem>
                  </dropdown_menu_1.DropdownMenuContent>
                </dropdown_menu_1.DropdownMenu>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden">
              <scroll_area_1.ScrollArea className="h-full">
                <div className="p-4 md:p-6 space-y-6">
                  {parseError ? (<div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                      <div className="font-medium mb-1">Template parse error</div>
                      <div>{parseError}</div>
                    </div>) : !parsedTemplate || !templateState || !hasVisibleInputs ? (<p className="text-sm text-muted-foreground py-4">
                      This template has no parameters. The content will be used
                      as-is.
                    </p>) : (<GroupEditor group={parsedTemplate.rootGroup} state={templateState} path={[]} onFieldChange={updateFieldValue} onAddGroupInstance={addGroupInstance} onRemoveGroupInstance={removeGroupInstance} onCopy={handleCopy}/>)}

                  <div className="pt-2">
                    <button_1.Button onClick={handleCopy} className="w-full" size="lg">
                      <lucide_react_1.Copy className="h-4 w-4 mr-2"/>
                      Copy Prompt
                    </button_1.Button>
                    <p className="text-center text-xs text-muted-foreground mt-2">
                      <kbd_1.Kbd>Ctrl</kbd_1.Kbd> + <kbd_1.Kbd>Enter</kbd_1.Kbd> to copy
                    </p>
                  </div>
                </div>
              </scroll_area_1.ScrollArea>
            </div>
          </section>

          <aside className="hidden lg:flex min-w-0 min-h-0 flex-col bg-muted/30">
            <div className="px-6 py-4.5 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-foreground">Preview</h2>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <div className="p-6 min-h-full">
                {preview ? (<pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed break-words">
                    {previewSegments.map(function (segment, index) {
                    return segment.isUserValue ? (<span key={index} className="rounded border border-primary/25 bg-primary/5 px-0.5 text-foreground" title={segment.paramName
                            ? "From: ".concat(segment.paramName)
                            : undefined}>
                          {segment.text}
                        </span>) : (<span key={index}>{segment.text}</span>);
                })}
                  </pre>) : (<p className="text-sm text-muted-foreground italic">
                    No preview available.
                  </p>)}
              </div>
            </div>
          </aside>
        </div>) : (<div className="flex h-full items-center justify-center">
          <div className="text-center max-w-sm">
            <lucide_react_1.FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4"/>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Select a template
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Choose a markdown template from the sidebar to get started
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
              <span>
                <kbd_1.Kbd>Ctrl</kbd_1.Kbd>+<kbd_1.Kbd>O</kbd_1.Kbd> Open folder
              </span>
              <span>
                <kbd_1.Kbd>Ctrl</kbd_1.Kbd>+<kbd_1.Kbd>K</kbd_1.Kbd> Quick open
              </span>
            </div>
          </div>
        </div>)}
    </main>);
}
function ParameterField(_a) {
    var _b;
    var param = _a.param, value = _a.value, onChange = _a.onChange, onCopy = _a.onCopy;
    var id = "param-".concat(param.name);
    var handleKeyDown = function (e) {
        if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            if (param.type === "text" || param.type === "number") {
                e.preventDefault();
                onCopy();
            }
        }
    };
    return (<div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <label_1.Label htmlFor={id} className="text-sm font-medium text-foreground">
          {param.label}
        </label_1.Label>
        <code className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono text-muted-foreground">
          {"{{".concat(param.name, "}}")}
        </code>
      </div>

      {param.type === "textarea" && (<textarea_1.Textarea id={id} value={value} onChange={function (e) { return onChange(e.target.value); }} placeholder={"Enter ".concat(param.label.toLowerCase(), "...")} rows={(_b = param.height) !== null && _b !== void 0 ? _b : 4} className="bg-card border-border resize-y min-h-[100px]" style={{
                minHeight: param.height ? "".concat(param.height * 1.5, "rem") : undefined,
            }}/>)}

      {param.type === "text" && (<input_1.Input id={id} type="text" value={value} onChange={function (e) { return onChange(e.target.value); }} onKeyDown={handleKeyDown} placeholder={"Enter ".concat(param.label.toLowerCase(), "...")} className="bg-card border-border"/>)}

      {param.type === "number" && (<input_1.Input id={id} type="number" value={value} onChange={function (e) { return onChange(e.target.value); }} onKeyDown={handleKeyDown} placeholder={"Enter ".concat(param.label.toLowerCase(), "...")} className="bg-card border-border"/>)}

      {param.type === "checkbox" && (<div className="flex items-center gap-3 p-3 rounded-md bg-card border border-border">
          <checkbox_1.Checkbox id={id} checked={value === "true"} onCheckedChange={function (checked) { return onChange(checked ? "true" : "false"); }}/>
          <label_1.Label htmlFor={id} className="text-sm text-muted-foreground cursor-pointer">
            {value === "true" ? "true" : "false"}
          </label_1.Label>
        </div>)}

      {param.type === "select" && (<select_1.Select value={value} onValueChange={onChange}>
          <select_1.SelectTrigger className="bg-card border-border">
            <select_1.SelectValue placeholder="Select an option"/>
          </select_1.SelectTrigger>
          <select_1.SelectContent>
            {param.values.map(function (v) { return (<select_1.SelectItem key={v} value={v}>
                {v}
              </select_1.SelectItem>); })}
          </select_1.SelectContent>
        </select_1.Select>)}

      {param.type === "radio" && (<radio_group_1.RadioGroup value={value} onValueChange={onChange} className="space-y-2">
          {param.values.map(function (v) { return (<div key={v} className="flex items-center gap-2">
              <radio_group_1.RadioGroupItem value={v} id={"".concat(id, "-").concat(v)}/>
              <label_1.Label htmlFor={"".concat(id, "-").concat(v)} className="text-sm text-foreground cursor-pointer">
                {v}
              </label_1.Label>
            </div>); })}
        </radio_group_1.RadioGroup>)}
    </div>);
}
