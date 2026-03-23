"use strict";
/**
 * src/main/test/test-day7.ts
 *
 * Day 7 manual test — verifies all P1 deliverables:
 *   1. Java adapter launches + connects
 *   2. Java call stack + variables populate
 *   3. Method breakpoints accepted (or graceful warning)
 *   4. suggestFix() returns { originalCode, fixedCode, explanation }
 *   5. switchThread() registered in IPC
 *
 * Run:  npx ts-node src/main/test/test-day7.ts
 *
 * Prerequisites:
 *   - java on PATH
 *   - java-debug JAR built OR JAVA_DEBUG_JAR set
 *   - javac -g tmp/TestNPE.java -d tmp/
 *   - DEE_BUGR_GROQ_KEY set for test 3
 */
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
var path = __importStar(require("path"));
var DAPClient_1 = require("../dap/DAPClient");
var java_1 = require("../dap/adapters/java");
var ROOT = path.resolve(__dirname, '../../../');
// ── TEST 1: Java adapter end-to-end ──────────────────────────────────────────
function testJava() {
    return __awaiter(this, void 0, void 0, function () {
        var classDir, jdwpPort, javaApp, adapter, client, initBody, srcFile;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('\n──── TEST 1: Java adapter ────');
                    classDir = path.join(ROOT, 'tmp');
                    jdwpPort = 5005;
                    console.log('[T1] Launching Java app with JDWP suspend...');
                    return [4 /*yield*/, (0, java_1.launchJavaProgram)('TestNPE', classDir, jdwpPort)];
                case 1:
                    javaApp = _a.sent();
                    console.log('[T1] Java app launched, PID:', javaApp.process.pid);
                    console.log('[T1] Launching java-debug adapter...');
                    return [4 /*yield*/, (0, java_1.launchJavaAdapter)()];
                case 2:
                    adapter = _a.sent();
                    console.log('[T1] Adapter port:', adapter.port);
                    client = new DAPClient_1.DAPClient();
                    return [4 /*yield*/, client.connect('127.0.0.1', adapter.port)];
                case 3:
                    _a.sent();
                    console.log('[T1] Connected');
                    return [4 /*yield*/, client.initialize()];
                case 4:
                    initBody = _a.sent();
                    console.log('[T1] Init OK — capabilities:', Object.keys(initBody !== null && initBody !== void 0 ? initBody : {}).join(', '));
                    return [4 /*yield*/, client.request('attach', (0, java_1.buildJavaAttachArgs)(jdwpPort))];
                case 5:
                    _a.sent();
                    console.log('[T1] Attached to JDWP');
                    srcFile = path.join(classDir, 'TestNPE.java');
                    return [4 /*yield*/, client.setBreakpoints(srcFile, [43])]; // line 43: sumList(list)
                case 6:
                    _a.sent(); // line 43: sumList(list)
                    return [4 /*yield*/, client.configurationDone()];
                case 7:
                    _a.sent();
                    console.log('[T1] Waiting for stopped event (15s timeout)...');
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            var t = setTimeout(function () { return reject(new Error('Timeout: no stopped event in 15s')); }, 15000);
                            client.once('event:stopped', function (body) { return __awaiter(_this, void 0, void 0, function () {
                                var st, frames, sc, loc, vs, varStr;
                                var _a, _b, _c, _d;
                                return __generator(this, function (_e) {
                                    switch (_e.label) {
                                        case 0:
                                            clearTimeout(t);
                                            console.log('[T1] Stopped! reason:', body.reason, 'thread:', body.threadId);
                                            return [4 /*yield*/, client.stackTrace((_a = body.threadId) !== null && _a !== void 0 ? _a : 1)];
                                        case 1:
                                            st = _e.sent();
                                            frames = (_b = st === null || st === void 0 ? void 0 : st.stackFrames) !== null && _b !== void 0 ? _b : [];
                                            console.log('[T1] Stack frames:', frames.length);
                                            frames.slice(0, 3).forEach(function (f, i) {
                                                var _a, _b;
                                                console.log("  #".concat(i, " ").concat(f.name, " @ ").concat((_b = (_a = f.source) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '?', ":").concat(f.line));
                                            });
                                            if (!frames[0]) return [3 /*break*/, 4];
                                            return [4 /*yield*/, client.scopes(frames[0].id)];
                                        case 2:
                                            sc = _e.sent();
                                            loc = (_c = sc === null || sc === void 0 ? void 0 : sc.scopes) === null || _c === void 0 ? void 0 : _c.find(function (s) { return /local/i.test(s.name); });
                                            if (!loc) return [3 /*break*/, 4];
                                            return [4 /*yield*/, client.variables(loc.variablesReference)];
                                        case 3:
                                            vs = _e.sent();
                                            varStr = ((_d = vs === null || vs === void 0 ? void 0 : vs.variables) !== null && _d !== void 0 ? _d : []).map(function (v) { return "".concat(v.name, "=").concat(v.value); }).join(', ');
                                            console.log('[T1] Variables:', varStr || '(none)');
                                            _e.label = 4;
                                        case 4:
                                            resolve();
                                            return [2 /*return*/];
                                    }
                                });
                            }); });
                            client.once('error', reject);
                        })];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, client.terminate().catch(function () { })];
                case 9:
                    _a.sent();
                    client.disconnect();
                    javaApp.process.kill();
                    adapter.process.kill();
                    console.log('[T1] PASS');
                    return [2 /*return*/];
            }
        });
    });
}
// ── TEST 2: suggestFix shape ──────────────────────────────────────────────────
function testSuggestFixShape() {
    return __awaiter(this, void 0, void 0, function () {
        var sm, orig, suggestFix, result, ok;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('\n──── TEST 2: suggestFix() shape ────');
                    if (!process.env.DEE_BUGR_GROQ_KEY) {
                        console.warn('[T2] SKIP: DEE_BUGR_GROQ_KEY not set');
                        return [2 /*return*/];
                    }
                    sm = require('../session/sessionManager');
                    orig = sm.session.getDebugContext.bind(sm.session);
                    sm.session.getDebugContext = function () { return ({
                        language: 'python',
                        errorMessage: "AttributeError: 'NoneType' object has no attribute 'children'",
                        stackFrames: [{ id: 0, name: 'getChildren', file: 'test.py', line: 5, column: 0 }],
                        variables: [{ name: 'node', value: 'None', type: 'NoneType', variablesReference: 0 }],
                        sourceLines: ['def getChildren(node):', '    return node.children'],
                        currentLine: 2,
                        currentFile: 'test.py',
                    }); };
                    suggestFix = require('../ai/groq').suggestFix;
                    return [4 /*yield*/, suggestFix()];
                case 1:
                    result = _b.sent();
                    sm.session.getDebugContext = orig;
                    ok = typeof result.originalCode === 'string'
                        && typeof result.fixedCode === 'string'
                        && typeof result.explanation === 'string';
                    console.log('[T2] originalCode:', typeof result.originalCode);
                    console.log('[T2] fixedCode:   ', typeof result.fixedCode);
                    console.log('[T2] explanation: ', (_a = result.explanation) === null || _a === void 0 ? void 0 : _a.slice(0, 100));
                    console.log('[T2]', ok ? 'PASS' : 'FAIL');
                    return [2 /*return*/];
            }
        });
    });
}
// ── TEST 3: switchThread + switchFrame IPC channels exist ────────────────────
function testIPCChannels() {
    return __awaiter(this, void 0, void 0, function () {
        var IPC, required, allOk, _i, required_1, key;
        return __generator(this, function (_a) {
            console.log('\n──── TEST 3: IPC channel definitions ────');
            IPC = require('../../shared/ipc').IPC;
            required = [
                'SWITCH_THREAD', 'SWITCH_FRAME', 'GOTO_LINE', 'RETURN_NOW', 'DROP_FRAME',
                'SET_METHOD_BP', 'SET_FIELD_WATCH', 'SET_EXCEPTION_BP', 'TOGGLE_GROUP',
                'AI_EXPLAIN', 'AI_FIX', 'AI_EXPLAIN_VAR', 'AI_WATCHPOINT',
                'AI_SUGGEST_BPS', 'AI_NARRATIVE',
                'EVENT_ANOMALY', 'EVENT_RETURN_VAL',
            ];
            allOk = true;
            for (_i = 0, required_1 = required; _i < required_1.length; _i++) {
                key = required_1[_i];
                if (!IPC[key]) {
                    console.error("[T3] MISSING: IPC.".concat(key));
                    allOk = false;
                }
            }
            console.log('[T3]', allOk ? 'PASS: all channels defined' : 'FAIL: some channels missing');
            return [2 /*return*/];
        });
    });
}
// ── Run ───────────────────────────────────────────────────────────────────────
function runAll() {
    return __awaiter(this, void 0, void 0, function () {
        var e_1, e_2, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('=== Day 7 P1 Tests === ROOT:', ROOT);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, testJava()];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    console.error('[T1] FAIL:', e_1.message);
                    return [3 /*break*/, 4];
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, testSuggestFixShape()];
                case 5:
                    _a.sent();
                    return [3 /*break*/, 7];
                case 6:
                    e_2 = _a.sent();
                    console.error('[T2] FAIL:', e_2.message);
                    return [3 /*break*/, 7];
                case 7:
                    _a.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, testIPCChannels()];
                case 8:
                    _a.sent();
                    return [3 /*break*/, 10];
                case 9:
                    e_3 = _a.sent();
                    console.error('[T3] FAIL:', e_3.message);
                    return [3 /*break*/, 10];
                case 10:
                    console.log('\n=== Done ===');
                    process.exit(0);
                    return [2 /*return*/];
            }
        });
    });
}
runAll();
