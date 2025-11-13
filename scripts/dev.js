import { spawn } from "child_process";

const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

const processes = new Set();
let shuttingDown = false;
let exitCode = 0;

function handleChild(child, description) {
  child.once("exit", (code, signal) => {
    if (!shuttingDown && (code && code !== 0)) {
      console.error(`${description} exited with code ${code}${signal ? ` (signal ${signal})` : ""}`);
    }
    if (!shuttingDown && processes.has(child)) {
      exitCode = code ?? exitCode;
      shutdown(code ?? 0);
    } else {
      processes.delete(child);
    }
  });
  child.once("error", (err) => {
    console.error(`Failed to start ${description}:`, err);
    shutdown(1);
  });
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  exitCode = exitCode || code;
  for (const child of processes) {
    if (child.exitCode == null) {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(exitCode ?? 0), 500);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function runOnce(args, { env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCmd, args, {
      stdio: "inherit",
      shell: false,
      env: { ...process.env, ...env },
    });
    child.once("exit", (code) => {
      if (code && code !== 0) {
        reject(new Error(`Command npm ${args.join(" ")} exited with code ${code}`));
      } else {
        resolve();
      }
    });
    child.once("error", reject);
  });
}

function runPersistent(args, { env = {}, description } = {}) {
  const child = spawn(npmCmd, args, {
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...env },
  });
  processes.add(child);
  handleChild(child, description || `npm ${args.join(" ")}`);
  return child;
}

console.log("📦 Installing backend dependencies...");
await runOnce(["install", "--prefix", "backend"]);
console.log("📦 Installing frontend dependencies...");
await runOnce(["install", "--prefix", "frontend"]);

console.log("🚀 Starting backend server...");
runPersistent(["run", "start", "--prefix", "backend"], {
  env: { NODE_ENV: "development" },
  description: "Backend server",
});

console.log("💻 Launching frontend dev server...");
runPersistent(["run", "dev", "--prefix", "frontend"], {
  env: { NODE_ENV: "development" },
  description: "Frontend dev server",
});

const keepAlive = setInterval(() => {}, 1 << 30);
process.on("exit", () => clearInterval(keepAlive));
