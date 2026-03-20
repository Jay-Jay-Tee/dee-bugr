// src/components/panels/CodeEditor.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Monaco editor with breakpoint gutter, execution cursor, and language sync.
//
// Day 3 migration note: replace MOCK_SOURCE_LINES with real file content
// from store.sourceLines once P1 delivers it via the stopped event.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react'
import MonacoEditor from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useDebugStore } from '../../renderer/store/debugStore'
import { MOCK_SOURCE_LINES, MOCK_DEBUG_STATE } from '../../renderer/mockData'

// ── Constants ─────────────────────────────────────────────────────────────────

const MONACO_LANG: Record<string, string> = {
  python:     'python',
  cpp:        'cpp',
  c:          'c',
  javascript: 'javascript',
  java:       'java',
}

const EDITOR_OPTIONS: Monaco.editor.IStandaloneEditorConstructionOptions = {
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
  minimap: { enabled: true },
  glyphMargin: true,
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  renderWhitespace: 'none',
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  wordWrap: 'off',
  readOnly: false,
  automaticLayout: true,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CodeEditor() {
  const language         = useDebugStore((s) => s.language)
  const currentLine      = useDebugStore((s) => s.currentLine)
  const currentFile      = useDebugStore((s) => s.currentFile)
  const breakpoints      = useDebugStore((s) => s.breakpoints)

  // Read toggleBreakpoint from the store directly inside the handler
  // to avoid stale closure — store actions are stable references in Zustand.
  const storeRef = useRef(useDebugStore.getState)

  const editorRef          = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef          = useRef<typeof Monaco | null>(null)
  const bpCollectionRef    = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)
  const cursorCollectionRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)

  // ── Mount: create decoration collections + wire gutter click ─────────────
  // useCallback prevents handleMount from being a new reference on every render,
  // which would cause MonacoEditor to remount the editor unnecessarily.
  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current  = editor
    monacoRef.current  = monaco
    bpCollectionRef.current     = editor.createDecorationsCollection([])
    cursorCollectionRef.current = editor.createDecorationsCollection([])

    editor.onMouseDown((e) => {
      const isGutter =
        e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
        e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN

      if (!isGutter || !e.target.position) return

      const line = e.target.position.lineNumber
      // Read from store at call time — avoids stale closure on currentFile
      const { currentFile: file, toggleBreakpoint } = storeRef.current()
      toggleBreakpoint(file || MOCK_DEBUG_STATE.currentFile, line)
    })
  }, []) // no deps — storeRef.current() always returns fresh state

  // ── Sync breakpoint decorations ───────────────────────────────────────────
  useEffect(() => {
    const monaco = monacoRef.current
    const col    = bpCollectionRef.current
    if (!monaco || !col) return

    const { currentFile: file } = storeRef.current()
    const modelFile = file || MOCK_DEBUG_STATE.currentFile
    const relevant  = breakpoints.filter((bp) => bp.file === modelFile)

    col.set(
      relevant.map((bp) => ({
        range: new monaco.Range(bp.line, 1, bp.line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: 'lucid-bp-glyph',
          glyphMarginHoverMessage: {
            value: bp.condition ? `Condition: ${bp.condition}` : 'Breakpoint',
          },
          overviewRuler: {
            color: '#e51400',
            position: monaco.editor.OverviewRulerLane.Left,
          },
        },
      }))
    )
  }, [breakpoints, currentFile])

  // ── Sync execution cursor ─────────────────────────────────────────────────
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    const col    = cursorCollectionRef.current
    if (!editor || !monaco || !col) return

    if (!currentLine) {
      col.set([])
      return
    }

    col.set([{
      range: new monaco.Range(currentLine, 1, currentLine, 1),
      options: {
        isWholeLine: true,
        className: 'lucid-exec-line',
        glyphMarginClassName: 'lucid-exec-arrow',
        overviewRuler: {
          color: '#ffcc00',
          position: monaco.editor.OverviewRulerLane.Full,
        },
      },
    }])

    editor.revealLineInCenterIfOutsideViewport(currentLine, 1 /* smooth */)
  }, [currentLine])

  // ── Sync Monaco language ──────────────────────────────────────────────────
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return
    const model = editor.getModel()
    if (!model) return
    monaco.editor.setModelLanguage(model, MONACO_LANG[language] ?? 'plaintext')
  }, [language])

  // Day 3: replace MOCK_SOURCE_LINES with store.sourceLines?.join('\n')
  const sourceContent = MOCK_SOURCE_LINES

  return (
    <MonacoEditor
      height="100%"
      language={MONACO_LANG[language] ?? 'cpp'}
      value={sourceContent}
      theme="vs-dark"
      options={EDITOR_OPTIONS}
      onMount={handleMount}
    />
  )
}
