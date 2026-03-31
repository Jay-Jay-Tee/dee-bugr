/**
 * src/main/ai/groq.ts
 *
 * Groq API client for AI explanations.
 * Calls Llama 3.1 70B via Groq's free API (https://groq.com)
 *
 * Set DEE_bugr_GROQ_KEY environment variable with your API key from https://console.groq.com
 */

import { FormattedDebugContext, getDebugContext, getExecutionHistory } from './context'
import { Language } from '../../shared/types'

const GROQ_API_KEY = process.env.DEE_BUGR_GROQ_KEY
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

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

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
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
      throw new Error(`Groq API error ${response.status}: ${error}`)
    }

    const data = await response.json() as any
    return data.choices?.[0]?.message?.content || 'No response from AI'
  } catch (err: any) {
    console.error('[AI] Groq API call failed:', err.message)
    throw err
  }
}

/**
 * Explain the bug at current execution point.
 * Returns a plain-English explanation of what went wrong and why.
 */
export async function explainBug(): Promise<string> {
  const context = getDebugContext()

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
  const context = getDebugContext()

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
  const context = getDebugContext()

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
 * Generate watch expression suggestions for the current breakpoint.
 * Returns an array of suggested variable/expression names to watch.
 */
export async function generateWatch(): Promise<string[]> {
  const context = getDebugContext()

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

/**
 * MISSING FEATURE: Groq AI anomaly check for ambiguous cases.
 * Called every 5 steps when fast rule checks found nothing suspicious.
 * Returns Anomaly[] — empty array if nothing found or API unavailable.
 */
export async function checkAnomaliesWithAI(
  variables: Array<{ name: string; value: string; type: string }>,
  sourceSnippet: string
): Promise<import('../../shared/types').Anomaly[]> {
  if (!GROQ_API_KEY) return []  // silently skip if no key

  const varList = variables
    .map(v => `${v.name} = ${v.value} (${v.type})`)
    .join(', ')

  const systemPrompt = `You are a runtime anomaly detector for a debugger. Analyze the given variable values and source context for subtle bugs that simple pattern matching would miss. Examples: a pointer that is non-null but points to freed memory indicated by a suspiciously low or high address, a counter that should only grow but has decreased, a size variable that exceeds the container capacity, a variable that should be positive but is zero at a point where division is imminent. Return ONLY a JSON array (no markdown, no preamble). Empty array [] if nothing suspicious. Each element: {"variable":"name","type":"null_pointer|integer_overflow|bounds_exceeded|suspicious_jump|ai_flagged","severity":"warning|error","message":"short explanation under 20 words"}`

  const userPrompt = `Variables: ${varList}\n\nSource context:\n${sourceSnippet}`

  try {
    const raw = await callGroq(systemPrompt, userPrompt)
    // Strip markdown fences if the model disobeys
    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    if (!Array.isArray(parsed)) return []
    return parsed as import('../../shared/types').Anomaly[]
  } catch (err) {
    console.warn('[AI] checkAnomaliesWithAI parse/call failed:', err)
    return []
  }
}
