# Prompt Forge

Prompt Forge is a local-first app for building prompts from Markdown templates.

It lets you:

- organize templates in a folder/tree
- fill templates through generated forms
- preview the final rendered prompt
- copy the result
- import and export templates/folders/root as JSON
- use structured repeatable groups in templates

## Screenshots

<img width="2558" height="1266" alt="image" src="https://github.com/user-attachments/assets/6ceef05b-b833-4de5-ae4f-9a640964eb1d" />

<img width="2558" height="1267" alt="image" src="https://github.com/user-attachments/assets/744024ff-b1f7-4aef-bd7c-79bcb71e6891" />

<img width="2558" height="1268" alt="image" src="https://github.com/user-attachments/assets/e74d8af1-9350-4b66-8879-18e59d23960a" />

<img width="2558" height="1272" alt="image" src="https://github.com/user-attachments/assets/695c7131-407a-4003-87df-ad05824ffc39" />

<img width="593" height="526" alt="image" src="https://github.com/user-attachments/assets/22bae342-4949-495a-8c47-840666a96664" />

<img width="2559" height="1268" alt="image" src="https://github.com/user-attachments/assets/06e9a501-fd51-4dcd-b76f-e5ff5f9dbee8" />

## Main ideas

Prompt Forge treats a template as:

- Markdown body
- optional frontmatter for metadata and richer field definitions

Simple templates can be written with only placeholders in the body.

Structured templates can define fields and groups in frontmatter and use group blocks in the body.

## Features

- local-first template management
- root / folder / template import-export in JSON
- sidebar browsing with nested folders
- template search
- template picker / "Use template"
- dynamic form generation from template body and frontmatter
- live preview
- copy rendered prompt
- grouped fields
- repeatable groups
- nested groups
- per-template saved values
- theme switcher
- refresh from UI

## Import / export

Prompt Forge supports JSON-only import and export.

### Export types

- single template
- folder with all children
- whole root/workspace

### Import targets

- root
- a specific folder

### Export file naming

Examples:

- `export.template.2026-03-30.12-44-12.json`
- `export.folder.2026-03-30.12-44-12.json`
- `export.workspace.2026-03-30.12-44-12.json`

### Import / export behavior

- JSON content is the source of truth
- file name is not used by the logic
- import is merge-only
- imported nodes always receive new internal IDs
- duplicate names are allowed
- no UI/session state is included
- content only: templates, folder structure, timestamps when available

### Export schema

All exports use one unified schema:

```json
{
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
}
```

Node kinds:

- `root`
- `folder`
- `template`

Required fields:

### Root node

```json
{
  "type": "root",
  "children": []
}
```

### Folder node

```json
{
  "type": "folder",
  "name": "Folder name",
  "children": []
}
```

### Template node

```json
{
  "type": "template",
  "name": "Template name",
  "content": "Template body"
}
```

Optional on folder/template:

- `createdAt`
- `updatedAt`

### Validation rules

Import fails if:

- JSON is invalid
- `version` is missing or unsupported
- `root` is missing
- `root.type !== "root"`
- `children` is malformed
- a folder/template node is structurally invalid

Import is all-or-nothing.

## Template syntax

Prompt Forge supports two levels of template complexity:

- simple body-only placeholders
- structured templates with frontmatter groups

## Simple placeholders

Basic placeholders use double curly braces:

```txt
{{task}}
{{audience}}
{{tone}}
```

If a field is not declared in frontmatter, it is still valid.

Implicit fields default to:

- `type: textarea`
- `label`: derived from `name`

Example:

```md
Task:
{{task}}

Audience:
{{audience}}
```

This will render two textarea fields automatically.

## Name rules

Field and group names are technical identifiers.

Valid names match:

```txt
^[a-zA-Z0-9_-]+$
```

Use `label` for human-readable UI text.

Examples:

- valid: `task`
- valid: `current_state`
- valid: `report-title`
- invalid: `task name`
- invalid: `title!`
- invalid: `{task}`

## Frontmatter

Frontmatter is optional for plain fields and required for groups.

Example:

```yaml
---
params:
  - name: reportTitle
    type: text
    label: Report title

  - name: intro
    type: textarea
    label: Introduction
---
```

### Field defaults

For declared fields:

- missing `type` -> `textarea`
- missing `label` -> derived from `name`

Unknown metadata keys are ignored.

If a declared field is never used in the body, it is not rendered in the UI.

## Supported field types

Supported field types:

- `textarea`
- `text`
- `number`

Example:

