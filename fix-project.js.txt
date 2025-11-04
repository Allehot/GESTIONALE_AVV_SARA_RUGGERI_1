// fix-project.js
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const frontend = path.join(root, "frontend");
const backend = path.join(root, "backend");
const appPath = path.join(frontend, "src", "App.jsx");
const vitePath = path.join(frontend, "vite.config.js");
const serverPath = path.join(backend, "src", "server.js");

// 1) Vite proxy
const viteConfig = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  },
  preview: { port: 4173 }
});
`;
fs.writeFileSync(vitePath, viteConfig, "utf8");
console.log("✔ vite.config.js aggiornato");

// 2) Backend body parser + CORS
let serverJs = fs.readFileSync(serverPath, "utf8");
if (!serverJs.includes('app.use(express.json())')) {
  serverJs = serverJs.replace(
    /const app = express\(\);\s*/m,
    `const app = express();
app.use(require("cors")());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
`
  );
  fs.writeFileSync(serverPath, serverJs, "utf8");
  console.log("✔ server.js: aggiunti CORS e body parser");
} else {
  console.log("ℹ server.js: CORS/body parser già presenti");
}

// 3) Rimuovi i duplicati in App.jsx (mantieni la PRIMA definizione)
function removeSecondUseMemo(src, varName) {
  const re = new RegExp(`const\\s+${varName}\\s*=\\s*useMemo\\s*\\(`, "g");
  const matches = [...src.matchAll(re)];
  if (matches.length < 2) return src;

  // prendi la seconda occorrenza e rimuovi tutto il blocco useMemo fino a ');'
  const second = matches[1].index;
  // cerca arrow => { ... }
  const arrowIdx = src.indexOf("=>", second);
  if (arrowIdx === -1) return src;
  const braceStart = src.indexOf("{", arrowIdx);
  if (braceStart === -1) return src;

  // cammina tra le graffe fino a chiusura del body
  let depth = 1, i = braceStart + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
    i++;
  }
  // cerca la chiusura ');' del useMemo
  let end = src.indexOf(");", i);
  if (end === -1) end = i;
  end += 2;

  return src.slice(0, second) + src.slice(end);
}

let app = fs.readFileSync(appPath, "utf8");
const targets = ["casesById","filteredClients","filteredCases","filteredInvoices","filteredDeadlines"];
targets.forEach(v => {
  const before = app;
  app = removeSecondUseMemo(app, v);
  if (app !== before) console.log(`✔ App.jsx: rimossa seconda dichiarazione di ${v}`);
});
fs.writeFileSync(appPath + ".bak", fs.readFileSync(appPath, "utf8"), "utf8");
fs.writeFileSync(appPath, app, "utf8");

console.log("✅ Patch completata. Avvio consigliato:");
console.log("   1) backend: cd backend && npm install && npm start");
console.log("   2) frontend: cd frontend && npm install && npm run dev");
