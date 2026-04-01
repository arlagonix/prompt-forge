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
exports.parseFrontMatter = parseFrontMatter;
exports.parseTemplate = parseTemplate;
exports.extractParameters = extractParameters;
exports.createInitialScopeState = createInitialScopeState;
exports.buildPromptSegmentsFromTemplate = buildPromptSegmentsFromTemplate;
exports.buildPromptFromTemplate = buildPromptFromTemplate;
exports.buildPromptSegments = buildPromptSegments;
exports.buildPrompt = buildPrompt;
exports.stripReusableFlag = stripReusableFlag;
var yaml_1 = require("yaml");
var NAME_RE = /^[a-zA-Z0-9_-]+$/;
var FIELD_TYPES = [
    "textarea",
    "text",
    "number",
    "checkbox",
    "select",
    "radio",
];
function formatParamName(p) {
    return p
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}
function isSupportedParamType(value) {
    return FIELD_TYPES.includes(value);
}
function normalizeStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.map(function (item) { return String(item !== null && item !== void 0 ? item : "").trim(); }).filter(Boolean);
}
function defaultValueForType(type, rawDefaultValue, values) {
    if (rawDefaultValue != null)
        return String(rawDefaultValue);
    if (type === "checkbox")
        return "false";
    if ((type === "select" || type === "radio") && values.length > 0) {
        return values[0];
    }
    return null;
}
function createFieldDefinition(name, options) {
    var _a;
    if (options === void 0) { options = {}; }
    var type = isSupportedParamType(options.type) ? options.type : "textarea";
    var values = normalizeStringArray(options.values);
    return {
        kind: "field",
        name: name,
        type: type,
        label: typeof options.label === "string" && options.label.trim()
            ? options.label.trim()
            : formatParamName(name),
        defaultValue: defaultValueForType(type, options.defaultValue, values),
        height: typeof options.height === "number" && Number.isFinite(options.height)
            ? options.height
            : type === "textarea"
                ? 4
                : null,
        values: values,
        explicit: (_a = options.explicit) !== null && _a !== void 0 ? _a : false,
    };
}
function createGroupDefinition(name, options) {
    var _a, _b, _c;
    if (options === void 0) { options = {}; }
    return {
        kind: "group",
        name: name,
        label: typeof options.label === "string" && options.label.trim()
            ? options.label.trim()
            : formatParamName(name),
        repeat: Boolean(options.repeat),
        explicit: (_a = options.explicit) !== null && _a !== void 0 ? _a : false,
        children: (_b = options.children) !== null && _b !== void 0 ? _b : [],
        renderOrder: (_c = options.renderOrder) !== null && _c !== void 0 ? _c : [],
    };
}
function getDefinitionByName(group, name) {
    var _a;
    return (_a = group.children.find(function (child) { return child.name === name; })) !== null && _a !== void 0 ? _a : null;
}
function getFieldDefinitionByName(group, name) {
    var found = getDefinitionByName(group, name);
    return (found === null || found === void 0 ? void 0 : found.kind) === "field" ? found : null;
}
function getGroupDefinitionByName(group, name) {
    var found = getDefinitionByName(group, name);
    return (found === null || found === void 0 ? void 0 : found.kind) === "group" ? found : null;
}
function ensureUniqueChildName(group, name) {
    if (getDefinitionByName(group, name)) {
        throw new Error("Duplicate name \"".concat(name, "\" in scope \"").concat(group.name, "\"."));
    }
}
function normalizeMetadataParam(raw, ancestorGroupNames) {
    if (ancestorGroupNames === void 0) { ancestorGroupNames = []; }
    if (!raw || typeof raw !== "object")
        return null;
    var item = raw;
    var name = typeof item.name === "string" ? item.name.trim() : "";
    if (!NAME_RE.test(name))
        return null;
    if (item.type === "group") {
        if (ancestorGroupNames.includes(name)) {
            throw new Error("Group name \"".concat(name, "\" must be unique along the nesting path."));
        }
        var childGroup = createGroupDefinition(name, {
            label: typeof item.label === "string" ? item.label : undefined,
            repeat: Boolean(item.repeat),
            explicit: true,
            children: [],
            renderOrder: [],
        });
        var rawChildren = Array.isArray(item.fields) ? item.fields : [];
        for (var _i = 0, rawChildren_1 = rawChildren; _i < rawChildren_1.length; _i++) {
            var rawChild = rawChildren_1[_i];
            var normalizedChild = normalizeMetadataParam(rawChild, __spreadArray(__spreadArray([], ancestorGroupNames, true), [name], false));
            if (!normalizedChild)
                continue;
            ensureUniqueChildName(childGroup, normalizedChild.name);
            childGroup.children.push(normalizedChild);
        }
        return childGroup;
    }
    var type = isSupportedParamType(item.type) ? item.type : "textarea";
    return createFieldDefinition(name, {
        type: type,
        label: typeof item.label === "string" ? item.label : undefined,
        defaultValue: item.default == null ? null : String(item.default),
        height: typeof item.height === "number" ? item.height : undefined,
        values: normalizeStringArray(item.values),
        explicit: true,
    });
}
function parseFrontMatter(content) {
    if (typeof content !== "string") {
        return {
            metadata: {},
            body: "",
            rawFrontMatter: "",
            hasFrontMatter: false,
        };
    }
    var normalized = content.replace(/\r\n/g, "\n");
    var match = normalized.match(/^(\uFEFF)?---\n([\s\S]*?)\n---(?:\n|$)/);
    if (!match) {
        return {
            metadata: {},
            body: content,
            rawFrontMatter: "",
            hasFrontMatter: false,
        };
    }
    var rawFrontMatter = match[0];
    var rawBody = normalized.slice(rawFrontMatter.length);
    var metadataBlock = match[2];
    var metadata = {};
    try {
        var parsed = yaml_1.default.parse(metadataBlock);
        metadata =
            parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? parsed
                : {};
    }
    catch (_a) {
        metadata = {};
    }
    return {
        metadata: metadata,
        body: rawBody.replace(/^\n+/, ""),
        rawFrontMatter: rawFrontMatter,
        hasFrontMatter: true,
    };
}
function ensureRenderItem(group, item) {
    var exists = group.renderOrder.some(function (current) {
        if (current.kind !== item.kind)
            return false;
        if (current.kind === "field" && item.kind === "field") {
            return current.field.name === item.field.name;
        }
        if (current.kind === "group" && item.kind === "group") {
            return current.group.name === item.group.name;
        }
        return false;
    });
    if (!exists) {
        group.renderOrder.push(item);
    }
}
function resolveFieldReference(scopeStack, name) {
    for (var depth = 0; depth < scopeStack.length; depth += 1) {
        var group = scopeStack[scopeStack.length - 1 - depth];
        var field = getFieldDefinitionByName(group, name);
        if (field) {
            return { definition: field, lookupDepth: depth, owner: group };
        }
    }
    var currentScope = scopeStack[scopeStack.length - 1];
    if (getGroupDefinitionByName(currentScope, name)) {
        throw new Error("Placeholder \"".concat(name, "\" conflicts with group \"").concat(name, "\" in scope \"").concat(currentScope.name, "\"."));
    }
    var implicitField = createFieldDefinition(name, { explicit: false });
    currentScope.children.push(implicitField);
    return { definition: implicitField, lookupDepth: 0, owner: currentScope };
}
function parseTemplate(content) {
    if (typeof content !== "string") {
        return {
            metadata: {},
            body: "",
            rootGroup: createGroupDefinition("root", { explicit: true }),
            nodes: [],
        };
    }
    var _a = parseFrontMatter(content), metadata = _a.metadata, body = _a.body;
    var rootGroup = createGroupDefinition("root", {
        label: "Root",
        explicit: true,
    });
    var metadataParamsRaw = Array.isArray(metadata.params) ? metadata.params : [];
    for (var _i = 0, metadataParamsRaw_1 = metadataParamsRaw; _i < metadataParamsRaw_1.length; _i++) {
        var rawParam = metadataParamsRaw_1[_i];
        var normalized = normalizeMetadataParam(rawParam, []);
        if (!normalized)
            continue;
        ensureUniqueChildName(rootGroup, normalized.name);
        rootGroup.children.push(normalized);
    }
    var rootNodes = [];
    var nodesStack = [rootNodes];
    var scopeStack = [rootGroup];
    var openGroupNodeStack = [];
    var cursor = 0;
    while (cursor < body.length) {
        var start = body.indexOf("{{", cursor);
        if (start === -1) {
            if (cursor < body.length) {
                nodesStack[nodesStack.length - 1].push({
                    kind: "text",
                    text: body.slice(cursor),
                });
            }
            break;
        }
        if (start > cursor) {
            nodesStack[nodesStack.length - 1].push({
                kind: "text",
                text: body.slice(cursor, start),
            });
        }
        var end = body.indexOf("}}", start + 2);
        if (end === -1) {
            nodesStack[nodesStack.length - 1].push({
                kind: "text",
                text: body.slice(start),
            });
            break;
        }
        var inner = body.slice(start + 2, end).trim();
        var currentScope = scopeStack[scopeStack.length - 1];
        var groupStartMatch = inner.match(/^([a-zA-Z0-9_-]+):start$/);
        var groupEndMatch = inner.match(/^([a-zA-Z0-9_-]+):end$/);
        if (groupStartMatch) {
            var groupName = groupStartMatch[1];
            var childGroup = getGroupDefinitionByName(currentScope, groupName);
            if (!childGroup) {
                throw new Error("Group \"".concat(groupName, "\" is not declared in scope \"").concat(currentScope.name, "\"."));
            }
            ensureRenderItem(currentScope, { kind: "group", group: childGroup });
            var groupNode = {
                kind: "group",
                name: groupName,
                definition: childGroup,
                children: [],
            };
            nodesStack[nodesStack.length - 1].push(groupNode);
            openGroupNodeStack.push(groupNode);
            nodesStack.push(groupNode.children);
            scopeStack.push(childGroup);
            cursor = end + 2;
            continue;
        }
        if (groupEndMatch) {
            var groupName = groupEndMatch[1];
            var openGroup = openGroupNodeStack[openGroupNodeStack.length - 1];
            if (!openGroup || openGroup.name !== groupName) {
                throw new Error("Unexpected group end \"".concat(groupName, "\"."));
            }
            openGroupNodeStack.pop();
            nodesStack.pop();
            scopeStack.pop();
            cursor = end + 2;
            continue;
        }
        if (NAME_RE.test(inner)) {
            var resolved = resolveFieldReference(scopeStack, inner);
            ensureRenderItem(resolved.owner, {
                kind: "field",
                field: resolved.definition,
            });
            var fieldNode = {
                kind: "field-ref",
                name: inner,
                definition: resolved.definition,
                lookupDepth: resolved.lookupDepth,
            };
            nodesStack[nodesStack.length - 1].push(fieldNode);
            cursor = end + 2;
            continue;
        }
        nodesStack[nodesStack.length - 1].push({
            kind: "text",
            text: body.slice(start, end + 2),
        });
        cursor = end + 2;
    }
    if (openGroupNodeStack.length > 0) {
        throw new Error("Group \"".concat(openGroupNodeStack[openGroupNodeStack.length - 1].name, "\" was not closed."));
    }
    return {
        metadata: metadata,
        body: body,
        rootGroup: rootGroup,
        nodes: rootNodes,
    };
}
function extractParameters(content) {
    try {
        var parsed = parseTemplate(content);
        return parsed.rootGroup.renderOrder
            .filter(function (item) {
            return item.kind === "field";
        })
            .map(function (item) { return ({
            name: item.field.name,
            type: item.field.type,
            label: item.field.label,
            defaultValue: item.field.defaultValue,
            height: item.field.height,
            values: item.field.values,
        }); });
    }
    catch (_a) {
        return [];
    }
}
function createInitialScopeState(group) {
    var _a;
    var fields = {};
    var groups = {};
    for (var _i = 0, _b = group.renderOrder; _i < _b.length; _i++) {
        var item = _b[_i];
        if (item.kind === "field") {
            fields[item.field.name] = (_a = item.field.defaultValue) !== null && _a !== void 0 ? _a : "";
            continue;
        }
        groups[item.group.name] = [createInitialScopeState(item.group)];
    }
    return { fields: fields, groups: groups };
}
function trimBoundaryNewlines(segments) {
    const trimmed = segments.map((segment) => ({ ...segment }));
    while (trimmed.length > 0 && trimmed[0].text.length === 0) {
        trimmed.shift();
    }
    while (trimmed.length > 0 && trimmed[trimmed.length - 1].text.length === 0) {
        trimmed.pop();
    }
    if (trimmed.length > 0 && trimmed[0].text.startsWith("
")) {
        trimmed[0].text = trimmed[0].text.slice(1);
        if (trimmed[0].text.length === 0)
            trimmed.shift();
    }
    if (trimmed.length > 0 && trimmed[trimmed.length - 1].text.endsWith("
")) {
        trimmed[trimmed.length - 1].text = trimmed[trimmed.length - 1].text.slice(0, -1);
        if (trimmed[trimmed.length - 1].text.length === 0)
            trimmed.pop();
    }
    return trimmed;
}
function buildSegmentsFromNodes(nodes, scopeStack) {
    var _a, _b;
    var segments = [];
    var _loop_1 = function (node) {
        if (node.kind === "text") {
            segments.push({ text: node.text, isUserValue: false });
            return "continue";
        }
        if (node.kind === "field-ref") {
            var targetScopeIndex = Math.max(0, scopeStack.length - 1 - node.lookupDepth);
            var targetScope = scopeStack[targetScopeIndex];
            var value = (_a = targetScope.fields[node.definition.name]) !== null && _a !== void 0 ? _a : "";
            segments.push({
                text: value,
                isUserValue: true,
                paramName: node.definition.name,
            });
            return "continue";
        }
        var currentScope = scopeStack[scopeStack.length - 1];
        var instances = (_b = currentScope.groups[node.definition.name]) !== null && _b !== void 0 ? _b : [];
        var groupSegments = [];
        instances.forEach(function (instance, index) {
            var instanceSegments = trimBoundaryNewlines(buildSegmentsFromNodes(node.children, __spreadArray(__spreadArray([], scopeStack, true), [instance], false)));
            if (instanceSegments.length === 0) {
                return;
            }
            if (index > 0 && groupSegments.length > 0) {
                groupSegments.push({ text: "\n\n", isUserValue: false });
            }
            groupSegments.push.apply(groupSegments, instanceSegments);
        });
        segments.push.apply(segments, groupSegments);
    };
    for (var _i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
        var node = nodes_1[_i];
        _loop_1(node);
    }
    return segments;
}
function buildPromptSegmentsFromTemplate(template, state) {
    return trimBoundaryNewlines(buildSegmentsFromNodes(template.nodes, [state]));
}
function buildPromptFromTemplate(template, state) {
    return buildPromptSegmentsFromTemplate(template, state)
        .map(function (segment) { return segment.text; })
        .join("")
        .replace(/\n\s*\n\s*\n/g, "\n\n")
        .trim();
}
function buildPromptSegments(bodyContent, content, formValues) {
    var _a;
    var tmpl = (_a = bodyContent !== null && bodyContent !== void 0 ? bodyContent : content) !== null && _a !== void 0 ? _a : "";
    var out = [];
    var i = 0;
    while (i < tmpl.length) {
        var s = tmpl.indexOf("{{", i);
        if (s === -1) {
            if (i < tmpl.length) {
                out.push({ text: tmpl.slice(i), isUserValue: false });
            }
            break;
        }
        if (s > i) {
            out.push({ text: tmpl.slice(i, s), isUserValue: false });
        }
        var e = tmpl.indexOf("}}", s + 2);
        if (e === -1) {
            out.push({ text: tmpl.slice(s), isUserValue: false });
            break;
        }
        var name_1 = tmpl.slice(s + 2, e).trim();
        if (NAME_RE.test(name_1) && formValues.has(name_1)) {
            out.push({
                text: formValues.get(name_1) || "",
                isUserValue: true,
                paramName: name_1,
            });
        }
        else {
            out.push({ text: tmpl.slice(s, e + 2), isUserValue: false });
        }
        i = e + 2;
    }
    return out;
}
function buildPrompt(bodyContent, content, _params, formValues) {
    return buildPromptSegments(bodyContent, content, formValues)
        .map(function (segment) { return segment.text; })
        .join("")
        .replace(/\n\s*\n\s*\n/g, "\n\n")
        .trim();
}
function stripReusableFlag(content) {
    if (typeof content !== "string" || !content.trim())
        return content;
    var _a = parseFrontMatter(content), metadata = _a.metadata, body = _a.body, hasFrontMatter = _a.hasFrontMatter;
    if (!hasFrontMatter) {
        return content;
    }
    var nextMetadata = __assign({}, metadata);
    delete nextMetadata.reusable;
    var metadataKeys = Object.keys(nextMetadata);
    if (metadataKeys.length === 0) {
        return body;
    }
    var serialized = yaml_1.default.stringify(nextMetadata).trimEnd();
    return "---\n".concat(serialized, "\n---\n\n").concat(body);
}
