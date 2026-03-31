# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| `main` branch | ✅ Active |
| Older releases | ❌ No patches |

Security fixes are applied to the `main` branch only. We recommend always running the latest release.

---

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in DEE-bugr, report it privately so we can address it before public disclosure.

**Preferred channel:** Open a [GitHub Security Advisory](https://github.com/your-org/dee-bugr/security/advisories/new) — this keeps communication private and gives you credit once the issue is resolved.

**Alternative:** Email `security@your-org.example` with the subject line `DEE-bugr Security Report`. If the message is sensitive, request our PGP key in a preliminary email.

---

## What to include in your report

The more detail you provide, the faster we can triage and patch. Please include:

- A description of the vulnerability and its potential impact
- The component or file(s) affected
- Steps to reproduce or a minimal proof-of-concept
- Any suggested mitigations you've identified

---

## What to expect

| Timeline | Action |
|----------|--------|
| Within 48 hours | Acknowledgement of your report |
| Within 7 days | Initial severity assessment and response |
| Within 30 days | Patch released for confirmed issues (or a clear timeline if more time is needed) |
| After patch | Public disclosure coordinated with you |

We follow a responsible disclosure model. We ask that you give us a reasonable window to patch before disclosing publicly, and we will reciprocate by keeping you informed at every step.

---

## Scope

### In scope

The following areas are in scope for security reports:

- **Electron main process** — privilege escalation, IPC injection, arbitrary code execution via the DAP bridge or AI integration
- **AI prompt injection** — crafted source code or variable values that manipulate AI outputs in harmful ways
- **Environment variable handling** — `.env` key exposure, insecure defaults
- **File system access** — unintended read/write outside of expected debug paths
- **Supply chain** — compromised or malicious dependencies in `package.json`

### Out of scope

The following are explicitly out of scope:

- Bugs that require physical access to the user's machine
- Social engineering attacks against maintainers or users
- Vulnerabilities in third-party services (Groq, Ollama) — report those to the respective vendor
- Issues that only affect development builds (`pnpm dev`) and cannot affect distributed binaries
- Theoretical vulnerabilities with no practical exploitation path

---

## Security considerations for contributors

If you are contributing code, keep these practices in mind:

**IPC validation.** All messages received from the renderer process in `src/main/ipc/handlers.ts` must be validated before use. The renderer is an untrusted context — treat its input the same way you would treat user input from the network.

**AI prompt construction.** Variable values, file paths, and source code snippets are included in AI prompts. Never interpolate untrusted content into system prompts or in ways that could alter the instruction structure. Treat prompt construction the same as SQL query construction — parameters must be clearly separated from instructions.

**File path handling.** Debug target paths come from user input. Always resolve and validate paths before passing them to child processes. Do not allow `..` traversal outside the working directory.

**Environment variables.** API keys are read from `.env` at startup. They must never be logged, included in error messages, or transmitted to the renderer process. The preload script and IPC channels must not expose `process.env` to the renderer.

**Dependency additions.** Before adding a new dependency, check its download count, maintenance status, and known vulnerabilities via `pnpm audit`. Prefer well-maintained packages with a track record. Avoid packages that have access to the file system or network unless strictly necessary.

---

## Acknowledgements

We are grateful to everyone who has responsibly reported issues to us. Contributors who report confirmed vulnerabilities will be credited in the relevant release notes unless they prefer to remain anonymous.
