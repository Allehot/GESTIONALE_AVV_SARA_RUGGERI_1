// ======================================================
// Gestionale Studio Legale - Avv. Sara Ruggeri
// server.js - versione completa
// ======================================================

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "http://localhost:5173", credentials: false }));
app.use(express.json());
// ======= ALIAS ITALIANI PER LE API (compat layer) =======
const itToEnMaps = [
  { it: '/api/clienti',    en: '/api/clients' },
  { it: '/api/casi',       en: '/api/cases' },
  { it: '/api/scadenze',   en: '/api/deadlines' },
  { it: '/api/fatture',    en: '/api/invoices' },
  { it: '/api/documenti',  en: '/api/documents' },

  // export/import “gruppi”
  { it: '/api/export/clienti',  en: '/api/export/clients' },
  { it: '/api/export/casi',     en: '/api/export/cases' },
  { it: '/api/export/fatture',  en: '/api/export/invoices' },
  { it: '/api/export/scadenze', en: '/api/export/deadlines' },

  { it: '/api/import/clienti',  en: '/api/import/clients' },
  { it: '/api/import/casi',     en: '/api/import/cases' },
  { it: '/api/import/fatture',  en: '/api/import/invoices' },
];

// middleware generico: riscrive l’URL se inizia con un prefisso IT
app.use((req, _res, next) => {
  for (const { it, en } of itToEnMaps) {
    if (req.url.startsWith(it)) {
      req.url = en + req.url.slice(it.length);
      break;
    }
  }
  next();
});

// --- Alias specifici utili (se il frontend li usa in IT) ---
// ICS scadenze (IT -> EN)
app.get('/api/scadenze/ics', (req, res, next) => {
  req.url = '/api/deadlines/ics';
  next();
});

// PDF fattura (IT -> EN)
app.get('/api/fatture/:id/pdf', (req, res, next) => {
  req.url = `/api/invoices/${req.params.id}/pdf`;
  next();
});

// Scadenze di una pratica (IT -> EN)
app.post('/api/casi/:id/scadenze', (req, res, next) => {
  req.url = `/api/cases/${req.params.id}/deadlines`;
  next();
});

// Log pratica (IT -> EN, GET e POST)
app.get('/api/casi/:id/logs', (req, res, next) => {
  req.url = `/api/cases/${req.params.id}/logs`;
  next();
});
app.post('/api/casi/:id/logs', (req, res, next) => {
  req.url = `/api/cases/${req.params.id}/logs`;
  next();
});

// --- Alias per report con nomi italiani usati nel frontend ---
app.get('/api/reports/recenti', (req, res, next) => {
  req.url = '/api/reports/upcoming-deadlines';
  next();
});
app.get('/api/reports/mesi', (req, res, next) => {
  req.url = '/api/reports/monthly';
  next();
});
// ======= FINE ALIAS ITALIANI =======

// ------------------------------------------------------
// CARTELLE E DB
// ------------------------------------------------------
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function loadDB() {
  const file = path.join(dataDir, "db.json");
  if (!fs.existsSync(file)) {
    return {
      users: [
        { id: "1", username: "admin", password: "admin", name: "Amministratore" }
      ],
      studio: {
           name: "Studio Legale Avv. Sara Ruggeri",
        address: "Pavullo nel Frignano (MO)",
        vatNumber: "03840750362",
        fiscalCode: "RGGSRA91M60G393B",
        email: "avv.sararuggeri@gmail.com",
	Pec: "Sara.ruggeri@ordineavvmodena.it",
        phone: "+39 3926061553",
	Fax:"+39 053622584",
        cassaPerc: 4,
        ivaPerc: 22,
        ritenutaPerc: 20,
        bollo: 2.0,
        logoPath: "/assets/logo-studio.png"
      },
      clients: [],
      cases: [],
      deadlines: [],
      guardianships: [],
      documents: [],
      activities: [],
      expenses: [],
      invoices: [],
      logs: [],
      sequences: { case: 1, invoice: 1 }
    };
  }
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function saveDB(db) {
  const file = path.join(dataDir, "db.json");
  fs.writeFileSync(file, JSON.stringify(db, null, 2), "utf-8");
}

let db = loadDB();

if (!Array.isArray(db.guardianships)) {
  db.guardianships = [];
}

db.guardianships.forEach(ensureGuardianCollections);

// ------------------------------------------------------
// UPLOAD
// ------------------------------------------------------
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ------------------------------------------------------
// UTILITY
// ------------------------------------------------------
function getNextCaseNumber() {
  const year = new Date().getFullYear();
  db.sequences.case = (db.sequences.case || 0) + 1;
  return `PR-${year}-${String(db.sequences.case).padStart(4, "0")}`;
}

function getNextInvoiceNumber() {
  const year = new Date().getFullYear();
  db.sequences.invoice = (db.sequences.invoice || 0) + 1;
  return `FAT-${year}-${String(db.sequences.invoice).padStart(4, "0")}`;
}

function calcInvoiceTotals(lines, studio, withRitenuta = true) {
  let imponibile = 0;
  (lines || []).forEach(l => {
    imponibile += Number(l.amount || 0);
  });
  const cassa = studio.cassaPerc ? +(imponibile * (studio.cassaPerc / 100)).toFixed(2) : 0;
  const baseIva = imponibile + cassa;
  const iva = studio.ivaPerc ? +(baseIva * (studio.ivaPerc / 100)).toFixed(2) : 0;
  const ritenuta = withRitenuta && studio.ritenutaPerc ? +(imponibile * (studio.ritenutaPerc / 100)).toFixed(2) : 0;
  let totale = baseIva + iva - ritenuta;
  let bollo = 0;
  if (totale > 77.47 && studio.bollo) {
    bollo = studio.bollo;
    totale += bollo;
  }
  return {
    imponibile: +imponibile.toFixed(2),
    cassa,
    iva,
    ritenuta,
    bollo,
    totale: +totale.toFixed(2)
  };
}

// mappa i tipi tecnici → nomi “umani” in fattura
function prettyLineType(t) {
  if (!t) return "";
  const tt = t.toLowerCase();
  if (tt === "activity") return "Attività";
  if (tt === "expense") return "Spese sostenute";
  if (tt === "manual") return "Concordato";
  return t;
}

function escapeICSText(value) {
  if (value === undefined || value === null) return "";
  return value
    .toString()
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldICSLine(line) {
  const maxLength = 74;
  if (Buffer.byteLength(line, "utf8") <= maxLength) return [line];
  const result = [];
  let remaining = line;
  while (Buffer.byteLength(remaining, "utf8") > maxLength) {
    let slice = "";
    let bytes = 0;
    let i = 0;
    while (i < remaining.length && bytes < maxLength) {
      const char = remaining[i];
      const charBytes = Buffer.byteLength(char, "utf8");
      if (bytes + charBytes > maxLength) break;
      slice += char;
      bytes += charBytes;
      i += 1;
    }
    if (!slice) {
      slice = remaining.slice(0, maxLength);
      i = maxLength;
    }
    result.push(slice);
    remaining = " " + remaining.slice(i);
  }
  result.push(remaining);
  return result;
}

function formatICSTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function parseDateToUTC(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateToICS(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function addDaysUTC(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

// aggiunge una riga di cronostoria
function addLog({ caseId, action, detail }) {
  const logItem = {
    id: uuidv4(),
    caseId: caseId || null,
    action: action || "",
    detail: detail || "",
    createdAt: new Date().toISOString()
  };
  db.logs = db.logs || [];
  db.logs.push(logItem);
  saveDB(db);
  return logItem;
}

function applyGuardianFields(base, source = {}) {
  const fields = [
    "birthDate",
    "fiscalCode",
    "residence",
    "status",
    "supportLevel",
    "court",
    "judge",
    "decreeDate",
    "nextReportDue",
    "reportingFrequency",
    "lastReportSent",
    "income",
    "healthNotes",
    "socialServicesContact",
    "familyContacts",
    "notes"
  ];
  const multiline = new Set(["familyContacts", "healthNotes", "notes"]);
  const result = { ...base };
  fields.forEach(field => {
    if (!Object.prototype.hasOwnProperty.call(source, field)) {
      return;
    }
    if (field === "status") {
      result.status = sanitizeGuardianStatus(source[field], base.status);
      return;
    }
    const raw = cleanString(source[field]);
    result[field] = multiline.has(field) ? raw : raw.trim();
  });
  return result;
}

function cleanString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return value.toString();
}

function sanitizeGuardianStatus(value, fallback = "attivo") {
  const allowed = new Set(["attivo", "chiuso", "archiviato", "in revisione", "sospeso"]);
  const raw = cleanString(value, fallback).trim().toLowerCase();
  if (!raw) {
    return fallback || "attivo";
  }
  if (allowed.has(raw)) {
    return raw;
  }
  return raw;
}

const guardianCollectionKeys = [
  "documents",
  "assetInventory",
  "financialMovements",
  "reports",
  "courtFilings"
];

function ensureGuardianCollections(guardian) {
  if (!guardian) return guardian;
  guardianCollectionKeys.forEach(key => {
    if (!Array.isArray(guardian[key])) {
      guardian[key] = [];
    }
  });
  return guardian;
}

function cloneGuardian(guardian) {
  if (!guardian) return null;
  ensureGuardianCollections(guardian);
  return {
    ...guardian,
    documents: guardian.documents.map(doc => ({ ...doc })),
    assetInventory: guardian.assetInventory.map(item => ({ ...item })),
    financialMovements: guardian.financialMovements.map(move => ({ ...move })),
    reports: guardian.reports.map(report => ({ ...report })),
    courtFilings: guardian.courtFilings.map(filing => ({ ...filing }))
  };
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function guardianWithDerived(guardian) {
  if (!guardian) return null;
  const copy = cloneGuardian(guardian);
  const movements = copy.financialMovements || [];
  const totals = movements.reduce(
    (acc, move) => {
      const type = cleanString(move.type).trim().toLowerCase();
      const amount = toNumber(move.amount, 0);
      if (type === "entrata") acc.income += amount;
      if (type === "uscita") acc.expense += amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );
  const balance = totals.income - totals.expense;

  const assetsValue = (copy.assetInventory || []).reduce(
    (sum, asset) => sum + toNumber(asset.value, 0),
    0
  );

  const deliveredReports = (copy.reports || []).filter(report => {
    const status = cleanString(report.status).trim().toLowerCase();
    return status === "consegnato" || status === "depositato" || !!report.deliveredAt;
  });
  deliveredReports.sort((a, b) => {
    const aDate = new Date(a.deliveredAt || a.periodEnd || a.periodStart || 0).getTime();
    const bDate = new Date(b.deliveredAt || b.periodEnd || b.periodStart || 0).getTime();
    return bDate - aDate;
  });
  const lastReport = deliveredReports.length > 0 ? deliveredReports[0] : null;
  const pendingReports = Math.max((copy.reports || []).length - deliveredReports.length, 0);

  copy.financialSummary = {
    totalIncome: roundCurrency(totals.income),
    totalExpense: roundCurrency(totals.expense),
    balance: roundCurrency(balance)
  };

  copy.assetSummary = {
    totalItems: (copy.assetInventory || []).length,
    totalValue: roundCurrency(assetsValue)
  };

  copy.documentsSummary = {
    totalDocuments: (copy.documents || []).length
  };

  copy.reportingSummary = {
    totalReports: (copy.reports || []).length,
    deliveredReports: deliveredReports.length,
    pendingReports,
    lastDeliveredAt: lastReport ? lastReport.deliveredAt || lastReport.periodEnd || lastReport.periodStart || null : null
  };

  copy.filingsSummary = {
    totalFilings: (copy.courtFilings || []).length
  };

  return copy;
}

function touchGuardian(guardian) {
  if (!guardian) return;
  guardian.updatedAt = new Date().toISOString();
}

function sanitizeMovementType(value) {
  const normalized = cleanString(value).trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "income" || normalized === "entrate") return "entrata";
  if (normalized === "expense" || normalized === "uscite") return "uscita";
  if (normalized === "entrata" || normalized === "uscita") return normalized;
  return null;
}

function sanitizeReportStatus(value, fallback = "in preparazione") {
  const normalized = cleanString(value, fallback).trim().toLowerCase();
  if (!normalized) return fallback;
  const map = new Map([
    ["consegnato", "consegnato"],
    ["depositato", "depositato"],
    ["inviato", "inviato"],
    ["programmato", "programmato"],
    ["in preparazione", "in preparazione"],
    ["bozza", "bozza"],
    ["approvato", "approvato"]
  ]);
  if (map.has(normalized)) {
    return map.get(normalized);
  }
  return normalized;
}

function getGuardianOrRespond(res, guardianId) {
  const guardian = db.guardianships.find(g => g.id === guardianId);
  if (!guardian) {
    res.status(404).json({ message: "Amministrato non trovato" });
    return null;
  }
  ensureGuardianCollections(guardian);
  return guardian;
}

function respondWithGuardian(res, guardian, status = 200) {
  return res.status(status).json(guardianWithDerived(guardian));
}

// ------------------------------------------------------
// AUTH (demo)
// ------------------------------------------------------
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ message: "Credenziali non valide" });
  res.json({ token: "demo-token", user: { id: user.id, name: user.name } });
});

// ------------------------------------------------------
// STUDIO (dati fattura)
// ------------------------------------------------------
app.get("/api/studio", (req, res) => {
  res.json(db.studio);
});

app.put("/api/studio", (req, res) => {
  db.studio = { ...db.studio, ...req.body };
  saveDB(db);
  res.json(db.studio);
});

// ------------------------------------------------------
// CLIENTI
// ------------------------------------------------------
app.get("/api/clients", (req, res) => {
  res.json(db.clients);
});

app.post("/api/clients", (req, res) => {
  const id = uuidv4();
  const client = {
    id,
    name: req.body.name || "",
    fiscalCode: req.body.fiscalCode || "",
    vatNumber: req.body.vatNumber || "",
    email: req.body.email || "",
    pec: req.body.pec || "",
    phone: req.body.phone || "",
    address: req.body.address || "",
    notes: req.body.notes || ""
  };
  db.clients.push(client);
  saveDB(db);
  res.status(201).json(client);
});

app.put("/api/clients/:id", (req, res) => {
  const idx = db.clients.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "Cliente non trovato" });
  db.clients[idx] = { ...db.clients[idx], ...req.body };
  saveDB(db);
  res.json(db.clients[idx]);
});

