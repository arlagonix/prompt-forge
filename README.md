# Prompt Forge

Prompt Forge is a local-first app for building prompts from Markdown templates and structured forms.

A template has two parts:

1. Strict JSON between `---` markers. This defines the complete form.
2. Markdown below the JSON. This defines the final prompt and references field values.

## Basic template

```md
---
{
  "form": [
    {
      "type": "text",
      "id": "topic",
      "name": "Topic"
    },
    {
      "type": "select",
      "id": "audience",
      "name": "Audience",
      "values": ["Developers", "Managers", "Customers"]
    }
  ]
}
---

Write a summary about {{topic}} for {{audience}}.
```

The JSON config is the sole source of truth for the form:

- nodes appear in the order listed in `form`
- only configured fields appear
- placeholder order does not affect form order
- placeholders do not create fields
- every data field has a globally unique `id`
- `name` is the user-facing label

## Supported form nodes

### Fields

Supported field types:

- `textarea`
- `text`
- `number`
- `date`
- `checkbox`
- `select`
- `combobox`
- `radio`

```json
{
  "type": "text",
  "id": "quantity",
  "name": "Quantity",
  "default": "1",
  "inline": true
}
```

Field IDs are referenced directly in the Markdown body:

```md
Quantity: {{quantity}}
```

### Visual groups

Groups organize fields visually. They do not create a value scope and are not referenced in the prompt.

```json
{
  "type": "group",
  "name": "Sale settings",
  "description": "Configure the Auction House sale.",
  "children": [
    {
      "type": "text",
      "id": "quantity",
      "name": "Quantity"
    },
    {
      "type": "text",
      "id": "auction_cut",
      "name": "Auction cut"
    }
  ]
}
```

Both `name` and `description` are optional for visual groups.

Groups support three border styles:

```json
{
  "type": "group",
  "name": "Sale settings",
  "style": "dashed",
  "children": []
}
```

Supported values are `solid`, `dashed`, and `none`. The default is `solid`.

### Headers

```json
{
  "type": "header",
  "name": "Auction House prices",
  "description": "Enter the current lowest buyout prices."
}
```

Headers do not need IDs.

`name` and `description` are both optional individually, but a header must
provide at least one of them. A description-only header is valid:

```json
{
  "type": "header",
  "description": "Enter the current lowest buyout prices."
}
```

### Horizontal rules

Solid rule:

```json
{
  "type": "hr"
}
```

Dashed rule:

```json
{
  "type": "hr",
  "style": "dashed"
}
```

Horizontal rules do not need IDs. `style` is optional and defaults to `solid`.

### Repeaters

Repeatable data uses a separate `repeater` node. Repeaters require IDs because their instances are rendered in the prompt.

```md
---
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
{% end_repeat %}
```

Field and repeater IDs share one global namespace and must be unique throughout the form config.

## Choice fields

Simple values:

```json
{
  "type": "select",
  "id": "tone",
  "name": "Tone",
  "random": true,
  "values": ["Direct", "Friendly", "Formal"]
}
```

Label/value options:

```json
{
  "type": "select",
  "id": "format",
  "name": "Format",
  "values": [
    { "label": "Markdown", "value": "md" },
    { "label": "Plain text", "value": "text" }
  ]
}
```

Grouped options are supported for `select` and `combobox` through the `groups` property.

## Conditional output

```md
{% if context empty %}
No context was provided.
{% else %}
Context:
{{context}}
{% end_if %}
```

Supported operators:

- `field empty`
- `field not_empty`
- `field checked`
- `field unchecked`
- `field is "value"`
- `field is_not "value"`

## Clipboard and folder import

Textarea fields can expose clipboard and folder import tools.

```json
{
  "type": "textarea",
  "id": "source",
  "name": "Source",
  "clipboard_import": {
    "enabled": true,
    "formats": ["html", "minified", "markdown", "plain_text"],
    "default_format": "markdown"
  },
  "folder_import": {
    "enabled": true,
    "formats": [".md", ".txt"]
  }
}
```

## Reusable templates

```md
---
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
{{task}}
```

## Full example

```md
---
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
Auction cut: {{auction_cut}}
```

## Storage

Prompt Forge is local-first. Templates, folders, app state, and per-template form values are stored locally in the browser.
