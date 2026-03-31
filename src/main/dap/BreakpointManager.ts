// src/main/dap/BreakpointManager.ts
// ─────────────────────────────────────────────────────────────────────────────
// Manages all breakpoint state for the session.
//
// Responsibilities:
//   - Track all breakpoints (regular, method, field watch, exception)
//   - Dependent breakpoint logic (BP B only fires after BP A was hit first)
//   - Hit-count auto-disable (BP removes itself after N hits)
//   - Group toggle (enable/disable entire named groups at once)
//   - Sync to DAP adapter (setBreakpoints is a full-replace-per-file protocol)
//
// DESIGN NOTE: DAP setBreakpoints replaces ALL breakpoints for a given source
// file in a single request. Never send individual add/remove — always resync
// the full list for the file. This class tracks what's set per file and handles
// that reconciliation.
// ─────────────────────────────────────────────────────────────────────────────

import { DAPClient } from './DAPClient'
import type { Breakpoint } from '../../shared/types'

type DAPRecord = Record<string, unknown>

function bool(v: unknown, fallback = false) { return typeof v === 'boolean' ? v : fallback }

export class BreakpointManager {
  private client: DAPClient
  private breakpoints: Map<string, Breakpoint> = new Map()     // id → Breakpoint
  private fileIndex:   Map<string, Set<string>> = new Map()    // file → Set<id>
  private hitCounts:   Map<string, number> = new Map()         // id → times hit