app.delete("/api/clients/:id", (req, res) => {
  const id = req.params.id;
  const idx = db.clients.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ message: "Cliente non trovato" });

  const hasCases = db.cases.some(c => c.clientId === id);
  const hasInvoices = db.invoices.some(i => i.clientId === id);
  if (hasCases || hasInvoices) {
    return res.status(400).json({ message: "Impossibile eliminare: cliente collegato a pratiche o fatture" });
  }

  const removed = db.clients.splice(idx, 1)[0];
  saveDB(db);
  res.json(removed);
});

app.get("/api/clients/:id", (req, res) => {
  const cl = db.clients.find(c => c.id === req.params.id);
  if (!cl) return res.status(404).json({ message: "Cliente non trovato" });
  const clientCases = db.cases.filter(c => c.clientId === cl.id);
  const clientInvoices = db.invoices.filter(i => i.clientId === cl.id);
  res.json({ ...cl, cases: clientCases, invoices: clientInvoices });
});

// ------------------------------------------------------
// AMMINISTRATI DI SOSTEGNO
// ------------------------------------------------------
app.get("/api/guardianships", (req, res) => {
  const search = (req.query.search || "").toString().trim().toLowerCase();
  let items = Array.isArray(db.guardianships) ? [...db.guardianships] : [];
  if (search) {
    items = items.filter(g => {
      const fields = [
        g.fullName,
        g.fiscalCode,
        g.judge,
        g.court,
        g.socialServicesContact,
        g.familyContacts
      ]
        .filter(Boolean)
        .map(v => v.toString().toLowerCase());
      return fields.some(v => v.includes(search));
    });
  }
  items.sort((a, b) => {
    const aa = (a.fullName || "").toLowerCase();
    const bb = (b.fullName || "").toLowerCase();
    if (aa < bb) return -1;
    if (aa > bb) return 1;
    return 0;
  });
  res.json(items.map(guardianWithDerived));
});

app.post("/api/guardianships", (req, res) => {
  const fullName = (req.body.fullName || "").toString().trim();
  if (!fullName) {
    return res.status(400).json({ message: "Il nome dell'amministrato è obbligatorio" });
  }
  const now = new Date().toISOString();
  const guardian = applyGuardianFields(
    {
      id: uuidv4(),
      fullName,
      birthDate: "",
      fiscalCode: "",
      residence: "",
      status: "attivo",
      supportLevel: "",
      court: "",
      judge: "",
      decreeDate: "",
      nextReportDue: "",
      reportingFrequency: "",
      lastReportSent: "",
      income: "",
      healthNotes: "",
      socialServicesContact: "",
      familyContacts: "",
      notes: "",
      documents: [],
      assetInventory: [],
      financialMovements: [],
      reports: [],
      courtFilings: [],
      createdAt: now,
      updatedAt: now
    },
    req.body
  );
  guardian.fullName = fullName;
  guardian.createdAt = now;
  guardian.updatedAt = now;
  ensureGuardianCollections(guardian);
  db.guardianships.push(guardian);
  saveDB(db);
  respondWithGuardian(res, guardian, 201);
});

app.get("/api/guardianships/:id", (req, res) => {
  const guardian = getGuardianOrRespond(res, req.params.id);
  if (!guardian) return;
  respondWithGuardian(res, guardian);
});

