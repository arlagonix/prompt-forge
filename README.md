# Prompt Forge

## Comment from a real human

I wrote this tool for myself to simplify the process of prompts generation.  
Couldn't find any similar solution, so decided to create it myself using AI.

No one (except for me) is probably gonna use it... But who knows...  
Use the .html file with the latest version.

The code and documentation are AI-generated. 

Why are there such strange versions? 15, 21, 24, where are the others?  
I was too lazy to go and find the previous 20 or so versions.

## UI

<img width="1854" height="1264" alt="image" src="https://github.com/user-attachments/assets/1b8f7d7c-0451-4818-b6a7-f8d9b72eacba" />

<img width="1828" height="1257" alt="image" src="https://github.com/user-attachments/assets/596270c9-1259-482a-aa9f-4f79085a53bb" />


## Short description

Prompt Forge is a browser-based tool for working with local Markdown prompt templates. It lets you open a folder of `.md` files, browse templates in a sidebar, detect placeholders like `{{name}}`, generate a form for filling those placeholders, preview the final rendered prompt, and copy it to the clipboard. It also includes recent files, autosave of entered values, template search, and a quick-open command palette.

---

## Overview

Prompt Forge is a single-page web application that runs entirely in the browser. It uses the File System Access API to read template files from a user-selected local folder.

Main features:

- open a local folder with Markdown templates
- browse templates in a folder tree
- parse placeholders from template text
- automatically generate form controls from placeholder metadata
- preview the rendered prompt
- copy the generated prompt to the clipboard
- save entered values in `localStorage`
- remember recently opened files
- search templates in the sidebar
- open templates quickly through a command palette
- use keyboard shortcuts for common actions

---

## How it works

The application has three main layers:

### 1. UI layer
The HTML defines the app structure:

- sidebar
- main content area
- command palette
- documentation modal

The CSS provides:

- responsive layout
- component styling for form controls, modals, buttons, and preview area

### 2. State layer
A global `State` object stores runtime data such as:

- current folder handle
- folder tree
- selected file
- parsed parameters
- notification state
- search state

### 3. Template processing layer
JavaScript reads Markdown templates, extracts placeholders, builds input controls dynamically, replaces placeholders with user-provided values, and produces the final prompt.

---

## Main UI sections

### Sidebar
The left panel contains:

- app title
- refresh button
- folder picker button
- search area
- file/folder tree of templates

The sidebar is used to browse and select Markdown templates.

### Main content area
The right panel shows either:

- an empty state when no file is selected
- or the selected template form

For a loaded template it displays:

- template title
- docs button
- dynamically generated parameter form
- action buttons:
  - Generate & Copy
  - Preview
  - Clear
- preview of the generated prompt

### Command palette
A quick-open overlay for finding templates faster.

Features:

- opens with `Ctrl+K`
- shows recent files when search is empty
- filters templates by file name
- supports keyboard navigation with arrow keys and Enter

### Documentation modal
A built-in help dialog showing example placeholder syntax and supported options.

---

## Template syntax

Templates use placeholders wrapped in double curly braces:

```txt
{{name}}
{{title | type=text}}
{{age | type=number | default=42}}
{{agree | type=checkbox | default=true}}
{{color | type=select | value=Red | value=Green | default=Green}}
```

Each placeholder defines one input field in the generated form.

---

## Supported placeholder options

### `name`
The parameter identifier.

Example:

```txt
{{message}}
```

### `type`
Specifies what kind of input control should be rendered.

Supported values:

- `textarea` (default)
- `text`
- `number`
- `checkbox`
- `select`
- `radio`

Example:

```txt
{{title | type=text}}
```

### `label`
Custom label shown in the form.

Example:

```txt
{{title | type=text | label=Prompt title}}
```

### `default`
Default value for the field.

Example:

```txt
{{message | default=Hello}}
```

Multiline defaults are supported for textareas:

