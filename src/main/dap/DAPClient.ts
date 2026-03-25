// src/main/dap/DAPClient.ts
// FIX: initialize() now accepts adapterID parameter (was hardcoded 'python')

import * as net from 'node:net';
import { EventEmitter } from 'node:events';

interface DAPMessage {
  seq: number;
  type: 'request' | 'response' | 'event';
  command?: string;
  event?: string;
  body?: any;
  arguments?: any;
  request_seq?: number;
  success?: boolean;
  message?: string;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  command: string;
}

export class DAPClient extends EventEmitter {
  private seq = 1;
  private socket: net.Socket | null = null;
  private buffer = Buffer.alloc(0);
  private pending = new Map<number, PendingRequest>();
  private connected = false;

  // ── CONNECT ───────────────────────────────────────────────
  connect(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();

      this.socket.on('data', (chunk: Buffer) => {
        this.onData(chunk);
      });

      this.socket.on('error', (err: Error) => {
        console.error('[DAP] Socket error:', err.message);
        this.emit('error', err);
        this.pending.forEach(p => p.reject(err));
        this.pending.clear();
      });

      this.socket.on('close', () => {
        console.log('[DAP] Connection closed');
        this.connected = false;
        this.emit('close');
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
      }, 10000);
    });
  }

  disconnect() {
    this.socket?.destroy();
    this.socket = null;
    this.connected = false;
  }

  // ── SEND A REQUEST ────────────────────────────────────────
  request(command: string, args?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error(`[DAP] Not connected — cannot send ${command}`));
        return;
      }

      const seq = this.seq++;
      const message: DAPMessage = {
        seq,
        type: 'request',
        command,
        arguments: args,
      };

      this.pending.set(seq, { resolve, reject, command });
      this.sendRaw(message);

      setTimeout(() => {
        if (this.pending.has(seq)) {
          this.pending.delete(seq);
          reject(new Error(`[DAP] Request timeout: ${command}`));
        }
      }, 60000);
    });
  }

  // ── SEND RAW MESSAGE ──────────────────────────────────────
  private sendRaw(message: DAPMessage) {
    const json = JSON.stringify(message);
    const length = Buffer.byteLength(json, 'utf8');
    const header = `Content-Length: ${length}\r\n\r\n`;
    const packet = Buffer.concat([
      Buffer.from(header, 'ascii'),
      Buffer.from(json, 'utf8'),
    ]);

    console.log(`[DAP] → ${message.command || message.event} (seq ${message.seq})`);
    this.socket!.write(packet);
  }

  // ── PARSE INCOMING DATA ───────────────────────────────────
  private onData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header = this.buffer.slice(0, headerEnd).toString('ascii');
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(match[1]);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;

      if (this.buffer.length < messageEnd) break;

      const messageJson = this.buffer.slice(messageStart, messageEnd).toString('utf8');
      this.buffer = this.buffer.slice(messageEnd);

      try {
        const message: DAPMessage = JSON.parse(messageJson);
        this.handleMessage(message);
      } catch (e) {
        console.error('[DAP] Failed to parse message:', messageJson.slice(0, 200));
      }
    }
  }

  // ── ROUTE INCOMING MESSAGES ───────────────────────────────
  private handleMessage(message: DAPMessage) {
    if (message.type === 'response') {
      const pending = this.pending.get(message.request_seq!);
      if (pending) {
        this.pending.delete(message.request_seq!);
        if (message.success) {
          console.log(`[DAP] ← ${pending.command} OK`);
          pending.resolve(message.body);
        } else {
          console.error(`[DAP] ← ${pending.command} FAILED:`, message.message);
          pending.reject(new Error(message.message || `DAP error: ${pending.command}`));
        }
      }
    } else if (message.type === 'event') {
      console.log(`[DAP] ← EVENT: ${message.event}`);
      this.emit('event', message);
      this.emit(`event:${message.event}`, message.body);
    }
  }

  // ── CONVENIENCE WRAPPERS ──────────────────────────────────

  // FIX: adapterID is now a parameter, not hardcoded to 'python'
  async initialize(adapterID = 'generic') {
    return this.request('initialize', {
      clientID: 'lucid',
      clientName: 'Lucid Debugger',
      adapterID,
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsVariablePaging: false,
      supportsRunInTerminalRequest: false,
      supportsMemoryReferences: true,
      supportsDataBreakpoints: true,
      supportsDisassembleRequest: true,
      supportsGotoTargetsRequest: true,
      supportsRestartFrame: true,
    });
  }

  async launch(args: {
    program: string;
    cwd?: string;
    args?: string[];
    stopOnEntry?: boolean;
  }) {
    return this.request('launch', {
      ...args,
      stopOnEntry: args.stopOnEntry ?? true,
      justMyCode: false,
      console: 'internalConsole',
    });
  }

  async attach(host: string, port: number, adapterType = 'python') {
    return this.request('attach', {
      type: adapterType,
      request: 'attach',
      name: `Attach to ${adapterType}`,
      connect: { host, port },
      pathMappings: [],
      justMyCode: false,
    });
  }
  

  async setBreakpoints(file: string, lines: number[], conditions?: Record<number, string>) {
    return this.request('setBreakpoints', {
      source: { path: file },
      breakpoints: lines.map(line => ({
        line,
        condition: conditions?.[line],
      })),
    });
  }

  async configurationDone() {
    return this.request('configurationDone');
  }

  async continue(threadId = 1) {
    return this.request('continue', { threadId });
  }

  async next(threadId = 1) {
    return this.request('next', { threadId });
  }

  async stepIn(threadId = 1) {
    return this.request('stepIn', { threadId });
  }

  async stepOut(threadId = 1) {
    return this.request('stepOut', { threadId });
  }

  async stackTrace(threadId = 1) {
    return this.request('stackTrace', { threadId, startFrame: 0, levels: 20 });
  }

  async scopes(frameId: number) {
    return this.request('scopes', { frameId });
  }

  async variables(variablesReference: number) {
    return this.request('variables', {
      variablesReference,
      // Do NOT pass filter:'named' — it skips indexed items (array elements)
      // Omitting filter returns both named and indexed children correctly
    });
  }

  async evaluate(expression: string, frameId: number, context = 'repl') {
    return this.request('evaluate', { expression, frameId, context });
  }

  async setVariable(variablesReference: number, name: string, value: string) {
    return this.request('setVariable', { variablesReference, name, value });
  }

  async disassemble(memoryReference: string, count = 50) {
    return this.request('disassemble', {
      memoryReference,
      offset: 0,
      instructionOffset: 0,   // FIX: was -10, now 0 — start from the actual instruction pointer
      instructionCount: count,
      resolveSymbols: true,
    });
  }

  async readMemory(memoryReference: string, count = 256) {
    return this.request('readMemory', {
      memoryReference,
      offset: 0,
      count,
    });
  }

  async gotoTargets(file: string, line: number) {
    return this.request('gotoTargets', {
      source: { path: file },
      line,
    });
  }

  async goto(targetId: number, threadId = 1) {
    return this.request('goto', { threadId, targetId });
  }

  async restartFrame(frameId: number) {
    return this.request('restartFrame', { frameId });
  }

  async threads() {
    return this.request('threads');
  }

  async terminate() {
    return this.request('terminate');
  }
}