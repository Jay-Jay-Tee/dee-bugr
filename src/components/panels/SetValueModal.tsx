// src/components/panels/SetValueModal.tsx
// Right-click a variable row → edit its value → confirm → IPC.SET_VARIABLE.
// Renders as an inline row expansion, not a floating modal (avoids z-index issues).

import { useState, useRef, useCallback, useEffect, useId } from 'react'
import { IPC } from '../../shared/ipc'
import type { Variable } from '../../shared/types'

function invoke(channel: typeof IPC[keyof typeof IPC], args?: unknown) {
  return globalThis.electronAPI?.invoke(channel, args)
    .catch((err: unknown) => console.error('[SetValue]', err))
}

interface Props {
  variable: Variable
  variablesReference: number   // parent scope reference
  onClose: () => void
  onSuccess: () => void        // caller re-fetches variables after success
}

export default function SetValueModal({
  variable,
  variablesReference,
  onClose,
  onSuccess,
}: Readonly<Props>) {
  const [draft,   setDraft]   = useState(variable.value)
  const [pending, setPending] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const commit = useCallback(async () => {
    const trimmed = draft.trim()
    if (trimmed === variable.value) { onClose(); return }
    setPending(true)
    setError(null)
    const result = await invoke(IPC.SET_VARIABLE, {
      variablesReference,
      name:  variable.name,
      value: trimmed,
    }) as { success?: boolean; error?: string } | undefined
    setPending(false)
    if (result?.success === false) {
      setError(result.error ?? 'Failed to set value')
    } else {
      onSuccess()
      onClose()
    }
  }, [draft, variable, variablesReference, onClose, onSuccess])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  { e.preventDefault(); commit() }
    if (e.key === 'Escape') { onClose() }
  }, [commit, onClose])

  return (
    <div className="flex flex-col gap-1 px-2 py-1.5 bg-[#1a1a1a] border-t border-[#3c3c3c]">
      <div className="flex items-center gap-1">
        <label htmlFor={id} className="text-[10px] text-[#969696] shrink-0 font-mono">
          {variable.name} =
        </label>
        <input
          id={id}
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={pending}
          className="flex-1 bg-[#3c3c3c] text-[11px] text-white px-1.5 py-0.5 rounded font-mono outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          onClick={commit}
          disabled={pending}
          className="text-[10px] px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? '…' : 'Set'}
        </button>
        <button
          onClick={onClose}
          className="text-[10px] px-1.5 py-0.5 rounded text-[#555] hover:text-[#f48771] transition-colors"
        >
          ✕
        </button>
      </div>
      {error && (
        <div className="text-[10px] text-[#f48771] px-1 font-mono">{error}</div>
      )}
    </div>
  )
}
