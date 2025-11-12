
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function ensureFS(){
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({
    users:[{id:"1",username:"admin",password:"admin",name:"Amministratore"}],
    studio:{name:"Studio Legale"},
    clients:[], cases:[], deadlines:[], documents:[], activities:[],
    expenses:[], invoices:[], logs:[], sequences:{case:0, invoice:0},
    guardianships:[]
  }, null, 2));
}

export function loadDB(){
  ensureFS();
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const db = JSON.parse(raw||"{}");
    // alias
    if (!Array.isArray(db.invoices) && Array.isArray(db.fatture)) db.invoices = db.fatture;
    if (!Array.isArray(db.clients)  && Array.isArray(db.clienti))  db.clients  = db.clienti;
    if (!Array.isArray(db.cases)    && Array.isArray(db.casi))     db.cases    = db.casi;
    if (!Array.isArray(db.deadlines)&& Array.isArray(db.scadenze)) db.deadlines= db.scadenze;
    return db;
  } catch(e){
    console.error("Errore lettura DB", e);
    return { users:[], studio:{}, clients:[], cases:[], deadlines:[], documents:[], activities:[], expenses:[], invoices:[], logs:[], sequences:{}, guardianships:[] };
  }
}

export let db = loadDB();
export function saveDB(next){
  if (next) db = next;
  ensureFS();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
