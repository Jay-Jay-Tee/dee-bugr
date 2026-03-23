"use strict";
// src/main/dap/adapters/java.ts
// ─────────────────────────────────────────────────────────────────────────────
// Java DAP adapter via microsoft/java-debug.
//
// SETUP (one-time):
//   git clone https://github.com/microsoft/java-debug.git
//   cd java-debug && mvn package -DskipTests
//   Set env: JAVA_DEBUG_JAR=/path/to/java-debug/com.microsoft.java.debug.plugin/target/com.microsoft.java.debug.plugin-*.jar
//
//   OR install the VS Code Java extension pack — it includes java-debug.
//   Set: JAVA_DEBUG_JAR=~/.vscode/extensions/vscjava.vscode-java-debug-*/server/com.microsoft.java.debug.plugin-*.jar
//
// Compile your Java program:
//   javac -g YourClass.java
//
// Run (java-debug attaches via JDWP):
//   java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=5005 YourClass
// ─────────────────────────────────────────────────────────────────────────────
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchJavaProgram = launchJavaProgram;
exports.launchJavaAdapter = launchJavaAdapter;
exports.buildJavaLaunchArgs = buildJavaLaunchArgs;
exports.buildJavaAttachArgs = buildJavaAttachArgs;
var node_child_process_1 = require("node:child_process");
var net = __importStar(require("node:net"));
var path = __importStar(require("node:path"));
var fs = __importStar(require("node:fs"));
var node_util_1 = require("node:util");
var execAsync = (0, node_util_1.promisify)(node_child_process_1.exec);
function findJavaDebugJar() {
    var _a, _b;
    if (process.env.JAVA_DEBUG_JAR) {
        var p = process.env.JAVA_DEBUG_JAR;
        if (fs.existsSync(p))
            return p;
        // Glob-like: if it ends with *, do a manual scan
        var dir = path.dirname(p);
        var prefix_1 = path.basename(p).replace('*', '');
        if (fs.existsSync(dir)) {
            var match = fs.readdirSync(dir).find(function (f) { return f.startsWith(prefix_1); });
            if (match)
                return path.join(dir, match);
        }
        console.warn('[Java] JAVA_DEBUG_JAR set but not found:', p);
    }
    // VS Code extension install
    var home = (_b = (_a = process.env.HOME) !== null && _a !== void 0 ? _a : process.env.USERPROFILE) !== null && _b !== void 0 ? _b : '';
    var extsDir = path.join(home, '.vscode', 'extensions');
    if (fs.existsSync(extsDir)) {
        var dirs = fs.readdirSync(extsDir).filter(function (d) { return d.startsWith('vscjava.vscode-java-debug-'); });
        for (var _i = 0, _c = dirs.sort().reverse(); _i < _c.length; _i++) {
            var dir = _c[_i];
            var serverDir = path.join(extsDir, dir, 'server');
            if (!fs.existsSync(serverDir))
                continue;
            var jar = fs.readdirSync(serverDir).find(function (f) { return f.startsWith('com.microsoft.java.debug.plugin'); });
            if (jar)
                return path.join(serverDir, jar);
        }
    }
    return null;
}
function getFreePort() {
    return new Promise(function (resolve, reject) {
        var srv = net.createServer();
        srv.listen(0, '127.0.0.1', function () {
            var port = srv.address().port;
            srv.close(function () { return resolve(port); });
        });
        srv.on('error', reject);
    });
}
// ── Launch a Java program with JDWP suspended ─────────────────────────────────
// Returns the child process AND the port to use for DAP attach.
function launchJavaProgram(classOrJar_1, classpath_1) {
    return __awaiter(this, arguments, void 0, function (classOrJar, // e.g. "Main" or "/path/to/app.jar"
    classpath, // e.g. "." or "/path/to/classes:/path/to/lib.jar"
    jdwpPort) {
        var isJar, javaArgs, child;
        var _a, _b;
        if (jdwpPort === void 0) { jdwpPort = 5005; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    isJar = classOrJar.endsWith('.jar');
                    javaArgs = __spreadArray([
                        "-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=127.0.0.1:".concat(jdwpPort)
                    ], (isJar ? ['-jar', classOrJar] : ['-cp', classpath, classOrJar]), true);
                    console.log("[Java] Launching: java ".concat(javaArgs.join(' ')));
                    child = (0, node_child_process_1.spawn)('java', javaArgs, {
                        cwd: path.dirname(isJar ? classOrJar : classpath),
                    });
                    (_a = child.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (d) { return console.log('[java stdout]', d.toString().trim()); });
                    (_b = child.stderr) === null || _b === void 0 ? void 0 : _b.on('data', function (d) {
                        var msg = d.toString().trim();
                        console.log('[java stderr]', msg);
                    });
                    child.on('error', function (err) { return console.error('[Java] Process error:', err); });
                    child.on('exit', function (code) { return console.log('[Java] Exited with code', code); });
                    // Wait briefly for JDWP to come up
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                case 1:
                    // Wait briefly for JDWP to come up
                    _c.sent();
                    return [2 /*return*/, { process: child, port: jdwpPort }];
            }
        });
    });
}
// ── Launch the java-debug DAP adapter server ──────────────────────────────────
// This starts a separate DAP adapter process that bridges from DAP to JDWP.
function launchJavaAdapter() {
    return __awaiter(this, void 0, void 0, function () {
        var jar, port, child;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    jar = findJavaDebugJar();
                    if (!jar) {
                        throw new Error('java-debug JAR not found.\n' +
                            'Clone and build: git clone https://github.com/microsoft/java-debug && cd java-debug && mvn package -DskipTests\n' +
                            'Then set: JAVA_DEBUG_JAR=/path/to/com.microsoft.java.debug.plugin-*.jar');
                    }
                    return [4 /*yield*/, getFreePort()];
                case 1:
                    port = _c.sent();
                    console.log("[Java] Spawning java-debug adapter on port ".concat(port));
                    child = (0, node_child_process_1.spawn)('java', [
                        '-cp', jar,
                        'com.microsoft.java.debug.core.DebugServer',
                        String(port),
                    ]);
                    (_a = child.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (d) { return console.log('[java-debug stdout]', d.toString().trim()); });
                    (_b = child.stderr) === null || _b === void 0 ? void 0 : _b.on('data', function (d) { return console.log('[java-debug stderr]', d.toString().trim()); });
                    child.on('error', function (err) { return console.error('[Java-debug] Adapter error:', err); });
                    // Wait for the adapter to be ready — it prints "Listening on port N" or similar.
                    // Fall back to 2s timeout if no ready message appears.
                    return [4 /*yield*/, new Promise(function (resolve) {
                            var _a, _b;
                            var resolved = false;
                            var done = function () { if (!resolved) {
                                resolved = true;
                                resolve();
                            } };
                            (_a = child.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (d) {
                                if (d.toString().toLowerCase().includes('listening'))
                                    done();
                            });
                            (_b = child.stderr) === null || _b === void 0 ? void 0 : _b.on('data', function (d) {
                                if (d.toString().toLowerCase().includes('listening'))
                                    done();
                            });
                            child.on('exit', done);
                            setTimeout(done, 2000);
                        })];
                case 2:
                    // Wait for the adapter to be ready — it prints "Listening on port N" or similar.
                    // Fall back to 2s timeout if no ready message appears.
                    _c.sent();
                    return [2 /*return*/, { process: child, port: port }];
            }
        });
    });
}
// ── Build DAP launch args for a Java program ─────────────────────────────────
function buildJavaLaunchArgs(opts) {
    var _a;
    return {
        type: 'java',
        request: 'launch',
        name: 'Lucid Java Debug',
        mainClass: opts.mainClass,
        classPaths: opts.classpath.split(':'),
        stopOnEntry: true,
        jdwpPort: (_a = opts.jdwpPort) !== null && _a !== void 0 ? _a : 5005,
    };
}
// ── Build DAP attach args (for attaching to an already-running JDWP process) ─
function buildJavaAttachArgs(jdwpPort) {
    if (jdwpPort === void 0) { jdwpPort = 5005; }
    return {
        type: 'java',
        request: 'attach',
        name: 'Lucid Java Attach',
        hostName: '127.0.0.1',
        port: jdwpPort,
    };
}
