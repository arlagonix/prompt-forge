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

Prompt Forge is a local-first browser app for filling Markdown prompt templates with structured inputs. It opens a folder of `.md` or `.markdown` files, detects placeholders such as `{{task}}` or `{{tone | type=select | value=Formal}}`, builds a form automatically, previews the rendered result, and copies the final prompt to the clipboard. It also supports autosave, recent files, quick file search, folder restore, last-file restore, mobile-friendly UI, and installable PWA behavior.

---

## Overview

Prompt Forge is a single-page web app that runs entirely in the browser. It uses the File System Access API to read local template files, `localStorage` to persist recent files and form values, and IndexedDB to remember the last selected folder handle. The current version shown in the UI and manifest is `v1.27`.

Main capabilities:

- open a local folder containing Markdown templates
- browse templates in a collapsible folder tree
- search templates in the sidebar
- open templates quickly through a command palette
- parse placeholder definitions from template text
- generate form controls from placeholder metadata
- preview the rendered prompt
- copy the rendered prompt to the clipboard
- autosave entered values per template
- remember recent files
- restore the last opened file after reloading
- restore the previously selected folder when permission is still available
- work on desktop and mobile layouts
- install as a Progressive Web App

---

## How it works

The app has four main parts.

### 1. UI layer
The HTML defines:

- sidebar
- main content area
- command palette
- documentation modal
- install button

The CSS provides:

- two-column desktop layout
- responsive mobile layout
- collapsible mobile sidebar
- styled controls, buttons, modals, notifications, and preview panel

### 2. State layer
A global `State` object stores runtime values such as:

- current folder handle
- folder tree
- current file
- file map
- parsed parameters
- active notification
- search query and debounce timer
- preview debounce timer
- IndexedDB connection
- current abort controller for folder loading

### 3. Persistence layer
The app stores different kinds of data in different places:

- `localStorage` for recent files
- `localStorage` for form values per template
- `localStorage` for the last opened file
- IndexedDB for the selected folder handle

### 4. Template processing layer
JavaScript reads the selected Markdown file, extracts placeholders, builds the matching form fields, collects entered values, replaces placeholders in the template, and renders the final prompt.

---

## Main UI sections

### Sidebar
The left panel contains:

- app title and version
- refresh button
- folder picker button
- sidebar toggle button on mobile
- install button when PWA installation is available
- search box
- file and folder tree

The sidebar is used to browse and select templates.

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
- keyboard shortcut hint
- live preview panel

### Command palette
A quick-open overlay for finding templates faster.

Features:

- opens with `Ctrl+K`
- shows recent files when the search field is empty
- filters templates by file name
- supports keyboard navigation with arrow keys and Enter
- closes with `Esc`, backdrop click, or `Ctrl+K`

### Documentation modal
A built-in help dialog that shows example placeholder syntax for all supported field types.

### Notifications and errors
The app shows temporary toast-style notifications for successful actions and temporary popups for errors.

---

## Supported template syntax

Templates use placeholders wrapped in double curly braces.

```txt
{{name}}
{{title | type=text}}
{{age | type=number | default=42}}
{{agree | type=checkbox | default=true}}
{{color | type=select | value=Red | value=Green | default=Green}}
```

Each placeholder becomes one input field in the generated form.

---

## Supported placeholder options

### `name`
The parameter identifier.

```txt
{{message}}
```

Valid names match:

```txt
[a-zA-Z0-9_-]+
```

### `type`
Controls which form field is created.

Supported values:

- `textarea`
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
Overrides the human-readable field label.

```txt
{{title | type=text | label=Prompt title}}
```

### `default`
Sets the default value.

```txt
{{message | default=Hello}}
```

Multiline defaults are supported:

```txt
{{bio | type=textarea | default=Line 1
Line 2
Line 3}}
```

### `height`
Applies to textareas and controls the number of visible rows.

```txt
{{description | type=textarea | height=10}}
```

### `value`
Defines available options for `select` and `radio` fields.

```txt
{{color | type=select | value=Red | value=Green | value=Blue}}
```

---

## Supported input types

### Textarea
Default type when `type` is omitted.

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

Checkbox values are inserted into the rendered prompt as `true` or `false`.

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

This produces:

- a textarea for `task`
- a text input for `audience`
- a select dropdown for `tone`
- a checkbox for `examples`

---

## Application flow

### 1. Initialization
The `init()` function:

