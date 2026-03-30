// src/components/panels/MemoryPanel.tsx
//
// Hex-dump viewer.  Reads memoryBytes (base64) from Zustand, decodes to
// Uint8Array, renders 16 bytes per row.
//
// Region colour-coding:
//   stack  — blue    derived from assemblyLines (RSP/ESP/SP register hints)
//             and variables whose memoryReference falls in a "low address" range
//   heap   — green   variables whose type contains '*' and memoryReference
//             is in a "high address" range relative to the snapshot base
//   code   — purple  addresses that appear in assemblyLines
//   null   — red dim  byte value 0x00
//   other  — default grey
//
// DAP gives us `memoryBytes` as a base64 string covering one contiguous block
// starting at `memoryReference` of the selected variable / register.
// We also expose a manual address + length fetch form so the user can pull
// any region they like.

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import { IPC } from '../../shared/ipc'

// ── Constants ─────────────────────────────────────────────────────────────────

const COLS        = 16   // bytes per row
const MAX_ROWS    = 512  // render cap — 8 KiB; virtualise if you need more

// ── Region classification ─────────────────────────────────────────────────────

type Region = 'stack' | 'heap' | 'code' | 'null' | 'other'

interface RegionMap {
  stackAddrs: Set<number>   // absolute byte offsets into the snapshot
  heapAddrs:  Set<number>
  codeAddrs:  Set<number>
}

/** Parse a hex address string like "0x7fff1234" → BigInt, or null on failure. */
function parseAddr(s: string): bigint | null {
  try {
    const clean = s.replace(/^0x/i, '').trim()
    if (!clean) return null
    return BigInt('0x' + clean)
  } catch {
    return null
  }
}

/**
 * Build region offset sets relative to snapshotBase.
 * We work in BigInt for addresses (64-bit safe) then convert offsets to number
 * only when they fit within the snapshot window.
 */
function buildRegionMap(
  snapshotBase:   bigint,
  snapshotLength: number,
  assemblyLines:  { address: string }[],
  variables:      { memoryReference?: string; type?: string }[],
): RegionMap {
  const stackAddrs = new Set<number>()
  const heapAddrs  = new Set<number>()
  const codeAddrs  = new Set<number>()

  const inWindow = (abs: bigint): number | null => {
    const off = abs - snapshotBase
    if (off < 0n || off >= BigInt(snapshotLength)) return null
    return Number(off)
  }

  // Code: every address from the disassembly listing
  for (const line of assemblyLines) {
    const abs = parseAddr(line.address)
    if (abs === null) continue
    const off = inWindow(abs)
    if (off !== null) codeAddrs.add(off)
  }

  // Stack vs heap heuristic:
  //   Stack frames typically live at high virtual addresses (e.g. 0x7fff…)
  //   Heap allocations typically live at lower addresses (e.g. 0x0055…)
  //   We split on the snapshot midpoint as a simple heuristic.
  const mid = snapshotBase + BigInt(snapshotLength) / 2n

  for (const v of variables) {
    if (!v.memoryReference) continue
    const abs = parseAddr(v.memoryReference)
    if (abs === null) continue
    const off = inWindow(abs)
    if (off === null) continue

    const isPointer = v.type?.includes('*') || v.type?.includes('ptr')
    if (abs > mid) {
      stackAddrs.add(off)
    } else if (isPointer) {
      heapAddrs.add(off)
    }
  }

  return { stackAddrs, heapAddrs, codeAddrs }
}

function classifyByte(
  offset: number,
  value:  number,
  map:    RegionMap,
): Region {
  if (value === 0x00)           return 'null'
  if (map.codeAddrs.has(offset))  return 'code'
  if (map.stackAddrs.has(offset)) return 'stack'
  if (map.heapAddrs.has(offset))  return 'heap'
  return 'other'
}

// ── Styling ───────────────────────────────────────────────────────────────────

