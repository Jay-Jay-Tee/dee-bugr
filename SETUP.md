# DEE-bugr — Setup Guide (Day 10)

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20 LTS | `nvm install 20` |
| pnpm | latest | `npm i -g pnpm` |
| Python | 3.9+ | system |
| debugpy | latest | `pip install debugpy` |
| GDB | any | `sudo apt install gdb` or Xcode CLT on macOS |
| Java | 11+ | system (optional — for Java demo) |

## 1. Clone & Install

```bash
git clone <repo-url>
cd dee-bugr-main
pnpm install
```

## 2. Set Groq API Key

```bash
cp .env.example .env
# Edit .env and paste your key:
#   DEE_BUGR_GROQ_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
# Get a free key at https://console.groq.com
```

## 3. Run in Development

```bash
pnpm dev
```

This opens the DEE-bugr Electron window with hot reload.

## 4. Build Demo Programs

```bash
# C demo (required for the main presentation)
gcc -g -O0 -o demo demo.c

# Python demo — no compilation needed
# Run directly via DEE-bugr's file picker
```

## 5. Adapter Setup (C/C++)

**Option A — Use system GDB (easiest):**
The cpptools adapter auto-detects GDB. Make sure `gdb` is on your PATH:
```bash
which gdb   # should return a path
```

**Option B — Use cpptools from VS Code extension:**
```bash
# Find your VS Code extension directory
ls ~/.vscode/extensions/ | grep cpptools

# The adapter binary is at:
# ~/.vscode/extensions/ms-vscode.cpptools-*/debugAdapters/bin/OpenDebugAD7

# Set in .env:
# CPPTOOLS_ADAPTER_PATH=~/.vscode/extensions/ms-vscode.cpptools-X.Y.Z/debugAdapters/bin/OpenDebugAD7
```

## 6. Adapter Setup (Java — optional)

```bash
# Option A: use VS Code Java extension
ls ~/.vscode/extensions/ | grep vscjava.vscode-java-debug
# JAR is at: ~/.vscode/extensions/vscjava.vscode-java-debug-*/server/com.microsoft.java.debug.plugin-*.jar
# Set in .env: JAVA_DEBUG_JAR=<path>

# Option B: build from source
git clone https://github.com/microsoft/java-debug.git
cd java-debug && mvn package -DskipTests
# Set: JAVA_DEBUG_JAR=<path>/com.microsoft.java.debug.plugin/target/com.microsoft.java.debug.plugin-*.jar
```

## 7. Demo Walkthrough (7 minutes)

### Opening (0:00 — 0:45)
1. Launch DEE-bugr
2. Select **C / C++** from the language selector
3. Type the path to the compiled `demo` binary in the file input, click **Go**
4. Click **🎯 BPs** — 5 ghost breakpoints appear (AI pre-run suggestion)
5. Click one of the ghost BPs to accept it (line 35)

### Hit the Bug (0:45 — 1:15)
6. The program hits the breakpoint automatically
7. Anomaly badge appears in the toolbar: **⚠ 1 anomaly**
8. Right panel shows: `node is a null pointer — dereferencing will crash`

### Object Graph (1:15 — 1:45)
9. In the left panel (Variables tab), right-click `root` → **Visualise**
10. The Graph tab opens — tree renders as interactive nodes
11. The NULL node glows red — click it

### AI Explain (1:45 — 2:15)
12. Click **⚡ Explain** in the toolbar
13. AI panel shows streaming explanation
14. Toggle to **Beginner mode** — explanation becomes plain English

### Fix (2:15 — 2:45)
15. Click **🔧 Fix**
16. Diff view appears — 3-line change
17. Click **✓ Accept** — fix copied to clipboard

### Debug Cinema (2:45 — 3:30)
18. Run the fixed program to completion
19. Open the **🎬 Cinema** tab in the bottom panel
20. Click **▶ Play** — watch the session replay step by step

### Python + History Timeline (3:30 — 4:15)
21. Switch to **Python** language, open `demo.py`
22. Set breakpoint on line 27 (`shared_list.append`)
23. Step through — History tab shows `shared_list` growing
24. Open **History** tab, select `shared_list` variable

### Session Narrative (5:30 — 6:00)
25. Open the **Narrative** tab in the right panel
26. Click **📖 Generate Narrative**
27. AI writes a 4-sentence summary of the debug session

### Close (6:30)
> *"This is DEE-bugr — the debugger that explains itself. Every feature you just saw — none of it exists in VSCode, GDB, or IntelliJ's open source tooling."*

## 8. Day 10 Checklist

- [ ] `pnpm dev` opens DEE-bugr without errors
- [ ] `demo.c` compiled and breakpoint hits on line 35
- [ ] Anomaly detection fires automatically (null pointer)
- [ ] AI Explain returns a good explanation (test 3x)
- [ ] AI Fix returns a usable diff
- [ ] Ghost BPs appear when clicking 🎯 BPs
- [ ] Debug Cinema plays and scrubs
- [ ] Python demo works and History tab populates
- [ ] Session Narrative generates at session end
- [ ] Beginner/Expert toggle changes all panels
- [ ] Keyboard shortcuts work: F5, F10, F11, Shift+F11, Shift+F5, F9
- [ ] No crashes over 3 consecutive full demo runs
- [ ] Backup screen recording recorded
