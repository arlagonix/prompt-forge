"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DocsModal({ isOpen, onClose }: DocsModalProps) {
  const isMobile = useIsMobile();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "p-0",
          isMobile
            ? "h-[100dvh] w-screen max-w-none rounded-none border-0"
            : "max-h-[85vh] max-w-3xl",
        )}
      >
        <DialogHeader className="border-b border-border px-4 py-4 md:px-6">
          <DialogTitle>Template Syntax Guide</DialogTitle>
        </DialogHeader>

        <ScrollArea
          className={cn(
            isMobile ? "h-[calc(100dvh-73px)]" : "max-h-[calc(85vh-80px)]",
          )}
        >
          <div className="space-y-6 px-6 py-4">
            <DocSection title="Overview">
              <p className="mb-3 text-sm text-muted-foreground">
                Prompt Forge templates use a Markdown body with optional YAML
                front matter. Plain fields can be written directly in the body,
                while groups must be declared in front matter.
              </p>
              <CodeBlock>{`---
params:
  - name: reportTitle
    type: text
    label: Report title

  - name: days
    type: group
    label: Days
    repeat: true
    fields:
      - name: date
        type: text
        label: Date

      - name: meals
        type: group
        label: Meals
        repeat: true
        fields:
          - name: name
            type: text
            label: Meal
          - name: calories
            type: number
            label: Calories
---

Report: {{reportTitle}}

{{ days:start }}
Date: {{date}}

{{ meals:start }}
Meal: {{name}}
Calories: {{calories}}
{{ meals:end }}

{{ days:end }}`}</CodeBlock>
            </DocSection>

            <DocSection title="Simple placeholders">
              <p className="mb-3 text-sm text-muted-foreground">
                A placeholder uses <code>{`{{name}}`}</code>. If it is not
                declared in front matter, it is still valid and becomes a
                textarea automatically.
              </p>
              <CodeBlock>{`Task:
{{task}}

Audience:
{{audience}}`}</CodeBlock>
              <p className="mt-3 text-sm text-muted-foreground">
                In this example, both <code>task</code> and{" "}
                <code>audience</code> become implicit textarea fields.
              </p>
            </DocSection>

            <DocSection title="Front matter">
              <p className="mb-3 text-sm text-muted-foreground">
                Front matter is optional for plain fields and required for
                groups. It is used to refine field metadata and define nested
                structure.
              </p>
              <CodeBlock>{`---
params:
  - name: reportTitle
    type: text
    label: Report title

  - name: intro
    type: textarea
    label: Introduction
---`}</CodeBlock>
            </DocSection>

            <DocSection title="Name rules">
              <p className="mb-3 text-sm text-muted-foreground">
                Field and group names are technical identifiers. Use{" "}
                <code>label</code> for human-readable UI text.
              </p>
              <CodeBlock>{`Valid pattern:
^[a-zA-Z0-9_-]+$

Examples:
task
current_state
report-title`}</CodeBlock>
            </DocSection>

            <DocSection title="Field defaults">
              <p className="mb-3 text-sm text-muted-foreground">
                If a field is declared in front matter:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>
                  missing <code>type</code> becomes <code>textarea</code>
                </li>
                <li>
                  missing <code>label</code> is derived from <code>name</code>
                </li>
                <li>unknown metadata keys are ignored</li>
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">
                If a declared field is never used in the body, it is not
                rendered in the form UI.
              </p>
            </DocSection>

            <DocSection title="Supported field types">
              <CodeBlock>{`type: textarea
type: text
type: number
type: checkbox
type: select
type: radio`}</CodeBlock>
            </DocSection>

            <DocSection title="Declared fields">
              <CodeBlock>{`---
params:
  - name: title
    type: text
    label: Title

  - name: notes
    type: textarea
    label: Notes

  - name: calories
    type: number
    label: Calories
---`}</CodeBlock>
            </DocSection>

            <DocSection title="Inline field layout">
              <p className="mb-3 text-sm text-muted-foreground">
                Supported non-textarea fields can opt into an inline desktop
                layout with <code>inline: true</code>. When enabled, the label
                is shown on the left and the control is shown on the right.
              </p>
              <CodeBlock>{`---
params:
  - name: title
    type: text
    label: Title
    inline: true

  - name: priority
    type: select
    label: Priority
    values: [low, medium, high]
    inline: true

  - name: approved
    type: checkbox
    label: Approved
    inline: true
---`}</CodeBlock>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li><code>inline</code> defaults to <code>false</code></li>
                <li>
                  supported on <code>text</code>, <code>number</code>, <code>select</code>, <code>checkbox</code>, and <code>radio</code>
                </li>
                <li>ignored on unsupported field types</li>
                <li>mobile always falls back to stacked layout</li>
                <li>
                  for radio fields, <code>inline</code> affects only the field
                  layout, not the option layout inside the radio group
                </li>
              </ul>
            </DocSection>

            <DocSection title="Clipboard import">
              <p className="mb-3 text-sm text-muted-foreground">
                Textarea fields can expose an{" "}
                <strong>Import from clipboard</strong> button with a format
                picker. This is configured through <code>clipboard_import</code>{" "}
                in front matter.
              </p>
              <CodeBlock>{`---
params:
  - name: source
    type: textarea
    label: Source
    clipboard_import:
      enabled: true
---`}</CodeBlock>
              <p className="mt-3 text-sm text-muted-foreground">
                When enabled, the field shows:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>a small format select</li>
                <li>
                  an <strong>Import from clipboard</strong> button
                </li>
                <li>replacement of the current textarea value on import</li>
                <li>per-field format memory for that file</li>
              </ul>
            </DocSection>

            <DocSection title="Clipboard import formats">
              <p className="mb-3 text-sm text-muted-foreground">
                You can restrict which output formats are allowed and choose the
                default selected format.
              </p>
              <CodeBlock>{`---
params:
  - name: source
    type: textarea
    label: Source
    clipboard_import:
      enabled: true
      formats: [html, minified, markdown]
      default_format: markdown
---`}</CodeBlock>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>
                  <code>html</code> produces cleaned formatted HTML
                </li>
                <li>
                  <code>minified</code> produces cleaned minified HTML
                </li>
                <li>
                  <code>markdown</code> converts cleaned clipboard content to
                  Markdown
                </li>
              </ul>
            </DocSection>

            <DocSection title="Clipboard import behavior">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>supported only for declared textarea fields</li>
                <li>
                  clipboard HTML is preferred automatically when available
                </li>
                <li>plain text is used as a fallback when HTML is absent</li>
                <li>plain text is converted into paragraphs for HTML output</li>
                <li>imported content is trimmed before it is stored</li>
                <li>raw clipboard HTML is not rendered directly in the app</li>
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">
                If clipboard access fails or conversion cannot be completed, the
                app shows an error notification instead of silently failing.
              </p>
            </DocSection>

            <DocSection title="Groups">
              <p className="mb-3 text-sm text-muted-foreground">
                Groups are structural blocks that can contain fields and nested
                groups. Groups must be declared in front matter.
              </p>
              <CodeBlock>{`---
params:
  - name: meals
    type: group
    label: Meals
    repeat: true
    fields:
      - name: date
        type: text
        label: Date

      - name: calories
        type: number
        label: Calories
---`}</CodeBlock>
            </DocSection>

            <DocSection title="Group body syntax">
              <p className="mb-3 text-sm text-muted-foreground">
                Use <code>{`{{ group:start }}`}</code> and{" "}
                <code>{`{{ group:end }}`}</code> to enter and leave a group
                block.
              </p>
              <CodeBlock>{`{{ meals:start }}
Date: {{date}}
Calories: {{calories}}
{{ meals:end }}`}</CodeBlock>
              <p className="mt-3 text-sm text-muted-foreground">
                If a group block appears in the body but the group is not
                declared in front matter, that is a validation error.
              </p>
            </DocSection>

            <DocSection title="Group defaults">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>
                  missing <code>repeat</code> becomes <code>false</code>
                </li>
                <li>
                  missing <code>label</code> is derived from <code>name</code>
                </li>
              </ul>
            </DocSection>

            <DocSection title="Implicit fields inside groups">
              <p className="mb-3 text-sm text-muted-foreground">
                Child fields inside a declared group do not have to be declared
                in <code>fields</code>. If they are missing, they are inferred
                from the body in that group scope and default to textarea.
              </p>
              <CodeBlock>{`---
params:
  - name: meals
    type: group
    label: Meals
    repeat: true
---

{{ meals:start }}
Date: {{date}}
Calories: {{calories}}
{{ meals:end }}`}</CodeBlock>
            </DocSection>

            <DocSection title="Repeatable groups">
              <p className="mb-3 text-sm text-muted-foreground">
                Set <code>repeat: true</code> on a group to let the user create
                multiple instances through the UI.
              </p>
              <CodeBlock>{`---
params:
  - name: meals
    type: group
    repeat: true
---`}</CodeBlock>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>every group starts with one instance by default</li>
                <li>
                  <code>repeat: false</code> means exactly one instance
                </li>
                <li>
                  <code>repeat: true</code> shows a full-width Add button
                </li>
                <li>the last remaining instance cannot be removed</li>
              </ul>
            </DocSection>

            <DocSection title="Nested groups">
              <p className="mb-3 text-sm text-muted-foreground">
                Nested groups are supported when they are declared inside the
                parent group.
              </p>
              <CodeBlock>{`---
params:
  - name: days
    type: group
    label: Days
    repeat: true
    fields:
      - name: date
        type: text
        label: Date

      - name: meals
        type: group
        label: Meals
        repeat: true
        fields:
          - name: name
            type: text
            label: Meal

          - name: calories
            type: number
            label: Calories
---

{{ days:start }}
Date: {{date}}

{{ meals:start }}
Meal: {{name}}
Calories: {{calories}}
{{ meals:end }}

{{ days:end }}`}</CodeBlock>
            </DocSection>

            <DocSection title="Scope resolution">
              <p className="mb-3 text-sm text-muted-foreground">
                Field references use nearest-scope lookup.
              </p>
              <CodeBlock>{`{{date}}`}</CodeBlock>
              <p className="mt-3 text-sm text-muted-foreground">
                Resolution order:
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>current scope</li>
                <li>parent scope</li>
                <li>higher parent scopes</li>
                <li>root scope</li>
              </ol>
              <p className="mt-3 text-sm text-muted-foreground">
                First match wins.
              </p>
            </DocSection>

            <DocSection title="Scope example">
              <CodeBlock>{`---
params:
  - name: reportTitle
    type: text
    label: Report title

  - name: days
    type: group
    label: Days
    repeat: true
    fields:
      - name: date
        type: text

      - name: meals
        type: group
        label: Meals
        repeat: true
        fields:
          - name: name
            type: text
          - name: calories
            type: number
---

Report: {{reportTitle}}

{{ days:start }}
Date: {{date}}

{{ meals:start }}
Meal: {{name}}
Calories: {{calories}}
Report again: {{reportTitle}}
{{ meals:end }}

{{ days:end }}`}</CodeBlock>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>
                  <code>{`{{name}}`}</code> resolves to <code>meals.name</code>
                </li>
                <li>
                  <code>{`{{calories}}`}</code> resolves to{" "}
                  <code>meals.calories</code>
                </li>
                <li>
                  <code>{`{{date}}`}</code> falls back to <code>days.date</code>
                </li>
                <li>
                  <code>{`{{reportTitle}}`}</code> falls back to root
                </li>
              </ul>
            </DocSection>

            <DocSection title="Rendering rules">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>the same field may appear multiple times in the body</li>
                <li>all occurrences render the same value</li>
                <li>declared but unused fields are not shown in the form UI</li>
                <li>
                  repeated group instances are separated cleanly in output
                </li>
                <li>
                  boundary newlines around group blocks are trimmed during
                  rendering
                </li>
              </ul>
            </DocSection>

            <DocSection title="Group UI behavior">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>every group is shown with border and padding</li>
                <li>
                  root-level groups and nested groups use the same visual model
                </li>
                <li>
                  Add button for repeat groups is full-width and placed at the
                  bottom of the group
                </li>
                <li>
                  Remove button for repeat instances is full-width and placed at
                  the bottom of the instance
                </li>
                <li>repeat group instances do not show numbered titles</li>
              </ul>
            </DocSection>

            <DocSection title="Reusable templates">
              <p className="mb-3 text-sm text-muted-foreground">
                Add <code>reusable: true</code> in front matter if you want a
                template to appear in the <strong>Use template</strong> picker.
              </p>
              <CodeBlock>{`---
title: Role + Task Template
description: Reusable starter
reusable: true
params:
  - name: role
    type: textarea
  - name: task
    type: textarea
---

Role:
{{role}}

Task:
{{task}}`}</CodeBlock>
              <p className="mt-3 text-sm text-muted-foreground">
                When you choose <strong>Use template</strong>, the selected
                template is loaded into the editor as a starting point. The{" "}
                <code>reusable: true</code> flag is removed from the inserted
                content automatically.
              </p>
            </DocSection>

            <DocSection title="Import / export">
              <p className="mb-3 text-sm text-muted-foreground">
                Prompt Forge supports JSON-only import and export.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>export types: template, folder, workspace</li>
                <li>import targets: workspace/root or a specific folder</li>
                <li>JSON content is the source of truth</li>
                <li>file name is not used by the logic</li>
                <li>import is merge-only</li>
                <li>imported nodes always receive new internal IDs</li>
                <li>duplicate names are allowed</li>
              </ul>
              <CodeBlock>{`{
  "version": 1,
  "exportedAt": "2026-03-30T09:44:12.317Z",
  "root": {
    "type": "root",
    "children": [
      {
        "type": "folder",
        "name": "Writing",
        "children": [
          {
            "type": "template",
            "name": "Blog prompt",
            "content": "Write about {{topic}}"
          }
        ]
      }
    ]
  }
}`}</CodeBlock>
            </DocSection>

            <DocSection title="Keyboard shortcuts">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Open folder</div>
                <div className="font-mono">Ctrl+O</div>
                <div className="text-muted-foreground">Quick open file</div>
                <div className="font-mono">Ctrl+K</div>
                <div className="text-muted-foreground">Use template</div>
                <div className="font-mono">Ctrl+T</div>
                <div className="text-muted-foreground">Copy prompt</div>
                <div className="font-mono">Ctrl+Enter</div>
                <div className="text-muted-foreground">Refresh folder</div>
                <div className="font-mono">Alt+R</div>
                <div className="text-muted-foreground">Close dialogs</div>
                <div className="font-mono">Esc</div>
              </div>
            </DocSection>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function DocSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-secondary p-3 text-sm font-mono text-foreground">
      {children}
    </pre>
  );
}
