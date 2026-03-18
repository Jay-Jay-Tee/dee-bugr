# DEE-bugr

> The open source debugger that explains itself.

![License: MIT](https://img.shields.io/badge/license-MIT-teal.svg)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-blue.svg)
![Languages](https://img.shields.io/badge/languages-Python%20%7C%20C%2FC%2B%2B%20%7C%20JavaScript%20%7C%20Java-orange.svg)
![Built with Electron](https://img.shields.io/badge/built%20with-Electron%20%2B%20React-purple.svg)

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
Built on the [Debug Adapter Protocol (DAP)](https://microsoft.github.io/debug-adapter-protocol/). DEE-bugr speaks a single unified protocol and plugs in language adapters underneath:

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

### Prerequisites
- Node.js 20+
- pnpm
- Python 3.8+ (for Python debugging)
- A [Groq API key](https://console.groq.com) (free) for AI features

### Install

```bash
git clone https://github.com/your-org/DEE-bugr.git
cd DEE-bugr
pnpm install
```

### Configure AI

```bash
cp .env.example .env
# Add your Groq API key to .env:
# DEE-bugr_GROQ_KEY=your_key_here
```

### Run in development

```bash
pnpm dev
```

### Build

```bash
pnpm build
# Outputs an AppImage (Linux), .dmg (macOS), or .exe (Windows)
```

---

## Architecture

```
DEE-bugr/
├── src/
│   ├── main/          # Electron main process
│   │   ├── dap/       # DAP client + language adapters
│   │   ├── ipc/       # IPC handler registrations
│   │   └── ai/        # AI integration (Groq / Ollama)
│   ├── renderer/      # React UI
│   │   ├── panels/    # Variables, CallStack, Assembly, etc.
│   │   └── viz/       # D3 + Chart.js visualizations
│   └── shared/        # Types and IPC channel constants
```

The main process owns the DAP client and AI calls. The renderer is a pure React app that reads from a Zustand store. They communicate exclusively via Electron's IPC bridge — no direct access between layers.

---

## AI setup

DEE-bugr uses open source models. By default it calls **Llama 3.1 70B** via [Groq](https://groq.com) — free tier, no credit card required, fast enough for real-time use.

For fully offline use, install [Ollama](https://ollama.com) and set:

```bash
DEE-bugr_AI_MODE=local
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

DEE-bugr is built in the open. Contributions welcome.

```bash
# Run tests
pnpm test

# Lint
pnpm lint

# Type check
pnpm typecheck
```

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

---

## Roadmap

- [ ] Time-travel debugging via Mozilla `rr` (Linux)
- [ ] Race condition detection for multithreaded programs
- [ ] Stream / pipeline debugger for Java 8+ streams
- [ ] Remote debugging over SSH
- [ ] VS Code extension wrapper

---

## License

MIT — see [LICENSE](./LICENSE)

---

<p align="center">
  Built for <a href="https://fosshack.com">FOSSHack</a> by a team of 4.
</p>