app.put("/api/guardianships/:id", (req, res) => {
  const idx = db.guardianships.findIndex(g => g.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ message: "Amministrato non trovato" });
  }
  const current = db.guardianships[idx];
  const fullName = req.body.fullName ? req.body.fullName.toString().trim() : current.fullName;
  if (!fullName) {
    return res.status(400).json({ message: "Il nome dell'amministrato è obbligatorio" });
  }
  const now = new Date().toISOString();
  const updated = applyGuardianFields(current, req.body);
  updated.fullName = fullName;
  updated.id = current.id;
  updated.createdAt = current.createdAt || updated.createdAt || now;
  updated.updatedAt = now;
  ensureGuardianCollections(updated);
  db.guardianships[idx] = updated;
  saveDB(db);
  respondWithGuardian(res, updated);
});

app.delete("/api/guardianships/:id", (req, res) => {
  const idx = db.guardianships.findIndex(g => g.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ message: "Amministrato non trovato" });
  }
  const removed = db.guardianships.splice(idx, 1)[0];
  saveDB(db);
  res.json(removed);
});

// ------------------------------------------------------
// DOCUMENTI AMMINISTRATO
// ------------------------------------------------------
app.post("/api/guardianships/:id/documents", (req, res) => {
  const guardian = getGuardianOrRespond(res, req.params.id);
  if (!guardian) return;
  const title = cleanString(req.body.title || "").trim();
  if (!title) {
    return res.status(400).json({ message: "Il titolo del documento è obbligatorio" });
  }
  const now = new Date().toISOString();
  const doc = {
    id: uuidv4(),
    title,
    category: cleanString(req.body.category || "").trim(),
    date: cleanString(req.body.date || "").trim(),
    reference: cleanString(req.body.reference || "").trim(),
    link: cleanString(req.body.link || "").trim(),
    notes: cleanString(req.body.notes || ""),
    createdAt: now,
    updatedAt: now
  };
  guardian.documents.push(doc);
  touchGuardian(guardian);
  saveDB(db);
  respondWithGuardian(res, guardian, 201);
});

app.put("/api/guardianships/:id/documents/:docId", (req, res) => {
  const guardian = getGuardianOrRespond(res, req.params.id);
  if (!guardian) return;
  const idx = guardian.documents.findIndex(d => d.id === req.params.docId);
  if (idx === -1) {
    return res.status(404).json({ message: "Documento non trovato" });
  }
  const current = guardian.documents[idx];
  const title = cleanString(req.body.title !== undefined ? req.body.title : current.title).trim();
  if (!title) {
    return res.status(400).json({ message: "Il titolo del documento è obbligatorio" });
  }
  const now = new Date().toISOString();
  guardian.documents[idx] = {
    ...current,
    title,
    category: cleanString(req.body.category !== undefined ? req.body.category : current.category).trim(),
    date: cleanString(req.body.date !== undefined ? req.body.date : current.date).trim(),
    reference: cleanString(req.body.reference !== undefined ? req.body.reference : current.reference).trim(),
    link: cleanString(req.body.link !== undefined ? req.body.link : current.link).trim(),
    notes: cleanString(req.body.notes !== undefined ? req.body.notes : current.notes),
    updatedAt: now
  };
  touchGuardian(guardian);
  saveDB(db);
  respondWithGuardian(res, guardian);
});

app.delete("/api/guardianships/:id/documents/:docId", (req, res) => {
  const guardian = getGuardianOrRespond(res, req.params.id);
  if (!guardian) return;
  const idx = guardian.documents.findIndex(d => d.id === req.params.docId);
  if (idx === -1) {
    return res.status(404).json({ message: "Documento non trovato" });
  }
  guardian.documents.splice(idx, 1);
  touchGuardian(guardian);
  saveDB(db);
  respondWithGuardian(res, guardian);
});

// ------------------------------------------------------
// INVENTARIO BENI
// ------------------------------------------------------
app.post("/api/guardianships/:id/inventory", (req, res) => {
  const guardian = getGuardianOrRespond(res, req.params.id);
  if (!guardian) return;
  const label = cleanString(req.body.label || "").trim();
  if (!label) {
    return res.status(400).json({ message: "La descrizione del bene è obbligatoria" });
  }
  const now = new Date().toISOString();
  const quantity = toNumber(req.body.quantity, 1) || 1;
  const value = roundCurrency(toNumber(req.body.value, 0));
  const item = {
    id: uuidv4(),
    label,
    category: cleanString(req.body.category || "").trim(),
    location: cleanString(req.body.location || "").trim(),
    quantity,
    value,
    notes: cleanString(req.body.notes || ""),
    createdAt: now,
    updatedAt: now
  };
  guardian.assetInventory.push(item);
  touchGuardian(guardian);
  saveDB(db);
  respondWithGuardian(res, guardian, 201);
});

app.put("/api/guardianships/:id/inventory/:itemId", (req, res) => {
  const guardian = getGuardianOrRespond(res, req.params.id);
  if (!guardian) return;
  const idx = guardian.assetInventory.findIndex(i => i.id === req.params.itemId);
  if (idx === -1) {
    return res.status(404).json({ message: "Voce di inventario non trovata" });
  }
  const current = guardian.assetInventory[idx];
  const label = cleanString(req.body.label !== undefined ? req.body.label : current.label).trim();
  if (!label) {
    return res.status(400).json({ message: "La descrizione del bene è obbligatoria" });
  }
  const now = new Date().toISOString();
  const quantity = req.body.quantity !== undefined ? toNumber(req.body.quantity, current.quantity || 1) : current.quantity || 1;
  const value = req.body.value !== undefined ? roundCurrency(toNumber(req.body.value, current.value || 0)) : roundCurrency(current.value || 0);
  guardian.assetInventory[idx] = {
    ...current,
    label,
    category: cleanString(req.body.category !== undefined ? req.body.category : current.category).trim(),
    location: cleanString(req.body.location !== undefined ? req.body.location : current.location).trim(),
    quantity,
    value,
    notes: cleanString(req.body.notes !== undefined ? req.body.notes : current.notes),
    updatedAt: now
  };
  touchGuardian(guardian);
  saveDB(db);
  respondWithGuardian(res, guardian);
});

app.delete("/api/guardianships/:id/inventory/:itemId", (req, res) => {
  const guardian = getGuardianOrRespond(res, req.params.id);
  if (!guardian) return;
  const idx = guardian.assetInventory.findIndex(i => i.id === req.params.itemId);
  if (idx === -1) {
    return res.status(404).json({ message: "Voce di inventario non trovata" });
  }
  guardian.assetInventory.splice(idx, 1);
  touchGuardian(guardian);
  saveDB(db);
  respondWithGuardian(res, guardian);
});

// ------------------------------------------------------
// MOVIMENTI ECONOMICI
// ------------------------------------------------------
app.post("/api/guardianships/:id/movements", (req, res) => {
  const guardian = getGuardianOrRespond(res, req.params.id);
  if (!guardian) return;
  const type = sanitizeMovementType(req.body.type || "");
  if (!type) {
    return res.status(400).json({ message: "Specificare se la voce è un'entrata o un'uscita" });
  }
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount)) {
    return res.status(400).json({ message: "Importo non valido" });
  }
  const now = new Date().toISOString();
  const movement = {
    id: uuidv4(),
    type,
    amount: roundCurrency(amount),
    date: cleanString(req.body.date || "").trim(),
    category: cleanString(req.body.category || "").trim(),
    description: cleanString(req.body.description || "").trim(),
    reference: cleanString(req.body.reference || "").trim(),
    notes: cleanString(req.body.notes || ""),
    createdAt: now,
    updatedAt: now
  };
  guardian.financialMovements.push(movement);
  touchGuardian(guardian);
  saveDB(db);
  respondWithGuardian(res, guardian, 201);
});

app.put("/api/guardianships/:id/movements/:movementId", (req, res) => {
  const guardian = getGuardianOrRespond(res, req.params.id);
  if (!guardian) return;
  const idx = guardian.financialMovements.findIndex(m => m.id === req.params.movementId);
  if (idx === -1) {
    return res.status(404).json({ message: "Movimento non trovato" });
  }
  const current = guardian.financialMovements[idx];
  const type = sanitizeMovementType(req.body.type !== undefined ? req.body.type : current.type);
  if (!type) {
    return res.status(400).json({ message: "Specificare se la voce è un'entrata o un'uscita" });
  }
  const amountSource = req.body.amount !== undefined ? Number(req.body.amount) : Number(current.amount);
  if (!Number.isFinite(amountSource)) {
    return res.status(400).json({ message: "Importo non valido" });
  }
  const now = new Date().toISOString();
  guardian.financialMovements[idx] = {
    ...current,
    type,
    amount: roundCurrency(amountSource),
    date: cleanString(req.body.date !== undefined ? req.body.date : current.date).trim(),
    category: cleanString(req.body.category !== undefined ? req.body.category : current.category).trim(),
    description: cleanString(req.body.description !== undefined ? req.body.description : current.description).trim(),
    reference: cleanString(req.body.reference !== undefined ? req.body.reference : current.reference).trim(),
    notes: cleanString(req.body.notes !== undefined ? req.body.notes : current.notes),
    updatedAt: now
  };
  touchGuardian(guardian);
  saveDB(db);
  respondWithGuardian(res, guardian);
});

