// src/components/panels/subpanels/ipcInvoke.ts
// Shared IPC invoke helper for renderer-side panel components.
// Import this instead of redefining the same cast in every file.

import type { IPCChannel } from '../../../shared/ipc'

type AnyIPC = IPCChannel | string

export function invoke(channel: AnyIPC, args?: unknown): Promise<unknown> {
  const api = (window as Window & {
    electronAPI?: { invoke: (ch: AnyIPC, payload?: unknown) => Promise<unknown> }
  }).electronAPI
  return api?.invoke(channel, args)
    .catch((err: unknown) => console.error(`[IPC] ${String(channel)} failed:`, err))
    ?? Promise.resolve(undefined)
}
