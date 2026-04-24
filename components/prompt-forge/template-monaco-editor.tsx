"use client";

import type * as Monaco from "monaco-editor";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

interface TemplateMonacoEditorProps {
  initialValue: string;
  resetKey?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onMount?: (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
  ) => void;
}

export function TemplateMonacoEditor({
  initialValue,
  resetKey,
  readOnly = false,
  onChange,
  onMount,
}: TemplateMonacoEditorProps) {
  const { resolvedTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();

    if (!editor || !model) {
      return;
    }

    const currentValue = model.getValue();
    if (currentValue === initialValue) {
      return;
    }

    const selection = editor.getSelection();
    const position = editor.getPosition();
    const scrollTop = editor.getScrollTop();
    const scrollLeft = editor.getScrollLeft();

    editor.pushUndoStop();
    editor.executeEdits("external-reset", [
      {
        range: model.getFullModelRange(),
        text: initialValue,
        forceMoveMarkers: true,
      },
    ]);
    editor.pushUndoStop();

    if (selection) {
      editor.setSelection(selection);
    }

    if (position) {
      editor.setPosition(position);
    }

    editor.setScrollTop(scrollTop);
    editor.setScrollLeft(scrollLeft);
  }, [initialValue, resetKey]);

  const editorTheme =
    themeMounted && resolvedTheme === "dark"
      ? "promptforge-dark"
      : "promptforge-light";

  const handleEditorWillMount = useCallback((monaco: typeof Monaco) => {
    const languageId = "markdown-fm";

    if (
      !monaco.languages.getLanguages().some((lang) => lang.id === languageId)
    ) {
      monaco.languages.register({ id: languageId });
    }

    monaco.languages.setMonarchTokensProvider(languageId, {
      defaultToken: "",
      tokenPostfix: ".mdfm",

      tokenizer: {
        root: [
          [/^---\s*$/, { token: "keyword", next: "@frontmatter" }],
          { include: "@markdown" },
        ],

        frontmatter: [
          [/^---\s*$/, { token: "keyword", next: "@markdown" }],
          [/#.*$/, "comment"],

          [/^(\s*)([a-zA-Z0-9_-]+)(\s*:)/, ["", "fm-key", "fm-colon"]],
          [
            /^(\s*-\s+)([a-zA-Z0-9_-]+)(\s*:)/,
            ["fm-punctuation", "fm-key", "fm-colon"],
          ],

          [/\s*-\s+/, "fm-punctuation"],
          [/[{}\[\]]/, "fm-punctuation"],
          [/,/, "fm-punctuation"],
          [/:/, "fm-colon"],

          [/\b\d+(\.\d+)?\b/, "fm-value"],
          [/\b(true|false|null)\b/, "fm-value"],

          [/"([^"\\]|\\.)*"/, "fm-value"],
          [/'([^'\\]|\\.)*'/, "fm-value"],
          [/https?:\/\/\S+/, "fm-value"],

          [/[a-zA-Z_][\w.-]*/, "fm-value"],
          [/\s+/, ""],
        ],

        markdown: [
          [/^#{1,6}\s+.*$/, "heading"],
          [/^>\s+/, "comment"],
          [/^\s*[-*+]\s+/, "keyword"],
          [/^\s*\d+\.\s+/, "keyword"],

          [/^```.*$/, { token: "string", next: "@codeblock" }],
          [/^ {4}.+$/, "string"],

          [/!\[[^\]]*\]\([^)]+\)/, "tag"],
          [/\[[^\]]+\]\([^)]+\)/, "tag"],

          [/\*\*\*[^*]+\*\*\*/, "strong.emphasis"],
          [/___[^_]+___/, "strong.emphasis"],
          [/\*\*[^*]+\*\*/, "strong"],
          [/__[^_]+__/, "strong"],
          [/\*[^*]+\*/, "emphasis"],
          [/_[^_]+_/, "emphasis"],

          [/`[^`]+`/, "string"],

          [/^[-*_]{3,}\s*$/, "comment"],

          [/\{\{\s*[^{}\n]+\s*\}\}/, "variable"],

          [/[^\\`*_!\[{]+/, "text"],
          [/./, "text"],
        ],

        codeblock: [
          [/^```$/, { token: "string", next: "@markdown" }],
          [/.*$/, "string"],
        ],
      },
    });

    monaco.editor.defineTheme("promptforge-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "variable", foreground: "000000", fontStyle: "bold" },
        { token: "heading", foreground: "000000", fontStyle: "bold" },
        { token: "fm-key", foreground: "000000", fontStyle: "bold" },
        { token: "fm-value", foreground: "000000" },
        { token: "fm-colon", foreground: "000000" },
        { token: "fm-punctuation", foreground: "000000" },
      ],
      colors: {},
    });

    monaco.editor.defineTheme("promptforge-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "variable", foreground: "D4D4D4", fontStyle: "bold" },
        { token: "heading", foreground: "D4D4D4", fontStyle: "bold" },
        { token: "fm-key", foreground: "D4D4D4", fontStyle: "bold" },
        { token: "fm-value", foreground: "D4D4D4" },
        { token: "fm-colon", foreground: "D4D4D4" },
        { token: "fm-punctuation", foreground: "D4D4D4" },
      ],
      colors: {},
    });

    monaco.languages.setLanguageConfiguration(languageId, {
      comments: {
        blockComment: ["<!--", "-->"],
      },
      brackets: [
        ["[", "]"],
        ["(", ")"],
      ],
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: "`", close: "`" },
      ],
      surroundingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: "`", close: "`" },
      ],
      folding: {
        markers: {
          start: /^---\s*$/,
          end: /^---\s*$/,
        },
      },
    });
  }, []);

  const handleMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      editorRef.current = editor;
      onMount?.(editor, monaco);
    },
    [onMount],
  );

  const options = useMemo(
    () => ({
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on" as const,
      lineNumbers: "off" as const,
      lineDecorationsWidth: 16,
      lineNumbersMinChars: 0,
      glyphMargin: false,
      folding: false,
      renderLineHighlight: "none" as const,
      renderLineHighlightOnlyWhenFocus: false,
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: false,
      fontSize: 14,
      lineHeight: 24,
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
      padding: { top: 12, bottom: 12 },
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      contextmenu: true,
      quickSuggestions: false,
      suggestOnTriggerCharacters: false,
      wordBasedSuggestions: "off" as const,
      wrappingIndent: "same" as const,
      bracketPairColorization: {
        enabled: false,
      },
      guides: {
        bracketPairs: false,
        highlightActiveBracketPair: false,
      },
      readOnly,
      domReadOnly: readOnly,
    }),
    [readOnly],
  );

  return (
    <MonacoEditor
      key={resetKey}
      beforeMount={handleEditorWillMount}
      onMount={handleMount}
      language="markdown-fm"
      defaultValue={initialValue}
      onChange={(next) => onChange?.(next ?? "")}
      loading={
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading editor...
        </div>
      }
      options={options}
      theme={editorTheme}
    />
  );
}
