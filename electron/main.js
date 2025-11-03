const { app, BrowserWindow, dialog, nativeImage } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow = null;
let backendProcess = null;

function startBackend() {
  const isPackaged = app.isPackaged;
  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";

  // percorso del server.js nel progetto
  const backendPath = isPackaged
    ? path.join(process.resourcesPath, "backend", "src", "server.js")
    : path.join(__dirname, "..", "backend", "src", "server.js");

  console.log("[electron] backendPath:", backendPath);

  let child;

  if (!isPackaged) {
    // SVILUPPO: usiamo node installato
    child = spawn("node", [backendPath], {
      stdio: "inherit"
    });
  } else {
    // PACKAGED
    if (isMac) {
      // su mac possiamo usare process.execPath
      child = spawn(process.execPath, [backendPath], {
        stdio: "inherit"
      });
    } else if (isWin) {
      // su Windows packato: per ora NON rilanciamo il backend,
      // altrimenti re-lancia l'exe e va in loop.
      console.log("[electron] Windows packato: salta auto-backend. Avviare backend a parte.");
      return;
    } else {
      // linux
      child = spawn(process.execPath, [backendPath], {
        stdio: "inherit"
      });
    }
  }

  child.on("error", (err) => {
    console.error("[electron] Errore avviando il backend:", err);
    dialog.showErrorBox("Errore backend", err.message);
  });

  backendProcess = child;
}

function createWindow() {
  const isPackaged = app.isPackaged;

  // icona opzionale
  const iconPath = isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "icon.png");

  let winIcon;
  try {
    winIcon = nativeImage.createFromPath(iconPath);
  } catch (e) {}

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: winIcon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isPackaged) {
    const indexPath = path.join(process.resourcesPath, "dist", "index.html");
    mainWindow.loadFile(indexPath);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "frontend", "dist", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackend();
  setTimeout(() => {
    createWindow();
  }, 1000);
});

app.on("window-all-closed", () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