const REGION_HEX_CLASS: Record<Region, string> = {
  stack: 'text-[#5ba0f2] font-medium',
  heap:  'text-[#4ec9a0] font-medium',
  code:  'text-[#b48af7] font-medium',
  null:  'text-[#333]',
  other: 'text-[#8a8a9a]',
}

const REGION_ASCII_CLASS: Record<Region, string> = {
  stack: 'text-[#3a6aaa]',
  heap:  'text-[#2e8a6e]',
  code:  'text-[#7a5ab7]',
  null:  'text-[#2a2a2a]',
  other: 'text-[#444]',
}

// ── Base64 decode ─────────────────────────────────────────────────────────────

function base64ToUint8Array(b64: string): Uint8Array {
  try {
    const bin = atob(b64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    return arr
  } catch {
    return new Uint8Array(0)
  }
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

interface ByteTooltipState {
  offset:  number
  value:   number
  region:  Region
  x:       number
  y:       number
}

// ── Address input ─────────────────────────────────────────────────────────────

function AddressBar({
  baseAddr,
  onFetch,
  loading,
}: {
  baseAddr:  string
  onFetch:   (addr: string, count: number) => void
  loading:   boolean
}) {
  const [addr,  setAddr]  = useState(baseAddr)
  const [count, setCount] = useState(256)

  // Keep addr field in sync when store base changes
  useEffect(() => { setAddr(baseAddr) }, [baseAddr])

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#222] shrink-0 bg-[#141420]">
      <span className="text-[9px] font-mono text-[#444] uppercase tracking-widest shrink-0">addr</span>
      <input
        value={addr}
        onChange={(e) => setAddr(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onFetch(addr, count) }}
        placeholder="0x00007fff…"
        spellCheck={false}
        className="flex-1 min-w-0 bg-[#0e0e18] border border-[#2a2a3a] rounded px-2 py-0.5
                   text-[11px] font-mono text-[#8a8af7] placeholder:text-[#2a2a3a]
                   focus:outline-none focus:border-[#534AB7]"
      />
      <span className="text-[9px] font-mono text-[#444] shrink-0">×</span>
      <input
        type="number"
        value={count}
        min={16} max={8192} step={16}
        onChange={(e) => setCount(Math.max(16, Math.min(8192, Number(e.target.value))))}
        className="w-16 bg-[#0e0e18] border border-[#2a2a3a] rounded px-2 py-0.5
                   text-[11px] font-mono text-[#8a8af7]
                   focus:outline-none focus:border-[#534AB7]"
      />
      <button
        onClick={() => onFetch(addr, count)}
        disabled={loading}
        className="text-[10px] px-2 py-0.5 rounded bg-[#1e1c3a] border border-[#3a3858]
                   text-[#7c6af7] hover:bg-[#2a2848] disabled:opacity-40 transition-colors shrink-0"
      >
        {loading ? '…' : 'fetch'}
      </button>
    </div>
  )
}

// ── Hex row ───────────────────────────────────────────────────────────────────

interface HexRowProps {
  rowIndex:    number
  bytes:       Uint8Array
  offset:      number          // byte offset of this row's first byte in snapshot
  baseAddr:    bigint
  regionMap:   RegionMap
  highlighted: number | null   // hovered byte offset
  onHover:     (offset: number | null, e?: React.MouseEvent) => void
  onClick:     (offset: number, value: number, region: Region) => void
}

const HexRow = ({
  rowIndex, bytes, offset, baseAddr, regionMap, highlighted, onHover, onClick,
}: HexRowProps) => {
  const rowAddr = baseAddr + BigInt(offset)
  const count   = Math.min(COLS, bytes.length - offset)

  return (
    <tr className="group">
      {/* Address */}
      <td className="pl-3 pr-2 py-[1px] text-[#3a3a5a] tabular-nums select-none whitespace-nowrap">
        {'0x' + rowAddr.toString(16).padStart(12, '0')}
      </td>

      {/* Hex cells */}
      <td className="px-1 py-[1px]">
        <div className="flex gap-[3px]">
          {Array.from({ length: COLS }, (_, col) => {
            const byteOff = offset + col
            const inRange = col < count
            const val     = inRange ? bytes[byteOff] : null
            const region  = inRange ? classifyByte(byteOff, val!, regionMap) : 'other'
            const isHov   = byteOff === highlighted

            return (
              <span
                key={col}
                onMouseEnter={(e) => inRange && onHover(byteOff, e)}
                onMouseLeave={() => onHover(null)}
                onClick={() => inRange && val !== null && onClick(byteOff, val, region)}
                className={[
                  'w-[18px] text-center cursor-default rounded-[2px] text-[11px] font-mono',
                  inRange ? REGION_HEX_CLASS[region] : 'text-transparent',
                  isHov   ? 'bg-white/10 ring-1 ring-white/20' : '',
                  // Group bytes into chunks of 4 with a slightly wider gap
                  col === 7 ? 'mr-[6px]' : '',
                ].join(' ')}
              >
                {inRange ? val!.toString(16).padStart(2, '0') : '  '}
              </span>
            )
          })}
        </div>
      </td>

      {/* ASCII */}
      <td className="pl-2 pr-3 py-[1px]">
        <span className="font-mono text-[11px] tracking-[1px]">
          {Array.from({ length: count }, (_, col) => {
            const byteOff = offset + col
            const val     = bytes[byteOff]
            const region  = classifyByte(byteOff, val, regionMap)
            const ch      = val >= 0x20 && val < 0x7f ? String.fromCharCode(val) : '·'
            const isHov   = byteOff === highlighted
            return (
              <span
                key={col}
                onMouseEnter={(e) => onHover(byteOff, e)}
                onMouseLeave={() => onHover(null)}
                className={[
                  REGION_ASCII_CLASS[region],
                  isHov ? 'bg-white/10' : '',
                ].join(' ')}
              >
                {ch}
              </span>
            )
          })}
        </span>
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MemoryPanel() {
  const memoryBytes    = useDebugStore((s) => s.memoryBytes)
  const assemblyLines  = useDebugStore((s) => s.assemblyLines)
  const variables      = useDebugStore((s) => s.variables)
  const status         = useDebugStore((s) => s.status)

  // Local fetch state (for manual address bar requests)
  const [fetchedB64,  setFetchedB64]  = useState<string | null>(null)
  const [fetchedBase, setFetchedBase] = useState<string>('')
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError,  setFetchError]  = useState<string>('')

  // Tooltip
  const [tooltip, setTooltip] = useState<ByteTooltipState | null>(null)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Selected byte (clicked)
  const [selected, setSelected] = useState<ByteTooltipState | null>(null)

  // ── Resolve bytes to display ──────────────────────────────────────────────
  // Priority: manually fetched > store memoryBytes
  const activeB64   = fetchedB64 ?? memoryBytes ?? null
  const activeBytes = useMemo(
    () => activeB64 ? base64ToUint8Array(activeB64) : new Uint8Array(0),
    [activeB64],
  )

  // Derive base address from fetched address or first variable memoryReference
  const baseAddrStr = useMemo(() => {
    if (fetchedBase) return fetchedBase
    const firstRef = variables.find((v) => v.memoryReference)?.memoryReference
    return firstRef ?? '0x0000000000000000'
  }, [fetchedBase, variables])

  const baseAddr = useMemo(
    () => parseAddr(baseAddrStr) ?? 0n,
    [baseAddrStr],
  )

  // ── Region map ────────────────────────────────────────────────────────────
  const regionMap = useMemo(
    () => buildRegionMap(baseAddr, activeBytes.length, assemblyLines, variables),
    [baseAddr, activeBytes.length, assemblyLines, variables],
  )

  // ── Fetch handler ─────────────────────────────────────────────────────────
  const handleFetch = useCallback(async (addr: string, count: number) => {
    if (status !== 'paused') {
      setFetchError('Pause execution first.')
      return
    }
    setFetchLoading(true)
    setFetchError('')
    try {
      const result = await (globalThis as any).electronAPI?.invoke(
        IPC.READ_MEMORY, { memoryReference: addr, count }
      ) as any
      if (result?.data) {
        setFetchedB64(result.data)
        setFetchedBase(addr)
      } else {
        setFetchError(result?.error ?? 'Adapter returned no data.')
      }
    } catch (e: any) {
      setFetchError(e.message ?? 'IPC error')
    } finally {
      setFetchLoading(false)
    }
  }, [status])

  // ── Hover handler ─────────────────────────────────────────────────────────
  const handleHover = useCallback((
    offset: number | null,
    e?: React.MouseEvent,
  ) => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    if (offset === null || !e) { setTooltip(null); return }
    const val    = activeBytes[offset]
    const region = classifyByte(offset, val, regionMap)
    setTooltip({ offset, value: val, region, x: e.clientX, y: e.clientY })
  }, [activeBytes, regionMap])

  // ── Click handler ─────────────────────────────────────────────────────────
  const handleClick = useCallback((offset: number, value: number, region: Region) => {
    setSelected((prev) =>
      prev?.offset === offset ? null : { offset, value, region, x: 0, y: 0 }
    )
  }, [])

  // ── Capped row count ──────────────────────────────────────────────────────
  const totalBytes = Math.min(activeBytes.length, MAX_ROWS * COLS)
  const rowCount   = Math.ceil(totalBytes / COLS)

  // ── Empty states ──────────────────────────────────────────────────────────
  const showEmpty = activeBytes.length === 0

  return (
    <div className="flex flex-col h-full bg-[#0f0f1a] overflow-hidden">

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#1e1e2e] shrink-0">
        <span className="text-[10px] uppercase tracking-widest text-[#333358] font-mono">Memory</span>

        {activeBytes.length > 0 && (
          <span className="text-[10px] font-mono text-[#2a2a4a] tabular-nums">
            {activeBytes.length.toLocaleString()} bytes
          </span>
        )}

        {activeBytes.length > MAX_ROWS * COLS && (
          <span className="text-[10px] font-mono text-amber-700">
            (showing first {(MAX_ROWS * COLS).toLocaleString()})
          </span>
        )}

        {/* Region legend */}
        <div className="ml-auto flex items-center gap-3">
          {([
            ['stack', 'text-[#5ba0f2]'],
            ['heap',  'text-[#4ec9a0]'],
            ['code',  'text-[#b48af7]'],
          ] as const).map(([label, cls]) => (
            <span key={label} className={`text-[10px] font-mono ${cls}`}>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Address bar ────────────────────────────────────────────────── */}
      <AddressBar
        baseAddr={baseAddrStr}
        onFetch={handleFetch}
        loading={fetchLoading}
      />

      {/* ── Error strip ────────────────────────────────────────────────── */}
      {fetchError && (
        <div className="px-3 py-1 bg-red-950/40 border-b border-red-900/40 text-[10px] font-mono text-red-400 shrink-0">
          {fetchError}
        </div>
      )}

      {/* ── Selected byte info ──────────────────────────────────────────── */}
      {selected && (
        <div className="flex items-center gap-3 px-3 py-1 border-b border-[#1e1e2e] shrink-0 bg-[#12121e] text-[10px] font-mono">
          <span className="text-[#444]">
            addr <span className="text-[#8a8af7]">
              {'0x' + (baseAddr + BigInt(selected.offset)).toString(16).padStart(12, '0')}
            </span>
          </span>
          <span className="text-[#444]">
            hex  <span className="text-[#ccc]">{selected.value.toString(16).padStart(2, '0')}</span>
          </span>
          <span className="text-[#444]">
            dec  <span className="text-[#ccc]">{selected.value}</span>
          </span>
          <span className="text-[#444]">
            bin  <span className="text-[#888]">{selected.value.toString(2).padStart(8, '0')}</span>
          </span>
          <span className="text-[#444]">
            char <span className="text-[#ccc]">
              {selected.value >= 0x20 && selected.value < 0x7f
                ? `'${String.fromCharCode(selected.value)}'`
                : 'non-print'}
            </span>
          </span>
          <span className={`ml-auto ${REGION_HEX_CLASS[selected.region]}`}>
            {selected.region}
          </span>
          <button
            onClick={() => setSelected(null)}
            className="text-[#333] hover:text-[#888] ml-1"
          >✕</button>
        </div>
      )}

      {/* ── Hex grid ───────────────────────────────────────────────────── */}
      {showEmpty ? (
        <EmptyState status={status} />
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="border-collapse w-full">
            <thead className="sticky top-0 z-10 bg-[#0f0f1a]">
              <tr className="border-b border-[#1a1a2a]">
                <th className="pl-3 pr-2 py-1 text-left text-[9px] font-mono text-[#2a2a4a] uppercase tracking-widest whitespace-nowrap">
                  Address
                </th>
                <th className="px-1 py-1 text-left">
                  <div className="flex gap-[3px]">
                    {Array.from({ length: COLS }, (_, i) => (
                      <span
                        key={i}
                        className={[
                          'w-[18px] text-center text-[9px] font-mono text-[#2a2a4a]',
                          i === 7 ? 'mr-[6px]' : '',
                        ].join(' ')}
                      >
                        {i.toString(16).padStart(2, '0')}
                      </span>
                    ))}
                  </div>
                </th>
                <th className="pl-2 pr-3 py-1 text-left text-[9px] font-mono text-[#2a2a4a] uppercase tracking-widest">
                  ASCII
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowCount }, (_, row) => (
                <HexRow
                  key={row}
                  rowIndex={row}
                  bytes={activeBytes}
                  offset={row * COLS}
                  baseAddr={baseAddr}
                  regionMap={regionMap}
                  highlighted={tooltip?.offset ?? null}
                  onHover={handleHover}
                  onClick={handleClick}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Hover tooltip ──────────────────────────────────────────────── */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none px-2 py-1 rounded
                     bg-[#1a1a2e] border border-[#3a3858] text-[10px] font-mono
                     shadow-lg shadow-black/50"
          style={{ left: tooltip.x + 14, top: tooltip.y - 28 }}
        >
          <span className="text-[#555]">0x</span>
          <span className="text-[#ccc]">{tooltip.value.toString(16).padStart(2, '0')}</span>
          <span className="text-[#444] mx-1">·</span>
          <span className="text-[#888]">{tooltip.value}</span>
          <span className="text-[#444] mx-1">·</span>
          <span className={REGION_HEX_CLASS[tooltip.region]}>{tooltip.region}</span>
        </div>
      )}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ status }: { status: string }) {
  const msgs: Record<string, string> = {
    idle:       'Launch a debug session to inspect memory.',
    launching:  'Starting…',
    running:    'Pause or hit a breakpoint to read memory.',
    terminated: 'Session ended.',
  }
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
      <GridIcon />
      <span className="text-[11px] font-mono text-[#252535] leading-relaxed whitespace-pre-line">
        {msgs[status] ?? 'Enter an address above and click fetch.'}
      </span>
    </div>
  )
}

function GridIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="opacity-20">
      <rect x="2"  y="2"  width="9"  height="9"  rx="1" stroke="#8a8af7" strokeWidth="1.5"/>
      <rect x="13" y="2"  width="9"  height="9"  rx="1" stroke="#8a8af7" strokeWidth="1.5"/>
      <rect x="2"  y="13" width="9"  height="9"  rx="1" stroke="#8a8af7" strokeWidth="1.5"/>
      <rect x="13" y="13" width="9"  height="9"  rx="1" stroke="#8a8af7" strokeWidth="1.5"/>
    </svg>
  )
}