- checks File System Access API support
- opens IndexedDB
- tries to restore the previously saved folder handle
- requests permission to that folder if needed
- restores the last opened file when possible
- attaches global event listeners
- sets up keyboard shortcuts, modal behavior, palette behavior, install behavior, and mobile sidebar behavior

### 2. Folder selection
The `selectFolder()` function:

- opens the native directory picker
- saves the selected folder handle
- clears the previously remembered last file
- scans the folder recursively
- renders the sidebar tree
- adds the search box

### 3. Folder scanning
The `readDirectoryRecursive()` function:

- traverses subfolders recursively
- keeps only `.md` and `.markdown` files
- discards empty directories from the rendered tree
- builds the tree used by the sidebar
- stores file metadata in `State.fileMap`

### 4. File loading
The `loadFile(fileId)` function:

- reads file content from the selected handle
- stores file metadata in state
- updates recent files
- optionally saves the file as the last opened one
- highlights and reveals the active file in the sidebar
- extracts placeholders
- renders the form and preview

### 5. Form generation
The `renderTemplateForm(file, params)` function:

- creates input controls dynamically from placeholder definitions
- restores saved values when available
- otherwise applies defaults
- enables autosave
- enables auto-preview with debounce
- wires buttons for generate, preview, clear, and docs

### 6. Prompt generation
The `buildPrompt()` function:

- reads current values from the form
- scans the template content again
- replaces placeholders with current values
- keeps unknown or invalid placeholders unchanged
- removes excessive blank lines
- returns the final prompt text

### 7. Preview and clipboard copy
The app supports both manual and automatic preview updates.

- `previewPrompt()` refreshes the preview panel
- `setupAutoPreview()` updates preview after a short debounce
- `generateAndCopy()` builds the prompt, copies it to the clipboard, shows a notification, and refreshes preview on success

---

## Main JavaScript structures

### `State`
Central runtime state container.

Important fields:

- `currentFolderHandle`
- `folderTree`
- `currentFile`
- `fileMap`
- `fileIdCounter`
- `currentParams`
- `searchQuery`
- `searchTimer`
- `previewTimer`
- `activeNotification`
- `loadingAbortController`
- `db`

### `DOM`
Caches frequently used DOM nodes such as:

- `fileBrowser`
- `mainContent`
- `searchContainer`
- `selectFolderBtn`
- `refreshBtn`
- documentation modal elements
- command palette elements

### `Palette`
Stores command palette state:

- whether it is open
- focused item index
- current result items
- just-closed guard state for shortcut handling

---

## Important functions

### Folder persistence and restore
- `openDatabase()` — opens IndexedDB for folder handle persistence
- `saveFolderHandle(handle)` — stores the currently selected folder handle
- `loadFolderHandle()` — restores the saved folder handle
- `clearFolderHandle()` — removes the saved folder handle
- `saveLastFile(file)` — remembers the last opened file
- `loadLastFile()` — restores the last opened file metadata
- `clearLastFile()` — clears the remembered last file

### Recent files and form value storage
- `getRecentFiles()` — reads recent files from `localStorage`
- `pushRecentFile(file)` — adds a file to the recent list
- `saveFormValues(filePath, params, form)` — stores current form values
- `loadFormValues(filePath, params, form)` — restores stored form values
- `setupAutoSave(filePath, params, form)` — saves values on input and change

### UI helpers
- `showNotification(message, type)` — shows a temporary toast notification
- `showError(message)` — shows a temporary error popup
- `copyToClipboard(text)` — copies text using the modern API with a fallback
- `openDocsModal()` / `closeDocsModal()` — controls the docs modal
- `revealActiveFileInSidebar(fileId)` — expands parent folders so the current file stays visible

### Sidebar and file browser
- `renderFileBrowser(structure)` — renders the folder and file tree
- `renderDirectoryNode(dir, level)` — renders one directory node
- `renderFileNode(file)` — renders one file node
- `handleFileBrowserClick(e)` — handles folder expand and file selection
- `addSearchBox()` — injects the sidebar search input
- `filterFiles(query)` — filters visible files and expands matching folder branches

### Command palette
- `openPalette()` / `closePalette()` — opens or closes the quick-open panel
- `renderPaletteItems(query)` — renders recent or matched files
- `setPaletteFocus(idx)` — updates keyboard and mouse focus state
- `selectPaletteItem(idx)` — opens the selected file
- `scrollPaletteItemIntoView(idx)` — keeps focused item visible
- `scoreMatch(name, query)` — scores fuzzy-ish filename matches
- `highlightMatch(name, query)` — highlights matched characters or substrings

