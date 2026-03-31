// src/components/panels/CodeEditor.tsx

import { useEffect, useRef, useCallback } from 'react'
import MonacoEditor from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useDebugStore } from '../../renderer/store/debugStore'
import { MOCK_SOURCE_LINES } from '../../renderer/mockData'
import { useGutterDrag } from '../../renderer/hooks/useGutterDrag'
import type { Anomaly, ReturnValue } from '../../shared/types'

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
  readOnly: true,
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

function buildHistoryOverlays(
  executionHistory: { file: string; line: number; variables: Record<string, { value: string; changed: boolean }> }[],
  currentFile: string,
  currentLine: number,
): Map<number, { text: string; hasChanged: boolean }> {
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

// ── Anomaly decoration builder ────────────────────────────────────────────────
// One glyph per anomaly line. Errors get a red glyph; warnings get amber.
// Only anomalies with a known line number are decorated.

function buildAnomalyDecorations(
  anomalies: Anomaly[],
  monaco: typeof Monaco,
): Monaco.editor.IModelDeltaDecoration[] {
  const byLine = new Map<number, Anomaly>()
  for (const a of anomalies) {
    if (a.line == null) continue
    // If multiple anomalies share a line, prefer errors over warnings
    const existing = byLine.get(a.line)
    if (!existing || (existing.severity === 'warning' && a.severity === 'error')) {
      byLine.set(a.line, a)
    }
  }

  return [...byLine.entries()].map(([line, anomaly]) => ({
    range: new monaco.Range(line, 1, line, 1),
    options: {
      isWholeLine: true,
      className:           anomaly.severity === 'error' ? 'lucid-anomaly-line-error' : 'lucid-anomaly-line-warn',
      glyphMarginClassName: anomaly.severity === 'error' ? 'lucid-anomaly-glyph-error' : 'lucid-anomaly-glyph-warn',
      glyphMarginHoverMessage: { value: `${anomaly.severity === 'error' ? '⛔' : '⚠️'} ${anomaly.message}` },
      overviewRuler: {
        color:    anomaly.severity === 'error' ? '#f48771' : '#ffcc00',
        position: monaco.editor.OverviewRulerLane.Right,
      },
    },
  }))
}

// ── Return value call-site finder ─────────────────────────────────────────────
// Searches sourceLines backwards from currentLine for the most recent call
// to the returned function. Returns 1-indexed line number or null.
// Matches "fnName(" anywhere on the line (handles indentation, chained calls).

function findCallSiteLine(
  fnName: string,
  sourceLines: string[],
  currentLine: number,
): number | null {
  // Search backwards from execution cursor so we find the most recent call
  const searchFrom = Math.min(currentLine, sourceLines.length) - 1  // 0-indexed
  for (let i = searchFrom; i >= 0; i--) {
    if (sourceLines[i].includes(`${fnName}(`)) {
      return i + 1  // 1-indexed for Monaco
    }
  }
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CodeEditor() {
  const language         = useDebugStore((s) => s.language)
  const currentLine      = useDebugStore((s) => s.currentLine)
  const currentFile      = useDebugStore((s) => s.currentFile)
  const sourceLines      = useDebugStore((s) => s.sourceLines)
  const breakpoints      = useDebugStore((s) => s.breakpoints)
  const variables        = useDebugStore((s) => s.variables)
  const executionHistory = useDebugStore((s) => s.executionHistory)
  const anomalies        = useDebugStore((s) => s.anomalies)
  const lastReturnValue  = useDebugStore((s) => s.lastReturnValue)

  const storeRef  = useRef(useDebugStore.getState)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const getFile   = useCallback(() => storeRef.current().currentFile, [])
  const { isDragging, onMouseDown } = useGutterDrag(editorRef, getFile)
  const monacoRef              = useRef<typeof Monaco | null>(null)
  const bpCollectionRef        = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)
  const cursorCollectionRef    = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)
  const overlayCollectionRef   = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)
  const historyCollectionRef   = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)
  const ghostBPCollectionRef   = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)
  const anomalyCollectionRef   = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)
  const returnValCollectionRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)

  // ── Mount ─────────────────────────────────────────────────────────────────
  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current              = editor
    monacoRef.current              = monaco
    bpCollectionRef.current        = editor.createDecorationsCollection([])
    cursorCollectionRef.current    = editor.createDecorationsCollection([])
    overlayCollectionRef.current   = editor.createDecorationsCollection([])
    historyCollectionRef.current   = editor.createDecorationsCollection([])
    ghostBPCollectionRef.current   = editor.createDecorationsCollection([])
    anomalyCollectionRef.current   = editor.createDecorationsCollection([])
    returnValCollectionRef.current = editor.createDecorationsCollection([])

    editor.onDidChangeCursorPosition((e) => {
      window.dispatchEvent(
        new CustomEvent('lucid:cursor-line', { detail: e.position.lineNumber })
      )
    })

    editor.onMouseDown((e) => {
      const isGutter =
        e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
        e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
      if (!isGutter || !e.target.position) return
      const line = e.target.position.lineNumber
      const { currentFile: file, toggleBreakpoint } = storeRef.current()
      if (!file) {
        console.warn('[CodeEditor] No active file — launch a session before setting breakpoints')
        return
      }
      toggleBreakpoint(file, line)
    })

    const toggleAtCursor = () => {
      const pos  = editor.getPosition()
      const line = pos?.lineNumber
      if (!line) return
      const { currentFile: file, toggleBreakpoint } = storeRef.current()
      if (!file) return
      toggleBreakpoint(file, line)
    }
    window.addEventListener('lucid:toggle-bp-at-cursor', toggleAtCursor)

    const cinemaStep = (e: Event) => {
      const { line } = (e as CustomEvent<{ file: string; line: number }>).detail
      if (line) editor.revealLineInCenterIfOutsideViewport(line, 1)
    }
    window.addEventListener('lucid:cinema-step', cinemaStep)

    editor.onDidDispose(() => {
      window.removeEventListener('lucid:toggle-bp-at-cursor', toggleAtCursor)
      window.removeEventListener('lucid:cinema-step', cinemaStep)
    })
  }, [])

  // ── Breakpoint decorations ────────────────────────────────────────────────
  useEffect(() => {
    const monaco = monacoRef.current
    const col    = bpCollectionRef.current
    if (!monaco || !col) return
    const { currentFile: file } = storeRef.current()
    if (!file) { col.set([]); return }
    const relevant = breakpoints.filter((bp) => bp.file === file)
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
    if (!currentLine) { col.set([]); return }
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
    if (!currentLine || variables.length === 0) { col.set([]); return }
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
  useEffect(() => {
    const monaco = monacoRef.current
    const col    = historyCollectionRef.current
    if (!monaco || !col) return
    if (executionHistory.length === 0) { col.set([]); return }
    const { currentFile: file } = storeRef.current()
    if (!file) { col.set([]); return }
    const historyMap = buildHistoryOverlays(executionHistory, file, currentLine)
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

  // ── Ghost BP suggestions ──────────────────────────────────────────────────
  useEffect(() => {
    const monaco = monacoRef.current
    const col    = ghostBPCollectionRef.current
    if (!monaco || !col) return
    const handler = (e: Event) => {
      const suggestions = (e as CustomEvent<Array<{ line: number; reason: string }>>) .detail
      if (!suggestions || suggestions.length === 0) { col.set([]); return }
      col.set(suggestions.map((s) => ({
        range: new monaco.Range(s.line, 1, s.line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: 'lucid-ghost-bp-glyph',
          glyphMarginHoverMessage: { value: `💡 AI suggests: ${s.reason}` },
          className: 'lucid-ghost-bp-line',
        },
      })))
      setTimeout(() => col.set([]), 30_000)
    }
    window.addEventListener('lucid:ai-suggest-bps', handler)
    return () => window.removeEventListener('lucid:ai-suggest-bps', handler)
  }, [])

  // ── Anomaly gutter indicators ─────────────────────────────────────────────
  // Renders a coloured glyph in the gutter for each anomaly that has a line.
  // Error anomalies → red ⛔ glyph; warnings → amber ⚠ glyph.
  // Also highlights the whole line with a faint background tint.
  useEffect(() => {
    const monaco = monacoRef.current
    const col    = anomalyCollectionRef.current
    if (!monaco || !col) return
    if (anomalies.length === 0) { col.set([]); return }
    col.set(buildAnomalyDecorations(anomalies, monaco))
  }, [anomalies])

  // ── Return value inline overlay ───────────────────────────────────────────
  // After a stepOut, lastReturnValue arrives via EVENT_RETURN_VAL.
  // We scan sourceLines backwards from currentLine to find the call site
  // (the last line containing "fnName(") and annotate it inline.
  // Cleared when execution continues (currentLine changes or no return value).
  useEffect(() => {
    const monaco = monacoRef.current
    const col    = returnValCollectionRef.current
    if (!monaco || !col) return

    if (!lastReturnValue || !sourceLines || sourceLines.length === 0) {
      col.set([])
      return
    }

    const callLine = findCallSiteLine(lastReturnValue.fnName, sourceLines, currentLine)
    if (!callLine) { col.set([]); return }

    const text = `  ↩ ${lastReturnValue.fnName}() = ${truncate(lastReturnValue.value)}`

    col.set([{
      range: new monaco.Range(callLine, Number.MAX_SAFE_INTEGER, callLine, Number.MAX_SAFE_INTEGER),
      options: {
        after: {
          content: text,
          inlineClassName: 'lucid-return-val-overlay',
        },
      },
    }])
  }, [lastReturnValue, sourceLines, currentLine])

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
    <div
      style={{ position: 'relative', height: '100%', cursor: isDragging ? 'ns-resize' : undefined }}
      onMouseDown={onMouseDown}
    >
      <MonacoEditor
        height="100%"
        language={MONACO_LANG[language] ?? 'cpp'}
        value={sourceContent}
        theme="vs-dark"
        options={EDITOR_OPTIONS}
        onMount={handleMount}
      />
    </div>
  )
}
