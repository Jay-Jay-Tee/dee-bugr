// src/components/panels/CodeEditor.tsx
//
// FIXES vs original:
//   1. Removed MOCK_SOURCE_LINES fallback — editor starts blank, not with demo C++ code
//   2. Added onChange handler — typing in the editor updates sourceLines in the store
//      so the debugger uses the current buffer contents on launch
//   3. Added synthetic currentFile when user types without loading a file
//      so gutter breakpoints work on freshly-typed code
//   4. Removed readOnly:false from options (was already false, just clutter)

import { useEffect, useRef, useCallback } from 'react'
import MonacoEditor from '@monaco-editor/react'
import type { OnMount, OnChange } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useDebugStore } from '../../renderer/store/debugStore'
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

// Language-specific instructions shown in a read-only editor
// Directs users to open a file, set breakpoints, and run it
function getPlaceholderInstructions(language: string): string {
  const instructions: Record<string, string> = {
    python: [
      '# 1. Click the Open button to load a Python file',
      '# 2. Set breakpoints by clicking in the left gutter',
      '# 3. Click Go ▶ to start debugging',
    ].join('\n') + '\n',
    cpp: [
      '// 1. Click the Open button to load a C++ file',
      '// 2. Set breakpoints by clicking in the left gutter',
      '// 3. Click Go ▶ to start debugging',
    ].join('\n') + '\n',
    c: [
      '// 1. Click the Open button to load a C file',
      '// 2. Set breakpoints by clicking in the left gutter',
      '// 3. Click Go ▶ to start debugging',
    ].join('\n') + '\n',
    javascript: [
      '// 1. Click the Open button to load a JavaScript file',
      '// 2. Set breakpoints by clicking in the left gutter',
      '// 3. Click Go ▶ to start debugging',
    ].join('\n') + '\n',
    java: [
      '// 1. Click the Open button to load a Java file',
      '// 2. Set breakpoints by clicking in the left gutter',
      '// 3. Click Go ▶ to start debugging',
    ].join('\n') + '\n',
  }
  return instructions[language] || ''
}

// Synthetic temp filename used when the user types directly without loading a file.
// The launch handler writes the buffer to this path before starting the adapter.
const SYNTHETIC_FILENAME: Record<string, string> = {
  python:     '/tmp/lucid_scratch.py',
  cpp:        '/tmp/lucid_scratch.cpp',
  c:          '/tmp/lucid_scratch.c',
  javascript: '/tmp/lucid_scratch.js',
  java:       '/tmp/LucidScratch.java',
}

