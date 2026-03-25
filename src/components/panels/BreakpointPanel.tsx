// src/components/panels/BreakpointPanel.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Breakpoint management sidebar.
//
// Supports the full Breakpoint type from shared/types.ts:
//   - Enable / disable toggle (local optimistic, synced via updateBreakpoint)
//   - Delete button
//   - Condition expression edit (e.g. "depth > 2")
//   - Hit count — auto-removes after N hits (hitCountRemaining)
//   - Log message — turns bp into a logpoint instead of a hard stop
//   - Label — friendly name shown in the list
//   - Group — toggle entire groups on/off
//   - Depends-on — only activates when another named bp was hit first
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useId } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'
import type { Breakpoint } from '../../shared/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortFile(filePath: string): string {
  return filePath.split('/').slice(-2).join('/')
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function DeleteIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="2" x2="11" y2="11" />
      <line x1="11" y1="2" x2="2" y2="11" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
    >
      <polyline points="3,1 7,5 3,9" />
    </svg>
  )
}

// ── Inline editable field ─────────────────────────────────────────────────────

interface EditFieldProps {
  label: string
  value: string
  placeholder: string
  onCommit: (value: string) => void
  type?: 'text' | 'number'
}

function EditField({ label, value, placeholder, onCommit, type = 'text' }: Readonly<EditFieldProps>) {
  const [draft, setDraft] = useState(value)
  const id = useId()

  const handleBlur = useCallback(() => {
    if (draft !== value) onCommit(draft)
  }, [draft, value, onCommit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
    if (e.key === 'Escape') { setDraft(value); (e.target as HTMLInputElement).blur() }
  }, [value])

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-[10px] text-[#969696] w-16 shrink-0 uppercase tracking-wide">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="flex-1 bg-[#2d2d2d] text-[11px] text-[#cccccc] px-2 py-0.5 rounded border border-[#3c3c3c] focus:border-blue-500 focus:outline-none placeholder:text-[#555] font-mono"
      />
    </div>
  )
}

// ── Single breakpoint row ─────────────────────────────────────────────────────

interface BreakpointRowProps {
  bp: Breakpoint
  allBreakpoints: Breakpoint[]   // needed to populate dependsOn selector
}