app.delete("/api/guardianships/:id/movements/:movementId", (req, res) => {
  const guardian = getGuardianOrRespond(res, req.params.id);
  if (!guardian) return;
  const idx = guardian.financialMovements.findIndex(m => m.id === req.params.movementId);
  if (idx === -1) {
    return res.status(404).json({ message: "Movimento non trovato" });
  }
  guardian.financialMovements.splice(idx, 1);
  touchGuardian(guardian);
  saveDB(db);
  respondWithGuardian(res, guardian);
});

// ------------------------------------------------------
// RENDICONTI
// ------------------------------------------------------
app.post("/api/guardianships/:id/reports", (req, res) => {
  const guardian = getGuardianOrRespond(res, req.params.id);
  if (!guardian) return;
  const title = cleanString(req.body.title || "").trim();
  if (!title) {
    return res.status(400).json({ message: "Il titolo del rendiconto è obbligatorio" });
  }
  const now = new Date().toISOString();
  const report = {
    id: uuidv4(),
    title,
    periodStart: cleanString(req.body.periodStart || "").trim(),
    periodEnd: cleanString(req.body.periodEnd || "").trim(),
    deliveredAt: cleanString(req.body.deliveredAt || "").trim(),
    status: sanitizeReportStatus(req.body.status || "in preparazione"),
    protocol: cleanString(req.body.protocol || "").trim(),
    attachment: cleanString(req.body.attachment || "").trim(),
    summary: cleanString(req.body.summary || ""),
    notes: cleanString(req.body.notes || ""),
    createdAt: now,
    updatedAt: now
  };
  guardian.reports.push(report);
  touchGuardian(guardian);
  saveDB(db);
  respondWithGuardian(res, guardian, 201);
});

app.put("/api/guardianships/:id/reports/:reportId", (req, res) => {
  const guardian = getGuardianOrRespond(res, req.params.id);
  if (!guardian) return;
  const idx = guardian.reports.findIndex(r => r.id === req.params.reportId);
  if (idx === -1) {
    return res.status(404).json({ message: "Rendiconto non trovato" });
  }
  const current = guardian.reports[idx];
  const title = cleanString(req.body.title !== undefined ? req.body.title : current.title).trim();
  if (!title) {
    return res.status(400).json({ message: "Il titolo del rendiconto è obbligatorio" });
  }
  const now = new Date().toISOString();
  guardian.reports[idx] = {
    ...current,
    title,
    periodStart: cleanString(req.body.periodStart !== undefined ? req.body.periodStart : current.periodStart).trim(),
    periodEnd: cleanString(req.body.periodEnd !== undefined ? req.body.periodEnd : current.periodEnd).trim(),
    deliveredAt: cleanString(req.body.deliveredAt !== undefined ? req.body.deliveredAt : current.deliveredAt).trim(),
    status: sanitizeReportStatus(req.body.status !== undefined ? req.body.status : current.status),
    protocol: cleanString(req.body.protocol !== undefined ? req.body.protocol : current.protocol).trim(),
    attachment: cleanString(req.body.attachment !== undefined ? req.body.attachment : current.attachment).trim(),
    summary: cleanString(req.body.summary !== undefined ? req.body.summary : current.summary),
    notes: cleanString(req.body.notes !== undefined ? req.body.notes : current.notes),
    updatedAt: now
  };
  touchGuardian(guardian);
  saveDB(db);
  respondWithGuardian(res, guardian);
});

app.delete("/api/guardianships/:id/reports/:reportId", (req, res) => {
  const guardian = getGuardianOrRespond(res, req.params.id);
  if (!guardian) return;
  const idx = guardian.reports.findIndex(r => r.id === req.params.reportId);
  if (idx === -1) {
    return res.status(404).json({ message: "Rendiconto non trovato" });
  }
  guardian.reports.splice(idx, 1);
  touchGuardian(guardian);
  saveDB(db);
  respondWithGuardian(res, guardian);
});

// ------------------------------------------------------
// DEPOSITI TELEMATICI
// ------------------------------------------------------
app.post("/api/guardianships/:id/filings", (req, res) => {
  const guardian = getGuardianOrRespond(res, req.params.id);
  if (!guardian) return;
  const subject = cleanString(req.body.subject || "").trim();
  if (!subject) {
    return res.status(400).json({ message: "L'oggetto del deposito è obbligatorio" });
  }
  const now = new Date().toISOString();
  const filing = {
    id: uuidv4(),
    subject,
    date: cleanString(req.body.date || "").trim(),
    channel: cleanString(req.body.channel || "PCT").trim() || "PCT",
    registry: cleanString(req.body.registry || "").trim(),
    protocol: cleanString(req.body.protocol || "").trim(),
    outcome: cleanString(req.body.outcome || "").trim(),
    attachment: cleanString(req.body.attachment || "").trim(),
    notes: cleanString(req.body.notes || ""),
    createdAt: now,
    updatedAt: now
  };
  guardian.courtFilings.push(filing);
  touchGuardian(guardian);
  saveDB(db);
  respondWithGuardian(res, guardian, 201);
});

app.put("/api/guardianships/:id/filings/:filingId", (req, res) => {
  const guardian = getGuardianOrRespond(res, req.params.id);
  if (!guardian) return;
  const idx = guardian.courtFilings.findIndex(f => f.id === req.params.filingId);
  if (idx === -1) {
    return res.status(404).json({ message: "Deposito non trovato" });
  }
  const current = guardian.courtFilings[idx];
  const subject = cleanString(req.body.subject !== undefined ? req.body.subject : current.subject).trim();
  if (!subject) {
    return res.status(400).json({ message: "L'oggetto del deposito è obbligatorio" });
  }
  const now = new Date().toISOString();
  guardian.courtFilings[idx] = {
    ...current,
    subject,
    date: cleanString(req.body.date !== undefined ? req.body.date : current.date).trim(),
    channel: cleanString(req.body.channel !== undefined ? req.body.channel : current.channel).trim() || "PCT",
    registry: cleanString(req.body.registry !== undefined ? req.body.registry : current.registry).trim(),
    protocol: cleanString(req.body.protocol !== undefined ? req.body.protocol : current.protocol).trim(),
    outcome: cleanString(req.body.outcome !== undefined ? req.body.outcome : current.outcome).trim(),
    attachment: cleanString(req.body.attachment !== undefined ? req.body.attachment : current.attachment).trim(),
    notes: cleanString(req.body.notes !== undefined ? req.body.notes : current.notes),
    updatedAt: now
  };
  touchGuardian(guardian);
  saveDB(db);
  respondWithGuardian(res, guardian);
});

app.delete("/api/guardianships/:id/filings/:filingId", (req, res) => {
  const guardian = getGuardianOrRespond(res, req.params.id);
  if (!guardian) return;
  const idx = guardian.courtFilings.findIndex(f => f.id === req.params.filingId);
  if (idx === -1) {
    return res.status(404).json({ message: "Deposito non trovato" });
  }
  guardian.courtFilings.splice(idx, 1);
  touchGuardian(guardian);
  saveDB(db);
  respondWithGuardian(res, guardian);
});

// ------------------------------------------------------
// PRATICHE
// ------------------------------------------------------
app.get("/api/cases", (req, res) => {
  const { search, clientId, status, type } = req.query;
  let items = db.cases;
  if (search) {
    const s = search.toLowerCase();
    items = items.filter(c =>
      (c.subject && c.subject.toLowerCase().includes(s)) ||
      (c.number && c.number.toLowerCase().includes(s)) ||
      (c.rgNumber && c.rgNumber.toLowerCase().includes(s))
    );
  }
  if (clientId) items = items.filter(c => c.clientId === clientId);
  if (status) items = items.filter(c => c.status === status);
  if (type) items = items.filter(c => c.caseType === type);

  const result = items.map(c => {
    const cli = c.clientId ? db.clients.find(cl => cl.id === c.clientId) : null;
    return {
      ...c,
      clientName: cli ? cli.name : null
    };
  });

  res.json(result);
});

