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
      <DialogContent className="max-w-3xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle>Template Syntax Guide</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-80px)]">
          <div className="px-6 py-4 space-y-6">
            <DocSection title="Overview">
              <p className="text-sm text-muted-foreground mb-3">
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
              <p className="text-sm text-muted-foreground mb-3">
                The section between the two <code>---</code> lines is YAML front
                matter. It defines the template title, description, and
                parameter list.
              </p>
              <CodeBlock>{`---
title: Example
description: A prompt template
params:
  - name: audience
    type: text
---`}</CodeBlock>
            </DocSection>

            <DocSection title="Placeholders">
              <p className="text-sm text-muted-foreground mb-3">
                In the body, placeholders are simple. They should match the
                parameter names from <code>params</code>.
              </p>
              <CodeBlock>{`Hello, {{name}}!
Goal:
{{goal}}`}</CodeBlock>
            </DocSection>

            <DocSection title="Parameter Fields">
              <p className="text-sm text-muted-foreground mb-3">
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
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
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
              </ul>
            </DocSection>

            <DocSection title="Keyboard Shortcuts">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Open folder</div>
                <div className="font-mono">Ctrl+O</div>
                <div className="text-muted-foreground">Quick open file</div>
                <div className="font-mono">Ctrl+K</div>
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
      <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-secondary p-3 rounded-md text-sm font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}
