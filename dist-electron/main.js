var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { BrowserWindow, ipcMain, app } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import path__default from "node:path";
import * as fs from "fs";
import * as net from "node:net";
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { spawn as spawn$1 } from "child_process";
const IPC = {
  // ── LIFECYCLE ─────────────────────────────────────────────
  LAUNCH: "dap:launch",
  TERMINATE: "dap:terminate",
  // ── STEPPING ──────────────────────────────────────────────
  CONTINUE: "dap:continue",
  NEXT: "dap:next",
  STEP_IN: "dap:stepIn",
  STEP_OUT: "dap:stepOut",
  PAUSE: "dap:pause",
  // ── ADVANCED FLOW ─────────────────────────────────────────
  GOTO_LINE: "dap:gotoLine",
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
  GET_VARIABLES: "dap:variables",
  EVALUATE: "dap:evaluate",
  SET_VARIABLE: "dap:setVariable",
  DISASSEMBLE: "dap:disassemble",
  READ_MEMORY: "dap:readMemory",
  GET_DEBUG_CONTEXT: "dap:getDebugContext",
  // ── HISTORY ───────────────────────────────────────────────
  JUMP_TO_STEP: "dap:jumpToHistoryStep",
  // ── EVENTS PUSHED FROM MAIN TO RENDERER ───────────────────
  EVENT_STOPPED: "debug:stopped",
  EVENT_CONTINUED: "debug:continued",
  EVENT_TERMINATED: "debug:terminated",
  EVENT_OUTPUT: "debug:output"
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
function launchPythonAdapter(scriptPath, port = 5678) {
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
function str(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}
function num(v, fallback = 0) {
  return typeof v === "number" ? v : fallback;
}
function bool(v, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}
function rec(v) {
  return typeof v === "object" && v !== null ? v : {};
}
function isVariable(v) {
  if (typeof v !== "object" || v === null) return false;
  const r = v;
  return typeof r["name"] === "string" && typeof r["value"] === "string";
}
class SessionManager {
  constructor() {
    __publicField(this, "client", new DAPClient());
    __publicField(this, "adapterProcess", null);
    __publicField(this, "threadId", 1);
    __publicField(this, "frameId", 0);
    __publicField(this, "stepCount", 0);
    __publicField(this, "language", "python");
    __publicField(this, "prevVarValues", {});
    __publicField(this, "bpMap", /* @__PURE__ */ new Map());
    __publicField(this, "state", { ...INITIAL_DEBUG_STATE });
    this.wireClientEvents();
  }
  // ── Wire DAP events ───────────────────────────────────────
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
    var _a;
    console.log("[Session] Program terminated");
    this.state.status = "terminated";
    this.pushToRenderer(IPC.EVENT_TERMINATED, null);
    (_a = this.adapterProcess) == null ? void 0 : _a.kill();
  }
  handleExited(body) {
    console.log("[Session] Exited with code", body["exitCode"]);
  }
  // ── Launch ────────────────────────────────────────────────
  async launch(language, scriptPath, breakpointLines = []) {
    this.language = language;
    this.stepCount = 0;
    this.prevVarValues = {};
    this.bpMap = /* @__PURE__ */ new Map();
    this.state = { ...INITIAL_DEBUG_STATE, language, status: "launching" };
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
    } else {
      throw new Error(`Language not yet supported: ${language}`);
    }
    await this.sleep(1e3);
    await this.client.connect("127.0.0.1", port);
    console.log("[Session] DAPClient connected");
    const initBody = await this.client.initialize();
    console.log("[Session] Initialize OK, capabilities:", Object.keys(initBody ?? {}));
    if (language === "python") {
      await this.client.attach("127.0.0.1", port);
    } else if (language === "javascript") {
      await this.client.launch({ program: scriptPath, stopOnEntry: false });
    }
    if (breakpointLines.length > 0) {
      await this.client.setBreakpoints(scriptPath, breakpointLines);
      this.bpMap.set(scriptPath, new Set(breakpointLines));
    }
    await this.client.configurationDone();
    console.log("[Session] ConfigurationDone sent — program running");
    this.state.status = "running";
  }
  // ── Breakpoint management ─────────────────────────────────
  // DAP setBreakpoints is a full replacement per file, never incremental.
  async setBreakpoint(file, line, condition) {
    const lines = this.bpMap.get(file) ?? /* @__PURE__ */ new Set();
    lines.add(line);
    this.bpMap.set(file, lines);
    const conditions = condition ? { [line]: condition } : {};
    const body = await this.client.setBreakpoints(file, [...lines], conditions);
    const dapBps = Array.isArray(body == null ? void 0 : body.breakpoints) ? body.breakpoints : [];
    const updated = [...lines].map((l, i) => {
      const dap = rec(dapBps[i]);
      const existing = this.state.breakpoints.find((b) => b.file === file && b.line === l);
      return {
        id: (existing == null ? void 0 : existing.id) ?? `bp-${file}-${l}`,
        dapId: typeof dap["id"] === "number" ? dap["id"] : void 0,
        file,
        line: l,
        verified: bool(dap["verified"]),
        condition: condition && l === line ? condition : existing == null ? void 0 : existing.condition
      };
    });
    this.state.breakpoints = [
      ...updated,
      ...this.state.breakpoints.filter((b) => b.file !== file)
    ];
  }
  async removeBreakpoint(file, line) {
    const lines = this.bpMap.get(file) ?? /* @__PURE__ */ new Set();
    lines.delete(line);
    this.bpMap.set(file, lines);
    await this.client.setBreakpoints(file, [...lines]);
    this.state.breakpoints = this.state.breakpoints.filter(
      (b) => !(b.file === file && b.line === line)
    );
  }
  // ── Refresh full state after every stop ───────────────────
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
        this.state.sourceLines = fs.readFileSync(this.state.currentFile, "utf8").split("\n");
      } catch {
      }
      this.stepCount++;
      this.recordHistoryEntry(allVars);
      this.state.stepCount = this.stepCount;
    } catch (err) {
      console.error("[Session] refreshFullState failed:", err);
    }
  }
  // ── Fetch variables ───────────────────────────────────────
  async fetchVariables(variablesReference) {
    if (variablesReference === 0) return [];
    try {
      const body = await this.client.variables(variablesReference);
      const raw = Array.isArray(body == null ? void 0 : body.variables) ? body.variables : [];
      return raw.filter(isVariable).map((v) => {
        const hint = rec(v["presentationHint"]);
        return {
          name: str(v["name"]),
          value: str(v["value"]),
          type: str(v["type"], "unknown"),
          variablesReference: num(v["variablesReference"]),
          memoryReference: typeof v["memoryReference"] === "string" ? str(v["memoryReference"]) : void 0,
          expensive: bool(hint["lazy"])
        };
      });
    } catch (err) {
      console.error("[Session] fetchVariables failed for ref", variablesReference, err);
      return [];
    }
  }
  // ── History ───────────────────────────────────────────────
  recordHistoryEntry(vars) {
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
      timestamp: Date.now()
    });
  }
  // ── Step commands ─────────────────────────────────────────
  async stepOver() {
    this.state.status = "running";
    await this.client.next(this.threadId);
  }
  async stepIn() {
    this.state.status = "running";
    await this.client.stepIn(this.threadId);
  }
  async stepOut() {
    this.state.status = "running";
    await this.client.stepOut(this.threadId);
  }
  async continueExecution() {
    this.state.status = "running";
    await this.client.continue(this.threadId);
  }
  async pause() {
    await this.client.request("pause", { threadId: this.threadId });
  }
  async terminate() {
    var _a;
    try {
      await this.client.terminate();
    } catch {
    }
    (_a = this.adapterProcess) == null ? void 0 : _a.kill();
    this.adapterProcess = null;
    this.client.disconnect();
    this.client = new DAPClient();
    this.wireClientEvents();
    this.state = { ...INITIAL_DEBUG_STATE };
    this.state.status = "terminated";
    this.threadId = 1;
    this.frameId = 0;
    this.stepCount = 0;
    this.prevVarValues = {};
    this.bpMap = /* @__PURE__ */ new Map();
  }
  // ── Evaluate / set variable ───────────────────────────────
  async evaluate(expression) {
    try {
      const body = await this.client.evaluate(expression, this.frameId);
      return body != null && typeof body["result"] === "string" ? body["result"] : String((body == null ? void 0 : body["result"]) ?? "");
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
  // ── Memory / disassembly ──────────────────────────────────
  async readMemory(memoryReference, count = 256) {
    return this.client.readMemory(memoryReference, count);
  }
  async disassemble(memoryReference, count = 50) {
    return this.client.disassemble(memoryReference, count);
  }
  // ── AI context (P4) ───────────────────────────────────────
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
  // ── Getters ───────────────────────────────────────────────
  getState() {
    return this.state;
  }
  getClient() {
    return this.client;
  }
  getCurrentFrameId() {
    return this.frameId;
  }
  getCurrentThreadId() {
    return this.threadId;
  }
  // ── Helpers ───────────────────────────────────────────────
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  pushToRenderer(channel, data) {
    for (const win2 of BrowserWindow.getAllWindows()) {
      win2.webContents.send(channel, data);
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
  ipcMain.handle(IPC.SET_BREAKPOINT, async (_, args) => {
    try {
      await session.setBreakpoint(args.file, args.line, args.condition);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });
  ipcMain.handle(IPC.REMOVE_BREAKPOINT, async (_, args) => {
    try {
      await session.removeBreakpoint(args.file, args.line);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
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
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });
  ipcMain.handle(IPC.READ_MEMORY, async (_, args) => session.readMemory(args.memoryReference, args.count));
  ipcMain.handle(IPC.DISASSEMBLE, async (_, args) => session.disassemble(args.memoryReference, args.count));
  ipcMain.handle(IPC.GET_DEBUG_CONTEXT, () => session.getDebugContext());
  const notYet = (day) => async () => ({ success: false, error: `Not implemented until Day ${day}` });
  ipcMain.handle(IPC.GOTO_LINE, notYet(5));
  ipcMain.handle(IPC.RETURN_NOW, notYet(5));
  ipcMain.handle(IPC.DROP_FRAME, notYet(5));
  ipcMain.handle(IPC.JUMP_TO_STEP, notYet(5));
  ipcMain.handle(IPC.SET_METHOD_BP, notYet(6));
  ipcMain.handle(IPC.SET_FIELD_WATCH, notYet(6));
  ipcMain.handle(IPC.SET_EXCEPTION_BP, notYet(6));
  ipcMain.handle(IPC.TOGGLE_GROUP, notYet(6));
  console.log("[IPC] All handlers registered");
}
createRequire(import.meta.url);
const __dirname$1 = path__default.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path__default.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path__default.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path__default.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path__default.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path__default.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path__default.join(__dirname$1, "preload.mjs")
    }
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path__default.join(RENDERER_DIST, "index.html"));
  }
}
app.whenReady().then(() => {
  registerAllHandlers();
  createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
