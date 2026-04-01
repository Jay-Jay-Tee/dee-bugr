# DEE-bugr

> The open source debugger that explains itself.

## Video Demo

[Video Demo](https://drive.google.com/drive/folders/1eytlQerOkS76fAUVTuwePqJj5S3QodKv?usp=sharing)

---

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-teal.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-blue.svg)](https://github.com/your-org/dee-bugr)
[![Languages](https://img.shields.io/badge/languages-Python%20%7C%20C%2FC%2B%2B%20%7C%20JavaScript%20%7C%20Java-orange.svg)](https://github.com/your-org/dee-bugr)
[![Built with Electron](https://img.shields.io/badge/built%20with-Electron%20%2B%20React-purple.svg)](https://www.electronjs.org)

Every debugger shows you **where** your code broke.  
DEE-bugr shows you **why** — and draws you a picture.

---

## What makes DEE-bugr different

### AI that watches your code in real time

No button press required. DEE-bugr's anomaly detector runs after every step, automatically flagging null pointers, integer overflows, and out-of-bounds accesses the moment they happen. When you want a full explanation, one click sends your entire execution context to an AI model and returns a plain-English root cause and a fix you can accept inline.

### Visualizations that don't exist in any other debugger

- **Variable history timeline** — every value a variable ever held, plotted as an interactive graph. Click any point to jump back to that exact execution step.
- **Object graph visualizer** — linked lists, trees, and object references rendered as live node diagrams as you step through code.
- **Mutation diff view** — pick any two execution steps and see exactly what changed between them. Like `git diff` for your program's memory.
- **Scope lifetime waterfall** — a Gantt chart showing when each variable enters and leaves scope. Makes use-after-free and uninitialized variable bugs immediately obvious.
- **Debug Cinema** — replay your entire debug session as a smooth animation. Scrub, pause, slow down, frame-by-frame.

### Features VSCode and IntelliJ don't ship

- Dependent breakpoints — B only fires after A was hit first
- Hit-count auto-disable — breakpoint removes itself after N hits
- Real-time anomaly detection — automatic, no button press
- Plain-English call stack explanations in Beginner mode
- Cross-session diff — compare today's crash to yesterday's working run
- AI pre-run breakpoint placement — analyze source before running, get 5 suggested breakpoints

### One codebase, four languages

Built on the [Debug Adapter Protocol (DAP)](https://microsoft.github.io/debug-adapter-protocol/). DEE-bugr speaks a single unified protocol and plugs language adapters in underneath.

| Language | Adapter |
|---|---|
| Python | debugpy |
| JavaScript / Node.js | @vscode/js-debug |
| C / C++ | cpptools DAP adapter |
| Java | microsoft/java-debug |

---

## Screenshots

<!-- Add screenshots here -->

---

## Getting started

See [SETUP.md](./SETUP.md) for full installation and adapter configuration details.

### Prerequisites

- Node.js 20+
- pnpm
- Python 3.8+ (for Python debugging)
- A [Groq API key](https://console.groq.com) (free) for AI features

### Quick install

```bash
git clone https://github.com/your-org/dee-bugr.git
cd dee-bugr
pnpm install
pnpm setup:auto

```

`pnpm setup:auto` will check for `gcc`, `g++`, and `gdb` and tell the user if anything is missing.
If the toolchain is missing, install it manually (admin/system-level step):

```bash
# Ubuntu / Debian
sudo apt install build-essential gdb

# macOS (Homebrew)
brew install gcc gdb

# Windows (example)
# Install MSYS2/MinGW-w64 and ensure gcc, g++, gdb are on PATH
```

### Configure AI

`DEE_BUGR_GROQ_KEY` is required for AI features (Explain Bug, Suggest Fix, Narrative, AI breakpoint suggestions).
Without it, debugging still works, but AI actions will fail.

```bash
cp .env.example .env

# Required for AI features
DEE_BUGR_GROQ_KEY=gsk_your_key_here

# Optional: use local Ollama instead of Groq
# DEE_BUGR_AI_MODE=local
```

### Run in development

```bash
pnpm dev
```

### Build a distributable

```bash
pnpm build
# Outputs an AppImage (Linux), .dmg (macOS), or .exe (Windows)
```

To create both a Windows installer and a conventional zip package:

```bash
pnpm exec electron-builder --win nsis zip
```

---

## Architecture

```
dee-bugr/
├── electron/           # Electron entry points (main + preload)
├── src/
│   ├── main/           # Electron main process
│   │   ├── dap/        # DAP client + language adapters
│   │   ├── ipc/        # IPC handler registrations
│   │   ├── ai/         # AI integration (Groq / Ollama)
│   │   └── session/    # Session state management
│   ├── renderer/       # React UI
│   │   ├── store/      # Zustand global state
│   │   └── hooks/      # Keyboard shortcuts, gutter drag
│   ├── components/
│   │   └── panels/     # Variables, CallStack, Assembly, Visualizations
│   └── shared/         # Types and IPC channel constants
```

The main process owns the DAP client and all AI calls. The renderer is a pure React app backed by a Zustand store. The two layers communicate exclusively through Electron's IPC bridge — no direct cross-context access.

---

## AI setup

DEE-bugr uses open-source models by default. It calls **Llama 3.1 70B** via [Groq](https://groq.com) — free tier, no credit card required, fast enough for real-time use.

For fully offline use, install [Ollama](https://ollama.com) and set the following in your `.env`:

```env
DEE_BUGR_AI_MODE=local
```

DEE-bugr will use `codellama:13b` locally with no internet required.

---

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Continue | F5 |
| Step over | F10 |
| Step into | F11 |
| Step out | Shift+F11 |
| Toggle breakpoint | F9 |
| Explain this bug | Ctrl+Shift+E |
| Toggle Beginner / Expert mode | Ctrl+Shift+B |
| Open Debug Cinema | Ctrl+Shift+R |
| Open Breakpoint Manager | Ctrl+Shift+P |

---

## Contributing

DEE-bugr is built in the open. Contributions of all kinds are welcome — bug reports, feature requests, documentation improvements, and code.

```bash
# Run tests
pnpm test

# Lint
pnpm lint

# Type check
pnpm typecheck
```

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. For security issues, see [SECURITY.md](./SECURITY.md).

---

## Roadmap

- [ ] Time-travel debugging via Mozilla `rr` (Linux)
- [ ] Race condition detection for multithreaded programs
- [ ] Stream / pipeline debugger for Java 8+ streams
- [ ] Remote debugging over SSH
- [ ] VS Code extension wrapper

---

## License

Apache 2.0 — see [LICENSE](./LICENSE)

---

## AI Assistance Disclosure

Parts of this project were developed with the assistance of Large Language Models (LLMs), including ChatGPT, Cursor, and Claude.

The LLM was used primarily as a development aid for:
- Generating and refining code snippets
- Debugging and troubleshooting errors
- Exploring alternative implementations

All core ideas, architecture decisions, and final integrations were designed and implemented by the author(s).

The generated code was reviewed, modified, and tested to ensure correctness and alignment with project requirements.

---

<p align="center">
  Made for <a href="https://fosshack.com">FOSSHack '26</a> by a team of 4.
</p>
