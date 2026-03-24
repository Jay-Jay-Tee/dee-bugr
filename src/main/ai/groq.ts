/**
 * src/main/ai/groq.ts
 *
 * Groq API client for AI explanations.
 * Calls Llama 3.1 70B via Groq's free API (https://groq.com)
 *
 * Set DEE_bugr_GROQ_KEY environment variable with your API key from https://console.groq.com
 */

import { FormattedDebugContext, getDebugContext, getExecutionHistory } from './context.ts'
import { Language } from '../../shared/types.ts'

const GROQ_API_KEY = process.env.DEE_BUGR_GROQ_KEY
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.1-8b-instant'

/**
 * Check if API key is configured.
 */
function ensureApiKey() {
  if (!GROQ_API_KEY) {
    throw new Error(
      'Groq API key not found. Set DEE_BUGR_GROQ_KEY environment variable. ' +
      'Get a free key from https://console.groq.com'
    )
  }
}

/**
 * Call Groq API with a prompt and return the response.
 */
async function callGroq(systemPrompt: string, userPrompt: string): Promise<string> {
  ensureApiKey()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      if (response.status === 429) {
        throw new Error('Rate limited by Groq API. Please retry in a few seconds.')
      }
      throw new Error(`Groq API error ${response.status}: ${error}`)
    }

    const data = await response.json() as any
    return data.choices?.[0]?.message?.content || 'No response from AI'
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('AI request timed out after 15 seconds. Please retry.')
    }
    console.error('[AI] Groq API call failed:', err.message)
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Day 9: keep prompts under safe size while preserving the highest-value context.
 * Priority: variables > stack > source snippet.
 */
function truncateDebugContext(context: FormattedDebugContext, maxChars = 8000): FormattedDebugContext {
  const localVariables = context.localVariables.slice(0, Math.floor(maxChars * 0.45))
  const stackTrace = context.stackTrace.slice(0, Math.floor(maxChars * 0.3))
  const sourceCodeSnippet = context.sourceCodeSnippet.slice(0, Math.floor(maxChars * 0.25))

  return {
    ...context,
    localVariables,
    stackTrace,
    sourceCodeSnippet,
  }
}

/**
 * Explain the bug at current execution point.
 * Returns a plain-English explanation of what went wrong and why.
 */
export async function explainBug(): Promise<string> {
  const context = truncateDebugContext(getDebugContext())

  const systemPrompt =
    'You are an expert debugger. Analyze the given execution context and explain what bug or issue is likely present. ' +
    'Be concise but thorough. Suggest the root cause and how to fix it.'

  const userPrompt = `
Debug Context:
Language: ${context.language}
File: ${context.currentFile}, Line: ${context.currentLine}
Error: ${context.errorMessage || '(no exception)'}

Current Source Code:
${context.sourceCodeSnippet}

Variables:
${context.localVariables}

Call Stack:
${context.stackTrace}

What bug or issue is likely present at this execution point?
`.trim()

  return await callGroq(systemPrompt, userPrompt)
}

/**
 * Suggest a fix for the current bug.
 * Returns { originalCode, fixedCode, explanation } for the Monaco diff editor.
 */
export async function suggestFix(): Promise<{ originalCode: string; fixedCode: string; explanation: string }> {
  const context = truncateDebugContext(getDebugContext())

  const systemPrompt =
    'You are an expert code reviewer. Given the execution context, suggest a specific code fix. ' +
    'Return ONLY a valid JSON object with exactly these keys: ' +
    '{ "originalCode": "the buggy lines", "fixedCode": "the corrected lines", "explanation": "one sentence why" }. ' +
    'No markdown. No backticks. No extra text. Only the JSON object.'

  const userPrompt = `
Debug Context:
Language: ${context.language}
File: ${context.currentFile}, Line: ${context.currentLine}
Error: ${context.errorMessage || '(no exception)'}

Current Source Code:
${context.sourceCodeSnippet}

Variables:
${context.localVariables}

Return a JSON object with originalCode, fixedCode, and explanation:
`.trim()

  try {
    const raw = await callGroq(systemPrompt, userPrompt)
    // Strip markdown fences if model wraps anyway
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      originalCode:  typeof parsed.originalCode === 'string'  ? parsed.originalCode  : '',
      fixedCode:     typeof parsed.fixedCode    === 'string'  ? parsed.fixedCode     : '',
      explanation:   typeof parsed.explanation  === 'string'  ? parsed.explanation   : '',
    }
  } catch (err) {
    console.error('[AI] suggestFix JSON parse failed:', err)
    // Graceful fallback: return the raw text as explanation so UI still shows something
    return { originalCode: context.sourceCodeSnippet, fixedCode: '', explanation: String(err) }
  }
}