### Template parsing and prompt building
- `extractParameters(content)` — extracts placeholders from template text
- `parsePlaceholderInner(inner)` — parses a single placeholder definition
- `formatParamName(name)` — converts a parameter name into a readable label
- `readReplacementsFromForm(form, params)` — collects current values from the form
- `buildPrompt()` — replaces placeholders with current values
- `previewPrompt()` — refreshes preview content
- `generateAndCopy()` — builds and copies the final prompt
- `applyDefaults(form, params)` — resets fields to default values
- `clearForm()` — reapplies defaults, saves them, and refreshes preview
- `setupAutoPreview(form)` — updates preview after a 250 ms debounce

---

## Keyboard shortcuts

Global shortcuts:

- `Ctrl+O` — choose folder
- `Alt+R` — refresh current folder
- `Ctrl+K` — open or close the command palette
- `Ctrl+Enter` — generate and copy prompt
- `Esc` — close docs modal, close palette, or clear the current form
- `Alt+C` — clear the saved folder handle and last-file state

Notes:

- shortcut handling primarily uses `e.code`
- this makes shortcuts more reliable across keyboard layouts
- pressing `Enter` in single-line text or number fields also triggers prompt generation

---

## Data persistence

Prompt Forge persists data in several places.

### Recent files
Stored in `localStorage` under:

```txt
prompt-forge-recent-files
```

Keeps up to 10 recently opened templates.

### Form values
Stored in `localStorage` per template path under keys like:

```txt
prompt-forge-values-/folder/template.md
```

This lets a template restore previously entered values when reopened.

### Last opened file
Stored in `localStorage` under:

```txt
prompt-forge-last-file
```

Used to reopen the last active template after the folder is restored.

### Folder handle
Stored in IndexedDB database `prompt-forge-db`, object store `folder-handles`.

This allows the app to remember the selected folder between sessions, subject to browser permission rules.

---

## PWA support

Prompt Forge can be installed as a Progressive Web App.

Current implementation includes:

- a web app manifest
- an install button that appears when `beforeinstallprompt` fires
- service worker registration through `sw.js`
- cached app shell assets for offline startup fallback
- standalone display mode in supporting browsers

The manifest currently identifies the app as `Prompt Forge v1.27`.

---

## Browser requirements

Prompt Forge depends on browser APIs that are not universally available.

Required or important APIs:

- File System Access API for opening local folders
- IndexedDB for folder persistence
- Clipboard API, with a fallback for older copy behavior
- Service workers for install and offline PWA features

Browsers with the best support are Chromium-based browsers such as:

- Chrome
- Edge
- Opera

If the File System Access API is unavailable, local folder browsing will not work.

---

## Error handling

The app includes basic handling for:

- unsupported browser features
- folder picker failure
- permission errors
- missing files
- folder loading errors
- clipboard copy failures
- template parsing issues
- PWA registration failures in console output

Errors are shown through temporary popups or fallback empty-state content.

---

## Notes on placeholder parsing

The placeholder parser is intentionally lightweight.

Behavior:

- placeholders are found by scanning for `{{` and `}}`
- duplicate parameter names are ignored after the first occurrence
- invalid parameter names are ignored
- `textarea` is the default type
- checkbox defaults to `false` when omitted
- select and radio default to the first option when omitted
- multiline `default=` values are supported
- placeholder metadata after `default=` is still parsed for supported options like `height` and `value`

This is a pragmatic parser for structured prompt templates, not a full templating engine.

---

## Limitations

Current limitations of this implementation:

- only `.md` and `.markdown` files are loaded
- templates are read-only
- there is no save-back to template files
- there is no template editor inside the app
- the parser is custom and not a full templating engine
- only one field per unique parameter name is supported
- malformed placeholders are handled only in a basic way
- local folder access depends on browser support and permissions
- PWA behavior depends on browser support
- import and export of saved values is not implemented

---

## Summary

Prompt Forge is a local-first prompt template utility for people who keep reusable prompts as Markdown files and want a faster way to fill them out.

It provides:

- folder-based Markdown template browsing
- collapsible tree navigation
- sidebar search
- command palette quick-open
- placeholder parsing
- dynamic form generation
- live preview
- clipboard copy
- autosave
- recent files
- last-file restore
- saved folder restore
- mobile-friendly layout
- installable PWA support

See source code in the repository files.
