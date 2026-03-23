"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAPClient = void 0;
// src/main/dap/DAPClient.ts
var net = __importStar(require("node:net"));
var node_events_1 = require("node:events");
var DAPClient = /** @class */ (function (_super) {
    __extends(DAPClient, _super);
    function DAPClient() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.seq = 1;
        _this.socket = null;
        _this.buffer = Buffer.alloc(0);
        _this.pending = new Map();
        _this.connected = false;
        return _this;
    }
    // ── CONNECT ───────────────────────────────────────────────
    DAPClient.prototype.connect = function (host, port) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.socket = new net.Socket();
            _this.socket.on('data', function (chunk) {
                _this.onData(chunk);
            });
            _this.socket.on('error', function (err) {
                console.error('[DAP] Socket error:', err.message);
                _this.emit('error', err);
                // Reject all pending requests
                _this.pending.forEach(function (p) { return p.reject(err); });
                _this.pending.clear();
            });
            _this.socket.on('close', function () {
                console.log('[DAP] Connection closed');
                _this.connected = false;
                _this.emit('close');
            });
            _this.socket.connect(port, host, function () {
                console.log("[DAP] Connected to ".concat(host, ":").concat(port));
                _this.connected = true;
                resolve();
            });
            // Timeout after 10 seconds
            setTimeout(function () {
                if (!_this.connected) {
                    reject(new Error("[DAP] Connection timeout to ".concat(host, ":").concat(port)));
                }
            }, 10000);
        });
    };
    DAPClient.prototype.disconnect = function () {
        var _a;
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.destroy();
        this.socket = null;
        this.connected = false;
    };
    // ── SEND A REQUEST ────────────────────────────────────────
    // This is the core method. Everything else calls this.
    DAPClient.prototype.request = function (command, args) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (!_this.socket || !_this.connected) {
                reject(new Error("[DAP] Not connected \u2014 cannot send ".concat(command)));
                return;
            }
            var seq = _this.seq++;
            var message = {
                seq: seq,
                type: 'request',
                command: command,
                arguments: args,
            };
            _this.pending.set(seq, { resolve: resolve, reject: reject, command: command });
            _this.sendRaw(message);
            // Timeout individual requests after 30 seconds
            setTimeout(function () {
                if (_this.pending.has(seq)) {
                    _this.pending.delete(seq);
                    reject(new Error("[DAP] Request timeout: ".concat(command)));
                }
            }, 30000);
        });
    };
    // ── SEND RAW MESSAGE ──────────────────────────────────────
    DAPClient.prototype.sendRaw = function (message) {
        var json = JSON.stringify(message);
        var length = Buffer.byteLength(json, 'utf8');
        var header = "Content-Length: ".concat(length, "\r\n\r\n");
        var packet = Buffer.concat([
            Buffer.from(header, 'ascii'),
            Buffer.from(json, 'utf8'),
        ]);
        console.log("[DAP] \u2192 ".concat(message.command || message.event, " (seq ").concat(message.seq, ")"));
        this.socket.write(packet);
    };
    // ── PARSE INCOMING DATA ───────────────────────────────────
    // DAP uses length-prefixed framing. Packets can be split
    // across multiple TCP chunks so we buffer and reassemble.
    DAPClient.prototype.onData = function (chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (true) {
            // Look for Content-Length header
            var headerEnd = this.buffer.indexOf('\r\n\r\n');
            if (headerEnd === -1)
                break; // incomplete header
            var header = this.buffer.slice(0, headerEnd).toString('ascii');
            var match = header.match(/Content-Length:\s*(\d+)/i);
            if (!match) {
                // Malformed — discard and try to recover
                this.buffer = this.buffer.slice(headerEnd + 4);
                continue;
            }
            var contentLength = parseInt(match[1]);
            var messageStart = headerEnd + 4;
            var messageEnd = messageStart + contentLength;
            // Not enough data yet — wait for more chunks
            if (this.buffer.length < messageEnd)
                break;
            // Extract and parse the message
            var messageJson = this.buffer.slice(messageStart, messageEnd).toString('utf8');
            this.buffer = this.buffer.slice(messageEnd);
            try {
                var message = JSON.parse(messageJson);
                this.handleMessage(message);
            }
            catch (e) {
                console.error('[DAP] Failed to parse message:', messageJson.slice(0, 200));
            }
        }
    };
    // ── ROUTE INCOMING MESSAGES ───────────────────────────────
    DAPClient.prototype.handleMessage = function (message) {
        if (message.type === 'response') {
            var pending = this.pending.get(message.request_seq);
            if (pending) {
                this.pending.delete(message.request_seq);
                if (message.success) {
                    console.log("[DAP] \u2190 ".concat(pending.command, " OK"));
                    pending.resolve(message.body);
                }
                else {
                    console.error("[DAP] \u2190 ".concat(pending.command, " FAILED:"), message.message);
                    pending.reject(new Error(message.message || "DAP error: ".concat(pending.command)));
                }
            }
        }
        else if (message.type === 'event') {
            console.log("[DAP] \u2190 EVENT: ".concat(message.event));
            // Emit the event so DAPSession can handle it
            this.emit('event', message);
            this.emit("event:".concat(message.event), message.body);
        }
    };
    // ── CONVENIENCE WRAPPERS ──────────────────────────────────
    // Use these instead of request() directly
    DAPClient.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('initialize', {
                        clientID: 'lucid',
                        clientName: 'Lucid Debugger',
                        adapterID: 'python',
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
                    })];
            });
        });
    };
    DAPClient.prototype.launch = function (args) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                return [2 /*return*/, this.request('launch', __assign(__assign({}, args), { stopOnEntry: (_a = args.stopOnEntry) !== null && _a !== void 0 ? _a : true, justMyCode: false, console: 'internalConsole' }))];
            });
        });
    };
    DAPClient.prototype.attach = function (host_1, port_1) {
        return __awaiter(this, arguments, void 0, function (host, port, adapterType) {
            if (adapterType === void 0) { adapterType = 'python'; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('attach', {
                        type: adapterType,
                        request: 'attach',
                        name: "Attach to ".concat(adapterType),
                        connect: { host: host, port: port },
                        pathMappings: [],
                        justMyCode: false,
                    })];
            });
        });
    };
    DAPClient.prototype.setBreakpoints = function (file, lines, conditions) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('setBreakpoints', {
                        source: { path: file },
                        breakpoints: lines.map(function (line) { return ({
                            line: line,
                            condition: conditions === null || conditions === void 0 ? void 0 : conditions[line],
                        }); }),
                    })];
            });
        });
    };
    DAPClient.prototype.configurationDone = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('configurationDone')];
            });
        });
    };
    DAPClient.prototype.continue = function () {
        return __awaiter(this, arguments, void 0, function (threadId) {
            if (threadId === void 0) { threadId = 1; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('continue', { threadId: threadId })];
            });
        });
    };
    DAPClient.prototype.next = function () {
        return __awaiter(this, arguments, void 0, function (threadId) {
            if (threadId === void 0) { threadId = 1; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('next', { threadId: threadId })];
            });
        });
    };
    DAPClient.prototype.stepIn = function () {
        return __awaiter(this, arguments, void 0, function (threadId) {
            if (threadId === void 0) { threadId = 1; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('stepIn', { threadId: threadId })];
            });
        });
    };
    DAPClient.prototype.stepOut = function () {
        return __awaiter(this, arguments, void 0, function (threadId) {
            if (threadId === void 0) { threadId = 1; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('stepOut', { threadId: threadId })];
            });
        });
    };
    DAPClient.prototype.stackTrace = function () {
        return __awaiter(this, arguments, void 0, function (threadId) {
            if (threadId === void 0) { threadId = 1; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('stackTrace', { threadId: threadId, startFrame: 0, levels: 20 })];
            });
        });
    };
    DAPClient.prototype.scopes = function (frameId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('scopes', { frameId: frameId })];
            });
        });
    };
    DAPClient.prototype.variables = function (variablesReference) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('variables', {
                        variablesReference: variablesReference,
                        filter: 'named',
                    })];
            });
        });
    };
    DAPClient.prototype.evaluate = function (expression_1, frameId_1) {
        return __awaiter(this, arguments, void 0, function (expression, frameId, context) {
            if (context === void 0) { context = 'repl'; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('evaluate', { expression: expression, frameId: frameId, context: context })];
            });
        });
    };
    DAPClient.prototype.setVariable = function (variablesReference, name, value) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('setVariable', { variablesReference: variablesReference, name: name, value: value })];
            });
        });
    };
    DAPClient.prototype.disassemble = function (memoryReference_1) {
        return __awaiter(this, arguments, void 0, function (memoryReference, count) {
            if (count === void 0) { count = 50; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('disassemble', {
                        memoryReference: memoryReference,
                        offset: 0,
                        instructionOffset: -10,
                        instructionCount: count,
                        resolveSymbols: true,
                    })];
            });
        });
    };
    DAPClient.prototype.readMemory = function (memoryReference_1) {
        return __awaiter(this, arguments, void 0, function (memoryReference, count) {
            if (count === void 0) { count = 256; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('readMemory', {
                        memoryReference: memoryReference,
                        offset: 0,
                        count: count,
                    })];
            });
        });
    };
    DAPClient.prototype.gotoTargets = function (file, line) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('gotoTargets', {
                        source: { path: file },
                        line: line,
                    })];
            });
        });
    };
    DAPClient.prototype.goto = function (targetId_1) {
        return __awaiter(this, arguments, void 0, function (targetId, threadId) {
            if (threadId === void 0) { threadId = 1; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('goto', { threadId: threadId, targetId: targetId })];
            });
        });
    };
    DAPClient.prototype.restartFrame = function (frameId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('restartFrame', { frameId: frameId })];
            });
        });
    };
    DAPClient.prototype.threads = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('threads')];
            });
        });
    };
    DAPClient.prototype.terminate = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('terminate')];
            });
        });
    };
    return DAPClient;
}(node_events_1.EventEmitter));
exports.DAPClient = DAPClient;