```txt
{{bio | type=textarea | default=Line 1
Line 2
Line 3}}
```

### `height`
Used only for textarea fields. Controls the number of rows.

Example:

```txt
{{description | type=textarea | height=10}}
```

### `value`
Defines options for `select` and `radio`.

Example:

```txt
{{color | type=select | value=Red | value=Green | value=Blue}}
```

---

## Supported input types

### Textarea
Default type when `type` is not specified.

Example:

```txt
{{bio}}
{{bio | type=textarea | label=Bio}}
```

### Text input

```txt
{{title | type=text}}
```

### Number input

```txt
{{age | type=number}}
```

### Checkbox

```txt
{{agree | type=checkbox | default=true}}
```

Checkbox values are inserted into the final prompt as:

- `true`
- `false`

### Select

```txt
{{color | type=select | value=Red | value=Green | value=Blue}}
```

### Radio

```txt
{{choice | type=radio | value=A | value=B | value=C}}
```

---

## Example template

```md
You are an expert assistant.

Task:
{{task | type=textarea | label=Task description | height=8}}

Audience:
{{audience | type=text | default=General users}}

Tone:
{{tone | type=select | value=Formal | value=Neutral | value=Friendly | default=Neutral}}

Include examples:
{{examples | type=checkbox | default=true}}
```

This template generates:

- a textarea for `task`
- a text input for `audience`
- a select dropdown for `tone`
- a checkbox for `examples`

---

## Application flow

### 1. Initialization
The `init()` function:

- checks whether `showDirectoryPicker` is supported
- attaches event listeners
- enables keyboard shortcuts
- initializes modal and command palette behavior

### 2. Folder selection
The `selectFolder()` function:

- opens the native folder picker
- stores the selected folder handle
- loads the folder structure recursively
- renders the sidebar browser
- adds the search input

### 3. Folder scanning
The `readDirectoryRecursive()` function:

- traverses the selected folder and subfolders
- keeps only `.md` and `.markdown` files
- builds a hierarchical folder tree
- stores file metadata in `State.fileMap`

### 4. File loading
The `loadFile(fileId)` function:

- reads file content
- stores it in state
- highlights the active file in the sidebar
- parses placeholders
- renders a form based on extracted parameters

### 5. Form generation
The `renderTemplateForm(file, params)` function:

- creates inputs dynamically from placeholder definitions
- restores saved values from local storage if available
- otherwise applies defaults
- connects buttons for generate, preview, clear, and docs

### 6. Prompt generation
The `buildPrompt()` function:

- reads current values from the form
- scans the template again
- replaces placeholders with entered values
- removes excessive empty lines
- returns the final prompt string

### 7. Clipboard copy
The `generateAndCopy()` function:

- generates the prompt
- copies it using `navigator.clipboard`
- falls back to `document.execCommand("copy")` if needed
- shows a notification
- refreshes the preview on success

---

## Main JavaScript structures

### `State`
Central runtime state container.

Important fields:

- `currentFolderHandle` — selected folder handle
- `folderTree` — parsed folder/file structure
- `currentFile` — active file metadata
- `fileMap` — map of file IDs to file objects
- `currentParams` — parsed placeholder parameters
- `searchQuery` — current sidebar search query
- `activeNotification` — current toast notification
- `loadingAbortController` — controller for canceling folder loads

### `DOM`
Caches frequently used DOM references such as:

- `fileBrowser`
- `mainContent`
- `searchContainer`
- `selectFolderBtn`
- `refreshBtn`
- palette and modal elements

---

## Important functions

### Recent files and storage
- `getRecentFiles()` — reads recent files from `localStorage`
- `pushRecentFile(file)` — adds a file to the recent list
- `saveFormValues(filePath, params, form)` — stores current input values
- `loadFormValues(filePath, params, form)` — restores saved input values
- `setupAutoSave(filePath, params, form)` — enables autosave on input/change

