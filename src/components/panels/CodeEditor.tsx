// src/components/panels/CodeEditor.tsx

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

// ── Overlay helpers ───────────────────────────────────────────────────────────

const MAX_VALUE_LEN = 24
const MAX_VARS      = 6

function truncate(s: string): string {
  return s.length > MAX_VALUE_LEN ? s.slice(0, MAX_VALUE_LEN) + '…' : s
}

function buildOverlayText(vars: { name: string; value: string }[]): string {
  return vars
    .slice(0, MAX_VARS)
    .map((v) => `${v.name} = ${truncate(v.value)}`)
    .join('   ')
}

// Derives a map of line → last known variable snapshot for the current file,
// excluding the current execution line (which gets its own live overlay).
function buildHistoryOverlays(
  executionHistory: { file: string; line: number; variables: Record<string, { value: string; changed: boolean }> }[],
  currentFile: string,
  currentLine: number,
): Map<number, { text: string; hasChanged: boolean }> {
  // Walk history in order so later entries overwrite earlier ones —
  // each line shows the most recent values from the last time it was visited.
  const result = new Map<number, { text: string; hasChanged: boolean }>()

  for (const entry of executionHistory) {
    if (entry.file !== currentFile) continue
    if (entry.line === currentLine) continue

    const vars = Object.entries(entry.variables)
    if (vars.length === 0) continue

    const text       = buildOverlayText(vars.map(([name, v]) => ({ name, value: v.value })))
    const hasChanged = vars.some(([, v]) => v.changed)
    result.set(entry.line, { text, hasChanged })
  }

  return result
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CodeEditor() {
  const language          = useDebugStore((s) => s.language)
  const currentLine       = useDebugStore((s) => s.currentLine)
  const currentFile       = useDebugStore((s) => s.currentFile)
  const sourceLines       = useDebugStore((s) => s.sourceLines)
  const breakpoints       = useDebugStore((s) => s.breakpoints)
  const variables         = useDebugStore((s) => s.variables)
  const executionHistory  = useDebugStore((s) => s.executionHistory)

  const storeRef = useRef(useDebugStore.getState)

  const editorRef              = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef              = useRef<typeof Monaco | null>(null)
  const bpCollectionRef        = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)
  const cursorCollectionRef    = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)
  const overlayCollectionRef   = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)
  const historyCollectionRef   = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)

  // ── Mount ─────────────────────────────────────────────────────────────────
  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current            = editor
    monacoRef.current            = monaco
    bpCollectionRef.current      = editor.createDecorationsCollection([])
    cursorCollectionRef.current  = editor.createDecorationsCollection([])
    overlayCollectionRef.current = editor.createDecorationsCollection([])
    historyCollectionRef.current = editor.createDecorationsCollection([])

    editor.onMouseDown((e) => {
      const isGutter =
        e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
        e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
      if (!isGutter || !e.target.position) return
      const line = e.target.position.lineNumber
      const { currentFile: file, toggleBreakpoint } = storeRef.current()
      toggleBreakpoint(file || MOCK_DEBUG_STATE.currentFile, line)
    })
  }, [])

  // ── Breakpoint decorations ────────────────────────────────────────────────
  useEffect(() => {
    const monaco = monacoRef.current
    const col    = bpCollectionRef.current
    if (!monaco || !col) return

    const { currentFile: file } = storeRef.current()
    const modelFile = file || MOCK_DEBUG_STATE.currentFile
    const relevant  = breakpoints.filter((bp) => bp.file === modelFile)

    col.set(relevant.map((bp) => ({
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
    })))
  }, [breakpoints, currentFile])

  // ── Execution cursor ──────────────────────────────────────────────────────
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

    editor.revealLineInCenterIfOutsideViewport(currentLine, 1)
  }, [currentLine])

  // ── Current-line inline overlay ───────────────────────────────────────────
  useEffect(() => {
    const monaco = monacoRef.current
    const col    = overlayCollectionRef.current
    if (!monaco || !col) return

    if (!currentLine || variables.length === 0) {
      col.set([])
      return
    }

    col.set([{
      range: new monaco.Range(currentLine, Number.MAX_SAFE_INTEGER, currentLine, Number.MAX_SAFE_INTEGER),
      options: {
        after: {
          content: `  ${buildOverlayText(variables)}`,
          inlineClassName: 'lucid-inline-overlay',
        },
      },
    }])
  }, [variables, currentLine])

  // ── History overlays (past lines) ─────────────────────────────────────────
  // Shows the last known variable values on every previously visited line,
  // dimmer than the current overlay. Lines where a value changed get a
  // separate CSS class so they can be styled distinctly.
  useEffect(() => {
    const monaco = monacoRef.current
    const col    = historyCollectionRef.current
    if (!monaco || !col) return

    if (executionHistory.length === 0) {
      col.set([])
      return
    }

    const { currentFile: file } = storeRef.current()
    const modelFile = file || MOCK_DEBUG_STATE.currentFile
    const historyMap = buildHistoryOverlays(executionHistory, modelFile, currentLine)

    col.set(
      [...historyMap.entries()].map(([line, { text, hasChanged }]) => ({
        range: new monaco.Range(line, Number.MAX_SAFE_INTEGER, line, Number.MAX_SAFE_INTEGER),
        options: {
          after: {
            content: `  ${text}`,
            inlineClassName: hasChanged
              ? 'lucid-history-overlay lucid-history-changed'
              : 'lucid-history-overlay',
          },
        },
      }))
    )
  }, [executionHistory, currentLine, currentFile])

  // ── Language sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return
    const model = editor.getModel()
    if (!model) return
    monaco.editor.setModelLanguage(model, MONACO_LANG[language] ?? 'plaintext')
  }, [language])

  const sourceContent = sourceLines?.join('\n') ?? MOCK_SOURCE_LINES

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
