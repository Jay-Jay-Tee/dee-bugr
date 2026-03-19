// src/renderer/components/BottomPanel.tsx

import { useEffect, useRef } from "react";
import { useDebugStore } from "../renderer/store/debugStore";

interface LogLineProps {
  text: string;
  category: string;
}

function LogLine({ text, category }: LogLineProps) {
  const color =
    category === "stderr"
      ? "text-red-400"
      : category === "debug"
      ? "text-yellow-400"
      : "text-gray-200";

  return (
    <div className={`font-mono text-sm whitespace-pre-wrap ${color}`}>
      {text}
    </div>
  );
}

export default function BottomPanel() {
  const outputLog = useDebugStore((s) => s.outputLog);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new output arrives
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [outputLog]);

  return (
    <div className="h-40 bg-[#1e1e1e] border-t border-gray-700 flex flex-col">
      <div className="px-3 py-1 text-xs uppercase text-gray-400 border-b border-gray-700">
        Console
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-2 py-1 space-y-1"
      >
        {outputLog.map((line: { text: string; category: string; }) => (
          <LogLine key={`${line.text}-${line.category}`} text={line.text} category={line.category} />
        ))}
      </div>
    </div>
  );
}