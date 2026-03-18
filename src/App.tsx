import { useEffect } from "react";
import { useDebugStore, initIPCListeners } from "./renderer/store/debugStore";
import Toolbar from "./components/Toolbar";
import MainLayout from "./components/MainLayout";
import BottomPanel from "./components/BottomPanel";

function App() {
  const currentFile = useDebugStore((s) => s.currentFile);
  const currentLine = useDebugStore((s) => s.currentLine);

  useEffect(() => {
    initIPCListeners();

    const handler = (_: unknown, data: unknown) => {
      console.log("DAP EVENT:", data);
    };
    (globalThis as any).electron?.on?.("dap:event", handler);

    return () => {
      (globalThis as any).electron?.off?.("dap:event", handler);
    };
  }, []);

  console.log("DEBUG STATE:", { currentFile, currentLine });

  return (
    <div className="h-screen flex flex-col">
      <Toolbar />
      <MainLayout />
      <BottomPanel />
    </div>
  );
}

export default App;