app.post("/api/cases", (req, res) => {
  const id = uuidv4();
  const now = new Date().toISOString();
  const legalCase = {
    id,
    number: req.body.number || getNextCaseNumber(),
    clientId: req.body.clientId || null,
    subject: req.body.subject || "",
    court: req.body.court || "",
    section: req.body.section || "",
    judge: req.body.judge || "",
    rgNumber: req.body.rgNumber || "",
    caseType: req.body.caseType || "civile",
    proceedingType: req.body.proceedingType || "stragiudiziale", // giudiziale/stragiudiziale
    status: req.body.status || "aperta",
    value: req.body.value || 0,
    notes: req.body.notes || "",
    createdAt: now
  };
  db.cases.push(legalCase);
  addLog({
    caseId: id,
    action: "creazione-pratica",
    detail: `Creata pratica: ${legalCase.number} - ${legalCase.subject}`
  });
  saveDB(db);
  res.status(201).json(legalCase);
});

app.get("/api/cases/:id", (req, res) => {
  const c = db.cases.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ message: "Pratica non trovata" });
  const client = c.clientId ? db.clients.find(cl => cl.id === c.clientId) : null;
  const deadlines = db.deadlines.filter(d => d.caseId === c.id);
  const documents = db.documents.filter(d => d.caseId === c.id);
  const activities = db.activities.filter(a => a.caseId === c.id);
  const expenses = db.expenses.filter(e => e.caseId === c.id);
  const invoices = db.invoices.filter(i => i.caseId === c.id);
  const totalTime = activities.reduce((s, a) => s + (a.minutes || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalInvoices = invoices.reduce((s, i) => s + ((i.totals && i.totals.totale) || 0), 0);
  res.json({
    ...c,
    client,
    deadlines,
    documents,
    activities,
    expenses,
    invoices,
    summary: { totalMinutes: totalTime, totalExpenses, totalInvoices }
  });
});

app.put("/api/cases/:id", (req, res) => {
  const idx = db.cases.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "Pratica non trovata" });
  db.cases[idx] = { ...db.cases[idx], ...req.body };
  addLog({
    caseId: db.cases[idx].id,
    action: "modifica-pratica",
    detail: "Pratica modificata"
  });
  saveDB(db);
  res.json(db.cases[idx]);
});

app.delete("/api/cases/:id", (req, res) => {
  const id = req.params.id;
  const idx = db.cases.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ message: "Pratica non trovata" });

  // cancella anche le entità figlie
  db.deadlines = db.deadlines.filter(d => d.caseId !== id);
  db.activities = db.activities.filter(a => a.caseId !== id);
  db.expenses = db.expenses.filter(a => a.caseId !== id);
  db.documents = db.documents.filter(a => a.caseId !== id);
  // le fatture le lasciamo ma le scolleghiamo
  db.invoices = db.invoices.map(i => i.caseId === id ? { ...i, caseId: null } : i);

  const removed = db.cases.splice(idx, 1)[0];
  addLog({
    caseId: id,
    action: "pratica-eliminata",
    detail: removed.subject
  });
  saveDB(db);
  res.json(removed);
});

// ------------------------------------------------------
// CRONOSTORIA DI PRATICA
// ------------------------------------------------------
app.get("/api/cases/:id/logs", (req, res) => {
  const caseId = req.params.id;
  const items = (db.logs || [])
    .filter(l => l.caseId === caseId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(items);
});

// nota manuale
app.post("/api/cases/:id/logs", (req, res) => {
  const caseId = req.params.id;
  const legCase = db.cases.find(c => c.id === caseId);
  if (!legCase) return res.status(404).json({ message: "Pratica non trovata" });
  const { detail } = req.body;
  const log = addLog({
    caseId,
    action: "nota-manuale",
    detail: detail || "Nota"
  });
  res.status(201).json(log);
});

// ------------------------------------------------------
// SCADENZE / UDIENZE / TERMINI
// ------------------------------------------------------
app.get("/api/deadlines", (req, res) => {
  const { from, to, caseId } = req.query;
  let items = db.deadlines;
  if (caseId) items = items.filter(d => d.caseId === caseId);
  if (from) items = items.filter(d => d.date >= from);
  if (to) items = items.filter(d => d.date <= to);
  res.json(items);
});

app.get("/api/deadlines/ics", (req, res) => {
  const deadlines = (db.deadlines || []).filter(d => d.date).sort((a, b) => a.date.localeCompare(b.date));
  const casesById = new Map((db.cases || []).map(c => [c.id, c]));
  const now = new Date();
  const lines = [];
  const pushLine = line => {
    foldICSLine(line).forEach(l => lines.push(l));
  };

  pushLine("BEGIN:VCALENDAR");
  pushLine("VERSION:2.0");
  pushLine("PRODID:-//Gestionale Studio Legale//Calendario Scadenze//IT");
  pushLine("CALSCALE:GREGORIAN");
  pushLine("METHOD:PUBLISH");
  pushLine(`X-WR-CALNAME:${escapeICSText(db.studio && db.studio.name ? `${db.studio.name} - Scadenze` : "Scadenze Studio")}`);
  pushLine("X-WR-TIMEZONE:Europe/Rome");

  deadlines.forEach(deadline => {
    const startDate = parseDateToUTC(deadline.date);
    if (!startDate) return;
    const endDate = addDaysUTC(startDate, 1);
    const caseInfo = casesById.get(deadline.caseId);
    const summaryParts = [];
    if (deadline.type) summaryParts.push(deadline.type.charAt(0).toUpperCase() + deadline.type.slice(1));
    if (deadline.description) summaryParts.push(deadline.description);
    const summary = summaryParts.length ? summaryParts.join(" - ") : "Scadenza";
    const descriptionParts = [];
    if (deadline.description) descriptionParts.push(deadline.description);
    const typeLabel = deadline.type
      ? deadline.type.charAt(0).toUpperCase() + deadline.type.slice(1)
      : "Scadenza";
    descriptionParts.push(`Tipo: ${typeLabel}`);
    if (caseInfo) {
      descriptionParts.push(`${caseInfo.number || ""} ${caseInfo.subject || ""}`.trim());
      if (caseInfo.clientName) descriptionParts.push(`Cliente: ${caseInfo.clientName}`);
    }
    if (deadline.assignedTo) descriptionParts.push(`Assegnato a: ${deadline.assignedTo}`);
    const description = descriptionParts.join("\n");

    pushLine("BEGIN:VEVENT");
    pushLine(`UID:${escapeICSText(deadline.id)}@gestionestudio`);
    pushLine(`DTSTAMP:${formatICSTimestamp(now)}`);
    pushLine(`DTSTART;VALUE=DATE:${formatDateToICS(startDate)}`);
    pushLine(`DTEND;VALUE=DATE:${formatDateToICS(endDate)}`);
    pushLine(`SUMMARY:${escapeICSText(summary)}`);
    if (description) pushLine(`DESCRIPTION:${escapeICSText(description)}`);
    pushLine("END:VEVENT");
  });

  pushLine("END:VCALENDAR");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", "inline; filename=\"scadenze-studio.ics\"");
  res.send(lines.join("\r\n") + "\r\n");
});

app.post("/api/cases/:id/deadlines", (req, res) => {
  const caseId = req.params.id;
  const legCase = db.cases.find(x => x.id === caseId);
  if (!legCase) return res.status(404).json({ message: "Pratica non trovata" });
  const id = uuidv4();
  const deadline = {
    id,
    caseId,
    date: req.body.date,
    description: req.body.description || "",
    type: req.body.type || "scadenza",
    assignedTo: req.body.assignedTo || null
  };
  db.deadlines.push(deadline);
  addLog({
    caseId,
    action: "scadenza-creata",
    detail: `${deadline.type}: ${deadline.date} - ${deadline.description}`
  });
  saveDB(db);
  res.status(201).json(deadline);
});

app.put("/api/deadlines/:id", (req, res) => {
  const idx = db.deadlines.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "Scadenza non trovata" });
  db.deadlines[idx] = { ...db.deadlines[idx], ...req.body };
  addLog({
    caseId: db.deadlines[idx].caseId,
    action: "scadenza-modificata",
    detail: `${db.deadlines[idx].type}: ${db.deadlines[idx].date} - ${db.deadlines[idx].description}`
  });
  saveDB(db);
  res.json(db.deadlines[idx]);
});

app.delete("/api/deadlines/:id", (req, res) => {
  const idx = db.deadlines.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "Scadenza non trovata" });
  const removed = db.deadlines.splice(idx, 1)[0];
  addLog({
    caseId: removed.caseId,
    action: "scadenza-eliminata",
    detail: removed.description
  });
  saveDB(db);
  res.json(removed);
});