/**
 * Explain a specific variable's purpose and value.
 */
export async function explainVariable(varName: string): Promise<string> {
  const context = truncateDebugContext(getDebugContext())

  const systemPrompt =
    'You are a debugging assistant. Explain what the named variable does and why its current value might be problematic or correct.'

  const userPrompt = `
Variable Name: ${varName}
Language: ${context.language}
Current Variables:
${context.localVariables}

Explain what "${varName}" is, what it should contain, and whether its current value makes sense in this context.
`.trim()

  return await callGroq(systemPrompt, userPrompt)
}

/**
 * Generate a concise 1-2 sentence tooltip explaining a variable's current state and usage.
 * Optimized for Beginner Mode variable hover tooltips.
 */
export async function explainVariableTooltip(
  varName: string,
  varValue: string,
  varType?: string
): Promise<string> {
  const context = truncateDebugContext(getDebugContext(), 3000)

  const systemPrompt =
    'You are a concise debugging assistant. Explain in 1-2 short sentences (target under 220 characters) what this variable is, its current value, and its likely purpose in this context. ' +
    'Be specific and practical. Example: "count is an integer set to 5; it tracks iterations through the loop and will be incremented each step."'

  const userPrompt = `
Variable: ${varName}
Type: ${varType || 'unknown'}
Current Value: ${varValue}
Language: ${context.language}
Code Context:
${context.sourceCodeSnippet}

Explain this variable in 1-2 brief sentences:
`.trim()

  try {
    const response = await callGroq(systemPrompt, userPrompt)
    // Ensure response is short and doesn't exceed a reasonable tooltip length
    const truncated = response.substring(0, 200).trim()
    return truncated
  } catch (err) {
    console.error('[AI] Variable tooltip failed:', err)
    return `${varName}: ${varValue}`
  }
}

/**
 * Generate a valid watchpoint expression from a natural language description.
 * Examples:
 *   "stop when balance goes negative" → "balance < 0"
 *   "when count exceeds 10" → "count > 10"
 */
export async function generateWatchpointExpression(
  description: string,
  language: Language,
  availableVariables: string[]
): Promise<string> {
  const systemPrompt =
    `You are a debugger expression generator for ${language}. Given a natural language description and available variables, ` +
    `generate a single valid ${language} expression that can be used as a breakpoint condition. ` +
    'Return ONLY the expression, no explanation. ' +
    'Examples: "x > 10", "items.length === 0", "balance < -100"'

  const userPrompt = `
Language: ${language}
Available Variables: ${availableVariables.join(', ')}

Convert this description to a valid ${language} watchpoint expression:
"${description}"

Return ONLY the expression (no quotes, no explanation):
`.trim()

  try {
    const response = await callGroq(systemPrompt, userPrompt)
    // Extract the expression (should be first line, no markdown)
    const expression = response.split('\n')[0].trim()
    return expression
  } catch (err) {
    console.error('[AI] Watchpoint expression generation failed:', err)
    return ''
  }
}

/**
 * Generate watch expression suggestions for the current breakpoint.
 * Returns an array of suggested variable/expression names to watch.
 */
