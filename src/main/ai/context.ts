/**
 * src/main/ai/context.ts
 * 
 * Debug context formatter for AI consumption.
 * Gathers execution state from SessionManager and formats it into
 * human-readable strings suitable for Groq prompts.
 */

import { session } from '../session/sessionManager'
import { Language, StackFrame, Variable } from '../../shared/types'

export interface FormattedDebugContext {
  language: Language
  currentFile: string
  currentLine: number
  sourceCodeSnippet: string
  stackTrace: string
  localVariables: string
  errorMessage?: string
}

/**
 * Get current debug context from session manager and format it for AI.
 * This is called by all AI functions (explainBug, suggestFix, etc.)
 */
export function getDebugContext(): FormattedDebugContext {
  const rawContext = session.getDebugContext()

  // Format stack trace
  const stackTrace = formatStackTrace(rawContext.stackFrames)

  // Format variables
  const localVariables = formatVariables(rawContext.variables)

  // Get source code snippet (±5 lines around current line)
  const sourceCodeSnippet = getSourceSnippet(
    rawContext.sourceLines,
    rawContext.currentLine,
    5
  )

  return {
    language: rawContext.language,
    currentFile: rawContext.currentFile,
    currentLine: rawContext.currentLine,
    sourceCodeSnippet,
    stackTrace,
    localVariables,
    errorMessage: rawContext.errorMessage,
  }
}

/**
 * Format stack frames into a readable string.
 */
function formatStackTrace(frames: StackFrame[]): string {
  if (frames.length === 0) {
    return 'No call stack available'
  }

  const lines = frames.map((frame, index) => {
    const indent = '  '.repeat(index)
    return `${indent}→ ${frame.name}() at ${frame.file}:${frame.line}`
  })

  return lines.join('\n')
}

/**
 * Format variables into a readable key-value string.
 * Truncates long values and limits total output to ~1500 chars.
 */
function formatVariables(variables: Variable[]): string {
  if (variables.length === 0) {
    return '(no local variables)'
  }

  const MAX_VALUE_LENGTH = 100
  const MAX_TOTAL_LENGTH = 1500

  let output = ''

  for (const v of variables) {
    const truncatedValue =
      v.value.length > MAX_VALUE_LENGTH
        ? v.value.substring(0, MAX_VALUE_LENGTH) + '...'
        : v.value

    const line = `  ${v.name}: ${truncatedValue} (${v.type})\n`

    // Stop if we're going over the limit
    if ((output + line).length > MAX_TOTAL_LENGTH) {
      output += `  ... and ${variables.length - (output.match(/\n/g) || []).length} more variables\n`
      break
    }

    output += line
  }

  return output.trim()
}

/**
 * Extract a snippet of source code around the current line.
 * Returns lines in format: "  123 | code here"
 */
function getSourceSnippet(
  sourceLines: string[],
  currentLine: number,
  contextLines: number
): string {
  if (sourceLines.length === 0) {
    return '(source code not available)'
  }

  // DAP uses 1-indexed lines
  const absoluteIndex = currentLine - 1
  const startIndex = Math.max(0, absoluteIndex - contextLines)
  const endIndex = Math.min(sourceLines.length, absoluteIndex + contextLines + 1)

  const snippet: string[] = []

  for (let i = startIndex; i < endIndex; i++) {
    const lineNum = i + 1
    const isCurrentLine = i === absoluteIndex
    const marker = isCurrentLine ? '→ ' : '  '

    // Pad line numbers to align
    const paddedNum = String(lineNum).padStart(4)
    const code = sourceLines[i] || ''

    snippet.push(`${marker}${paddedNum} | ${code}`)
  }

  return snippet.join('\n')
}

/**
 * Get execution history from session (for session narrative feature).
 * Returns formatted history entries.
 */
export function getExecutionHistory(): string {
  const state = session.getState()
  const history = state.executionHistory || []

  if (history.length === 0) {
    return '(no execution history yet)'
  }

  const lines = history.slice(0, 10).map((entry, idx) => {
    const changedVars = Object.entries(entry.variables)
      .filter(([_, v]) => v.changed)
      .map(([name, v]) => `${name}=${v.value}`)
      .join(', ')

    return `Step ${entry.step}: ${entry.file}:${entry.line} [${changedVars}]`
  })

  return lines.join('\n')
}
