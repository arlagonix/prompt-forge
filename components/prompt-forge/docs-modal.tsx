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
import { useRef } from "react";

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DocsModal({ isOpen, onClose }: DocsModalProps) {
  const isMobile = useIsMobile();
  const contentRef = useRef<HTMLDivElement | null>(null);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "p-0",
          isMobile
            ? "h-[100dvh] w-screen max-w-none rounded-none border-0"
            : "max-h-[85vh] max-w-3xl",
        )}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          contentRef.current?.focus();
        }}
      >
        <DialogHeader className="border-b border-border px-4 py-4 md:px-6">
          <DialogTitle>Prompt Forge Guide</DialogTitle>
        </DialogHeader>

        <ScrollArea
          className={cn(
            isMobile ? "h-[calc(100dvh-73px)]" : "max-h-[calc(85vh-80px)]",
          )}
        >
          <div
            ref={contentRef}
            tabIndex={-1}
            className="space-y-6 px-6 py-4 outline-none"
          >
            <DocSection title="What Prompt Forge does">
              <p className="mb-3 text-sm text-muted-foreground">
                Prompt Forge stores prompts as Markdown templates. The template
                can contain placeholders like <code>{`{{task}}`}</code>. The app
                turns those placeholders into form fields, lets you fill them in,
                shows the final rendered result in Preview, and lets you copy the
                finished prompt.
              </p>
              <CodeBlock>{`Template source
----------------
Write a summary for:
{{topic}}

Audience:
{{audience}}

UI generated from the template
------------------------------
topic    -> input field
 audience -> input field

Preview output
--------------
Write a summary for:
Release notes for v1.29

Audience:
Developers`}</CodeBlock>
            </DocSection>

            <DocSection title="The basic workflow">
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Choose a template from the sidebar or create a new one.</li>
                <li>
                  Click <strong>Edit</strong> if you want to change the template
                  source.
                </li>
                <li>
                  Put placeholders like <code>{`{{task}}`}</code> in the body.
                </li>
                <li>Save the template.</li>
                <li>Fill the generated fields in the main panel.</li>
                <li>Review the result in <strong>Preview</strong>.</li>
                <li>
                  Click <strong>Copy Prompt</strong> to copy the rendered output.
                </li>
              </ol>
            </DocSection>

            <DocSection title="How the UI is organized">
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  <strong>Sidebar:</strong> browse folders, create templates,
                  move items, rename items, import, and export.
                </li>
                <li>
                  <strong>Main panel:</strong> fill the fields generated from the
                  currently selected template.
                </li>
                <li>
                  <strong>Preview:</strong> shows the final rendered prompt before
                  you copy it.
                </li>
                <li>
                  <strong>Editor:</strong> used to write or change the template
                  source.
                </li>
              </ul>
            </DocSection>

            <DocSection title="Important terms">
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  <strong>Template source:</strong> the raw Markdown file,
                  optionally with YAML front matter.
                </li>
                <li>
                  <strong>Rendered prompt:</strong> the final text after all
                  placeholders are replaced with values.
                </li>
                <li>
                  <strong>View source:</strong> opens the raw template in a
                  read-only view.
                </li>
                <li>
                  <strong>Copy template source:</strong> copies the raw template
                  file exactly as written.
                </li>
                <li>
                  <strong>Copy Prompt:</strong> copies the rendered output shown
                  in Preview.
                </li>
                <li>
                  <strong>Reusable template:</strong> a starter template that can
                  be inserted into the editor from the picker.
                </li>
              </ul>
            </DocSection>

            <DocSection title="Your first template">
              <p className="mb-3 text-sm text-muted-foreground">
                You can start with plain Markdown and placeholders only. Front
                matter is optional until you need richer field types or groups.
              </p>
              <CodeBlock>{`You are helping with the following task.

Task:
{{task}}

Context:
{{context}}

Constraints:
{{constraints}}`}</CodeBlock>
              <p className="mt-3 text-sm text-muted-foreground">
                This creates three fields automatically. Undeclared placeholders
                default to textarea inputs.
              </p>
            </DocSection>

            <DocSection title="When to use front matter">
              <p className="mb-3 text-sm text-muted-foreground">
                Add YAML front matter when you want labels, field types, choice
                fields, clipboard import, reusable templates, or nested groups.
              </p>
              <CodeBlock>{`---
title: Blog summary
params:
  - name: topic
    type: text
    label: Topic

  - name: audience
    type: select
    label: Audience
    values: [developers, managers, customers]
---

Summarize:
{{topic}}

Audience:
{{audience}}`}</CodeBlock>
            </DocSection>

            <DocSection title="Source vs output">
              <p className="mb-3 text-sm text-muted-foreground">
                A common source of confusion is that the app works with two
                representations of the same template.
              </p>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  The <strong>source</strong> is the Markdown template that you
                  edit.
                </li>
                <li>
                  The <strong>output</strong> is the rendered prompt produced from
                  the source and the current field values.
                </li>
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">
                Use <strong>View source</strong> when you want to inspect the
                template itself. Use <strong>Preview</strong> and
                <strong> Copy Prompt</strong> when you want the final result.
              </p>
            </DocSection>

            <DocSection title="Common actions">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Create template</div>
                <div>Sidebar menu → New Template</div>
                <div className="text-muted-foreground">Edit template</div>
                <div>Main panel menu → Edit</div>
                <div className="text-muted-foreground">View source</div>
                <div>Main panel menu → View source</div>
                <div className="text-muted-foreground">Copy final prompt</div>
                <div>Main panel → Copy Prompt</div>
                <div className="text-muted-foreground">Copy raw source</div>
                <div>Main panel menu → Copy template source</div>
                <div className="text-muted-foreground">Reset field values</div>
                <div>Main panel → Reset</div>
                <div className="text-muted-foreground">Insert reusable starter</div>
                <div>Editor → Insert template</div>
                <div className="text-muted-foreground">Export template</div>
                <div>Main panel menu → Export</div>
              </div>
            </DocSection>

            <DocSection title="Template syntax basics">
              <p className="mb-3 text-sm text-muted-foreground">
                Simple placeholders use double curly braces.
              </p>
              <CodeBlock>{`{{task}}
{{audience}}
{{tone}}`}</CodeBlock>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>undeclared placeholders are valid</li>
                <li>undeclared placeholders default to textarea fields</li>
                <li>field names are technical identifiers</li>
                <li>use <code>label</code> for user-facing names</li>
              </ul>
            </DocSection>

            <DocSection title="Supported field types">
              <CodeBlock>{`type: textarea
type: text
type: number
type: checkbox
type: select
type: combobox
type: radio`}</CodeBlock>
              <p className="mt-3 text-sm text-muted-foreground">
                If <code>type</code> is omitted for a declared field, it defaults
                to <code>textarea</code>.
              </p>
            </DocSection>

            <DocSection title="Groups and repeatable blocks">
              <p className="mb-3 text-sm text-muted-foreground">
                Use groups when one section contains nested fields or when users
                should be able to add multiple repeated blocks.
              </p>
              <CodeBlock>{`---
params:
  - name: steps
    type: group
    label: Steps
    repeat: true
    fields:
      - name: title
        type: text
        label: Title
      - name: details
        type: textarea
        label: Details
---

{% group steps %}
Step: {{title}}
{{details}}
{% end_group %}`}</CodeBlock>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>groups must be declared in front matter</li>
                <li>
                  use <code>{`{% group group_name %}`}</code> and
                  <code>{` {% end_group %}`}</code> in the body
                </li>
                <li>
                  <code>repeat: true</code> lets the user add multiple instances
                </li>
              </ul>
            </DocSection>

            <DocSection title="Conditional sections">
              <p className="mb-3 text-sm text-muted-foreground">
                Use conditionals when a section should appear only for certain
                field values. Logic tags use <code>{`{% ... %}`}</code>; value
                placeholders still use <code>{`{{ ... }}`}</code>.
              </p>
              <CodeBlock>{`{% if context empty %}
No context was provided.

{% else %}
Context:
{{context}}

{% end_if %}`}</CodeBlock>
              <CodeBlock>{`{% if output_format is "JSON" %}
Return valid JSON only.

{% else_if output_format is "Markdown" %}
Return Markdown.

{% else %}
Return plain text.

{% end_if %}`}</CodeBlock>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li><code>field empty</code> checks for an empty value</li>
                <li><code>field not_empty</code> checks for a filled value</li>
                <li><code>field checked</code> and <code>field unchecked</code> are useful for checkboxes</li>
                <li><code>field is "value"</code> checks selected/text values</li>
                <li><code>field is_not "value"</code> checks for anything else</li>
              </ul>
            </DocSection>

            <DocSection title="Reusable templates">
              <p className="mb-3 text-sm text-muted-foreground">
                Set <code>reusable: true</code> in front matter if the template
                should appear in the reusable template picker inside the editor.
              </p>
              <CodeBlock>{`---
title: Role + Task starter
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
                When inserted, the reusable template becomes the starting content
                of the current editor and the <code>reusable: true</code> flag is
                removed automatically.
              </p>
            </DocSection>

            <DocSection title="Clipboard import">
              <p className="mb-3 text-sm text-muted-foreground">
                Declared textarea fields can expose an <strong>Import from
                clipboard</strong> button.
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
            </DocSection>

            <DocSection title="Folder import">
              <p className="mb-3 text-sm text-muted-foreground">
                Declared textarea fields can expose an <strong>Insert folder contents</strong> button and a
                drag-and-drop area that recursively read matching files and replace the whole textarea.
              </p>
              <CodeBlock>{`---
params:
  - name: context
    type: textarea
    label: Context
    folder_import:
      enabled: true
      formats: [.md, .txt]
---`}</CodeBlock>
              <p className="mt-3 text-sm text-muted-foreground">
                When <code>formats</code> is omitted it defaults to <code>[.md]</code>. Imported files are
                sorted by relative path and rendered as <code>[File: path/to/file.md]</code> blocks.
              </p>
            </DocSection>

            <DocSection title="Import and export">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>JSON only</li>
                <li>export types: template, folder, workspace</li>
                <li>import is merge-only</li>
                <li>imported nodes receive new internal IDs</li>
                <li>duplicate names are allowed</li>
              </ul>
              <CodeBlock>{`{
  "version": 1,
  "exportedAt": "2026-03-30T09:44:12.317Z",
  "root": {
    "type": "root",
    "children": []
  }
}`}</CodeBlock>
            </DocSection>

            <DocSection title="Keyboard shortcuts">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Quick convert</div>
                <div className="font-mono">Ctrl+O</div>
                <div className="text-muted-foreground">Quick open</div>
                <div className="font-mono">Ctrl+K</div>
                <div className="text-muted-foreground">New template</div>
                <div className="font-mono">Ctrl+N</div>
                <div className="text-muted-foreground">Edit current template</div>
                <div className="font-mono">Ctrl+E</div>
                <div className="text-muted-foreground">Insert reusable template</div>
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