export async function generateWatch(): Promise<string[]> {
  const context = truncateDebugContext(getDebugContext())

  const systemPrompt =
    'You are a debugging assistant. Given the execution context, suggest 3-5 variables or expressions the developer should watch to debug this issue. ' +
    'Return ONLY a JSON array of strings, nothing else.\n' +
    'Example: ["length", "ptr", "i < array.length", "count > 0"]'

  const userPrompt = `
Language: ${context.language}
Current Source Line: ${context.currentLine}
Code:
${context.sourceCodeSnippet}

Available Variables:
${context.localVariables}

Suggest 3-5 watch expressions (as JSON array of strings, no markdown):
`.trim()

  try {
    const response = await callGroq(systemPrompt, userPrompt)

    // Try to parse as JSON array
    const jsonMatch = response.match(/\[.*\]/s)
    if (!jsonMatch) {
      console.warn('[AI] Watch generation: Could not parse JSON array from response:', response)
      return []
    }

    const suggestions = JSON.parse(jsonMatch[0]) as string[]
    return Array.isArray(suggestions) ? suggestions.slice(0, 5) : []
  } catch (err) {
    console.error('[AI] Watch generation failed:', err)
    return []
  }
}

/**
 * Suggest breakpoint placement based on source code.
 * Analyzes source code BEFORE running to suggest useful breakpoint locations.
 */
export async function suggestBreakpoints(
  sourceCode: string,
  language: Language
): Promise<Array<{ line: number; reason: string }>> {
  const systemPrompt =
    `You are a debugging expert for ${language}. Analyze the source code and suggest 3-5 breakpoint locations ` +
    'that would be most useful for understanding the program flow.\n' +
    'Return ONLY a JSON array: [{"line": 5, "reason": "..."}, ...]\n' +
    'line must be an actual non-empty line number, reason must be brief.'

  const userPrompt = `
Source Code (${language}):
${addLineNumbers(sourceCode)}

Suggest 5 good breakpoint locations (return as JSON array only):
`.trim()

  try {
    const response = await callGroq(systemPrompt, userPrompt)

    const jsonMatch = response.match(/\[.*\]/s)
    if (!jsonMatch) {
      console.warn('[AI] BP suggestion: Could not parse JSON from response')
      return []
    }

    const suggestions = JSON.parse(jsonMatch[0]) as Array<{ line: number; reason: string }>
    return suggestions.filter(s => typeof s.line === 'number' && typeof s.reason === 'string').slice(0, 5)
  } catch (err) {
    console.error('[AI] BP suggestion failed:', err)
    return []
  }
}

/**
 * Day 7: suggest likely breakpoints by analyzing recent logs and source.
 */
export async function suggestBreakpointsFromLogs(
  logTail: string,
  language: Language,
  sourceCodeWithLines: string
): Promise<Array<{ line: number; reason: string }>> {
  const systemPrompt =
    `You are a debugging assistant for ${language}. Based on logs and source code, suggest exactly 3 breakpoints likely to catch the failure. ` +
    'Return ONLY a JSON array with objects: {"line": number, "reason": string}. ' +
    'Line must be a valid source line number from the provided code. Keep reason concise.'

  const userPrompt = `
Recent Logs (last lines):
${logTail}

Source Code (with line numbers):
${sourceCodeWithLines}

Return exactly 3 breakpoint suggestions as JSON array only:
`.trim()

  try {
    const response = await callGroq(systemPrompt, userPrompt)
    const cleaned = response.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned) as Array<{ line: number; reason: string }>
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((s) => typeof s.line === 'number' && Number.isFinite(s.line) && typeof s.reason === 'string')
      .slice(0, 3)
  } catch (err) {
    console.error('[AI] Log breakpoint suggestion failed:', err)
    return []
  }
}

/**
 * Generate a narrative summary of the debug session.
 * Useful for documentation or understanding a multi-step debugging session.
 */
export async function sessionNarrative(): Promise<string> {
  const history = getExecutionHistory()
  const context = getDebugContext()

  const systemPrompt =
    'You are a software journalist. Write a brief, engaging summary of the debug session\'s execution flow and findings.'

  const userPrompt = `
Execution History (first 10 steps):
${history}

Final Context:
Language: ${context.language}
Error: ${context.errorMessage || '(none)'}
Current Line: ${context.currentFile}:${context.currentLine}

Write a 3-4 sentence summary of what happened during this debug session and what was found:
`.trim()

  return await callGroq(systemPrompt, userPrompt)
}

/**
 * Helper: Add line numbers to source code for display.
 */
function addLineNumbers(source: string): string {
  return source
    .split('\n')
    .map((line, i) => `${String(i + 1).padStart(4)} | ${line}`)
    .join('\n')
}
