import EditorPanel from "./EditorPanel";
import RightPanel from "./RightPanel";

export default function MainLayout() {
  return (
    <div className="flex flex-1">
      <EditorPanel />
      <RightPanel />
    </div>
  );
}
