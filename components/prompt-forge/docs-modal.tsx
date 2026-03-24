"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface DocsModalProps {
  isOpen: boolean
  onClose: () => void
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
            <DocSection title="Front Matter">
              <p className="text-sm text-muted-foreground mb-3">
                Add metadata at the top of your template file. This is shown in the header and excluded from the generated prompt.
              </p>
              <CodeBlock>{`---
name: Name of the prompt
description: Description of the prompt
tags:
  - coding
  - analysis
owner: John
---
Your prompt starts here... {{message}}`}</CodeBlock>
            </DocSection>

            <DocSection title="Basic Placeholders">
              <CodeBlock>{`{{message}}
{{message | label=Your message}}
{{message | default=Hello}}
{{message | label=Your message | default=Hello}}`}</CodeBlock>
            </DocSection>

            <DocSection title="Textarea (default type)">
              <CodeBlock>{`{{bio}}
{{bio | type=textarea}}
{{bio | type=textarea | label=Bio}}
{{bio | type=textarea | height=10}}
{{description | type=textarea | label=Long description | height=15 | default=Enter text...}}`}</CodeBlock>
            </DocSection>

            <DocSection title="Text Input">
              <CodeBlock>{`{{title | type=text}}
{{title | type=text | label=Title}}
{{title | type=text | default=Hello}}`}</CodeBlock>
            </DocSection>

            <DocSection title="Number Input">
              <CodeBlock>{`{{age | type=number}}
{{age | type=number | label=Age}}
{{age | type=number | default=42}}`}</CodeBlock>
            </DocSection>

            <DocSection title="Checkbox">
              <CodeBlock>{`{{agree | type=checkbox}}
{{agree | type=checkbox | label=I agree}}
{{agree | type=checkbox | default=true}}`}</CodeBlock>
            </DocSection>

            <DocSection title="Select Dropdown">
              <CodeBlock>{`{{color | type=select | value=Red | value=Green | value=Blue}}
{{color | type=select | label=Pick a color | value=Red | value=Green | value=Blue}}
{{color | type=select | value=One | value=Two | value=Three | default=Two}}`}</CodeBlock>
            </DocSection>

            <DocSection title="Radio Buttons">
              <CodeBlock>{`{{choice | type=radio | value=A | value=B | value=C}}
{{choice | type=radio | label=Choose one | value=A | value=B | value=C}}
{{choice | type=radio | value=One | value=Two | value=Three | default=Three}}`}</CodeBlock>
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
  )
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
      {children}
    </div>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-secondary p-3 rounded-md text-sm font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  )
}
