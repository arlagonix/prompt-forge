"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DocsModal({ isOpen, onClose }: DocsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Template Syntax Guide</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-80px)]">
          <div className="space-y-6 px-6 py-4">
            <DocSection title="Overview">
              <p className="mb-3 text-sm text-muted-foreground">
                Templates use YAML front matter for parameter definitions and
                simple <code>{`{{name}}`}</code> placeholders inside the body.
              </p>
              <CodeBlock>{`---
title: Example
description: A prompt template
params:
  - name: audience
    label: Target audience
    type: select
    values: [Beginners, Experts, Executives]
    default: Beginners
  - name: tone
    type: radio
    values: [Neutral, Friendly, Formal]
    default: Neutral
  - name: constraints
    type: textarea
    default: ""
---

Write a response for {{audience}} in a {{tone}} tone.

Constraints:
{{constraints}}`}</CodeBlock>
            </DocSection>

            <DocSection title="Front Matter">
              <p className="mb-3 text-sm text-muted-foreground">
                The section between the two <code>---</code> lines is YAML front
                matter. It defines the template title, description, reusable
                flag, and parameter list.
              </p>
              <CodeBlock>{`---
title: Example
description: A prompt template
reusable: true
params:
  - name: audience
    type: text
---`}</CodeBlock>
            </DocSection>

            <DocSection title="Placeholders">
              <p className="mb-3 text-sm text-muted-foreground">
                In the body, placeholders are simple. They should match the
                parameter names from <code>params</code>.
              </p>
              <CodeBlock>{`Hello, {{name}}!
Goal:
{{goal}}`}</CodeBlock>
            </DocSection>

            <DocSection title="Reusable Templates">
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
                template is loaded into the editor as a starting point. The
                <code>reusable: true</code> flag is removed from the inserted
                content automatically.
              </p>
            </DocSection>

            <DocSection title="Parameter Fields">
              <p className="mb-3 text-sm text-muted-foreground">
                Each item inside <code>params</code> defines one form field.
              </p>
              <CodeBlock>{`params:
  - name: audience
    label: Target audience
    type: select
    values: [Beginners, Experts, Executives]
    default: Beginners`}</CodeBlock>
            </DocSection>

            <DocSection title="Supported Types">
              <CodeBlock>{`type: text
type: textarea
type: number
type: checkbox
type: select
type: radio`}</CodeBlock>
            </DocSection>

            <DocSection title="Fallback Behavior">
              <p className="mb-3 text-sm text-muted-foreground">
                If a placeholder exists in the body but is not defined in
                <code>params</code>, it falls back to a normal textarea.
              </p>
              <CodeBlock>{`---
title: Simple Template
---

Main task:
{{task}}

Extra notes:
{{notes}}`}</CodeBlock>
            </DocSection>

            <DocSection title="Text Input">
              <CodeBlock>{`params:
  - name: name
    label: Name
    type: text
    default: John`}</CodeBlock>
            </DocSection>

            <DocSection title="Textarea">
              <CodeBlock>{`params:
  - name: constraints
    label: Constraints
    type: textarea
    default: ""`}</CodeBlock>
            </DocSection>

            <DocSection title="Number">
              <CodeBlock>{`params:
  - name: age
    label: Age
    type: number
    default: 42`}</CodeBlock>
            </DocSection>

            <DocSection title="Checkbox">
              <CodeBlock>{`params:
  - name: include_examples
    label: Include examples
    type: checkbox
    default: true`}</CodeBlock>
            </DocSection>

            <DocSection title="Select">
              <CodeBlock>{`params:
  - name: audience
    label: Target audience
    type: select
    values: [Beginners, Experts, Executives]
    default: Beginners`}</CodeBlock>
            </DocSection>

            <DocSection title="Radio">
              <CodeBlock>{`params:
  - name: tone
    label: Tone
    type: radio
    values: [Neutral, Friendly, Formal]
    default: Neutral`}</CodeBlock>
            </DocSection>

            <DocSection title="Notes">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>
                  Parameter names should match the placeholders in the body.
                </li>
                <li>
                  Use simple placeholders like <code>{`{{name}}`}</code>.
                </li>
                <li>
                  <code>values</code> is used for <code>select</code> and{" "}
                  <code>radio</code>.
                </li>
                <li>
                  <code>default</code> sets the initial value shown in the form.
                </li>
                <li>
                  <code>reusable: true</code> makes a template available in the
                  reusable template picker.
                </li>
              </ul>
            </DocSection>

            <DocSection title="Keyboard Shortcuts">
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