// PDF mensile scadenze
app.get("/api/deadlines/month/pdf", (req, res) => {
  const { year, month } = req.query;
  const studio = db.studio;
  const now = new Date();
  const y = year ? Number(year) : now.getFullYear();
  const m = month ? Number(month) : (now.getMonth() + 1);
  const monthStr = m.toString().padStart(2, "0");
  const items = db.deadlines.filter(d => d.date && d.date.startsWith(`${y}-${monthStr}`));

  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="scadenze-${y}-${monthStr}.pdf"`);

  const logoFsPath = path.join(__dirname, "..", "assets", "logo-studio.png");
  if (fs.existsSync(logoFsPath)) {
    doc.image(logoFsPath, 40, 40, { width: 80 });
    doc.moveDown(3);
  }
  doc.fontSize(16).text(studio.name, { align: "left" });
  doc.fontSize(12).text(`Scadenze / Udienze - ${monthStr}/${y}`);
  doc.moveDown();

  items.forEach(d => {
    const legCase = db.cases.find(c => c.id === d.caseId);
    const pratica = legCase ? `${legCase.number} - ${legCase.subject}` : d.caseId;
    doc.fontSize(10).text(`${d.date} - ${d.type} - ${d.description}`);
    doc.text(`Pratica: ${pratica}`);
    doc.moveDown(0.5);
  });

  if (items.length === 0) {
    doc.text("Nessuna scadenza per questo mese.");
  }

  doc.end();
  doc.pipe(res);
});

// ------------------------------------------------------
// DOCUMENTI
// ------------------------------------------------------
app.post("/api/cases/:id/documents", upload.single("file"), (req, res) => {
  const caseId = req.params.id;
  const legCase = db.cases.find(x => x.id === caseId);
  if (!legCase) return res.status(404).json({ message: "Pratica non trovata" });
  const id = uuidv4();
  const docu = {
    id,
    caseId,
    originalName: req.file.originalname,
    path: req.file.filename,
    uploadedAt: new Date().toISOString(),
    type: req.body.type || "documento"
  };
  db.documents.push(docu);
  saveDB(db);
  res.status(201).json(docu);
});

app.get("/api/documents/:id/download", (req, res) => {
  const docu = db.documents.find(d => d.id === req.params.id);
  if (!docu) return res.status(404).json({ message: "Documento non trovato" });
  res.download(path.join(uploadDir, docu.path), docu.originalName);
});

// ------------------------------------------------------
// ATTIVITÀ
// ------------------------------------------------------
app.get("/api/cases/:id/activities", (req, res) => {
  res.json(db.activities.filter(a => a.caseId === req.params.id));
});

app.post("/api/cases/:id/activities", (req, res) => {
  const caseId = req.params.id;
  const legCase = db.cases.find(x => x.id === caseId);
  if (!legCase) return res.status(404).json({ message: "Pratica non trovata" });
  const id = uuidv4();
  const act = {
    id,
    caseId,
    date: req.body.date || new Date().toISOString().slice(0, 10),
    description: req.body.description || "",
    minutes: req.body.minutes || 0,
    rate: req.body.rate || 0,
    amount: req.body.amount || 0,
    activityType: req.body.activityType || "studio"
  };
  if (!act.amount && act.rate && act.minutes) {
    act.amount = (act.minutes / 60) * act.rate;
  }
  db.activities.push(act);
  saveDB(db);
  res.status(201).json(act);
});

// ------------------------------------------------------
// SPESE
// ------------------------------------------------------
app.get("/api/cases/:id/expenses", (req, res) => {
  res.json(db.expenses.filter(e => e.caseId === req.params.id));
});

app.post("/api/cases/:id/expenses", (req, res) => {
  const caseId = req.params.id;
  const legCase = db.cases.find(x => x.id === caseId);
  if (!legCase) return res.status(404).json({ message: "Pratica non trovata" });
  const id = uuidv4();
  const exp = {
    id,
    caseId,
    date: req.body.date || new Date().toISOString().slice(0, 10),
    description: req.body.description || "",
    amount: req.body.amount || 0,
    type: req.body.type || "spesa",
    documentRef: req.body.documentRef || ""
  };
  db.expenses.push(exp);
  saveDB(db);
  res.status(201).json(exp);
});

// ------------------------------------------------------
// FATTURE
// ------------------------------------------------------
app.get("/api/invoices", (req, res) => {
  const { clientId, caseId } = req.query;
  let items = db.invoices;
  if (clientId) items = items.filter(i => i.clientId === clientId);
  if (caseId) items = items.filter(i => i.caseId === caseId);

  const result = items.map(inv => {
    const client = inv.clientId ? db.clients.find(c => c.id === inv.clientId) : null;
    const legCase = inv.caseId ? db.cases.find(c => c.id === inv.caseId) : null;
    return {
      ...inv,
      clientName: client ? client.name : null,
      caseNumber: legCase ? legCase.number : null
    };
  });

  res.json(result);
});

app.post("/api/invoices", (req, res) => {
  const id = uuidv4();
  const now = new Date().toISOString().slice(0, 10);

  const {
    clientId,
    caseId,
    number,
    date,
    notes,
    withRitenuta = true,
    manualLines = [],
    overrideIvaPerc,
    overrideCassaPerc,
    overrideRitenutaPerc,
    overrideBollo
  } = req.body;

  // partiamo dai dati studio
  const studio = { ...db.studio };
  if (typeof overrideIvaPerc === "number") studio.ivaPerc = overrideIvaPerc;
  if (typeof overrideCassaPerc === "number") studio.cassaPerc = overrideCassaPerc;
  if (typeof overrideRitenutaPerc === "number") studio.ritenutaPerc = overrideRitenutaPerc;
  if (typeof overrideBollo === "number") studio.bollo = overrideBollo;

  let lines = [];

  // da pratica (attività + spese)
  if (caseId) {
    const acts = db.activities.filter(a => a.caseId === caseId);
    const exps = db.expenses.filter(e => e.caseId === caseId);
    acts.forEach(a => lines.push({ type: "activity", description: a.description, amount: a.amount }));
    exps.forEach(e => lines.push({ type: "expense", description: e.description, amount: e.amount }));
  }

  // linee manuali (concordato)
  if (Array.isArray(manualLines)) {
    manualLines.forEach(l => {
      if (!l || !l.description) return;
      const amt = Number(l.amount) || 0;
      lines.push({ type: "manual", description: l.description, amount: amt });
    });
  }

  const totals = calcInvoiceTotals(lines, studio, withRitenuta);

  const invoice = {
    id,
    number: number || getNextInvoiceNumber(),
    date: date || now,
    clientId: clientId || null,
    caseId: caseId || null,
    lines,
    notes: notes || "",
    totals,
    status: "emessa"
  };
  db.invoices.push(invoice);
  if (invoice.caseId) {
    addLog({
      caseId: invoice.caseId,
      action: "fattura-emessa",
      detail: `Fattura ${invoice.number} per € ${invoice.totals.totale.toFixed(2)}`
    });
  }
  saveDB(db);
  res.status(201).json(invoice);
});

app.get("/api/invoices/:id", (req, res) => {
  const inv = db.invoices.find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ message: "Fattura non trovata" });
  res.json(inv);
});

app.put("/api/invoices/:id", (req, res) => {
  const idx = db.invoices.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "Fattura non trovata" });

  const old = db.invoices[idx];
  const {
    clientId,
    caseId,
    date,
    notes,
    lines,
    withRitenuta,
    overrideIvaPerc,
    overrideCassaPerc,
    overrideRitenutaPerc,
    overrideBollo
  } = req.body;

  let newLines = Array.isArray(lines) ? lines : old.lines;

  const studio = { ...db.studio };
  if (typeof overrideIvaPerc === "number") studio.ivaPerc = overrideIvaPerc;
  if (typeof overrideCassaPerc === "number") studio.cassaPerc = overrideCassaPerc;
  if (typeof overrideRitenutaPerc === "number") studio.ritenutaPerc = overrideRitenutaPerc;
  if (typeof overrideBollo === "number") studio.bollo = overrideBollo;

  const totals = calcInvoiceTotals(newLines, studio, withRitenuta ?? true);

  const updated = {
    ...old,
    clientId: clientId ?? old.clientId,
    caseId: caseId ?? old.caseId,
    date: date ?? old.date,
    notes: notes ?? old.notes,
    lines: newLines,
    totals
  };

  db.invoices[idx] = updated;
  saveDB(db);
  res.json(updated);
});

app.delete("/api/invoices/:id", (req, res) => {
  const idx = db.invoices.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "Fattura non trovata" });
  const removed = db.invoices.splice(idx, 1)[0];
  if (removed.caseId) {
    addLog({
      caseId: removed.caseId,
      action: "fattura-eliminata",
      detail: `Fattura ${removed.number} rimossa`
    });
  }
  saveDB(db);
  res.json(removed);
});

// PDF fattura
app.get("/api/invoices/:id/pdf", (req, res) => {
  const inv = db.invoices.find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ message: "Fattura non trovata" });

  const client = inv.clientId ? db.clients.find(c => c.id === inv.clientId) : null;
  const legCase = inv.caseId ? db.cases.find(c => c.id === inv.caseId) : null;
  const studio = db.studio;

  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="fattura-${inv.number}.pdf"`);

  // intestazione con logo
  const logoFsPath = path.join(__dirname, "..", "assets", "logo-studio.png");
  if (fs.existsSync(logoFsPath)) {
    doc.image(logoFsPath, 40, 40, { width: 80 });
  }
  doc.fontSize(14).text(studio.name, 140, 40);
  doc.fontSize(10).text(studio.address || "", 140, 60);
  if (studio.vatNumber) doc.text("P.IVA: " + studio.vatNumber, 140, 74);
  if (studio.email) doc.text("Email: " + studio.email, 140, 88);
  if (studio.phone) doc.text("Tel: " + studio.phone, 140, 102);

  doc.fontSize(18).text("FATTURA", 400, 40);
  doc.fontSize(10).text("Numero: " + inv.number, 400, 60);
  doc.text("Data: " + inv.date, 400, 74);

  doc.moveDown(4);

  // cliente
  doc.fontSize(12).text("Destinatario:", { underline: true });
  if (client) {
    doc.fontSize(10).text(client.name);
    if (client.address) doc.text(client.address);
    if (client.fiscalCode) doc.text("CF: " + client.fiscalCode);
    if (client.vatNumber) doc.text("P.IVA: " + client.vatNumber);
  } else {
    doc.fontSize(10).text("Cliente non specificato");
  }
  doc.moveDown();

  // pratica (solo se giudiziale mostro tribunale e RG)
  if (legCase) {
    doc.fontSize(11).text(`Pratica: ${legCase.number} - ${legCase.subject}`);
    const isGiudiziale = (legCase.proceedingType || "").toLowerCase() === "giudiziale";
    if (isGiudiziale) {
      if (legCase.rgNumber) doc.text("RG: " + legCase.rgNumber);
      if (legCase.court) doc.text("Tribunale: " + legCase.court);
    }
    doc.moveDown();
  }

  // tabella linee
  doc.fontSize(11).text("Dettaglio prestazioni:");
  const startY = doc.y + 6;
  const col1 = 40, col2 = 360, col3 = 460;
  doc.fontSize(10).text("Descrizione", col1, startY);
  doc.text("Voce", col2, startY);
  doc.text("Importo €", col3, startY);
  doc.moveTo(col1, startY + 12).lineTo(550, startY + 12).stroke();

  let y = startY + 16;
  inv.lines.forEach(l => {
    const printableType = prettyLineType(l.type);
    doc.text(l.description, col1, y, { width: 300 });
    doc.text(printableType, col2, y, { width: 80 });
    doc.text((l.amount || 0).toFixed(2), col3, y, { width: 80, align: "right" });
    y += 14;
  });

  // totali
  y += 10;
  doc.moveTo(300, y).lineTo(550, y).stroke();
  y += 6;
  doc.text("Imponibile:", 300, y);    doc.text(inv.totals.imponibile.toFixed(2), 460, y, { align: "right" });
  y += 12;
  doc.text(`Cassa ${studio.cassaPerc}%:`, 300, y); doc.text(inv.totals.cassa.toFixed(2), 460, y, { align: "right" });
  y += 12;
  doc.text(`IVA ${studio.ivaPerc}%:`, 300, y); doc.text(inv.totals.iva.toFixed(2), 460, y, { align: "right" });
  y += 12;
  if (inv.totals.ritenuta > 0) {
    doc.text(`Ritenuta ${studio.ritenutaPerc}%:`, 300, y); doc.text("-" + inv.totals.ritenuta.toFixed(2), 460, y, { align: "right" });
    y += 12;
  }
  if (inv.totals.bollo > 0) {
    doc.text("Marca da bollo:", 300, y); doc.text(inv.totals.bollo.toFixed(2), 460, y, { align: "right" });
    y += 12;
  }
  doc.fontSize(13).text("TOTALE €:", 300, y); doc.fontSize(13).text(inv.totals.totale.toFixed(2), 460, y, { align: "right" });

  if (inv.notes) {
    doc.moveDown();
    doc.fontSize(10).text("Note:");
    doc.text(inv.notes);
  }

  doc.end();
  doc.pipe(res);
});

