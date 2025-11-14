#!/usr/bin/env node
const { spawn } = require("child_process");
const { copyFileSync, existsSync } = require("fs");
const { join, resolve, dirname } = require("path");

const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

const processes = new Set();
let shuttingDown = false;
let exitCode = 0;

function locateRepoRoot() {
  const candidates = [];
  const cwd = process.cwd();
  candidates.push(cwd);

  if (!process.pkg) {
    candidates.push(resolve(__dirname, ".."));
  } else {
    const execDir = dirname(process.execPath);
    candidates.unshift(execDir);
    candidates.unshift(resolve(execDir, ".."));
  }

  for (const candidate of candidates) {
    if (
      existsSync(join(candidate, "backend", "package.json")) &&
      existsSync(join(candidate, "frontend", "package.json"))
    ) {
      return candidate;
    }
  }

  return null;
}

const repoRoot = locateRepoRoot();
if (!repoRoot) {
  console.error(
    "❌ Impossibile trovare la cartella del progetto. Avvia l'eseguibile dalla cartella che contiene backend/ e frontend/."
  );
  process.exit(1);
}

process.chdir(repoRoot);

function handleChild(child, description) {
  child.once("exit", (code, signal) => {
    if (!shuttingDown && (code && code !== 0)) {
      console.error(
        `${description} exited with code ${code}${signal ? ` (signal ${signal})` : ""}`
      );
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
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(npmCmd, args, {
      stdio: "inherit",
      shell: false,
      env: { ...process.env, ...env },
    });
    child.once("exit", (code) => {
      if (code && code !== 0) {
        rejectPromise(new Error(`Command npm ${args.join(" ")} exited with code ${code}`));
      } else {
        resolvePromise();
      }
    });
    child.once("error", rejectPromise);
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

async function ensureDependencies(dir, description) {
  const packageLock = join(dir, "package-lock.json");
  const nodeModules = join(dir, "node_modules");
  const hasLockfile = existsSync(packageLock);
  const hasNodeModules = existsSync(nodeModules);

  if (!hasNodeModules) {
    const command = hasLockfile ? "ci" : "install";
    console.log(`📦 Installing ${description} dependencies...`);
    await runOnce([command, "--prefix", dir]);
  } else {
    console.log(`✅ ${description} dependencies already installed.`);
  }
}

function ensureEnvFile(dir) {
  const envFile = join(dir, ".env");
  const exampleEnvFile = join(dir, ".env.example");
  if (!existsSync(envFile) && existsSync(exampleEnvFile)) {
    copyFileSync(exampleEnvFile, envFile);
    console.log(`📝 Copied ${dir}/.env from .env.example.`);
  }
}

(async () => {
  await ensureDependencies("backend", "backend");
  ensureEnvFile("backend");
  await ensureDependencies("frontend", "frontend");
  ensureEnvFile("frontend");

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
})();