```yaml
---
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
---
```

## Groups

Groups are structural blocks that can contain fields and nested groups.

Groups must be declared in frontmatter.

Example:

```yaml
---
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
---
```

### Group defaults

For declared groups:

- missing `repeat` -> `false`
- missing `label` -> derived from `name`

### Group body syntax

Groups are used in the body with start/end markers:

```txt
{{ meals:start }}
Date: {{date}}
Calories: {{calories}}
{{ meals:end }}
```

If a group block appears in the body but the group is not declared in frontmatter, that is a validation error.

### Group child fields

Child fields inside a declared group do not have to be declared in frontmatter.

If omitted from `fields`, they are inferred from usage in the body and default to:

- `type: textarea`
- `label`: derived from `name`

Example:

```yaml
---
params:
  - name: meals
    type: group
    label: Meals
    repeat: true
---
```

```txt
{{ meals:start }}
Date: {{date}}
Calories: {{calories}}
{{ meals:end }}
```

In this case, `date` and `calories` are inferred inside the `meals` scope.

## Repeatable groups

Groups can be repeatable with:

```yaml
repeat: true
```

Behavior:

- every group starts with one instance by default
- `repeat: false` -> exactly one instance
- `repeat: true` -> user can add more instances with the Add button
- last remaining instance cannot be removed

## Nested groups

Nested groups are supported when they are declared inside the parent group.

Example:

```yaml
---
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
```

Body:

```txt
{{ days:start }}
Date: {{date}}

{{ meals:start }}
Meal: {{name}}
Calories: {{calories}}
{{ meals:end }}

{{ days:end }}
```

## Scope resolution

Field references use nearest-scope lookup.

For a placeholder like:

```txt
{{date}}
```

resolution order is:

1. current scope
2. parent scope
3. higher parent scopes
4. root scope

First match wins.

This allows nested groups to use parent/root fields naturally without extra syntax.

Example:

```yaml
---
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
```

```txt
Report: {{reportTitle}}

{{ days:start }}
Date: {{date}}

{{ meals:start }}
Meal: {{name}}
Calories: {{calories}}
Report again: {{reportTitle}}
{{ meals:end }}

{{ days:end }}
```

Inside `meals`:

- `{{name}}` resolves to `meals.name`
- `{{calories}}` resolves to `meals.calories`
- `{{date}}` falls back to `days.date` if needed
- `{{reportTitle}}` falls back to root

## Rendering rules

- same field may appear multiple times in the body
- all occurrences render the same value
- declared but unused fields are not rendered in the form UI
- repeated group instances are separated cleanly in generated output
- leading/trailing boundary newlines around group blocks are trimmed during rendering

## Group UI behavior

- every group is shown with border and padding
- root-level groups and nested groups use the same general visual model
- Add button for repeat groups is full-width and placed at the bottom of the group
- Remove button for repeat instances is full-width and placed at the bottom of the instance
- repeat group instances do not show numbered titles

## Example templates

### Small repeatable group example

```md
---
params:
  - name: meals
    type: group
    label: Meals
    repeat: true
    fields:
      - name: date
        type: text
        label: Date
      - name: description
        type: textarea
        label: What I ate
      - name: calories
        type: number
        label: Calories
---

{{ meals:start }}
Date: {{date}}
What I ate that day: {{description}}
Calories: {{calories}}
{{ meals:end }}
```

### Larger nested example

```md
---
params:
  - name: reportTitle
    type: text
    label: Report title

  - name: intro
    type: textarea
    label: Introduction

  - name: days
    type: group
    label: Days
    repeat: true
    fields:
      - name: date
        type: text
        label: Date

      - name: weather
        type: text
        label: Weather

      - name: notes
        type: textarea
        label: Notes

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

          - name: comment
            type: textarea
            label: Comment
---

Report title: {{reportTitle}}

Introduction:
{{intro}}

{{ days:start }}
Date: {{date}}
Weather: {{weather}}

Notes:
{{notes}}

Meals for this day:
{{ meals:start }}
- Meal: {{name}}
- Calories: {{calories}}
- Comment: {{comment}}
{{ meals:end }}

{{ days:end }}
```

## Data storage

Prompt Forge is local-first.

Project data is stored in IndexedDB:

- folders
- prompts
- app state

Per-template form values are stored locally as well.

## Notes

- file names in export are generated for portability
- duplicate names are allowed in imports
- import/export logic relies on JSON content, not file name
- groups are the only structure that must be explicitly declared
- plain fields remain lightweight and flexible by design