// ------------------------------------------------------
// REPORT / DASHBOARD
// ------------------------------------------------------
app.get("/api/reports/dashboard", (req, res) => {
  res.json({
    totalClients: db.clients.length,
    totalCases: db.cases.length,
    totalOpenCases: db.cases.filter(c => c.status === "aperta").length,
    totalCivil: db.cases.filter(c => c.caseType === "civile").length,
    totalPenal: db.cases.filter(c => c.caseType === "penale").length,
    totalDeadlines: db.deadlines.length,
    totalInvoices: db.invoices.length,
    invoicesAmount: db.invoices.reduce((s, i) => s + ((i.totals && i.totals.totale) || 0), 0)
  });
});

// scadenze imminenti (15 gg)
app.get("/api/reports/upcoming-deadlines", (req, res) => {
  const today = new Date();
  const limit = new Date();
  limit.setDate(today.getDate() + 15);

  const toIso = (d) => d.toISOString().slice(0, 10);

  const items = db.deadlines
    .filter(d => d.date && d.date >= toIso(today) && d.date <= toIso(limit))
    .map(d => {
      const cas = d.caseId ? db.cases.find(c => c.id === d.caseId) : null;
      return {
        ...d,
        caseNumber: cas ? cas.number : null,
        caseSubject: cas ? cas.subject : null
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json(items);
});

// statistiche mensili
app.get("/api/reports/monthly", (req, res) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const monthStr = m.toString().padStart(2, "0");

  const casesThisMonth = db.cases.filter(c => c.createdAt && c.createdAt.startsWith(`${y}-${monthStr}`));
  const invoicesThisMonth = db.invoices.filter(i => i.date && i.date.startsWith(`${y}-${monthStr}`));
  const totInv = invoicesThisMonth.reduce((s, i) => s + ((i.totals && i.totals.totale) || 0), 0);

  const dist = { civile: 0, penale: 0, lavoro: 0, altro: 0 };
  db.cases.forEach(c => {
    const t = (c.caseType || "").toLowerCase();
    if (t === "civile") dist.civile++;
    else if (t === "penale") dist.penale++;
    else if (t === "lavoro") dist.lavoro++;
    else dist.altro++;
  });

  res.json({
    year: y,
    month: m,
    casesThisMonth: casesThisMonth.length,
    invoicesThisMonth: invoicesThisMonth.length,
    invoicesAmountThisMonth: +totInv.toFixed(2),
    caseTypeDistribution: dist
  });
});

// ------------------------------------------------------
// EXPORT CSV
// ------------------------------------------------------
app.get("/api/export/clients.csv", (req, res) => {
  const rows = [
    "id;nome;codice_fiscale;piva;email;pec;telefono;indirizzo;note"
  ];
  db.clients.forEach(c => {
    rows.push(`${c.id};${c.name || ""};${c.fiscalCode || ""};${c.vatNumber || ""};${c.email || ""};${c.pec || ""};${c.phone || ""};${c.address || ""};${(c.notes || "").replace(/;/g, ",")}`);
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=clienti.csv");
  res.send(rows.join("\n"));
});

app.get("/api/export/cases.csv", (req, res) => {
  const rows = [
    "id;numero;oggetto;cliente;tribunale;rg;tipo;procedimento;stato;data_creazione"
  ];
  db.cases.forEach(c => {
    const cli = c.clientId ? db.clients.find(cl => cl.id === c.clientId) : null;
    rows.push(`${c.id};${c.number};${(c.subject || "").replace(/;/g, ",")};${cli ? cli.name : ""};${c.court || ""};${c.rgNumber || ""};${c.caseType || ""};${c.proceedingType || ""};${c.status || ""};${c.createdAt || ""}`);
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=pratiche.csv");
  res.send(rows.join("\n"));
});

app.get("/api/export/invoices.csv", (req, res) => {
  const rows = [
    "id;numero;data;cliente;pratica;imponibile;iva;cassa;ritenuta;bollo;totale"
  ];
  db.invoices.forEach(i => {
    const cli = i.clientId ? db.clients.find(cl => cl.id === i.clientId) : null;
    const cas = i.caseId ? db.cases.find(cl => cl.id === i.caseId) : null;
    rows.push(`${i.id};${i.number};${i.date};${cli ? cli.name : ""};${cas ? cas.number : ""};${i.totals?.imponibile || 0};${i.totals?.iva || 0};${i.totals?.cassa || 0};${i.totals?.ritenuta || 0};${i.totals?.bollo || 0};${i.totals?.totale || 0}`);
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=fatture.csv");
  res.send(rows.join("\n"));
});

app.get("/api/export/deadlines.csv", (req, res) => {
  const rows = [
    "id;data;descrizione;tipo;pratica"
  ];
  db.deadlines.forEach(d => {
    const cas = d.caseId ? db.cases.find(c => c.id === d.caseId) : null;
    rows.push(`${d.id};${d.date};${(d.description || "").replace(/;/g, ",")};${d.type || ""};${cas ? cas.number : ""}`);
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=scadenze.csv");
  res.send(rows.join("\n"));
});

// ------------------------------------------------------
// EXPORT EXCEL
// ------------------------------------------------------
app.get("/api/export/excel", async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Gestionale Studio Legale";
    workbook.created = new Date();

    // CLIENTI
    const wsClients = workbook.addWorksheet("Clienti");
    wsClients.columns = [
      { header: "ID", key: "id", width: 32 },
      { header: "Nome", key: "name", width: 30 },
      { header: "Codice Fiscale", key: "fiscalCode", width: 20 },
      { header: "P.IVA", key: "vatNumber", width: 16 },
      { header: "Email", key: "email", width: 28 },
      { header: "PEC", key: "pec", width: 28 },
      { header: "Telefono", key: "phone", width: 16 },
      { header: "Indirizzo", key: "address", width: 35 },
      { header: "Note", key: "notes", width: 35 }
    ];
    db.clients.forEach(c => wsClients.addRow(c));

    // PRATICHE
    const wsCases = workbook.addWorksheet("Pratiche");
    wsCases.columns = [
      { header: "ID", key: "id", width: 32 },
      { header: "Numero", key: "number", width: 18 },
      { header: "Oggetto", key: "subject", width: 40 },
      { header: "Cliente", key: "clientName", width: 28 },
      { header: "Tribunale", key: "court", width: 25 },
      { header: "RG", key: "rgNumber", width: 16 },
      { header: "Tipo", key: "caseType", width: 12 },
      { header: "Procedimento", key: "proceedingType", width: 16 },
      { header: "Stato", key: "status", width: 12 },
      { header: "Creato il", key: "createdAt", width: 20 }
    ];
    db.cases.forEach(c => {
      const client = c.clientId ? db.clients.find(cl => cl.id === c.clientId) : null;
      wsCases.addRow({
        ...c,
        clientName: client ? client.name : ""
      });
    });

    // FATTURE
    const wsInv = workbook.addWorksheet("Fatture");
    wsInv.columns = [
      { header: "ID", key: "id", width: 32 },
      { header: "Numero", key: "number", width: 18 },
      { header: "Data", key: "date", width: 14 },
      { header: "Cliente", key: "clientName", width: 28 },
      { header: "Pratica", key: "caseNumber", width: 20 },
      { header: "Imponibile", key: "imponibile", width: 14 },
      { header: "Cassa", key: "cassa", width: 12 },
      { header: "IVA", key: "iva", width: 12 },
      { header: "Ritenuta", key: "ritenuta", width: 12 },
      { header: "Bollo", key: "bollo", width: 12 },
      { header: "Totale", key: "totale", width: 14 }
    ];
    db.invoices.forEach(i => {
      const client = i.clientId ? db.clients.find(cl => cl.id === i.clientId) : null;
      const cas = i.caseId ? db.cases.find(cl => cl.id === i.caseId) : null;
      wsInv.addRow({
        id: i.id,
        number: i.number,
        date: i.date,
        clientName: client ? client.name : "",
        caseNumber: cas ? cas.number : "",
        imponibile: i.totals ? i.totals.imponibile : "",
        cassa: i.totals ? i.totals.cassa : "",
        iva: i.totals ? i.totals.iva : "",
        ritenuta: i.totals ? i.totals.ritenuta : "",
        bollo: i.totals ? i.totals.bollo : "",
        totale: i.totals ? i.totals.totale : ""
      });
    });

    // SCADENZE
    const wsDead = workbook.addWorksheet("Scadenze");
    wsDead.columns = [
      { header: "ID", key: "id", width: 32 },
      { header: "Data", key: "date", width: 14 },
      { header: "Descrizione", key: "description", width: 40 },
      { header: "Tipo", key: "type", width: 16 },
      { header: "Pratica", key: "caseNumber", width: 20 }
    ];
    db.deadlines.forEach(d => {
      const cas = d.caseId ? db.cases.find(c => c.id === d.caseId) : null;
      wsDead.addRow({
        ...d,
        caseNumber: cas ? cas.number : ""
      });
    });

    [wsClients, wsCases, wsInv, wsDead].forEach(ws => {
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: "frozen", ySplit: 1 }];
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=export-studio-legale.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Errore generazione Excel" });
  }
});
// ------------------------------------------------------
// IMPORT SEMPLICE DA CSV
// accetta un file CSV e crea clienti / pratiche / scadenze
// ------------------------------------------------------
// ------------------------------------------------------
// IMPORT SEMPLICE DA CSV
// modalità: SOSTITUISCI i dati esistenti di quel tipo
// ------------------------------------------------------
const csvUpload = multer({ storage: multer.memoryStorage() });

app.post("/api/import/:type", csvUpload.single("file"), (req, res) => {
  const { type } = req.params;
  if (!req.file) {
    return res.status(400).json({ message: "Nessun file ricevuto" });
  }

  // leggo e tolgo eventuale BOM
  const text = req.file.buffer.toString("utf-8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) {
    return res.status(400).json({ message: "File vuoto" });
  }

  // rimuovo header
  lines.shift();

  let imported = 0;

  if (type === "clients") {
    // SVUOTA clienti prima di importare
    db.clients = [];

    // formato: id;nome;codice_fiscale;piva;email;pec;telefono;indirizzo;note
    lines.forEach(l => {
      const parts = l.split(";");
      if (!parts[1]) return; // senza nome salto
      const client = {
        id: parts[0] && parts[0].trim() !== "" ? parts[0] : uuidv4(),
        name: parts[1] || "",
        fiscalCode: parts[2] || "",
        vatNumber: parts[3] || "",
        email: parts[4] || "",
        pec: parts[5] || "",
        phone: parts[6] || "",
        address: parts[7] || "",
        notes: parts[8] || ""
      };
      db.clients.push(client);
      imported++;
    });

  } else if (type === "cases") {
    // SVUOTA pratiche prima di importare
    db.cases = [];
    // quando svuoto le pratiche, ha senso anche scollegare le scadenze e le fatture
    // ma tu vuoi importare SOLO le pratiche, quindi per ora lasciamo deadlines e invoices come sono

    // formato: id;numero;oggetto;cliente;tribunale;rg;tipo;procedimento;stato;data_creazione
    lines.forEach(l => {
      const parts = l.split(";");
      if (!parts[2]) return; // senza oggetto non inserisco

      const clientName = parts[3] || "";
      const client = db.clients.find(c => c.name === clientName);

      const legalCase = {
        id: parts[0] && parts[0].trim() !== "" ? parts[0] : uuidv4(),
        number: parts[1] || getNextCaseNumber(),
        subject: parts[2] || "",
        clientId: client ? client.id : null,
        court: parts[4] || "",
        rgNumber: parts[5] || "",
        caseType: parts[6] || "civile",
        proceedingType: parts[7] || "stragiudiziale",
        status: parts[8] || "aperta",
        createdAt: parts[9] || new Date().toISOString()
      };
      db.cases.push(legalCase);
      imported++;
    });

  } else if (type === "invoices") {
    // SVUOTA fatture prima di importare
    db.invoices = [];

    // formato: id;numero;data;cliente;pratica;imponibile;iva;cassa;ritenuta;bollo;totale
    lines.forEach(l => {
      const parts = l.split(";");
      if (!parts[1]) return; // senza numero salto

      const clientName = parts[3] || "";
      const caseNumber = parts[4] || "";
      const client = db.clients.find(c => c.name === clientName);
      const legCase = db.cases.find(c => c.number === caseNumber);

      const invoice = {
        id: parts[0] && parts[0].trim() !== "" ? parts[0] : uuidv4(),
        number: parts[1] || getNextInvoiceNumber(),
        date: parts[2] || new Date().toISOString().slice(0, 10),
        clientId: client ? client.id : null,
        caseId: legCase ? legCase.id : null,
        lines: [
          {
            type: "manual",
            description: "Importato da CSV",
            amount: Number(parts[10] || 0)
          }
        ],
        notes: "",
        totals: {
          imponibile: Number(parts[5] || 0),
          iva: Number(parts[6] || 0),
          cassa: Number(parts[7] || 0),
          ritenuta: Number(parts[8] || 0),
          bollo: Number(parts[9] || 0),
          totale: Number(parts[10] || 0)
        },
        status: "emessa"
      };
      db.invoices.push(invoice);
      imported++;
    });

  } else {
    return res.status(400).json({ message: "Tipo non supportato. Usa: clients | cases | invoices" });
  }

  saveDB(db);
  return res.json({ message: "Import eseguito (sostituzione)", imported, type });
});


// ------------------------------------------------------
// AVVIO SERVER
// ------------------------------------------------------
app.listen(PORT, () => {
  console.log("Server gestionale avviato sulla porta " + PORT);
});