  constructor(client: DAPClient) {
    this.client = client
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Add or update a breakpoint. Returns the internal id. */
  async set(opts: {
    file: string
    line: number
    condition?: string
    hitCount?: number          // auto-disable after N hits
    logMessage?: string
    label?: string
    groupId?: string
    dependsOn?: string         // id of another BP that must be hit first
    methodName?: string        // for method/function breakpoints
  }): Promise<Breakpoint> {
    const id = `bp-${opts.file}-${opts.line}`

    const bp: Breakpoint = {
      id,
      file:             opts.file,
      line:             opts.line,
      verified:         false,
      condition:        opts.condition,
      hitCountRemaining: opts.hitCount,
      logMessage:       opts.logMessage,
      label:            opts.label,
      groupId:          opts.groupId,
      dependsOn:        opts.dependsOn,
      dependencyMet:    opts.dependsOn ? false : undefined,
    }

    this.breakpoints.set(id, bp)
    if (!this.fileIndex.has(opts.file)) this.fileIndex.set(opts.file, new Set())
    this.fileIndex.get(opts.file)!.add(id)
    this.hitCounts.set(id, 0)

    await this.syncFile(opts.file)
    return bp
  }

  /** Remove a breakpoint by id. */
  async remove(id: string): Promise<void> {
    const bp = this.breakpoints.get(id)
    if (!bp) return
    this.breakpoints.delete(id)
    this.hitCounts.delete(id)
    const fileSet = this.fileIndex.get(bp.file)
    if (fileSet) {
      fileSet.delete(id)
      if (fileSet.size === 0) this.fileIndex.delete(bp.file)
    }
    await this.syncFile(bp.file)
  }

  /** Remove by file + line (convenience). */
  async removeAt(file: string, line: number): Promise<void> {
    const id = `bp-${file}-${line}`
    await this.remove(id)
  }

  /** Toggle an entire group on/off. */
  async toggleGroup(groupId: string, enabled: boolean): Promise<void> {
    const affected = new Set<string>()
    for (const [, bp] of this.breakpoints) {
      if (bp.groupId === groupId) {
        // We use a convention: disabled BPs are kept in the map but removed from the DAP
        // The 'verified' flag doubles as enabled/active indicator for the UI
        bp.verified = enabled
        affected.add(bp.file)
      }
    }
    // Resync all affected files
    for (const file of affected) {
      await this.syncFileWithFilter(file, enabled ? undefined : groupId)
    }
  }

  /** Called on every stopped event. Handles dependent BPs and hit counts. */
  onStopped(hitBreakpointIds: number[]): {
    shouldContinue: boolean   // true = skip this stop (dependency not met)
    autoRemoved: string[]     // ids of BPs that auto-removed themselves
  } {
    const autoRemoved: string[] = []
    let shouldContinue = false

    for (const dapId of hitBreakpointIds) {
      const bp = this.findByDapId(dapId)
      if (!bp) continue

      // Mark dependents as unlocked
      for (const [, other] of this.breakpoints) {
        if (other.dependsOn === bp.id) {
          other.dependencyMet = true
        }
      }

      // Check if THIS bp's dependency is met
      if (bp.dependsOn !== undefined && !bp.dependencyMet) {
        // Dependency not met — skip this stop
        shouldContinue = true
        continue
      }

      // Hit count tracking
      const hitCount = (this.hitCounts.get(bp.id) ?? 0) + 1
      this.hitCounts.set(bp.id, hitCount)

      if (bp.hitCountRemaining !== undefined) {
        bp.hitCountRemaining--
        if (bp.hitCountRemaining <= 0) {
          // Auto-remove
          autoRemoved.push(bp.id)
        }
      }
    }

    // Execute auto-removes (async fire-and-forget — safe here)
    for (const id of autoRemoved) {
      this.remove(id).catch(err => console.error('[BPManager] Auto-remove failed:', err))
    }

    return { shouldContinue, autoRemoved }
  }

  /** Set method/function breakpoints (break on any call to a named function). */
  async setMethodBreakpoint(name: string): Promise<void> {
    try {
      await this.client.request('setFunctionBreakpoints', {
        breakpoints: [{ name }],
      })
      console.log(`[BPManager] Method breakpoint set on: ${name}`)
    } catch (err) {
      console.error('[BPManager] setFunctionBreakpoints failed:', err)
    }
  }

  /** Set a data/field watchpoint (break when variable memory is written). */
  async setFieldWatch(opts: {
    variablesReference: number
    name: string
    accessType?: 'read' | 'write' | 'readWrite'
    condition?: string
  }): Promise<void> {
    try {
      // Step 1: get the dataId for this variable
      const info = await this.client.request('dataBreakpointInfo', {
        variablesReference: opts.variablesReference,
        name: opts.name,
      })
      const dataId = (info as DAPRecord)?.['dataId']
      if (!dataId) {
        console.warn('[BPManager] dataBreakpointInfo returned no dataId — adapter may not support watchpoints')
        return
      }

      // Step 2: set the watchpoint
      await this.client.request('setDataBreakpoints', {
        breakpoints: [{
          dataId,
          accessType: opts.accessType ?? 'write',
          condition: opts.condition,
        }],
      })
      console.log(`[BPManager] Field watchpoint set on: ${opts.name}`)
    } catch (err) {
      console.error('[BPManager] setDataBreakpoints failed:', err)
    }
  }

  /** Set exception breakpoints with optional class/caller filters. */
  async setExceptionBreakpoints(opts: {
    filters: string[]                     // e.g. ['uncaught', 'all']
    classFilter?: string                  // e.g. 'com.myapp.*'
    exceptionClasses?: string[]           // e.g. ['NullPointerException']
  }): Promise<void> {
    try {
      const args: DAPRecord = {
        filters: opts.filters,
      }

      if (opts.classFilter || opts.exceptionClasses?.length) {
        args['filterOptions'] = opts.filters.map(filterId => ({
          filterId,
          condition: opts.classFilter
            ? `exception.class.startsWith('${opts.classFilter}')`
            : undefined,
        }))
      }

      if (opts.exceptionClasses?.length) {
        args['exceptionOptions'] = opts.exceptionClasses.map(cls => ({
          path: [{ names: [cls] }],
          breakMode: 'always',
        }))
      }

      await this.client.request('setExceptionBreakpoints', args)
      console.log('[BPManager] Exception breakpoints set:', opts.filters)
    } catch (err) {
      console.error('[BPManager] setExceptionBreakpoints failed:', err)
    }
  }

  /** Get all breakpoints as an array (for Zustand state). */
  getAll(): Breakpoint[] {
    return [...this.breakpoints.values()]
  }

  /** Get hit count for a BP id. */
  getHitCount(id: string): number {
    return this.hitCounts.get(id) ?? 0
  }

  /** Reset all state (call on session terminate). */
  reset(): void {
    this.breakpoints.clear()
    this.fileIndex.clear()
    this.hitCounts.clear()
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Sync all breakpoints for a file to the DAP adapter. */
  private async syncFile(file: string): Promise<void> {
    const ids = this.fileIndex.get(file)
    if (!ids || ids.size === 0) {
      // No breakpoints left in this file — clear it in adapter
      await this.client.setBreakpoints(file, [])
      return
    }

    const bps = [...ids]
      .map(id => this.breakpoints.get(id))
      .filter((bp): bp is Breakpoint => bp !== undefined)

    const lines = bps.map(bp => bp.line)
    const conditions: Record<number, string> = {}
    for (const bp of bps) {
      if (bp.condition) conditions[bp.line] = bp.condition
    }

    try {
      const body = await this.client.setBreakpoints(file, lines, conditions)
      const dapBps: DAPRecord[] = Array.isArray((body as DAPRecord)?.['breakpoints'])
        ? (body as DAPRecord)['breakpoints'] as DAPRecord[]
        : []

      // Update verified status and dapId from response
      bps.forEach((bp, i) => {
        const dap = dapBps[i] ?? {}
        bp.dapId   = typeof dap['id'] === 'number' ? dap['id'] : undefined
        bp.verified = bool(dap['verified'])
      })
    } catch (err) {
      console.error(`[BPManager] syncFile failed for ${file}:`, err)
    }
  }

  /** Sync file excluding a specific group (for group toggle-off). */
  private async syncFileWithFilter(file: string, excludeGroup?: string): Promise<void> {
    const ids = this.fileIndex.get(file)
    if (!ids) return

    const bps = [...ids]
      .map(id => this.breakpoints.get(id))
      .filter((bp): bp is Breakpoint =>
        bp !== undefined && (excludeGroup === undefined || bp.groupId !== excludeGroup)
      )

    const lines = bps.map(bp => bp.line)
    const conditions: Record<number, string> = {}
    for (const bp of bps) {
      if (bp.condition) conditions[bp.line] = bp.condition
    }

    await this.client.setBreakpoints(file, lines, conditions).catch(err =>
      console.error(`[BPManager] syncFileWithFilter failed for ${file}:`, err)
    )
  }

  private findByDapId(dapId: number): Breakpoint | undefined {
    for (const [, bp] of this.breakpoints) {
      if (bp.dapId === dapId) return bp
    }
    return undefined
  }
}