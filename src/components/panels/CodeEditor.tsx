import Editor from "@monaco-editor/react";

export default function CodeEditor() {
  return (
    <Editor
      height="100%"
      defaultLanguage="cpp"
      defaultValue={`#include <iostream>
using namespace std;

int main() {
  cout << "Hello";
  return 0;
}`}
      onMount={(editor, _monaco) => {
        console.log("Editor ready");

        editor.onDidChangeCursorPosition((e) => {
          console.log("Cursor:", e.position);
        });
      }}
    />
  );
}