// src/components/panels/AssemblyPanel.tsx
//
// Standalone disassembly viewer.
// Reads assemblyLines + currentLine + language + status from Zustand.
// Replaces the inline AssemblyPanel function in RightPanel.tsx.

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import type { AsmLine } from '../../shared/types'

// ── Mnemonic syntax highlighting ──────────────────────────────────────────────
//
// Groups based on common x86/ARM/JVM mnemonic families.
// Returns a pair of [mnemonicClass, operandsClass] Tailwind colour strings.

function mnemonicClass(mnemonic: string): string {
  const m = mnemonic.toLowerCase()
  if (/^j|^b(eq|ne|lt|gt|le|ge|al|r$)/.test(m)) return 'text-[#c586c0]'  // jumps/branches — purple
  if (/^call|^bl$|^jsr/.test(m))                  return 'text-[#dcdcaa]'  // calls — yellow
  if (/^ret|^iret|^rfe|^eret/.test(m))             return 'text-[#f48771]'  // returns — orange-red
  if (/^mov|^lea|^ldr|^str|^push|^pop/.test(m))    return 'text-[#9cdcfe]'  // data movement — blue
  if (/^cmp|^test|^tst/.test(m))                   return 'text-[#4ec9b0]'  // compare — teal
  if (/^add|^sub|^mul|^div|^inc|^dec|^neg/.test(m)) return 'text-[#b5cea8]' // arithmetic — green
  if (/^and|^or|^xor|^not|^shl|^shr|^sar/.test(m)) return 'text-[#ce9178]' // bitwise — amber
  if (/^nop|^hlt|^int/.test(m))                    return 'text-[#555]'     // misc — dim
  return 'text-[#569cd6]'                                                    // default — blue
}

interface HighlightedInstructionProps {
  instruction: string
}

function HighlightedInstruction({ instruction }: HighlightedInstructionProps) {
  // Split on first whitespace run: mnemonic + rest
  const spaceIdx = instruction.search(/\s/)
  if (spaceIdx === -1) {
    return <span className={mnemonicClass(instruction) + ' font-semibold'}>{instruction}</span>
  }
  const mnemonic  = instruction.slice(0, spaceIdx)
  const operands  = instruction.slice(spaceIdx)
  // Colour immediate values (0x…, #N, plain numbers) inside operands
  const coloured  = operands.replace(
    /(0x[0-9a-fA-F]+|-?\d+)/g,
    '<num>$1</num>',
  )

  return (
    <>
      <span className={mnemonicClass(mnemonic) + ' font-semibold'}>{mnemonic}</span>
      <span className="text-[#cccccc]">
        {coloured.split(/(<num>.*?<\/num>)/).map((part, i) => {
          const m = part.match(/^<num>(.*)<\/num>$/)
          return m
            ? <span key={i} className="text-[#b5cea8]">{m[1]}</span>
            : <span key={i}>{part}</span>
        })}
      </span>
    </>
  )
}

// ── Address formatting ────────────────────────────────────────────────────────

