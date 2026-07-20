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
        onOpenAutoFocus={(event) => {
          event.preventDefault();
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
            <DocSection title="Template structure">
              <p className="mb-3 text-sm text-muted-foreground">
                A template contains strict JSON between the two
                <code> --- </code> markers and Markdown below it. The JSON
                defines the complete form. The Markdown body only uses the
                configured values.
              </p>
              <CodeBlock>{`---
{
  "form": [
    {
      "type": "text",
      "id": "topic",
      "name": "Topic"
    }
  ]
}
---

Write about {{topic}}.`}</CodeBlock>
            </DocSection>

            <DocSection title="Form order and field IDs">
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>The order of nodes in <code>form</code> is the UI order.</li>
                <li>The prompt body never creates or reorders fields.</li>
                <li>Only fields declared in <code>form</code> appear in the UI.</li>
                <li>Every field requires a globally unique <code>id</code>.</li>
                <li><code>name</code> is the user-facing field label.</li>
                <li>Use field IDs in placeholders such as <code>{`{{topic}}`}</code>.</li>
              </ul>
            </DocSection>

            <DocSection title="Supported field types">
              <CodeBlock>{`textarea
text
number
date
checkbox
select
combobox
radio`}</CodeBlock>
              <CodeBlock>{`{
  "type": "text",
  "id": "quantity",
  "name": "Quantity",
  "default": "1",
  "inline": true
}`}</CodeBlock>
            </DocSection>

            <DocSection title="Visual groups">
              <p className="mb-3 text-sm text-muted-foreground">
                A group only organizes the form visually. It does not create a
                value scope and is never referenced in the prompt. Its
                <code>name</code> and <code>description</code> are optional.
              </p>
              <CodeBlock>{`{
  "type": "group",
  "name": "Sale settings",
  "description": "Configure the Auction House sale.",
  "style": "dashed",
  "children": [
    {
      "type": "text",
      "id": "quantity",
      "name": "Quantity",
      "default": "1"
    },
    {
      "type": "text",
      "id": "auction_cut",
      "name": "Auction cut",
      "default": "5%"
    }
  ]
}`}</CodeBlock>
              <p className="mt-3 text-sm text-muted-foreground">
                The body still references the fields directly:
                <code>{` {{quantity}} `}</code> and
                <code>{` {{auction_cut}}`}</code>.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Group styles are <code>solid</code>, <code>dashed</code>, and
                <code>none</code>. The default is <code>solid</code>. The
                <code>none</code> style removes only the border while preserving
                the group background, padding, and spacing.
              </p>
            </DocSection>

            <DocSection title="Headers and horizontal rules">
              <p className="mb-3 text-sm text-muted-foreground">
                Headers and horizontal rules are visual nodes, so they do not
                need IDs.
              </p>
              <CodeBlock>{`{
  "type": "header",
  "name": "Auction House prices",
  "description": "Enter the current lowest buyout prices."
},
{
  "type": "header",
  "description": "This header displays descriptive text without a title."
},
{
  "type": "hr"
},
{
  "type": "hr",
  "style": "dashed"
}`}</CodeBlock>
              <p className="mt-3 text-sm text-muted-foreground">
                A header must provide a name, a description, or both.
                Horizontal rules are solid by default. Supported styles are
                <code> solid </code> and <code> dashed</code>.
              </p>
            </DocSection>

            <DocSection title="Choice fields">
              <CodeBlock>{`{
  "type": "select",
  "id": "tone",
  "name": "Tone",
  "random": true,
  "values": ["Direct", "Friendly", "Formal"]
}`}</CodeBlock>
              <p className="mt-3 text-sm text-muted-foreground">
                Select and combobox fields can also use labelled option groups
                through the <code>groups</code> property.
              </p>
            </DocSection>

            <DocSection title="Repeaters">
              <p className="mb-3 text-sm text-muted-foreground">
                Repeatable data uses a separate <code>repeater</code> node. A
                repeater has an ID because its instances are referenced in the
                prompt. Visual groups remain non-repeatable and ID-free.
              </p>
              <CodeBlock>{`---
{
  "form": [
    {
      "type": "repeater",
      "id": "materials",
      "name": "Materials",
      "children": [
        {
          "type": "text",
          "id": "material_name",
          "name": "Material"
        },
        {
          "type": "text",
          "id": "material_price",
          "name": "Price"
        }
      ]
    }
  ]
}
---

{% repeat materials %}
- {{material_name}}: {{material_price}}
{% end_repeat %}`}</CodeBlock>
            </DocSection>

            <DocSection title="Conditional sections">
              <CodeBlock>{`{% if context empty %}
No context was provided.
{% else %}
Context: {{context}}
{% end_if %}`}</CodeBlock>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li><code>field empty</code></li>
                <li><code>field not_empty</code></li>
                <li><code>field checked</code> / <code>field unchecked</code></li>
                <li><code>field is "value"</code></li>
                <li><code>field is_not "value"</code></li>
              </ul>
            </DocSection>

            <DocSection title="Clipboard and folder import">
              <CodeBlock>{`{
  "type": "textarea",
  "id": "source",
  "name": "Source",
  "clipboard_import": {
    "enabled": true,
    "formats": ["html", "minified", "markdown"],
    "default_format": "markdown"
  },
  "folder_import": {
    "enabled": true,
    "formats": [".md", ".txt"]
  }
}`}</CodeBlock>
              <p className="mt-3 text-sm text-muted-foreground">
                These options are supported only by textarea fields.
              </p>
            </DocSection>

            <DocSection title="Reusable templates">
              <CodeBlock>{`---
{
  "reusable": true,
  "form": [
    {
      "type": "textarea",
      "id": "task",
      "name": "Task"
    }
  ]
}
---

Task:
{{task}}`}</CodeBlock>
            </DocSection>

            <DocSection title="Complete example">
              <CodeBlock>{`---
{
  "form": [
    {
      "type": "header",
      "name": "Frostweave Bag calculator",
      "description": "Enter current prices and sale settings."
    },
    {
      "type": "group",
      "name": "Prices",
      "style": "solid",
      "children": [
        {
          "type": "text",
          "id": "frostweave_bag",
          "name": "Frostweave Bag",
          "inline": true
        },
        {
          "type": "text",
          "id": "eternium_thread",
          "name": "Eternium Thread",
          "default": "2g 85s",
          "inline": true
        }
      ]
    },
    {
      "type": "hr",
      "style": "dashed"
    },
    {
      "type": "group",
      "name": "Sale settings",
      "children": [
        {
          "type": "text",
          "id": "quantity",
          "name": "Quantity",
          "default": "1",
          "inline": true
        },
        {
          "type": "text",
          "id": "auction_cut",
          "name": "Auction cut",
          "default": "5%",
          "inline": true
        }
      ]
    }
  ]
}
---

Frostweave Bag: {{frostweave_bag}}
Eternium Thread: {{eternium_thread}}
Quantity: {{quantity}}
Auction cut: {{auction_cut}}`}</CodeBlock>
            </DocSection>

            <DocSection title="Keyboard shortcuts">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Quick convert</div>
                <div className="font-mono">Ctrl+O</div>
                <div className="text-muted-foreground">Quick open</div>
                <div className="font-mono">Ctrl+K</div>
                <div className="text-muted-foreground">New template</div>
                <div className="font-mono">Ctrl+N</div>
                <div className="text-muted-foreground">Edit template</div>
                <div className="font-mono">Ctrl+E</div>
                <div className="text-muted-foreground">Copy prompt</div>
                <div className="font-mono">Ctrl+Enter</div>
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