const EDITOR_OPTIONS: Monaco.editor.IStandaloneEditorConstructionOptions = {
  fontSize:            13,
  fontFamily:          "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
  minimap:             { enabled: true },
  glyphMargin:         true,
  lineNumbers:         'on',
  scrollBeyondLastLine: false,
  readOnly:           true,
  renderWhitespace:    'none',
  smoothScrolling:     true,
  cursorBlinking:      'smooth',
  wordWrap:            'off',
  automaticLayout:     true,
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

function buildAnomalyDecorations(
  anomalies: Anomaly[],
  monaco: typeof Monaco,
): Monaco.editor.IModelDeltaDecoration[] {
  const byLine = new Map<number, Anomaly>()
  for (const a of anomalies) {
    if (a.line == null) continue
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

function findCallSiteLine(
  fnName: string,
  sourceLines: string[],
  currentLine: number,
): number | null {
  const searchFrom = Math.min(currentLine, sourceLines.length) - 1
  for (let i = searchFrom; i >= 0; i--) {
    if (sourceLines[i].includes(`${fnName}(`)) return i + 1
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
  const setState         = useDebugStore((s) => s.setState)

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
      globalThis.dispatchEvent(
        new CustomEvent('lucid:cursor-line', { detail: e.position.lineNumber })
      )
    })

    editor.onMouseDown((e) => {
      const isGutter =
        e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
        e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
      if (!isGutter || !e.target.position) return
      const line = e.target.position.lineNumber
      const store = storeRef.current()
      // FIX: if no file is loaded yet, use the synthetic scratch filename so
      //      breakpoints can be set on freshly typed (unsaved) code
      const file = store.currentFile || SYNTHETIC_FILENAME[store.language] || '/tmp/lucid_scratch'
      store.toggleBreakpoint(file, line)
    })

    const toggleAtCursor = () => {
      const pos  = editor.getPosition()
      const line = pos?.lineNumber
      if (!line) return
      const store = storeRef.current()
      const file = store.currentFile || SYNTHETIC_FILENAME[store.language] || '/tmp/lucid_scratch'
      store.toggleBreakpoint(file, line)
    }
    globalThis.addEventListener('lucid:toggle-bp-at-cursor', toggleAtCursor)

    const cinemaStep = (e: Event) => {
      const { line } = (e as CustomEvent<{ file: string; line: number }>).detail
      if (line) editor.revealLineInCenterIfOutsideViewport(line, 1)
    }
    globalThis.addEventListener('lucid:cinema-step', cinemaStep)

    editor.onDidDispose(() => {
      globalThis.removeEventListener('lucid:toggle-bp-at-cursor', toggleAtCursor)
      globalThis.removeEventListener('lucid:cinema-step', cinemaStep)
    })
  }, [])

  // ── onChange — sync editor content back to store ──────────────────────────
  // When the user types directly in the editor, update sourceLines and set a
  // synthetic currentFile so the launch handler knows what to run.
  const handleChange: OnChange = useCallback((value) => {
    if (value === undefined) return
    const store = storeRef.current()
    // Only update if no real file is loaded (i.e. user is typing from scratch)
    // or if the file IS a synthetic scratch file
    const syntheticFile = SYNTHETIC_FILENAME[store.language] || '/tmp/lucid_scratch'
    const isScratch = !store.currentFile || store.currentFile === syntheticFile
    if (isScratch) {
      setState({
        ...store,
        currentFile:  syntheticFile,
        sourceLines:  value.split('\n'),
      })
    } else {
      // File is loaded from disk — update sourceLines so overlays stay in sync,
      // but don't change currentFile (the real path is already correct)
      setState({
        ...store,
        sourceLines: value.split('\n'),
      })
    }
  }, [setState])

  // ── Breakpoint decorations ────────────────────────────────────────────────
  useEffect(() => {
    const monaco = monacoRef.current
    const col    = bpCollectionRef.current
    if (!monaco || !col) return
    const { currentFile: file, language: lang } = storeRef.current()
    const effectiveFile = file || SYNTHETIC_FILENAME[lang] || '/tmp/lucid_scratch'
    const relevant = breakpoints.filter((bp) => bp.file === effectiveFile)
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
    globalThis.addEventListener('lucid:ai-suggest-bps', handler)
    return () => globalThis.removeEventListener('lucid:ai-suggest-bps', handler)
  }, [])

  // ── Anomaly gutter indicators ─────────────────────────────────────────────
  useEffect(() => {
    const monaco = monacoRef.current
    const col    = anomalyCollectionRef.current
    if (!monaco || !col) return
    if (anomalies.length === 0) { col.set([]); return }
    col.set(buildAnomalyDecorations(anomalies, monaco))
  }, [anomalies])

  // ── Return value inline overlay ───────────────────────────────────────────
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

  // FIX: no mock fallback — start blank with language-appropriate placeholder instructions
  const sourceContent = sourceLines?.join('\n') ?? getPlaceholderInstructions(language) ?? ''

  return (
    <div
      style={{ position: 'relative', height: '100%', cursor: isDragging ? 'ns-resize' : undefined }}
      onMouseDown={onMouseDown}
    >
      <MonacoEditor
        height="100%"
        language={MONACO_LANG[language] ?? 'plaintext'}
        value={sourceContent}
        theme="vs-dark"
        options={EDITOR_OPTIONS}
        onMount={handleMount}
        onChange={handleChange}
      />
    </div>
  )
}
