// src/renderer/components/RightPanel.tsx

import { useDebugStore } from "../renderer/store/debugStore";

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-700">
      <div className="px-3 py-1 text-xs uppercase text-gray-400 bg-[#252526]">
        {title}
      </div>
      <div className="p-2 text-sm">{children}</div>
    </div>
  );
}

export default function RightPanel() {
  const status = useDebugStore((s: any) => s.status);
  const currentFile = useDebugStore((s: any) => s.currentFile);
  const currentLine = useDebugStore((s: any) => s.currentLine);

  return (
    <div className="w-72 bg-[#1e1e1e] border-l border-gray-700 flex flex-col">
      <Section title="Status">
        <div className="text-gray-200">
          {status === "running" && "Running"}
          {status === "paused" && "Paused"}
          {status === "terminated" && "Terminated"}
          {status === "idle" && "Idle"}
        </div>
      </Section>

      <Section title="Current Location">
        {currentFile ? (
          <div className="font-mono text-xs text-gray-300">
            {currentFile}:{currentLine}
          </div>
        ) : (
          <div className="text-gray-500 text-xs">No frame</div>
        )}
      </Section>

      <Section title="Call Stack">
        <div className="text-gray-500 text-xs">
          Call stack will appear when paused
        </div>
      </Section>

      <Section title="Variables">
        <div className="text-gray-500 text-xs">
          Variables not available
        </div>
      </Section>
    </div>
  );
}