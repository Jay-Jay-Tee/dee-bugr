import CodeEditor from './CodeEditor'
import AssemblyToggle from './AssemblyToggle'
import AssemblyPanel from './AssemblyPanel'
import { useDebugStore } from '../../renderer/store/debugStore'

export default function EditorPanel() {
  const isBeginnerMode = useDebugStore((s) => s.isBeginnerMode)

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <AssemblyToggle
        editorSlot={<CodeEditor />}
        assemblySlot={<AssemblyPanel />}
        hideToggle={isBeginnerMode}
      />
    </div>
  )
}