### UI helpers
- `showNotification(message, type)` — shows a temporary status notification
- `showError(message)` — shows a temporary error popup
- `copyToClipboard(text)` — copies text with modern API and fallback support
- `openDocsModal()` / `closeDocsModal()` — controls the docs modal

### Sidebar and file browser
- `renderFileBrowser(structure)` — renders the folder/file tree
- `renderDirectoryNode(dir, level)` — renders a directory node
- `renderFileNode(file)` — renders a file item
- `revealActiveFileInSidebar(fileId)` — opens parent folders of the active file

### Command palette
- `openPalette()` / `closePalette()` — open or close quick-open panel
- `renderPaletteItems(query)` — render recent or matched files
- `setPaletteFocus(idx)` — update keyboard/mouse focus in palette
- `selectPaletteItem(idx)` — open the selected template

### Template parsing
- `extractParameters(content)` — extracts placeholders from template content
- `parsePlaceholderInner(inner)` — parses one placeholder definition
- `formatParamName(p)` — converts a parameter name into a human-readable label

### Prompt building
- `readReplacementsFromForm(form, params)` — reads current form values
- `buildPrompt()` — replaces placeholders and returns final text
- `previewPrompt()` — updates preview area
- `generateAndCopy()` — generates prompt and copies it
- `applyDefaults(form, params)` — applies default values to fields
- `clearForm()` — resets the form to defaults

### Search
- `addSearchBox()` — adds the sidebar search input
- `filterFiles(query)` — filters visible file and folder items

---

## Keyboard shortcuts

Global shortcuts:

- `Ctrl+O` — choose folder
- `Alt+R` — refresh current folder
- `Ctrl+K` — open or close command palette
- `Ctrl+Enter` — generate and copy prompt
- `Esc` — close docs modal, close palette, or clear form

Notes:

- shortcut handling uses `e.code`
- this makes shortcuts work more reliably across different keyboard layouts

---

## Data persistence

The app uses `localStorage` for two types of persistence.

### Recent files
Stored under:

```txt
prompt-forge-recent-files
```

Keeps up to 10 recently opened templates.

### Form values
Stored per template path under keys like:

```txt
prompt-forge-values-/folder/template.md
```

This allows a template to restore previously entered values when reopened.

---

## Browser requirements

Prompt Forge depends on the File System Access API.

Supported browsers generally include:

- Chrome
- Edge
- Opera

If the API is not available, the application shows an error and local folder browsing will not work.

---

## Error handling

The code includes basic handling for:

- unsupported browser features
- folder picker failure
- permission errors
- missing files
- folder loading errors
- clipboard copy failures
- invalid or missing template data

Errors are displayed through temporary popups or fallback UI states.

---

## Notes on placeholder parsing

The placeholder parser is intentionally lightweight.

Behavior:

- placeholders are found by scanning for `{{` and `}}`
- duplicate parameter names are ignored after the first occurrence
- valid parameter names must match:

```txt
[a-zA-Z0-9_-]+
```

- `textarea` is the default type
- checkbox defaults to `false` if omitted
- select and radio default to the first option if omitted

The parser supports multiline `default=` values, which is especially useful for textarea fields.

---

## Limitations

Current limitations of this implementation:

- only Markdown files are loaded
- templates are read-only
- there is no write-back to files
- the parser is custom and not a full templating engine
- only one field per unique parameter name is supported
- invalid placeholders are ignored
- local folder access depends on browser permissions
- there is no import/export for saved form data
- malformed placeholder syntax is only handled in a basic way

---

## Summary

Prompt Forge is a local-first prompt template tool that provides:

- folder-based Markdown template browsing
- placeholder parsing
- dynamic form generation
- prompt preview
- clipboard copy
- autosave
- recent file memory
- sidebar search
- command palette quick-open

It is useful for users who keep reusable prompt templates and want a fast interface for filling them in and generating final prompts.

