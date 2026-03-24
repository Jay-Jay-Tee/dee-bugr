/**
 * src/main/test/test-day4-fixes.ts
 *
 * Day 4 manual test — validates suggestFix() against the REAL Groq API
 * on 5 realistic bugs across Python and JavaScript.
 *
 * PowerShell run:
 *   $env:DEE_BUGR_GROQ_KEY='your_key_here'; npx ts-node src/main/test/test-day4-fixes.ts
 *
 * bash/zsh run:
 *   DEE_BUGR_GROQ_KEY='your_key_here' npx ts-node src/main/test/test-day4-fixes.ts
 */

interface FormattedDebugContext {
  language: 'python' | 'javascript' | 'java' | 'c' | 'cpp'
  currentFile: string
  currentLine: number
  sourceCodeSnippet: string
  stackTrace: string
  localVariables: string
  errorMessage?: string
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.1-8b-instant'

async function callGroqSuggestFix(context: FormattedDebugContext): Promise<{ originalCode: string; fixedCode: string; explanation: string }> {
  const apiKey = process.env.DEE_BUGR_GROQ_KEY
  if (!apiKey) {
    throw new Error('DEE_BUGR_GROQ_KEY is not set. Set it before running this test.')
  }

  const systemPrompt =
    'You are an expert code reviewer. Given the execution context, suggest a specific code fix. ' +
    'Return ONLY a valid JSON object with exactly these keys: ' +
    '{ "originalCode": "the buggy lines", "fixedCode": "the corrected lines", "explanation": "one sentence why" }. ' +
    'Keep fixes minimal: modify only the necessary lines, do not rewrite full functions unless unavoidable. ' +
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

Call Stack:
${context.stackTrace}

Return a JSON object with originalCode, fixedCode, and explanation:
`.trim()

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 900,
    }),
  })

  if (!response.ok) {
    const msg = await response.text()
    throw new Error(`Groq API error ${response.status}: ${msg}`)
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const raw = data.choices?.[0]?.message?.content ?? ''
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(cleaned) as {
    originalCode?: unknown
    fixedCode?: unknown
    explanation?: unknown
  }

  return {
    originalCode: typeof parsed.originalCode === 'string' ? parsed.originalCode : '',
    fixedCode: typeof parsed.fixedCode === 'string' ? parsed.fixedCode : '',
    explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
  }
}

interface TestCase {
  name: string
  context: FormattedDebugContext
}

function countLines(text: string): number {
  return text.trim() ? text.split('\n').length : 0
}

function printFixSummary(name: string, fix: { originalCode: string; fixedCode: string; explanation: string }) {
  const originalLines = countLines(fix.originalCode)
  const fixedLines = countLines(fix.fixedCode)
  const lineDelta = Math.abs(fixedLines - originalLines)

  console.log(`\n${name}`)
  console.log(`  Original: ${fix.originalCode.substring(0, 80).replace(/\n/g, ' / ')}`)
  console.log(`  Fixed:    ${fix.fixedCode.substring(0, 80).replace(/\n/g, ' / ')}`)
  console.log(`  Why:      ${fix.explanation}`)
  console.log(`  Diff size: ${lineDelta} line delta (${originalLines} -> ${fixedLines})`)
}

async function runOne(testCase: TestCase) {
  const fix = await callGroqSuggestFix(testCase.context)
  printFixSummary(testCase.name, fix)

  if (!fix.originalCode || !fix.fixedCode || !fix.explanation) {
    console.warn('  ⚠ Incomplete structured output returned by AI')
  }

  if (countLines(fix.fixedCode) - countLines(fix.originalCode) > 8) {
    console.warn('  ⚠ Large rewrite detected; prompt likely needs tightening')
  }
}

async function runTests() {
  if (!process.env.DEE_BUGR_GROQ_KEY) {
    throw new Error('DEE_BUGR_GROQ_KEY is not set. Set it before running this test.')
  }

  const tests: TestCase[] = [
    {
      name: 'Test 1: Python - Uninitialized Loop Counter',
      context: {
        language: 'python',
        currentFile: 'test.py',
        currentLine: 5,
        sourceCodeSnippet: 'i = 0\nwhile i < len(items):\n    print(items[i])',
        localVariables: 'i=0, items=[1,2,3,4,5], len=5',
        stackTrace: '-> main() at test.py:5',
        errorMessage: undefined,
      },
    },
    {
      name: 'Test 2: JavaScript - Array Index Off-by-One',
      context: {
        language: 'javascript',
        currentFile: 'index.js',
        currentLine: 12,
        sourceCodeSnippet: 'for (let i = 0; i <= length; i++) { arr[i] }',
        localVariables: 'length=5, arr=[a,b,c,d,e]',
        stackTrace: '-> loop() at index.js:12',
        errorMessage: undefined,
      },
    },
    {
      name: 'Test 3: Python - Null Pointer Dereference',
      context: {
        language: 'python',
        currentFile: 'service.py',
        currentLine: 42,
        sourceCodeSnippet: 'x = None\nresult = x.method()',
        localVariables: 'x=None',
        stackTrace: '-> process() at service.py:42',
        errorMessage: "AttributeError: 'NoneType' object has no attribute 'method'",
      },
    },
    {
      name: 'Test 4: JavaScript - Logic Error (Invalid Transaction)',
      context: {
        language: 'javascript',
        currentFile: 'wallet.js',
        currentLine: 89,
        sourceCodeSnippet: 'let balance = 100\nbalance -= 150',
        localVariables: 'balance=100, amount=150',
        stackTrace: '-> withdraw() at wallet.js:89',
        errorMessage: undefined,
      },
    },
    {
      name: 'Test 5: Python - Variable Capture (Wrong Array Reference)',
      context: {
        language: 'python',
        currentFile: 'processor.py',
        currentLine: 156,
        sourceCodeSnippet: 'sum = 0\nfor lst in lists:\n  for i in lst:\n    sum += arr[i]',
        localVariables: 'sum=0, lists=[[0,1],[2,3]], arr=[10,20,30,40], i=0',
        stackTrace: '-> aggregate() at processor.py:156',
        errorMessage: undefined,
      },
    },
  ]

  console.log('=== Day 4 Real API Fix Suggestion Tests ===')
  console.log(`Model path: Groq direct API (${MODEL})`)

  for (const testCase of tests) {
    await runOne(testCase)
  }

  console.log('\n=== Complete ===')
  console.log('Review warnings above for non-minimal diffs.')
}

runTests().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