function fmtAddress(addr: string): string {
  // Normalise to lowercase, trim leading zeros beyond 4, keep 0x prefix
  if (addr.startsWith('0x') || addr.startsWith('0X')) {
    const hex = addr.slice(2).replace(/^0+/, '') || '0'
    return '0x' + hex.toLowerCase().padStart(8, '0')
  }
  return addr
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handle = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [text])
  return (
    <button
      onClick={handle}
      title="Copy disassembly"
      className="text-[#555] hover:text-[#ccc] transition-colors text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5"
    >
      {copied ? '✓ copied' : 'copy'}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AssemblyPanel() {
  const assemblyLines  = useDebugStore((s) => s.assemblyLines)
  const currentLine    = useDebugStore((s) => s.currentLine)
  const language       = useDebugStore((s) => s.language)
  const status         = useDebugStore((s) => s.status)
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)

  const currentRowRef  = useRef<HTMLTableRowElement>(null)
  const [showBytes,    setShowBytes]    = useState(false)
  const [search,       setSearch]       = useState('')
  const [searchActive, setSearchActive] = useState(false)

  // Auto-scroll to current instruction whenever it changes
  useEffect(() => {
    currentRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [assemblyLines, currentLine])

  // Filter lines by search query
  const filteredLines = useMemo<AsmLine[]>(() => {
    if (!search.trim()) return assemblyLines
    const q = search.trim().toLowerCase()
    return assemblyLines.filter(
      (l) =>
        l.address.toLowerCase().includes(q) ||
        l.instruction.toLowerCase().includes(q) ||
        (l.bytes ?? '').toLowerCase().includes(q) ||
        String(l.sourceLine ?? '').includes(q),
    )
  }, [assemblyLines, search])

  // Clipboard text: address  bytes  instruction
  const clipboardText = useMemo(
    () =>
      assemblyLines
        .map((l) =>
          [fmtAddress(l.address), l.bytes ?? '', l.instruction, l.sourceLine ? `; L${l.sourceLine}` : '']
            .filter(Boolean)
            .join('  '),
        )
        .join('\n'),
    [assemblyLines],
  )

  // ── Empty / restricted states ───────────────────────────────────────────────

  if (isBeginnerMode) {
    return (
      <EmptyState message="Assembly view is hidden in Beginner mode." />
    )
  }

  if (language !== 'c' && language !== 'cpp' && language !== 'java') {
    return (
      <EmptyState message={`Assembly available for C / C++ / Java.\nCurrent language: ${language}.`} />
    )
  }

  if (status === 'idle' || status === 'terminated') {
    return <EmptyState message="Launch a session to see disassembly." />
  }

  if (status === 'running') {
    return <EmptyState message="Running…  pause or hit a breakpoint." />
  }

  if (assemblyLines.length === 0) {
    return (
      <EmptyState
        message={status === 'paused'
          ? 'No disassembly for this frame.\nThe adapter may not support DISASSEMBLE.'
          : 'Step to a breakpoint to load disassembly.'}
      />
    )
  }

  // ── Table ─────────────────────────────────────────────────────────────────

  const currentIdx = assemblyLines.findIndex((l) => l.sourceLine === currentLine)

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] overflow-hidden">

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#2d2d2d] shrink-0 bg-[#1e1e1e]">
        <span className="text-[10px] uppercase tracking-widest text-[#555]">Disassembly</span>

        <span className="text-[10px] text-[#3a3a3a] tabular-nums ml-1">
          {assemblyLines.length} insns
          {currentIdx >= 0 && (
            <span className="text-[#4a4a4a]">  ·  #{currentIdx + 1}</span>
          )}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {/* Bytes toggle */}
          <button
            onClick={() => setShowBytes((b) => !b)}
            title={showBytes ? 'Hide byte encoding' : 'Show byte encoding'}
            className={[
              'text-[10px] px-1.5 py-0.5 rounded transition-colors',
              showBytes
                ? 'bg-blue-600/30 text-blue-400 border border-blue-600/40'
                : 'text-[#555] hover:text-[#999] hover:bg-white/5',
            ].join(' ')}
          >
            bytes
          </button>

          {/* Search toggle */}
          <button
            onClick={() => { setSearchActive((a) => !a); setSearch('') }}
            title="Search instructions"
            className={[
              'text-[10px] px-1.5 py-0.5 rounded transition-colors',
              searchActive
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-[#555] hover:text-[#999] hover:bg-white/5',
            ].join(' ')}
          >
            ⌕
          </button>

          <CopyButton text={clipboardText} />
        </div>
      </div>

      {/* ── Search bar ─────────────────────────────────────────────────── */}
      {searchActive && (
        <div className="px-3 py-1.5 border-b border-[#2d2d2d] shrink-0 flex items-center gap-2">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); setSearchActive(false) } }}
            placeholder="address, mnemonic, operands…"
            className="flex-1 bg-[#252525] border border-[#3a3a3a] rounded px-2 py-1
                       text-[11px] font-mono text-[#ccc] placeholder:text-[#444]
                       focus:outline-none focus:border-[#569cd6]"
          />
          {search && (
            <span className="text-[10px] text-[#555] tabular-nums shrink-0">
              {filteredLines.length} / {assemblyLines.length}
            </span>
          )}
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <table className="w-full border-collapse text-[11px] font-mono">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#1e1e1e] border-b border-[#2d2d2d] text-[9px] uppercase tracking-widest">
              <th className="w-4 px-1 py-1.5 text-center text-[#333] font-normal select-none" />
              <th className="px-3 py-1.5 text-left text-[#444] font-normal whitespace-nowrap">Address</th>
              {showBytes && (
                <th className="px-3 py-1.5 text-left text-[#444] font-normal whitespace-nowrap">Bytes</th>
              )}
              <th className="px-3 py-1.5 text-left text-[#444] font-normal">Instruction</th>
              <th className="px-3 py-1.5 text-right text-[#444] font-normal whitespace-nowrap pr-3">Src</th>
            </tr>
          </thead>
          <tbody>
            {filteredLines.length === 0 ? (
              <tr>
                <td colSpan={showBytes ? 5 : 4} className="px-3 py-4 text-center text-[#444]">
                  No results for "{search}"
                </td>
              </tr>
            ) : (
              filteredLines.map((line, i) => {
                const isCurrent = line.sourceLine !== undefined && line.sourceLine === currentLine
                const isNear    = !isCurrent &&
                                  line.sourceLine !== undefined &&
                                  Math.abs((line.sourceLine ?? -999) - currentLine) <= 2

                return (
                  <tr
                    key={line.address + i}
                    ref={isCurrent ? currentRowRef : undefined}
                    className={[
                      'border-b transition-colors select-none',
                      isCurrent
                        ? 'bg-[#0d3a5c] border-[#1a5a8a]'
                        : isNear
                        ? 'bg-[#1a2535] border-[#1e1e1e] opacity-80'
                        : 'border-[#1e1e1e] hover:bg-[#242424]',
                    ].join(' ')}
                  >
                    {/* ── Gutter: current-instruction arrow ── */}
                    <td className="w-4 px-1 text-center">
                      {isCurrent && (
                        <span className="text-yellow-400 text-[10px] leading-none">▶</span>
                      )}
                    </td>

                    {/* ── Address ──────────────────────────── */}
                    <td className={[
                      'px-3 py-[3px] whitespace-nowrap tabular-nums',
                      isCurrent ? 'text-yellow-300' : 'text-[#569cd6]',
                    ].join(' ')}>
                      {fmtAddress(line.address)}
                    </td>

                    {/* ── Bytes (optional) ─────────────────── */}
                    {showBytes && (
                      <td className="px-3 py-[3px] text-[#3a3a3a] whitespace-nowrap tabular-nums">
                        {line.bytes ?? ''}
                      </td>
                    )}

                    {/* ── Instruction ──────────────────────── */}
                    <td className="px-3 py-[3px] whitespace-nowrap">
                      <HighlightedInstruction instruction={line.instruction} />
                    </td>

                    {/* ── Source line ───────────────────────── */}
                    <td className={[
                      'px-3 py-[3px] text-right whitespace-nowrap tabular-nums pr-3',
                      isCurrent ? 'text-yellow-500' : 'text-[#444]',
                    ].join(' ')}>
                      {line.sourceLine !== undefined ? `L${line.sourceLine}` : ''}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-1 border-t border-[#2d2d2d] shrink-0 bg-[#1e1e1e] overflow-x-auto">
        {[
          { color: 'text-[#c586c0]', label: 'jmp'  },
          { color: 'text-[#dcdcaa]', label: 'call' },
          { color: 'text-[#f48771]', label: 'ret'  },
          { color: 'text-[#9cdcfe]', label: 'mov'  },
          { color: 'text-[#4ec9b0]', label: 'cmp'  },
          { color: 'text-[#b5cea8]', label: 'arith'},
          { color: 'text-[#ce9178]', label: 'bit'  },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1 shrink-0">
            <span className={`${color} text-[10px] font-mono font-semibold`}>{label}</span>
          </span>
        ))}
        <span className="ml-auto text-[9px] text-[#333] shrink-0">▶ = current  ·  Src = source line</span>
      </div>
    </div>
  )
}

// ── Shared empty state ────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 text-center">
      <span className="text-[11px] font-mono text-[#404040] whitespace-pre-line leading-relaxed">
        {message}
      </span>
    </div>
  )
}