var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { BrowserWindow, ipcMain } from "electron";
import * as fs$1 from "fs";
import * as net from "node:net";
import { EventEmitter } from "node:events";
import { spawn, exec } from "node:child_process";
import * as path from "node:path";
import { spawn as spawn$1 } from "child_process";
import * as fs from "node:fs";
import { promisify } from "node:util";
const IPC = {
  // ── LIFECYCLE ─────────────────────────────────────────────
  LAUNCH: "dap:launch",
  TERMINATE: "dap:terminate",
  RESTART: "dap:restart",
  // ── STEPPING ──────────────────────────────────────────────
  CONTINUE: "dap:continue",
  NEXT: "dap:next",
  STEP_IN: "dap:stepIn",
  STEP_OUT: "dap:stepOut",
  PAUSE: "dap:pause",
  // ── ADVANCED FLOW ─────────────────────────────────────────
  GOTO_LINE: "dap:gotoLine",
  RUN_TO_CURSOR: "dap:runToCursor",
  RETURN_NOW: "dap:returnNow",
  DROP_FRAME: "dap:dropFrame",
  // ── BREAKPOINTS ───────────────────────────────────────────
  SET_BREAKPOINT: "dap:setBreakpoint",
  REMOVE_BREAKPOINT: "dap:removeBreakpoint",
  SET_METHOD_BP: "dap:setMethodBP",
  SET_FIELD_WATCH: "dap:setFieldWatch",
  SET_EXCEPTION_BP: "dap:setExceptionBP",
  TOGGLE_GROUP: "dap:toggleGroup",
  SWITCH_FRAME: "dap:switchFrame",
  // ── INSPECTION ────────────────────────────────────────────
  GET_STACK: "dap:stackTrace",
  GET_SCOPES: "dap:scopes",
  GET_VARIABLES: "dap:variables",
  EVALUATE: "dap:evaluate",
  SET_VARIABLE: "dap:setVariable",
  DISASSEMBLE: "dap:disassemble",
  READ_MEMORY: "dap:readMemory",
  GET_DEBUG_CONTEXT: "dap:getDebugContext",
  // ── HISTORY ───────────────────────────────────────────────
  JUMP_TO_STEP: "dap:jumpToHistoryStep",
  // ── AI (P4 registers these) ───────────────────────────────
  AI_EXPLAIN: "ai:explainBug",
  AI_FIX: "ai:suggestFix",
  AI_EXPLAIN_VAR: "ai:explainVariable",
  AI_WATCHPOINT: "ai:generateWatch",
  AI_SUGGEST_BPS: "ai:suggestBreakpoints",
  AI_NARRATIVE: "ai:sessionNarrative",
  // ── EVENTS PUSHED FROM MAIN TO RENDERER ───────────────────
  EVENT_STOPPED: "debug:stopped",
  EVENT_CONTINUED: "debug:continued",
  EVENT_TERMINATED: "debug:terminated",
  EVENT_OUTPUT: "debug:output",
  EVENT_ANOMALY: "debug:anomaly",
  EVENT_RETURN_VAL: "debug:returnValue",
  EVENT_BP_HIT: "debug:breakpointHit"
};
class DAPClient extends EventEmitter {
  constructor() {
    super(...arguments);
    __publicField(this, "seq", 1);
    __publicField(this, "socket", null);
    __publicField(this, "buffer", Buffer.alloc(0));
    __publicField(this, "pending", /* @__PURE__ */ new Map());
    __publicField(this, "connected", false);
  }
  // ── CONNECT ───────────────────────────────────────────────
  connect(host, port) {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.on("data", (chunk) => {
        this.onData(chunk);
      });
      this.socket.on("error", (err) => {
        console.error("[DAP] Socket error:", err.message);
        this.emit("error", err);
        this.pending.forEach((p) => p.reject(err));
        this.pending.clear();
      });
      this.socket.on("close", () => {
        console.log("[DAP] Connection closed");
        this.connected = false;
        this.emit("close");
      });
      this.socket.connect(port, host, () => {
        console.log(`[DAP] Connected to ${host}:${port}`);
        this.connected = true;
        resolve();
      });
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error(`[DAP] Connection timeout to ${host}:${port}`));
        }
      }, 1e4);
    });
  }
  disconnect() {
    var _a;
    (_a = this.socket) == null ? void 0 : _a.destroy();
    this.socket = null;
    this.connected = false;
  }
  // ── SEND A REQUEST ────────────────────────────────────────
  // This is the core method. Everything else calls this.
  request(command, args) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error(`[DAP] Not connected — cannot send ${command}`));
        return;
      }
      const seq = this.seq++;
      const message = {
        seq,
        type: "request",
        command,
        arguments: args
      };
      this.pending.set(seq, { resolve, reject, command });
      this.sendRaw(message);
      setTimeout(() => {
        if (this.pending.has(seq)) {
          this.pending.delete(seq);
          reject(new Error(`[DAP] Request timeout: ${command}`));
        }
      }, 15e3);
    });
  }
  // ── SEND RAW MESSAGE ──────────────────────────────────────
  sendRaw(message) {
    const json = JSON.stringify(message);
    const length = Buffer.byteLength(json, "utf8");
    const header = `Content-Length: ${length}\r
\r
`;
    const packet = Buffer.concat([
      Buffer.from(header, "ascii"),
      Buffer.from(json, "utf8")
    ]);
    console.log(`[DAP] → ${message.command || message.event} (seq ${message.seq})`);
    this.socket.write(packet);
  }
  // ── PARSE INCOMING DATA ───────────────────────────────────
  // DAP uses length-prefixed framing. Packets can be split
  // across multiple TCP chunks so we buffer and reassemble.
  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      const header = this.buffer.slice(0, headerEnd).toString("ascii");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }
      const contentLength = parseInt(match[1]);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;
      if (this.buffer.length < messageEnd) break;
      const messageJson = this.buffer.slice(messageStart, messageEnd).toString("utf8");
      this.buffer = this.buffer.slice(messageEnd);
      try {
        const message = JSON.parse(messageJson);
        this.handleMessage(message);
      } catch (e) {
        console.error("[DAP] Failed to parse message:", messageJson.slice(0, 200));
      }
    }
  }
  // ── ROUTE INCOMING MESSAGES ───────────────────────────────
  handleMessage(message) {
    if (message.type === "response") {
      const pending = this.pending.get(message.request_seq);
      if (pending) {
        this.pending.delete(message.request_seq);
        if (message.success) {
          console.log(`[DAP] ← ${pending.command} OK`);
          pending.resolve(message.body);
        } else {
          console.error(`[DAP] ← ${pending.command} FAILED:`, message.message);
          pending.reject(new Error(message.message || `DAP error: ${pending.command}`));
        }
      }
    } else if (message.type === "event") {
      console.log(`[DAP] ← EVENT: ${message.event}`);
      this.emit("event", message);
      this.emit(`event:${message.event}`, message.body);
    }
  }
  // ── CONVENIENCE WRAPPERS ──────────────────────────────────
  // Use these instead of request() directly
  async initialize() {
    return this.request("initialize", {
      clientID: "lucid",
      clientName: "Lucid Debugger",
      adapterID: "python",
      pathFormat: "path",
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsVariablePaging: false,
      supportsRunInTerminalRequest: false,
      supportsMemoryReferences: true,
      supportsDataBreakpoints: true,
      supportsDisassembleRequest: true,
      supportsGotoTargetsRequest: true,
      supportsRestartFrame: true
    });
  }
  async launch(args) {
    return this.request("launch", {
      ...args,
      stopOnEntry: args.stopOnEntry ?? true,
      justMyCode: false,
      console: "internalConsole"
    });
  }
  async attach(host, port) {
    return this.request("attach", {
      type: "python",
      request: "attach",
      name: "Attach to debugpy",
      connect: { host, port },
      pathMappings: [],
      justMyCode: false
    });
  }
  async setBreakpoints(file, lines, conditions) {
    return this.request("setBreakpoints", {
      source: { path: file },
      breakpoints: lines.map((line) => ({
        line,
        condition: conditions == null ? void 0 : conditions[line]
      }))
    });
  }
  async configurationDone() {
    return this.request("configurationDone");
  }
  async continue(threadId = 1) {
    return this.request("continue", { threadId });
  }
  async next(threadId = 1) {
    return this.request("next", { threadId });
  }
  async stepIn(threadId = 1) {
    return this.request("stepIn", { threadId });
  }
  async stepOut(threadId = 1) {
    return this.request("stepOut", { threadId });
  }
  async stackTrace(threadId = 1) {
    return this.request("stackTrace", { threadId, startFrame: 0, levels: 20 });
  }
  async scopes(frameId) {
    return this.request("scopes", { frameId });
  }
  async variables(variablesReference) {
    return this.request("variables", {
      variablesReference,
      filter: "named"
    });
  }
  async evaluate(expression, frameId, context = "repl") {
    return this.request("evaluate", { expression, frameId, context });
  }
  async setVariable(variablesReference, name, value) {
    return this.request("setVariable", { variablesReference, name, value });
  }
  async disassemble(memoryReference, count = 50) {
    return this.request("disassemble", {
      memoryReference,
      offset: 0,
      instructionOffset: -10,
      instructionCount: count,
      resolveSymbols: true
    });
  }
  async readMemory(memoryReference, count = 256) {
    return this.request("readMemory", {
      memoryReference,
      offset: 0,
      count
    });
  }
  async gotoTargets(file, line) {
    return this.request("gotoTargets", {
      source: { path: file },
      line
    });
  }
  async goto(targetId, threadId = 1) {
    return this.request("goto", { threadId, targetId });
  }
  async restartFrame(frameId) {
    return this.request("restartFrame", { frameId });
  }
  async threads() {
    return this.request("threads");
  }
  async terminate() {
    return this.request("terminate");
  }
}
function bool$1(v, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}
class BreakpointManager {
  // id → times hit
  constructor(client) {
    __publicField(this, "client");
    __publicField(this, "breakpoints", /* @__PURE__ */ new Map());
    // id → Breakpoint
    __publicField(this, "fileIndex", /* @__PURE__ */ new Map());
    // file → Set<id>
    __publicField(this, "hitCounts", /* @__PURE__ */ new Map());
    this.client = client;
  }
  // ── Public API ────────────────────────────────────────────────────────────
  /** Add or update a breakpoint. Returns the internal id. */
  async set(opts) {
    const id = `bp-${opts.file}-${opts.line}`;
    const bp = {
      id,
      file: opts.file,
      line: opts.line,
      verified: false,
      condition: opts.condition,
      hitCountRemaining: opts.hitCount,
      logMessage: opts.logMessage,
      label: opts.label,
      groupId: opts.groupId,
      dependsOn: opts.dependsOn,
      dependencyMet: opts.dependsOn ? false : void 0
    };
    this.breakpoints.set(id, bp);
    if (!this.fileIndex.has(opts.file)) this.fileIndex.set(opts.file, /* @__PURE__ */ new Set());
    this.fileIndex.get(opts.file).add(id);
    this.hitCounts.set(id, 0);
    await this.syncFile(opts.file);
    return bp;
  }
  /** Remove a breakpoint by id. */
  async remove(id) {
    const bp = this.breakpoints.get(id);
    if (!bp) return;
    this.breakpoints.delete(id);
    this.hitCounts.delete(id);
    const fileSet = this.fileIndex.get(bp.file);
    if (fileSet) {
      fileSet.delete(id);
      if (fileSet.size === 0) this.fileIndex.delete(bp.file);
    }
    await this.syncFile(bp.file);
  }
  /** Remove by file + line (convenience). */
  async removeAt(file, line) {
    const id = `bp-${file}-${line}`;
    await this.remove(id);
  }
  /** Toggle an entire group on/off. */
  async toggleGroup(groupId, enabled) {
    const affected = /* @__PURE__ */ new Set();
    for (const [id, bp] of this.breakpoints) {
      if (bp.groupId === groupId) {
        bp.verified = enabled;
        affected.add(bp.file);
      }
    }
    for (const file of affected) {
      await this.syncFileWithFilter(file, enabled ? void 0 : groupId);
    }
  }
  /** Called on every stopped event. Handles dependent BPs and hit counts. */
  onStopped(hitBreakpointIds) {
    const autoRemoved = [];
    let shouldContinue = false;
    for (const dapId of hitBreakpointIds) {
      const bp = this.findByDapId(dapId);
      if (!bp) continue;
      for (const [, other] of this.breakpoints) {
        if (other.dependsOn === bp.id) {
          other.dependencyMet = true;
        }
      }
      if (bp.dependsOn !== void 0 && !bp.dependencyMet) {
        shouldContinue = true;
        continue;
      }
      const hitCount = (this.hitCounts.get(bp.id) ?? 0) + 1;
      this.hitCounts.set(bp.id, hitCount);
      if (bp.hitCountRemaining !== void 0) {
        bp.hitCountRemaining--;
        if (bp.hitCountRemaining <= 0) {
          autoRemoved.push(bp.id);
        }
      }
    }
    for (const id of autoRemoved) {
      this.remove(id).catch((err) => console.error("[BPManager] Auto-remove failed:", err));
    }
    return { shouldContinue, autoRemoved };
  }
  /** Set method/function breakpoints (break on any call to a named function). */
  async setMethodBreakpoint(name) {
    try {
      await this.client.request("setFunctionBreakpoints", {
        breakpoints: [{ name }]
      });
      console.log(`[BPManager] Method breakpoint set on: ${name}`);
    } catch (err) {
      console.error("[BPManager] setFunctionBreakpoints failed:", err);
    }
  }
  /** Set a data/field watchpoint (break when variable memory is written). */
  async setFieldWatch(opts) {
    try {
      const info = await this.client.request("dataBreakpointInfo", {
        variablesReference: opts.variablesReference,
        name: opts.name
      });
      const dataId = info == null ? void 0 : info["dataId"];
      if (!dataId) {
        console.warn("[BPManager] dataBreakpointInfo returned no dataId — adapter may not support watchpoints");
        return;
      }
      await this.client.request("setDataBreakpoints", {
        breakpoints: [{
          dataId,
          accessType: opts.accessType ?? "write",
          condition: opts.condition
        }]
      });
      console.log(`[BPManager] Field watchpoint set on: ${opts.name}`);
    } catch (err) {
      console.error("[BPManager] setDataBreakpoints failed:", err);
    }
  }
  /** Set exception breakpoints with optional class/caller filters. */
  async setExceptionBreakpoints(opts) {
    var _a, _b;
    try {
      const args = {
        filters: opts.filters
      };
      if (opts.classFilter || ((_a = opts.exceptionClasses) == null ? void 0 : _a.length)) {
        args["filterOptions"] = opts.filters.map((filterId) => ({
          filterId,
          condition: opts.classFilter ? `exception.class.startsWith('${opts.classFilter}')` : void 0
        }));
      }
      if ((_b = opts.exceptionClasses) == null ? void 0 : _b.length) {
        args["exceptionOptions"] = opts.exceptionClasses.map((cls) => ({
          path: [{ names: [cls] }],
          breakMode: "always"
        }));
      }
      await this.client.request("setExceptionBreakpoints", args);
      console.log("[BPManager] Exception breakpoints set:", opts.filters);
    } catch (err) {
      console.error("[BPManager] setExceptionBreakpoints failed:", err);
    }
  }
  /** Get all breakpoints as an array (for Zustand state). */
  getAll() {
    return [...this.breakpoints.values()];
  }
  /** Get hit count for a BP id. */
  getHitCount(id) {
    return this.hitCounts.get(id) ?? 0;
  }
  /** Reset all state (call on session terminate). */
  reset() {
    this.breakpoints.clear();
    this.fileIndex.clear();
    this.hitCounts.clear();
  }
  // ── Private helpers ───────────────────────────────────────────────────────
  /** Sync all breakpoints for a file to the DAP adapter. */
  async syncFile(file) {
    const ids = this.fileIndex.get(file);
    if (!ids || ids.size === 0) {
      await this.client.setBreakpoints(file, []);
      return;
    }
    const bps = [...ids].map((id) => this.breakpoints.get(id)).filter((bp) => bp !== void 0);
    const lines = bps.map((bp) => bp.line);
    const conditions = {};
    for (const bp of bps) {
      if (bp.condition) conditions[bp.line] = bp.condition;
    }
    try {
      const body = await this.client.setBreakpoints(file, lines, conditions);
      const dapBps = Array.isArray(body == null ? void 0 : body["breakpoints"]) ? body["breakpoints"] : [];
      bps.forEach((bp, i) => {
        const dap = dapBps[i] ?? {};
        bp.dapId = typeof dap["id"] === "number" ? dap["id"] : void 0;
        bp.verified = bool$1(dap["verified"]);
      });
    } catch (err) {
      console.error(`[BPManager] syncFile failed for ${file}:`, err);
    }
  }
  /** Sync file excluding a specific group (for group toggle-off). */
  async syncFileWithFilter(file, excludeGroup) {
    const ids = this.fileIndex.get(file);
    if (!ids) return;
    const bps = [...ids].map((id) => this.breakpoints.get(id)).filter(
      (bp) => bp !== void 0 && (excludeGroup === void 0 || bp.groupId !== excludeGroup)
    );
    const lines = bps.map((bp) => bp.line);
    const conditions = {};
    for (const bp of bps) {
      if (bp.condition) conditions[bp.line] = bp.condition;
    }
    await this.client.setBreakpoints(file, lines, conditions).catch(
      (err) => console.error(`[BPManager] syncFileWithFilter failed for ${file}:`, err)
    );
  }
  findByDapId(dapId) {
    for (const [, bp] of this.breakpoints) {
      if (bp.dapId === dapId) return bp;
    }
    return void 0;
  }
}
function getFreePort$2() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = addr.port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}
async function launchPythonAdapter(scriptPath) {
  const port = await getFreePort$2();
  return new Promise((resolve, reject) => {
    var _a, _b;
    console.log(`[Python] Spawning debugpy for ${scriptPath} on port ${port}`);
    const child = spawn("python", [
      "-m",
      "debugpy",
      "--listen",
      `127.0.0.1:${port}`,
      "--wait-for-client",
      scriptPath
    ], {
      cwd: path.dirname(scriptPath)
    });
    let resolved = false;
    (_a = child.stdout) == null ? void 0 : _a.on("data", (data) => {
      console.log("[debugpy stdout]", data.toString().trim());
    });
    (_b = child.stderr) == null ? void 0 : _b.on("data", (data) => {
      const msg = data.toString().trim();
      console.log("[debugpy stderr]", msg);
      if (!resolved && msg.includes("Waiting for client to connect")) {
        resolved = true;
        resolve({ process: child, port });
      }
    });
    child.on("error", (err) => {
      console.error("[Python] Failed to spawn:", err);
      reject(err);
    });
    child.on("exit", (code) => {
      console.log("[Python] Process exited with code", code);
    });
    setTimeout(() => {
      if (!resolved) {
        console.log("[Python] No ready message seen — connecting anyway");
        resolved = true;
        resolve({ process: child, port });
      }
    }, 4e3);
  });
}
function launchJSAdapter(scriptPath, port = 4712) {
  return new Promise((resolve, reject) => {
    var _a, _b;
    console.log(`[JS] Spawning js-debug for ${scriptPath} on port ${port}`);
    let jsDebugEntry;
    try {
      jsDebugEntry = require.resolve("@vscode/js-debug/dist/src/dapDebugServer.js");
    } catch {
      reject(new Error(
        "Could not find @vscode/js-debug. Run: npm install @vscode/js-debug"
      ));
      return;
    }
    const child = spawn$1("node", [jsDebugEntry, String(port)]);
    let resolved = false;
    (_a = child.stdout) == null ? void 0 : _a.on("data", (data) => {
      const msg = data.toString().trim();
      console.log("[js-debug stdout]", msg);
      if (!resolved && msg.includes("Debug server listening")) {
        resolved = true;
        resolve({ process: child, port });
      }
    });
    (_b = child.stderr) == null ? void 0 : _b.on("data", (data) => {
      console.error("[js-debug stderr]", data.toString().trim());
    });
    child.on("error", (err) => {
      console.error("[JS] Failed to spawn:", err);
      reject(err);
    });
    child.on("exit", (code) => {
      console.log("[JS] Process exited with code", code);
    });
    setTimeout(() => {
      if (!resolved) {
        console.log("[JS] No ready message — connecting anyway");
        resolved = true;
        resolve({ process: child, port });
      }
    }, 4e3);
  });
}
function findCppToolsAdapter() {
  if (process.env.CPPTOOLS_ADAPTER_PATH) {
    const p = process.env.CPPTOOLS_ADAPTER_PATH;
    if (fs.existsSync(p)) return p;
    console.warn("[C++] CPPTOOLS_ADAPTER_PATH set but file not found:", p);
  }
  const root = path.join(process.cwd(), "cpptools", "OpenDebugAD7");
  if (fs.existsSync(root)) return root;
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const vscodeExts = path.join(home, ".vscode", "extensions");
  if (fs.existsSync(vscodeExts)) {
    const dirs = fs.readdirSync(vscodeExts).filter((d) => d.startsWith("ms-vscode.cpptools-"));
    if (dirs.length > 0) {
      dirs.sort().reverse();
      const bin = path.join(vscodeExts, dirs[0], "debugAdapters", "bin", "OpenDebugAD7");
      if (fs.existsSync(bin)) return bin;
    }
  }
  return null;
}
function getFreePort$1() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}
async function launchCppAdapter(programPath) {
  var _a, _b;
  const adapterBin = findCppToolsAdapter();
  if (!adapterBin) {
    throw new Error(
      "cpptools adapter not found.\nDownload from https://github.com/microsoft/vscode-cpptools/releases\nExtract and set CPPTOOLS_ADAPTER_PATH=/path/to/OpenDebugAD7"
    );
  }
  const port = await getFreePort$1();
  console.log(`[C++] Spawning cpptools adapter on port ${port}`);
  console.log(`[C++] Adapter binary: ${adapterBin}`);
  console.log(`[C++] Target program: ${programPath}`);
  try {
    fs.chmodSync(adapterBin, 493);
  } catch {
  }
  const child = spawn(adapterBin, ["--server=" + port], {
    cwd: path.dirname(programPath)
  });
  (_a = child.stdout) == null ? void 0 : _a.on("data", (d) => console.log("[cpptools stdout]", d.toString().trim()));
  (_b = child.stderr) == null ? void 0 : _b.on("data", (d) => console.log("[cpptools stderr]", d.toString().trim()));
  child.on("error", (err) => console.error("[C++] Adapter error:", err));
  child.on("exit", (code) => console.log("[C++] Adapter exited with code", code));
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return { process: child, port };
}
function buildCppLaunchArgs(programPath, sourceFile) {
  return {
    type: "cppdbg",
    request: "launch",
    name: "Lucid C++ Debug",
    program: programPath,
    args: [],
    stopAtEntry: true,
    // stop at main() first
    cwd: path.dirname(programPath),
    environment: [],
    externalConsole: false,
    MIMode: "gdb",
    // or 'lldb' on macOS
    miDebuggerPath: "gdb",
    // must be on PATH
    setupCommands: [
      {
        description: "Enable pretty-printing",
        text: "-enable-pretty-printing",
        ignoreFailures: true
      }
    ],
    // Map source files if needed
    ...{}
  };
}
promisify(exec);
function findJavaDebugJar() {
  if (process.env.JAVA_DEBUG_JAR) {
    const p = process.env.JAVA_DEBUG_JAR;
    if (fs.existsSync(p)) return p;
    const dir = path.dirname(p);
    const prefix = path.basename(p).replace("*", "");
    if (fs.existsSync(dir)) {
      const match = fs.readdirSync(dir).find((f) => f.startsWith(prefix));
      if (match) return path.join(dir, match);
    }
    console.warn("[Java] JAVA_DEBUG_JAR set but not found:", p);
  }
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const extsDir = path.join(home, ".vscode", "extensions");
  if (fs.existsSync(extsDir)) {
    const dirs = fs.readdirSync(extsDir).filter((d) => d.startsWith("vscjava.vscode-java-debug-"));
    for (const dir of dirs.sort().reverse()) {
      const serverDir = path.join(extsDir, dir, "server");
      if (!fs.existsSync(serverDir)) continue;
      const jar = fs.readdirSync(serverDir).find((f) => f.startsWith("com.microsoft.java.debug.plugin"));
      if (jar) return path.join(serverDir, jar);
    }
  }
  return null;
}
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}
async function launchJavaProgram(classOrJar, classpath, jdwpPort = 5005) {
  var _a, _b;
  const isJar = classOrJar.endsWith(".jar");
  const javaArgs = [
    `-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=127.0.0.1:${jdwpPort}`,
    ...isJar ? ["-jar", classOrJar] : ["-cp", classpath, classOrJar]
  ];
  console.log(`[Java] Launching: java ${javaArgs.join(" ")}`);
  const child = spawn("java", javaArgs, {
    cwd: path.dirname(isJar ? classOrJar : classpath)
  });
  (_a = child.stdout) == null ? void 0 : _a.on("data", (d) => console.log("[java stdout]", d.toString().trim()));
  (_b = child.stderr) == null ? void 0 : _b.on("data", (d) => {
    const msg = d.toString().trim();
    console.log("[java stderr]", msg);
  });
  child.on("error", (err) => console.error("[Java] Process error:", err));
  child.on("exit", (code) => console.log("[Java] Exited with code", code));
  await new Promise((resolve) => setTimeout(resolve, 1e3));
  return { process: child, port: jdwpPort };
}
async function launchJavaAdapter() {
  var _a, _b;
  const jar = findJavaDebugJar();
  if (!jar) {
    throw new Error(
      "java-debug JAR not found.\nClone and build: git clone https://github.com/microsoft/java-debug && cd java-debug && mvn package -DskipTests\nThen set: JAVA_DEBUG_JAR=/path/to/com.microsoft.java.debug.plugin-*.jar"
    );
  }
  const port = await getFreePort();
  console.log(`[Java] Spawning java-debug adapter on port ${port}`);
  const child = spawn("java", [
    "-cp",
    jar,
    "com.microsoft.java.debug.core.DebugServer",
    // entry point for server mode
    String(port)
  ]);
  (_a = child.stdout) == null ? void 0 : _a.on("data", (d) => console.log("[java-debug stdout]", d.toString().trim()));
  (_b = child.stderr) == null ? void 0 : _b.on("data", (d) => console.log("[java-debug stderr]", d.toString().trim()));
  child.on("error", (err) => console.error("[Java-debug] Adapter error:", err));
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return { process: child, port };
}
function buildJavaAttachArgs(jdwpPort = 5005) {
  return {
    type: "java",
    request: "attach",
    name: "Lucid Java Attach",
    hostName: "127.0.0.1",
    port: jdwpPort
  };
}
const INITIAL_DEBUG_STATE = {
  status: "idle",
  language: "python",
  currentFile: "",
  currentLine: 0,
  stackFrames: [],
  scopes: [],
  variables: [],
  watchValues: {},
  assemblyLines: [],
  threads: [],
  breakpoints: [],
  executionHistory: [],
  anomalies: [],
  stepCount: 0
};
function str(v, fb = "") {
  return typeof v === "string" ? v : fb;
}
function num(v, fb = 0) {
  return typeof v === "number" ? v : fb;
}
function bool(v, fb = false) {
  return typeof v === "boolean" ? v : fb;
}
function rec(v) {
  return typeof v === "object" && v !== null ? v : {};
}
function isVariable(v) {
  if (typeof v !== "object" || v === null) return false;
  const r = v;
  return typeof r["name"] === "string" && typeof r["value"] === "string";
}
function runFastAnomalyChecks(variables, prevValues) {
  var _a, _b, _c, _d;
  const anomalies = [];
  for (const v of variables) {
    if (((_a = v.type) == null ? void 0 : _a.includes("*")) || ((_b = v.type) == null ? void 0 : _b.includes("ptr")) || v.type === "pointer") {
      if (v.value === "0x0" || v.value === "0" || v.value === "null" || v.value === "nullptr") {
        anomalies.push({
          variable: v.name,
          value: v.value,
          type: "null_pointer",
          severity: "error",
          message: `${v.name} is a null pointer — dereferencing will crash`
        });
      }
    }
    if (((_c = v.type) == null ? void 0 : _c.includes("int")) || ((_d = v.type) == null ? void 0 : _d.includes("long"))) {
      const curr = parseInt(v.value);
      const prev = parseInt(prevValues[v.name] ?? "0");
      if (!isNaN(curr) && !isNaN(prev) && Math.abs(curr - prev) > 1e9) {
        anomalies.push({
          variable: v.name,
          value: v.value,
          type: "integer_overflow",
          severity: "warning",
          message: `${v.name} jumped by ${(curr - prev).toLocaleString()} — possible overflow`
        });
      }
    }
    if (v.name.toLowerCase().includes("index") || v.name.toLowerCase().includes("count") || v.name.toLowerCase().includes("size") || v.name.toLowerCase().includes("len")) {
      if (parseInt(v.value) < 0) {
        anomalies.push({
          variable: v.name,
          value: v.value,
          type: "bounds_exceeded",
          severity: "warning",
          message: `${v.name} is negative (${v.value}) — likely out-of-bounds`
        });
      }
    }
  }
  return anomalies;
}
class SessionManager {
  constructor() {
    __publicField(this, "client", new DAPClient());
    __publicField(this, "bpManager");
    __publicField(this, "adapterProcess", null);
    __publicField(this, "javaAppProcess", null);
    __publicField(this, "threadId", 1);
    __publicField(this, "frameId", 0);
    __publicField(this, "stepCount", 0);
    __publicField(this, "language", "python");
    __publicField(this, "prevVarValues", {});
    __publicField(this, "state", { ...INITIAL_DEBUG_STATE });
    // For run-to-cursor: track temp BPs set for that feature
    __publicField(this, "runToCursorBP", null);
    this.bpManager = new BreakpointManager(this.client);
    this.wireClientEvents();
  }
  // ── Wire DAP events ───────────────────────────────────────────────────────
  wireClientEvents() {
    this.client.on("event:stopped", this.handleStopped.bind(this));
    this.client.on("event:continued", this.handleContinued.bind(this));
    this.client.on("event:output", this.handleOutput.bind(this));
    this.client.on("event:terminated", this.handleTerminated.bind(this));
    this.client.on("event:exited", this.handleExited.bind(this));
  }
  async handleStopped(body) {
    console.log("[Session] Stopped:", body["reason"], "| thread:", body["threadId"]);
    this.threadId = num(body["threadId"], 1);
    this.state.status = "paused";
    this.state.errorMessage = body["reason"] === "exception" ? str(body["text"]) || void 0 : void 0;
    const hitIds = Array.isArray(body["hitBreakpointIds"]) ? body["hitBreakpointIds"].map((n) => num(n)) : [];
    if (hitIds.length > 0) {
      const { shouldContinue } = this.bpManager.onStopped(hitIds);
      if (shouldContinue) {
        await this.continueExecution();
        return;
      }
    }
    if (this.runToCursorBP) {
      const { file, line } = this.runToCursorBP;
      this.runToCursorBP = null;
      await this.bpManager.removeAt(file, line);
      this.state.breakpoints = this.bpManager.getAll();
    }
    await this.refreshFullState();
    this.pushToRenderer(IPC.EVENT_STOPPED, this.state);
  }
  handleContinued() {
    this.state.status = "running";
    this.pushToRenderer(IPC.EVENT_CONTINUED, null);
  }
  handleOutput(body) {
    this.pushToRenderer(IPC.EVENT_OUTPUT, {
      text: str(body["output"]),
      category: str(body["category"], "stdout")
    });
  }
  handleTerminated() {
    var _a, _b;
    console.log("[Session] Program terminated");
    this.state.status = "terminated";
    this.pushToRenderer(IPC.EVENT_TERMINATED, null);
    (_a = this.adapterProcess) == null ? void 0 : _a.kill();
    (_b = this.javaAppProcess) == null ? void 0 : _b.kill();
  }
  handleExited(body) {
    console.log("[Session] Exited with code", body["exitCode"]);
  }
  // ── Launch ────────────────────────────────────────────────────────────────
  async launch(language, scriptPath, breakpointLines = []) {
    this.language = language;
    this.stepCount = 0;
    this.prevVarValues = {};
    this.runToCursorBP = null;
    this.bpManager.reset();
    this.state = { ...INITIAL_DEBUG_STATE, language, status: "launching" };
    this.javaAppProcess = null;
    console.log(`[Session] Launching ${language} → ${scriptPath}`);
    let port;
    if (language === "python") {
      const adapter = await launchPythonAdapter(scriptPath);
      this.adapterProcess = adapter.process;
      port = adapter.port;
    } else if (language === "javascript") {
      const adapter = await launchJSAdapter(scriptPath);
      this.adapterProcess = adapter.process;
      port = adapter.port;
    } else if (language === "c" || language === "cpp") {
      const adapter = await launchCppAdapter(scriptPath);
      this.adapterProcess = adapter.process;
      port = adapter.port;
    } else if (language === "java") {
      const jdwpPort = 5005;
      const classpath = process.env.JAVA_CLASSPATH ?? ".";
      const javaApp = await launchJavaProgram(scriptPath, classpath, jdwpPort);
      this.javaAppProcess = javaApp.process;
      const adapter = await launchJavaAdapter();
      this.adapterProcess = adapter.process;
      port = adapter.port;
    } else {
      throw new Error(`Language not yet supported: ${language}`);
    }
    await this.sleep(1500);
    await this.client.connect("127.0.0.1", port);
    console.log("[Session] DAPClient connected");
    const initBody = await this.client.initialize();
    console.log("[Session] Initialize OK, capabilities:", Object.keys(initBody ?? {}));
    if (language === "python") {
      await this.client.request("launch", {
        type: "python",
        request: "launch",
        name: "Lucid Python Debug",
        program: scriptPath,
        stopOnEntry: true,
        justMyCode: false,
        console: "internalConsole"
      });
    } else if (language === "javascript") {
      await this.client.launch({ program: scriptPath, stopOnEntry: false });
    } else if (language === "c" || language === "cpp") {
      await this.client.request("launch", buildCppLaunchArgs(scriptPath));
    } else if (language === "java") {
      await this.client.request("attach", buildJavaAttachArgs(5005));
    }
    for (const line of breakpointLines) {
      await this.bpManager.set({ file: scriptPath, line });
    }
    this.state.breakpoints = this.bpManager.getAll();
    await this.client.configurationDone();
    console.log("[Session] ConfigurationDone sent — program running");
    this.state.status = "running";
  }
  // ── Breakpoints (delegate to BreakpointManager) ───────────────────────────
  async setBreakpoint(file, line, opts) {
    await this.bpManager.set({ file, line, ...opts });
    this.state.breakpoints = this.bpManager.getAll();
  }
  async removeBreakpoint(file, line) {
    await this.bpManager.removeAt(file, line);
    this.state.breakpoints = this.bpManager.getAll();
  }
  async toggleBreakpointGroup(groupId, enabled) {
    await this.bpManager.toggleGroup(groupId, enabled);
    this.state.breakpoints = this.bpManager.getAll();
  }
  async setMethodBreakpoint(name) {
    await this.bpManager.setMethodBreakpoint(name);
  }
  async setFieldWatch(variablesReference, name) {
    await this.bpManager.setFieldWatch({ variablesReference, name });
  }
  async setExceptionBreakpoints(filters, classFilter) {
    await this.bpManager.setExceptionBreakpoints({ filters, classFilter });
  }
  // ── v1 Day 4: Run-to-cursor ───────────────────────────────────────────────
  // Sets a temporary breakpoint at target line, continues, removes it on stop.
  async runToCursor(file, line) {
    this.runToCursorBP = { file, line };
    await this.bpManager.set({ file, line });
    this.state.breakpoints = this.bpManager.getAll();
    await this.continueExecution();
  }
  // ── Refresh full state after every stop ───────────────────────────────────
  async refreshFullState() {
    try {
      const stackBody = await this.client.stackTrace(this.threadId);
      const rawFrames = Array.isArray(stackBody == null ? void 0 : stackBody.stackFrames) ? stackBody.stackFrames : [];
      const frames = rawFrames.map((f) => {
        const src = rec(f["source"]);
        return {
          id: num(f["id"]),
          name: str(f["name"]),
          file: str(src["path"]) || str(src["name"]),
          line: num(f["line"]),
          column: num(f["column"]),
          variableCount: 0
        };
      });
      this.state.stackFrames = frames;
      if (frames.length > 0) {
        this.frameId = frames[0].id;
        this.state.currentFile = frames[0].file;
        this.state.currentLine = frames[0].line;
      }
      const scopesBody = await this.client.scopes(this.frameId);
      const rawScopes = Array.isArray(scopesBody == null ? void 0 : scopesBody.scopes) ? scopesBody.scopes : [];
      const scopes = rawScopes.map((s) => ({
        name: str(s["name"]),
        variablesReference: num(s["variablesReference"]),
        expensive: bool(s["expensive"])
      }));
      this.state.scopes = scopes;
      const allVars = [];
      for (const scope of scopes) {
        if (scope.expensive) continue;
        allVars.push(...await this.fetchVariables(scope.variablesReference));
      }
      if (frames.length > 0) frames[0].variableCount = allVars.length;
      this.state.variables = allVars;
      const threadsBody = await this.client.threads();
      const rawThreads = Array.isArray(threadsBody == null ? void 0 : threadsBody.threads) ? threadsBody.threads : [];
      this.state.threads = rawThreads.map((t) => ({
        id: num(t["id"]),
        name: str(t["name"]),
        status: num(t["id"]) === this.threadId ? "stopped" : "running"
      }));
      try {
        this.state.sourceLines = fs$1.readFileSync(this.state.currentFile, "utf8").split("\n");
      } catch {
      }
      if ((this.language === "c" || this.language === "cpp") && allVars.length > 0) {
        const withMem = allVars.find((v) => v.memoryReference);
        if (withMem == null ? void 0 : withMem.memoryReference) {
          try {
            this.state.assemblyLines = await this.disassemble(withMem.memoryReference, 40);
          } catch {
          }
        }
      }
      const heapBytes = await this.tryReadHeapBytes();
      this.stepCount++;
      this.recordHistoryEntry(allVars, heapBytes);
      this.state.stepCount = this.stepCount;
      this.state.breakpoints = this.bpManager.getAll();
      const anomalies = runFastAnomalyChecks(allVars, this.prevVarValues);
      this.state.anomalies = anomalies;
      if (anomalies.length > 0) {
        for (const a of anomalies) {
          this.pushToRenderer(IPC.EVENT_ANOMALY, a);
        }
      }
    } catch (err) {
      console.error("[Session] refreshFullState failed:", err);
    }
  }
  // ── Heap bytes (v2 — P3 heap tracker) ────────────────────────────────────
  async tryReadHeapBytes() {
    if (this.language === "python") {
      try {
        const body = await this.client.evaluate(
          '__import__("tracemalloc").get_traced_memory()[0] if __import__("tracemalloc").is_tracing() else __import__("sys").getsizeof({})',
          this.frameId,
          "hover"
        );
        const val = parseInt(str(rec(body)["result"]));
        if (!isNaN(val)) return val;
      } catch {
      }
    }
    if (this.language === "javascript") {
      try {
        const body = await this.client.evaluate("process.memoryUsage().heapUsed", this.frameId, "hover");
        const val = parseInt(str(rec(body)["result"]));
        if (!isNaN(val)) return val;
      } catch {
      }
    }
    return void 0;
  }
  // ── Fetch variables ───────────────────────────────────────────────────────
  async fetchVariables(variablesReference) {
    if (variablesReference === 0) return [];
    try {
      const body = await this.client.variables(variablesReference);
      const raw = Array.isArray(body == null ? void 0 : body.variables) ? body.variables : [];
      return raw.filter(isVariable).map((v) => {
        const vr = v;
        const hint = rec(vr["presentationHint"]);
        return {
          name: str(vr["name"]),
          value: str(vr["value"]),
          type: str(vr["type"], "unknown"),
          variablesReference: num(vr["variablesReference"]),
          memoryReference: typeof vr["memoryReference"] === "string" ? str(vr["memoryReference"]) : void 0,
          expensive: bool(hint["lazy"])
        };
      });
    } catch (err) {
      console.error("[Session] fetchVariables failed for ref", variablesReference, err);
      return [];
    }
  }
  // ── History ───────────────────────────────────────────────────────────────
  recordHistoryEntry(vars, heapBytes) {
    const varSnapshot = {};
    for (const v of vars) {
      varSnapshot[v.name] = {
        value: v.value,
        type: v.type,
        changed: this.prevVarValues[v.name] !== v.value
      };
      this.prevVarValues[v.name] = v.value;
    }
    this.state.executionHistory.push({
      step: this.stepCount,
      file: this.state.currentFile,
      line: this.state.currentLine,
      variables: varSnapshot,
      timestamp: Date.now(),
      heapBytes
    });
  }
  // ── Step commands ─────────────────────────────────────────────────────────
  async stepOver() {
    this.state.status = "running";
    await this.client.next(this.threadId);
  }
  async stepIn() {
    this.state.status = "running";
    await this.client.stepIn(this.threadId);
  }
  async continueExecution() {
    this.state.status = "running";
    await this.client.continue(this.threadId);
  }
  async stepOut() {
    this.state.status = "running";
    await this.client.stepOut(this.threadId);
    await this.captureReturnValue();
  }
  async pause() {
    await this.client.request("pause", { threadId: this.threadId });
  }
  // v2: Return value capture after stepOut
  async captureReturnValue() {
    var _a;
    if (this.state.stackFrames.length === 0) return;
    const fnName = ((_a = this.state.stackFrames[0]) == null ? void 0 : _a.name) ?? "unknown";
    try {
      const body = await this.client.evaluate("$__return__", this.frameId, "hover");
      const value = str(rec(body)["result"]);
      const type = str(rec(body)["type"]);
      if (value) {
        this.state.lastReturnValue = { fnName, value, type };
        this.pushToRenderer(IPC.EVENT_RETURN_VAL, { fnName, value, type });
      }
    } catch {
    }
  }
  // ── Day 5+ stubs (clearly marked) ────────────────────────────────────────
  /** Day 5: Jump execution to any line in current file. */
  async gotoLine(file, line) {
    try {
      const targetsBody = await this.client.gotoTargets(file, line);
      const targets = rec(targetsBody)["targets"] ?? [];
      if (targets.length > 0) {
        await this.client.goto(num(targets[0]["id"]), this.threadId);
      }
    } catch (err) {
      console.error("[Session] gotoLine failed (adapter may not support gotoTargets):", err);
      throw err;
    }
  }
  /** Day 5: Drop (restart) current frame — re-enter the function from the top. */
  async dropFrame(frameId) {
    await this.client.restartFrame(frameId ?? this.frameId);
  }
  /** Day 5: Return from current function immediately. */
  async returnNow(frameId) {
    await this.client.restartFrame(frameId ?? this.frameId);
  }
  // ── Terminate ────────────────────────────────────────────────────────────
  async terminate() {
    var _a, _b;
    try {
      await this.client.terminate();
    } catch {
    }
    (_a = this.adapterProcess) == null ? void 0 : _a.kill();
    (_b = this.javaAppProcess) == null ? void 0 : _b.kill();
    this.adapterProcess = null;
    this.javaAppProcess = null;
    this.client.disconnect();
    this.client = new DAPClient();
    this.bpManager = new BreakpointManager(this.client);
    this.wireClientEvents();
    this.state = { ...INITIAL_DEBUG_STATE };
    this.state.status = "terminated";
    this.threadId = 1;
    this.frameId = 0;
    this.stepCount = 0;
    this.prevVarValues = {};
    this.runToCursorBP = null;
  }
  // ── Evaluate / set variable ───────────────────────────────────────────────
  async evaluate(expression) {
    try {
      const body = await this.client.evaluate(expression, this.frameId);
      return typeof rec(body)["result"] === "string" ? str(rec(body)["result"]) : String(body ?? "");
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  async setVariable(variablesReference, name, value) {
    return this.client.setVariable(variablesReference, name, value);
  }
  async switchFrame(frameId) {
    this.frameId = frameId;
    const scopesBody = await this.client.scopes(frameId);
    const rawScopes = Array.isArray(scopesBody == null ? void 0 : scopesBody.scopes) ? scopesBody.scopes : [];
    const allVars = [];
    for (const scope of rawScopes) {
      if (bool(scope["expensive"])) continue;
      allVars.push(...await this.fetchVariables(num(scope["variablesReference"])));
    }
    return allVars;
  }
  // ── Memory / disassembly ──────────────────────────────────────────────────
  async readMemory(memoryReference, count = 256) {
    return this.client.readMemory(memoryReference, count);
  }
  async disassemble(memoryReference, count = 50) {
    try {
      const body = await this.client.disassemble(memoryReference, count);
      const rawAsm = Array.isArray(body == null ? void 0 : body["instructions"]) ? body["instructions"] : [];
      return rawAsm.map((a) => ({
        address: str(a["address"]),
        instruction: str(a["instruction"]),
        sourceLine: typeof a["line"] === "number" ? a["line"] : void 0,
        bytes: str(a["instructionBytes"])
      }));
    } catch (err) {
      console.error("[Session] disassemble failed:", err);
      return [];
    }
  }
  // ── AI context (P4) ───────────────────────────────────────────────────────
  getDebugContext() {
    return {
      language: this.language,
      errorMessage: this.state.errorMessage,
      stackFrames: this.state.stackFrames,
      variables: this.state.variables,
      sourceLines: this.state.sourceLines ?? [],
      currentLine: this.state.currentLine,
      currentFile: this.state.currentFile
    };
  }
  // ── Getters ───────────────────────────────────────────────────────────────
  getState() {
    return this.state;
  }
  getClient() {
    return this.client;
  }
  getBPManager() {
    return this.bpManager;
  }
  getCurrentFrameId() {
    return this.frameId;
  }
  getCurrentThreadId() {
    return this.threadId;
  }
  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  pushToRenderer(channel, data) {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(channel, data);
    }
  }
}
const session = new SessionManager();
function registerAllHandlers() {
  ipcMain.handle(IPC.LAUNCH, async (_, args) => {
    try {
      await session.launch(args.language, args.target, args.breakpoints ?? []);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[IPC] Launch failed:", msg);
      return { success: false, error: msg };
    }
  });
  ipcMain.handle(IPC.TERMINATE, async () => {
    await session.terminate();
    return { success: true };
  });
  ipcMain.handle(IPC.RESTART, async () => {
    await session.terminate();
    return { success: true };
  });
  ipcMain.handle(IPC.NEXT, async () => {
    await session.stepOver();
    return { success: true };
  });
  ipcMain.handle(IPC.STEP_IN, async () => {
    await session.stepIn();
    return { success: true };
  });
  ipcMain.handle(IPC.STEP_OUT, async () => {
    await session.stepOut();
    return { success: true };
  });
  ipcMain.handle(IPC.CONTINUE, async () => {
    await session.continueExecution();
    return { success: true };
  });
  ipcMain.handle(IPC.PAUSE, async () => {
    await session.pause();
    return { success: true };
  });
  ipcMain.handle(IPC.GOTO_LINE, async (_, args) => {
    try {
      await session.gotoLine(args.file, args.line);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle(IPC.RETURN_NOW, async (_, args) => {
    try {
      await session.returnNow(args == null ? void 0 : args.frameId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle(IPC.DROP_FRAME, async (_, args) => {
    try {
      await session.dropFrame(args == null ? void 0 : args.frameId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle("dap:runToCursor", async (_, args) => {
    try {
      await session.runToCursor(args.file, args.line);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle(IPC.SET_BREAKPOINT, async (_, args) => {
    try {
      await session.setBreakpoint(args.file, args.line, {
        condition: args.condition,
        hitCount: args.hitCount,
        logMessage: args.logMessage,
        label: args.label,
        groupId: args.groupId,
        dependsOn: args.dependsOn
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle(IPC.REMOVE_BREAKPOINT, async (_, args) => {
    try {
      await session.removeBreakpoint(args.file, args.line);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle(IPC.SET_METHOD_BP, async (_, args) => {
    try {
      await session.setMethodBreakpoint(args.name);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle(IPC.SET_FIELD_WATCH, async (_, args) => {
    try {
      await session.setFieldWatch(args.variablesReference, args.name);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle(IPC.SET_EXCEPTION_BP, async (_, args) => {
    try {
      await session.setExceptionBreakpoints(args.filters, args.classFilter);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle(IPC.TOGGLE_GROUP, async (_, args) => {
    try {
      await session.toggleBreakpointGroup(args.groupId, args.enabled);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle(IPC.GET_VARIABLES, async (_, args) => session.fetchVariables(args.variablesReference));
  ipcMain.handle(IPC.EVALUATE, async (_, args) => session.evaluate(args.expr));
  ipcMain.handle(IPC.SET_VARIABLE, async (_, args) => {
    await session.setVariable(args.variablesReference, args.name, args.value);
    return { success: true };
  });
  ipcMain.handle(IPC.SWITCH_FRAME, async (_, args) => {
    try {
      return await session.switchFrame(args.frameId);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle(IPC.READ_MEMORY, async (_, args) => session.readMemory(args.memoryReference, args.count));
  ipcMain.handle(IPC.DISASSEMBLE, async (_, args) => session.disassemble(args.memoryReference, args.count));
  ipcMain.handle(IPC.GET_DEBUG_CONTEXT, () => session.getDebugContext());
  ipcMain.handle(IPC.JUMP_TO_STEP, async (_, args) => {
    const state = session.getState();
    const entry = state.executionHistory.find((h) => h.step === args.step);
    if (!entry) return { success: false, error: "Step not found in history" };
    return { success: true, entry };
  });
  ipcMain.handle(IPC.AI_EXPLAIN, async () => {
    try {
      const { explainBug } = require("../ai/groq");
      const explanation = await explainBug();
      return { success: true, explanation };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[IPC] AI_EXPLAIN failed:", msg);
      return { success: false, error: msg };
    }
  });
  ipcMain.handle(IPC.AI_FIX, async () => {
    try {
      const { suggestFix } = require("../ai/groq");
      const fix = await suggestFix();
      return { success: true, fix };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[IPC] AI_FIX failed:", msg);
      return { success: false, error: msg };
    }
  });
  ipcMain.handle(IPC.AI_EXPLAIN_VAR, async (_, args) => {
    try {
      const { explainVariable } = require("../ai/groq");
      const explanation = await explainVariable(args.varName);
      return { success: true, explanation };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });
  ipcMain.handle(IPC.AI_WATCHPOINT, async () => {
    try {
      const { generateWatch } = require("../ai/groq");
      const suggestions = await generateWatch();
      return { success: true, suggestions };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });
  ipcMain.handle(IPC.AI_SUGGEST_BPS, async (_, args) => {
    try {
      const { suggestBreakpoints } = require("../ai/groq");
      const suggestions = await suggestBreakpoints(args.sourceCode, args.language);
      return { success: true, suggestions };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });
  ipcMain.handle(IPC.AI_NARRATIVE, async () => {
    try {
      const { sessionNarrative } = require("../ai/groq");
      const narrative = await sessionNarrative();
      return { success: true, narrative };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });
  console.log("[IPC] All handlers registered");
}
export {
  registerAllHandlers
};
