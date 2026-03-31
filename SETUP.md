# DEE-bugr — Setup Guide

This guide covers everything needed to get DEE-bugr running locally, configure language adapters, and verify the installation works end-to-end.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20 LTS | `nvm install 20` |
| pnpm | latest | `npm i -g pnpm` |
| Python | 3.9+ | system or [python.org](https://python.org) |
| debugpy | latest | `pip install debugpy` |
| GDB | any | `sudo apt install gdb` / Xcode CLT on macOS |
| Java (optional) | 11+ | system JDK |

---

## 1. Clone & install dependencies

```bash
git clone https://github.com/your-org/dee-bugr.git
cd dee-bugr
pnpm install

# Optional but recommended: auto-bootstrap local debugger setup
pnpm setup:auto
```

---

## 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
# Groq API key — get a free key at https://console.groq.com
DEE_BUGR_GROQ_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

# AI provider mode: "groq" (default, cloud) or "local" (Ollama, offline)
DEE_BUGR_AI_MODE=groq

# (C/C++ only, optional) Path to cpptools OpenDebugAD7 binary
# CPPTOOLS_ADAPTER_PATH=~/.vscode/extensions/ms-vscode.cpptools-X.Y.Z/debugAdapters/bin/OpenDebugAD7

# (Java only, optional) Path to java-debug plugin JAR
# JAVA_DEBUG_JAR=/path/to/com.microsoft.java.debug.plugin-*.jar
```

> **Never commit your `.env` file.** It is already listed in `.gitignore`.

---

## 3. Run in development

```bash
pnpm dev
```

This opens the DEE-bugr Electron window with hot reload enabled. Changes to renderer code reflect immediately; changes to the main process require a restart.

---

## 4. Build a distributable

```bash
pnpm build
```

Outputs a platform-native binary:

| Platform | Output |
|----------|--------|
| Linux | `.AppImage` |
| macOS | `.dmg` |
| Windows | `.exe` (NSIS installer) |

---

## 5. Language adapter setup

### Python

Python debugging works out of the box once `debugpy` is installed:

```bash
pip install debugpy
```

DEE-bugr auto-detects and launches debugpy when you open a `.py` file.

### C / C++

**Option A — System GDB (recommended, easiest):**

```bash
# Verify GDB is on your PATH
which gdb
```

The cpptools adapter auto-detects GDB. No additional configuration needed.

**Option B — cpptools adapter from VS Code extension:**

```bash
# List installed VS Code extensions
ls ~/.vscode/extensions/ | grep cpptools

# The adapter binary lives at:
# ~/.vscode/extensions/ms-vscode.cpptools-X.Y.Z/debugAdapters/bin/OpenDebugAD7

# Add to .env:
# CPPTOOLS_ADAPTER_PATH=<path above>
```

### JavaScript / Node.js

No setup required. DEE-bugr bundles `@vscode/js-debug` and uses it automatically for `.js` and `.mjs` files.

### Java (optional)

**Option A — VS Code Java extension:**

```bash
ls ~/.vscode/extensions/ | grep vscjava.vscode-java-debug
# JAR path: ~/.vscode/extensions/vscjava.vscode-java-debug-*/server/com.microsoft.java.debug.plugin-*.jar
```

Set `JAVA_DEBUG_JAR` in `.env` to that path.

**Option B — Build from source:**

```bash
git clone https://github.com/microsoft/java-debug.git
cd java-debug
mvn package -DskipTests
# Set JAVA_DEBUG_JAR to: com.microsoft.java.debug.plugin/target/com.microsoft.java.debug.plugin-*.jar
```

---

## 6. Build demo programs

Demo programs are included in the repository root for testing and presentation:

```bash
# C demo — compile before use
gcc -g -O0 -o demo demo.c

# Python demo — no compilation needed
# Open demo.py directly via DEE-bugr's file picker
```

The `-g` flag includes debug symbols. The `-O0` flag disables optimizations that can confuse single-step debugging.

---

## 7. Offline / local AI mode

If you prefer to run AI features without a network connection, install [Ollama](https://ollama.com) and pull the code model:

```bash
ollama pull codellama:13b
```

Then set in `.env`:

```env
DEE_BUGR_AI_MODE=local
```

AI explanations, fixes, and narratives will run via `codellama:13b` entirely on-device.

---

## 8. Verification checklist

Run through this list after setup to confirm everything is working:

- [ ] `pnpm dev` opens DEE-bugr without console errors
- [ ] Compile `demo.c` and open it — breakpoint hits on the expected line
- [ ] Anomaly detection fires automatically (null pointer badge appears in toolbar)
- [ ] **AI Explain** returns a coherent explanation
- [ ] **AI Fix** returns a usable diff
- [ ] Ghost breakpoints appear when clicking the **🎯 BPs** button
- [ ] Debug Cinema plays and scrubs correctly
- [ ] Python demo works and the History tab populates
- [ ] Session Narrative generates at session end
- [ ] Beginner/Expert toggle changes panel language across all panels
- [ ] Keyboard shortcuts work: F5, F10, F11, Shift+F11, Shift+F5, F9
- [ ] No crashes over three consecutive full demo runs

---

## Troubleshooting

**`pnpm dev` fails with "Cannot find module 'electron'"**  
Run `pnpm install` again. If it persists, delete `node_modules` and reinstall.

**GDB not found**  
Install GDB for your platform: `sudo apt install gdb` (Debian/Ubuntu), `brew install gdb` (macOS with Homebrew), or `winget install GnuWin32.GDB` (Windows).

**AI features return no response**  
Check that `DEE_BUGR_GROQ_KEY` is set correctly in `.env` and that the key is valid at [console.groq.com](https://console.groq.com).

**Java adapter fails to launch**  
Verify your `JAVA_DEBUG_JAR` path points to the `.jar` file, not the directory. The filename should match `com.microsoft.java.debug.plugin-*.jar`.

**Build fails on macOS with code signing errors**  
For local development builds, you can skip signing by setting `CSC_IDENTITY_AUTO_DISCOVERY=false` before running `pnpm build`.
