
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const DB_FILE = path.join(DATA_DIR, "db.json");

export const DEFAULT_CASE_NUMBERING = {
  allowManual: true,
  separator: "-",
  caseTypes: {
    civile: { prefix: "PR-CIV", pad: 4 },
    penale: { prefix: "PR-PEN", pad: 4 },
  },
};

function ensureFS(){
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({
    users:[{id:"1",username:"admin",password:"admin",name:"Amministratore"}],
    studio:{name:"Studio Legale"},
    clients:[], cases:[], deadlines:[], documents:[], activities:[],
    expenses:[], invoices:[], logs:[],
    sequences:{},
    guardianships:[],
    settings:{ caseNumbering: DEFAULT_CASE_NUMBERING }
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
    if (!db.settings) db.settings = { caseNumbering: DEFAULT_CASE_NUMBERING };
    if (!db.settings.caseNumbering) db.settings.caseNumbering = DEFAULT_CASE_NUMBERING;
    else {
      db.settings.caseNumbering = {
        ...DEFAULT_CASE_NUMBERING,
        ...db.settings.caseNumbering,
        caseTypes: {
          ...DEFAULT_CASE_NUMBERING.caseTypes,
          ...(db.settings.caseNumbering.caseTypes || {}),
        },
        allowManual:
          typeof db.settings.caseNumbering.allowManual === "boolean"
            ? db.settings.caseNumbering.allowManual
            : DEFAULT_CASE_NUMBERING.allowManual,
        separator:
          db.settings.caseNumbering.separator || DEFAULT_CASE_NUMBERING.separator,
      };
    }
    if (!db.sequences) db.sequences = {};
    return db;
  } catch(e){
    console.error("Errore lettura DB", e);
    return {
      users:[],
      studio:{},
      clients:[],
      cases:[],
      deadlines:[],
      documents:[],
      activities:[],
      expenses:[],
      invoices:[],
      logs:[],
      sequences:{},
      guardianships:[],
      settings:{ caseNumbering: DEFAULT_CASE_NUMBERING },
    };
  }
}

export let db = loadDB();
export function saveDB(next){
  if (next) db = next;
  ensureFS();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
