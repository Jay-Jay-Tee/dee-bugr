import require$$0__default from "fs";
import require$$1 from "path";
import { app, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path__default from "node:path";
var main = {};
const fs = require$$0__default;
const path = require$$1;
function log(message) {
  console.log(`[dotenv][DEBUG] ${message}`);
}
const NEWLINE = "\n";
const RE_INI_KEY_VAL = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/;
const RE_NEWLINES = /\\n/g;
const NEWLINES_MATCH = /\r\n|\n|\r/;
function parse(src, options2) {
  const debug = Boolean(options2 && options2.debug);
  const obj = {};
  src.toString().split(NEWLINES_MATCH).forEach(function(line, idx) {
    const keyValueArr = line.match(RE_INI_KEY_VAL);
    if (keyValueArr != null) {
      const key = keyValueArr[1];
      let val = keyValueArr[2] || "";
      const end = val.length - 1;
      const isDoubleQuoted = val[0] === '"' && val[end] === '"';
      const isSingleQuoted = val[0] === "'" && val[end] === "'";
      if (isSingleQuoted || isDoubleQuoted) {
        val = val.substring(1, end);
        if (isDoubleQuoted) {
          val = val.replace(RE_NEWLINES, NEWLINE);
        }
      } else {
        val = val.trim();
      }
      obj[key] = val;
    } else if (debug) {
      log(`did not match key and value when parsing line ${idx + 1}: ${line}`);
    }
  });
  return obj;
}
function config(options2) {
  let dotenvPath = path.resolve(process.cwd(), ".env");
  let encoding = "utf8";
  let debug = false;
  if (options2) {
    if (options2.path != null) {
      dotenvPath = options2.path;
    }
    if (options2.encoding != null) {
      encoding = options2.encoding;
    }
    if (options2.debug != null) {
      debug = true;
    }
  }
  try {
    const parsed = parse(fs.readFileSync(dotenvPath, { encoding }), { debug });
    Object.keys(parsed).forEach(function(key) {
      if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
        process.env[key] = parsed[key];
      } else if (debug) {
        log(`"${key}" is already defined in \`process.env\` and will not be overwritten`);
      }
    });
    return { parsed };
  } catch (e) {
    return { error: e };
  }
}
main.config = config;
main.parse = parse;
const options = {};
if (process.env.DOTENV_CONFIG_ENCODING != null) {
  options.encoding = process.env.DOTENV_CONFIG_ENCODING;
}
if (process.env.DOTENV_CONFIG_PATH != null) {
  options.path = process.env.DOTENV_CONFIG_PATH;
}
if (process.env.DOTENV_CONFIG_DEBUG != null) {
  options.debug = process.env.DOTENV_CONFIG_DEBUG;
}
var envOptions = options;
const re = /^dotenv_config_(encoding|path|debug)=(.+)$/;
var cliOptions = function optionMatcher(args) {
  return args.reduce(function(acc, cur) {
    const matches = cur.match(re);
    if (matches) {
      acc[matches[1]] = matches[2];
    }
    return acc;
  }, {});
};
(function() {
  main.config(
    Object.assign(
      {},
      envOptions,
      cliOptions(process.argv)
    )
  );
})();
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
    title: "Lucid — The Debugger That Explains Itself",
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path__default.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path__default.join(RENDERER_DIST, "index.html"));
  }
}
app.whenReady().then(async () => {
  if (!process.env.DEE_BUGR_GROQ_KEY) {
    console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.warn("⚠  WARNING: DEE_BUGR_GROQ_KEY is not set.");
    console.warn("   AI features (Explain Bug, Suggest Fix, tooltips) will fail.");
    console.warn("   Get a free key at https://console.groq.com");
    console.warn("   Then add to your .env file:  DEE_BUGR_GROQ_KEY=gsk_...");
    console.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } else {
    console.log("[Main] Groq API key found ✓");
  }
  const { registerAllHandlers } = await import("./handlers-DBhTLimF.js");
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
