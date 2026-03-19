// src/components/BottomPanel.tsx

import { useEffect, useRef } from 'react'
import { useDebugStore } from '../../renderer/store/debugStore'

function LogLine({ text, category }: {readonly text: string;readonly category: string }) {
  const color =
    category === 'stderr' ? 'text-red-400' :
    category === 'debug'  ? 'text-yellow-400' :
    'text-[#cccccc]'

  return (
    <div className={`font-mono text-xs whitespace-pre-wrap leading-5 ${color}`}>
      {text}
    </div>
  )
}

export default function BottomPanel() {
  const outputLog = useDebugStore((s) => s.outputLog)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [outputLog])

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e] border-t border-[#3c3c3c]">
      <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-[#969696] border-b border-[#3c3c3c] shrink-0">
        Console
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5"
      >
        {outputLog.length === 0 ? (
          <div className="text-[#555] text-xs pt-1">No output yet</div>
        ) : (
          outputLog.map((line, i) => (
            <LogLine key={i} text={line.text} category={line.category} />
          ))
        )}
      </div>
    </div>
  )
}
