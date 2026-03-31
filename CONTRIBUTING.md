# Contributing to DEE-bugr

## Video Demo

[Video Demo](https://drive.google.com/drive/folders/1eytlQerOkS76fAUVTuwePqJj5S3QodKv?usp=sharing)

Thanks for your interest in contributing. DEE-bugr is built in the open and welcomes contributions of all kinds — bug reports, feature requests, documentation improvements, and code.

Please read this document before opening a pull request or issue.

---

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [Project structure](#project-structure)
- [Making changes](#making-changes)
- [Pull request guidelines](#pull-request-guidelines)
- [Commit style](#commit-style)
- [Testing](#testing)
- [AI and prompt changes](#ai-and-prompt-changes)
- [Adding a new language adapter](#adding-a-new-language-adapter)

---

## Code of conduct

This project follows a straightforward standard: be constructive, be respectful, and assume good faith. Harassment of any kind will not be tolerated. If something makes you uncomfortable, open an issue or email a maintainer directly.

---

## Ways to contribute

**Report a bug.** Open an issue using the Bug Report template. Include steps to reproduce, expected behavior, actual behavior, and your OS and Node.js version. If the issue is security-related, follow [SECURITY.md](./SECURITY.md) instead.

**Request a feature.** Open an issue using the Feature Request template. Describe the problem you're trying to solve, not just the solution you have in mind. Check existing issues first to avoid duplicates.

**Improve documentation.** Fix typos, clarify confusing sections, add examples to `SETUP.md`, or improve inline code comments. Documentation PRs are always welcome and quick to review.

**Submit a fix or feature.** Fork the repo, make your changes on a branch, and open a pull request. See the guidelines below.

---

## Development setup

Follow [SETUP.md](./SETUP.md) for the full environment setup. The short version:

```bash
git clone https://github.com/your-org/dee-bugr.git
cd dee-bugr
pnpm install
cp .env.example .env  # add your Groq key
pnpm dev
```

You will need Node.js 20+, pnpm, and Python 3.9+ with `debugpy`. GDB is required for C/C++ adapter work.

---

## Project structure

```
dee-bugr/
├── electron/               # Electron entry points
│   ├── main.ts             # App lifecycle, window creation
│   └── preload.ts          # Context bridge (legacy)
├── src/
│   ├── main/               # Main process (Node context)
│   │   ├── dap/            # DAP client and language adapters
│   │   ├── ai/             # Groq / Ollama integration
│   │   ├── ipc/            # IPC handler registrations
│   │   └── session/        # Session state
│   ├── renderer/           # React UI (browser context)
│   │   ├── store/          # Zustand global store
│   │   └── hooks/          # useKeyboardShortcuts, useGutterDrag
│   ├── components/
│   │   └── panels/         # All UI panels and sub-panels
│   └── shared/             # Types and IPC channel names shared between contexts
└── tmp/                    # Scratch files for development — not shipped
```

The most important architectural rule: **the renderer cannot import from `src/main/` and the main process cannot import from `src/renderer/`.** Everything crosses the boundary through IPC channels defined in `src/shared/ipc.ts`.

---

## Making changes

### 1. Fork and branch

Fork the repository on GitHub, then create a branch off `main` with a descriptive name:

```bash
git checkout -b fix/null-pointer-in-anomaly-detector
git checkout -b feat/scope-lifetime-waterfall
git checkout -b docs/improve-setup-guide
```

### 2. Keep changes focused

Each pull request should address a single concern. A PR that fixes a bug and adds an unrelated feature is harder to review and slower to merge. If you have two things to contribute, open two PRs.

### 3. Run the checks locally before pushing

```bash
pnpm lint        # ESLint
pnpm typecheck   # TypeScript compiler check (no emit)
pnpm test        # Test suite
```

All three must pass. A CI run will validate this automatically, but catching failures locally is faster.

---

## Pull request guidelines

- **Title format:** Use a short imperative sentence. Good: `Fix null pointer in anomaly detector`. Avoid: `Fixed some bugs`.
- **Description:** Explain what the change does and why. If it closes an issue, add `Closes #123` in the description body.
- **Screenshots:** If you changed any UI, include before/after screenshots.
- **Scope:** Do not include unrelated formatting changes, console.log cleanups, or refactors in the same PR as a feature or fix. These make diffs harder to read.
- **Draft PRs:** If your work is in progress but you want early feedback, open the PR as a draft and say what's missing.

A maintainer will review your PR within a few days. We may request changes or ask questions via inline comments. Once approved, a maintainer will merge it.

---

## Commit style

We use [Conventional Commits](https://www.conventionalcommits.org/). Each commit message should follow this format:

```
<type>(<scope>): <short description>
```

Common types:

| Type | When to use |
|------|-------------|
| `feat` | New user-visible feature |
| `fix` | Bug fix |
| `docs` | Documentation changes only |
| `refactor` | Code restructuring with no behavior change |
| `test` | Adding or updating tests |
| `chore` | Dependency bumps, config changes |

Examples:

```
feat(dap): add hit-count auto-disable for breakpoints
fix(anomaly): correct integer overflow detection for signed 32-bit values
docs(setup): add Java adapter build instructions
```

The `scope` is optional but helpful. Use the folder name or feature name as a guide.

---

## Testing

Tests live in `src/main/test/` and `dist-test/`. Run them with:

```bash
pnpm test
```

When adding a new feature:
- Add a test that covers the happy path.
- Add a test that covers the obvious failure mode.
- If your change touches the DAP client or a language adapter, add an integration-level test using the pattern in `src/main/test/test-day7.ts`.

When fixing a bug:
- Add a test that fails before your fix and passes after. This prevents regressions.

---

## AI and prompt changes

DEE-bugr's AI features live in `src/main/ai/`. Changes in this area need extra care.

**Prompt changes.** If you modify `context.ts` or `groq.ts`, include example inputs and outputs in your PR description so reviewers can evaluate the change without running the model themselves.

**Security note.** All source code, variable values, and file paths that go into AI prompts are untrusted user data. Never place them in a position where they could alter the instruction structure of the prompt. See [SECURITY.md](./SECURITY.md) for the full guidance.

**Model selection.** Do not change the default model (`llama-3.1-70b-versatile`) without a discussion in an issue first. Model changes affect every user and can have latency, cost, and quality implications.

---

## Adding a new language adapter

Language adapters live in `src/main/dap/adapters/`. Each file exports a function that returns a `ChildProcess` running the language's DAP server, plus a `LaunchArgs` factory for the initial `launch` or `attach` request.

To add a new adapter:

1. Create `src/main/dap/adapters/<language>.ts` following the pattern of `python.ts` or `cpp.ts`.
2. Register the adapter in `src/main/dap/DAPClient.ts` where the language selector runs.
3. Add the language to the UI language selector in `src/components/panels/ToolBar.tsx`.
4. Add a test file in `tmp/` for a minimal program in the new language that exercises a breakpoint hit.
5. Document any prerequisites (runtimes, debug servers, PATH requirements) in `SETUP.md` under a new adapter subsection.

Please open an issue to discuss the adapter before building it — we can let you know if there are known blockers or if someone else is already working on it.

---

## Questions

If you have a question that isn't answered here, open a Discussion on GitHub or ask in the issue you're working on. We're happy to help.

---

Made for FOSSHack '26.