function BreakpointRow({ bp, allBreakpoints }: Readonly<BreakpointRowProps>) {
  const [expanded, setExpanded] = useState(false)
  const updateBreakpoint = useDebugStore((s) => s.updateBreakpoint)
  const removeBreakpointById = useDebugStore((s) => s.removeBreakpointById)

  // Enabled = no explicit "disabled" flag. We store disabled state via
  // hitCountRemaining = 0, which the main side interprets as disabled.
  // For a clean UI toggle we use a local enabled field derived from the bp.
  const isEnabled = bp.enabled !== false

  const toggle = useCallback(() => {
    updateBreakpoint(bp.id, { enabled: !isEnabled })
  }, [bp.id, bp.hitCount, isEnabled, updateBreakpoint])

  const handleDelete = useCallback(() => {
    removeBreakpointById(bp.id)
  }, [bp.id, removeBreakpointById])

  // Computed badge text
  const badges: string[] = []
  if (bp.condition) badges.push('if')
  if (bp.hitCount) badges.push(`×${bp.hitCount}`)
  if (bp.logMessage) badges.push('log')
  if (bp.dependsOn) badges.push('dep')
  if (bp.groupId) badges.push(`grp:${bp.groupId}`)
  if (!bp.verified) badges.push('unverified')

  return (
    <div className={`border-b border-[#2d2d2d] ${!isEnabled ? 'opacity-50' : ''}`}>

      {/* ── Header row ── */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-[#2a2d2e] group">

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-[#969696] hover:text-white shrink-0 p-0.5"
          title="Expand breakpoint options"
        >
          <ChevronIcon open={expanded} />
        </button>

        {/* Enable / disable circle */}
        <button
          onClick={toggle}
          title={isEnabled ? 'Disable breakpoint' : 'Enable breakpoint'}
          className="shrink-0 w-3 h-3 rounded-full border transition-colors"
          style={{
            background: isEnabled ? (bp.verified ? '#e51400' : '#f48771') : 'transparent',
            borderColor: isEnabled ? (bp.verified ? '#e51400' : '#f48771') : '#555',
          }}
        />

        {/* Location */}
        <span className="flex-1 text-[11px] font-mono truncate text-[#cccccc]">
          {shortFile(bp.file)}
          <span className="text-[#969696]">:{bp.line}</span>
        </span>

        {/* Badges */}
        {badges.map((b) => (
          <span key={b} className="text-[9px] px-1 py-0.5 rounded bg-[#3c3c3c] text-[#969696] shrink-0">
            {b}
          </span>
        ))}

        {/* Label (if set) */}
        {bp.label && (
          <span className="text-[10px] text-[#75beff] italic shrink-0 truncate max-w-[80px]">
            {bp.label}
          </span>
        )}

        {/* Delete */}
        <button
          onClick={handleDelete}
          title="Remove breakpoint"
          className="text-[#555] hover:text-[#f48771] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
        >
          <DeleteIcon />
        </button>
      </div>

      {/* ── Expanded options ── */}
      {expanded && (
        <div className="px-3 pb-2 pt-1 flex flex-col gap-1.5 bg-[#1a1a1a] border-t border-[#2d2d2d]">

          <EditField
            label="Label"
            value={bp.label ?? ''}
            placeholder="friendly name"
            onCommit={(v) => updateBreakpoint(bp.id, { label: v || undefined })}
          />

          <EditField
            label="Condition"
            value={bp.condition ?? ''}
            placeholder="e.g. depth > 2"
            onCommit={(v) => updateBreakpoint(bp.id, { condition: v || undefined })}
          />

          <EditField
            label="Hit count"
            value={bp.hitCount != null ? String(bp.hitCount) : ''}
            placeholder="remove after N hits"
            type="number"
            onCommit={(v) => {
              const n = parseInt(v, 10)
              updateBreakpoint(bp.id, {
                hitCount: isNaN(n) ? undefined : n,
                hitCountRemaining: isNaN(n) ? undefined : n,
              })
            }}
          />

          <EditField
            label="Log msg"
            value={bp.logMessage ?? ''}
            placeholder="print instead of stopping"
            onCommit={(v) => updateBreakpoint(bp.id, { logMessage: v || undefined })}
          />

          <EditField
            label="Group"
            value={bp.groupId ?? ''}
            placeholder="group name"
            onCommit={(v) => updateBreakpoint(bp.id, { groupId: v || undefined })}
          />

          {/* Depends-on: only show if there are other breakpoints to depend on */}
          {allBreakpoints.filter((b) => b.id !== bp.id).length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#969696] w-16 shrink-0 uppercase tracking-wide">
                Depends on
              </span>
              <select
                value={bp.dependsOn ?? ''}
                onChange={(e) => updateBreakpoint(bp.id, {
                  dependsOn: e.target.value || undefined,
                  dependencyMet: false,
                })}
                className="flex-1 bg-[#2d2d2d] text-[11px] text-[#cccccc] px-2 py-0.5 rounded border border-[#3c3c3c] focus:border-blue-500 focus:outline-none"
              >
                <option value="">— none —</option>
                {allBreakpoints
                  .filter((b) => b.id !== bp.id)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {shortFile(b.file)}:{b.line}{b.label ? ` (${b.label})` : ''}
                    </option>
                  ))}
              </select>
              {bp.dependsOn && (
                <span
                  className={`text-[9px] px-1 py-0.5 rounded shrink-0 ${bp.dependencyMet ? 'bg-green-900 text-green-400' : 'bg-[#3c3c3c] text-[#969696]'
                    }`}
                >
                  {bp.dependencyMet ? 'met' : 'waiting'}
                </span>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ── Group section ─────────────────────────────────────────────────────────────
// Breakpoints that share a groupId are rendered under a collapsible header
// with a master toggle for the whole group.

interface GroupSectionProps {
  groupId: string
  breakpoints: Breakpoint[]
  allBreakpoints: Breakpoint[]
}

function GroupSection({ groupId, breakpoints, allBreakpoints }: Readonly<GroupSectionProps>) {
  const [open, setOpen] = useState(true)
  const updateBreakpoint = useDebugStore((s) => s.updateBreakpoint)

  const allEnabled = breakpoints.every((bp) => bp.enabled !== false)

  const toggleAll = useCallback(() => {
    for (const bp of breakpoints) {
      updateBreakpoint(bp.id, {
        hitCountRemaining: allEnabled ? 0 : bp.hitCount ?? undefined,
      })
    }
  }, [breakpoints, allEnabled, updateBreakpoint])

  return (
    <div>
      <div className="flex items-center gap-1.5 px-2 py-1 bg-[#252526] border-b border-[#3c3c3c] sticky top-0">
        <button onClick={() => setOpen((o) => !o)} className="text-[#969696] hover:text-white p-0.5">
          <ChevronIcon open={open} />
        </button>
        <button
          onClick={toggleAll}
          title={allEnabled ? 'Disable group' : 'Enable group'}
          className="w-2.5 h-2.5 rounded-full border shrink-0 transition-colors"
          style={{
            background: allEnabled ? '#75beff' : 'transparent',
            borderColor: allEnabled ? '#75beff' : '#555',
          }}
        />
        <span className="text-[10px] text-[#75beff] uppercase tracking-wide font-medium flex-1">
          {groupId}
        </span>
        <span className="text-[10px] text-[#555]">{breakpoints.length}</span>
      </div>
      {open && breakpoints.map((bp) => (
        <BreakpointRow key={bp.id} bp={bp} allBreakpoints={allBreakpoints} />
      ))}
    </div>
  )
}

// ── Breakpoint panel ──────────────────────────────────────────────────────────

export default function BreakpointPanel() {
  const breakpoints = useDebugStore((s) => s.breakpoints)
  const removeBreakpointById = useDebugStore((s) => s.removeBreakpointById)

  const removeAll = useCallback(() => {
    for (const bp of breakpoints) removeBreakpointById(bp.id)
  }, [breakpoints, removeBreakpointById])

  if (breakpoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-[#555] text-xs px-4 text-center">
        <span>No breakpoints set.</span>
        <span>Click a line number in the editor to add one.</span>
      </div>
    )
  }

  // Partition into grouped and ungrouped
  const grouped = new Map<string, Breakpoint[]>()
  const ungrouped: Breakpoint[] = []

  for (const bp of breakpoints) {
    if (bp.groupId) {
      const arr = grouped.get(bp.groupId) ?? []
      arr.push(bp)
      grouped.set(bp.groupId, arr)
    } else {
      ungrouped.push(bp)
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-[#3c3c3c] shrink-0">
        <span className="text-[10px] uppercase tracking-wide text-[#969696]">
          {breakpoints.length} breakpoint{breakpoints.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={removeAll}
          title="Remove all breakpoints"
          className="text-[10px] text-[#555] hover:text-[#f48771] transition-colors"
        >
          Remove all
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {/* Grouped breakpoints */}
        {[...grouped.entries()].map(([groupId, bps]) => (
          <GroupSection
            key={groupId}
            groupId={groupId}
            breakpoints={bps}
            allBreakpoints={breakpoints}
          />
        ))}

        {/* Ungrouped breakpoints */}
        {ungrouped.map((bp) => (
          <BreakpointRow key={bp.id} bp={bp} allBreakpoints={breakpoints} />
        ))}
      </div>
    </div>
  )
}
