// backend/src/routes/guardianships.js
import express from "express";
import { db, saveDB } from "../db.js";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_ROOT = path.resolve(__dirname, "../../data/static");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

ensureDir(path.join(STATIC_ROOT, "guardians"));

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const guardianId = req.params.id;
    const folderId = req.params.folderId;
    const dir = path.join(STATIC_ROOT, "guardians", guardianId, folderId);
    try {
      ensureDir(dir);
      cb(null, dir);
    } catch (err) {
      cb(err, dir);
    }
  },
  filename(req, file, cb) {
    const safeName = `${Date.now()}-${file.originalname}`.replace(/[^a-zA-Z0-9.\-_/]/g, "_");
    cb(null, safeName);
  },
});

const upload = multer({ storage });

function ensureGuardianDefaults(g) {
  g.notes ||= [];
  g.documents ||= [];
  g.inventory ||= [];
  g.incomes ||= [];
  g.expenses ||= [];
  g.deposits ||= [];
  g.movements ||= [];
  g.balance ||= 0;
  g.folders ||= [];
  g.timeline ||= [];
  g.careStructure ||= null;
  g.medicalExpenses ||= [];
  g.structureExpenses ||= [];
}

function findGuardian(id) {
  const g = (db.guardianships || []).find((x) => x.id === id);
  if (!g) return null;
  ensureGuardianDefaults(g);
  return g;
}

router.get("/", (req, res) => {
  (db.guardianships || []).forEach(ensureGuardianDefaults);
  res.json(db.guardianships || []);
});

router.post("/", (req, res) => {
  const g = {
    id: uuidv4(),
    fullName: req.body?.fullName || "",
    birthDate: req.body?.birthDate || "",
    fiscalCode: req.body?.fiscalCode || "",
    residence: req.body?.residence || "",
    status: "attivo",
    supportLevel: req.body?.supportLevel || "",
    court: req.body?.court || "",
    judge: req.body?.judge || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: [],
    documents: [],
    inventory: [],
    incomes: [],
    expenses: [],
    movements: [],
    deposits: [],
    balance: 0,
    folders: [],
    timeline: [],
    careStructure: null,
    medicalExpenses: [],
    structureExpenses: [],
  };
  (db.guardianships ||= []).push(g);
  saveDB();
  res.json(g);
});

router.get("/:id", (req, res) => {
  const g = findGuardian(req.params.id);
  if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
  res.json(g);
});

router.get("/:id/summary", (req, res) => {
  const g = findGuardian(req.params.id);
  if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
  const sum = (arr) => (arr || []).reduce((s, x) => s + Number(x.amount || 0), 0);
  const incomes = sum(g.incomes);
  const expenses = sum(g.expenses);
  const deposits = sum(g.deposits);
  const medical = sum(g.medicalExpenses);
  const structure = sum(g.structureExpenses);
  const balance = incomes - expenses + deposits - medical - structure;
  res.json({ incomes, expenses, deposits, medical, structure, balance });
});

function pushTx(req, res, key, category) {
  const g = findGuardian(req.params.id);
  if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
  const v = Number(req.body?.amount || 0);
  if (!(v > 0)) return res.status(400).json({ message: "Importo > 0" });
  const item = {
    id: uuidv4(),
    date: req.body?.date || new Date().toISOString().slice(0, 10),
    amount: v,
    note: req.body?.note || "",
    category: req.body?.category || category,
  };
  (g[key] ||= []).push(item);
  g.timeline.push({
    id: uuidv4(),
    type: key.slice(0, -1),
    title: item.category || key,
    detail: item.note || "",
    amount: item.amount,
    date: item.date,
    createdAt: `${item.date}T09:00`,
  });
  g.updatedAt = new Date().toISOString();
  saveDB();
  res.json(item);
}

function delTx(req, res, key) {
  const g = findGuardian(req.params.id);
  if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
  const ix = (g[key] || []).findIndex((x) => x.id === req.params.txId);
  if (ix < 0) return res.status(404).json({ message: "Movimento non trovato" });
  g[key].splice(ix, 1);
  g.updatedAt = new Date().toISOString();
  saveDB();
  res.json({ ok: true });
}

["incomes", "expenses", "deposits", "movements"].forEach((k) => {
  router.get(`/:id/${k}`, (req, res) => {
    const g = findGuardian(req.params.id);
    if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
    res.json(g[k] || []);
  });
  router.post(`/:id/${k}`, (req, res) => pushTx(req, res, k, k.slice(0, -1)));
  router.delete(`/:id/${k}/:txId`, (req, res) => delTx(req, res, k));
});

router.get("/:id/invoices", (req, res) => {
  const out = (db.invoices || []).filter((i) => i.guardianId === req.params.id);
  res.json(out.map((inv) => ({
    id: inv.id,
    number: inv.number,
    date: inv.date,
    total: inv.totals?.totale || 0,
    status: inv.status,
  })));
});

router.post("/:id/timeline", (req, res) => {
  const g = findGuardian(req.params.id);
  if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
  const when = req.body?.createdAt ? new Date(req.body.createdAt) : new Date();
  const item = {
    id: uuidv4(),
    type: req.body?.type || "nota",
    title: req.body?.title || "Nota",
    detail: req.body?.detail || "",
    date: req.body?.date || when.toISOString().slice(0, 10),
    createdAt: when.toISOString(),
  };
  g.timeline.push(item);
  g.updatedAt = new Date().toISOString();
  saveDB();
  res.json(item);
});

router.get("/:id/timeline", (req, res) => {
  const g = findGuardian(req.params.id);
  if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
  const combined = [...(g.timeline || [])];
  ["incomes", "expenses", "medicalExpenses", "structureExpenses", "movements"].forEach((key) => {
    (g[key] || []).forEach((item) => {
      combined.push({
        id: `${key}-${item.id}`,
        type: key,
        title: item.category || key,
        detail: item.note || "",
        amount: item.amount,
        date: item.date,
        createdAt: `${item.date || new Date().toISOString().slice(0, 10)}T08:00`,
      });
    });
  });
  combined.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  res.json(combined);
});

router.post("/:id/folders", (req, res) => {
  const g = findGuardian(req.params.id);
  if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
  const folder = {
    id: uuidv4(),
    name: req.body?.name || "Cartella",
    createdAt: new Date().toISOString(),
    documents: [],
  };
  g.folders.push(folder);
  g.updatedAt = new Date().toISOString();
  saveDB();
  res.json(folder);
});

router.post("/:id/folders/:folderId/documents", upload.single("file"), (req, res) => {
  const g = findGuardian(req.params.id);
  if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
  const folder = (g.folders || []).find((f) => f.id === req.params.folderId);
  if (!folder) return res.status(404).json({ message: "Cartella non trovata" });
  const body = req.body || {};
  const doc = {
    id: uuidv4(),
    title: body?.title || "Documento",
    description: body?.description || "",
    url: body?.url || "",
    createdAt: new Date().toISOString(),
    date: body?.date || new Date().toISOString().slice(0, 10),
  };
  if (req.file) {
    const relPath = path.relative(STATIC_ROOT, req.file.path).split(path.sep).join("/");
    doc.url = `/static/${relPath}`;
    doc.filePath = relPath;
    doc.fileName = req.file.originalname;
    doc.fileSize = req.file.size;
  }
  folder.documents.push(doc);
  g.updatedAt = new Date().toISOString();
  saveDB();
  res.json(doc);
});

router.delete("/:id/folders/:folderId/documents/:docId", (req, res) => {
  const g = findGuardian(req.params.id);
  if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
  const folder = (g.folders || []).find((f) => f.id === req.params.folderId);
  if (!folder) return res.status(404).json({ message: "Cartella non trovata" });
  const ix = (folder.documents || []).findIndex((d) => d.id === req.params.docId);
  if (ix < 0) return res.status(404).json({ message: "Documento non trovato" });
  const [removed] = folder.documents.splice(ix, 1);
  if (removed?.filePath) {
    const abs = path.join(STATIC_ROOT, removed.filePath);
    fs.promises.unlink(abs).catch(() => {});
  }
  g.updatedAt = new Date().toISOString();
  saveDB();
  res.json({ ok: true });
});

router.put("/:id/care-structure", (req, res) => {
  const g = findGuardian(req.params.id);
  if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
  const data = req.body || {};
  g.careStructure = {
    name: data.name || "",
    address: data.address || "",
    contact: data.contact || "",
    notes: data.notes || "",
    startDate: data.startDate || "",
    dailyRate: Number(data.dailyRate || 0),
    monthlyCost: Number(data.monthlyCost || 0),
  };
  g.timeline.push({
    id: uuidv4(),
    type: "care-structure",
    title: "Aggiornata struttura di ricovero",
    detail: g.careStructure.name,
    createdAt: new Date().toISOString(),
  });
  g.updatedAt = new Date().toISOString();
  saveDB();
  res.json(g.careStructure);
});

router.post("/:id/medical-expenses", (req, res) => {
  const g = findGuardian(req.params.id);
  if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
  const v = Number(req.body?.amount || 0);
  if (!(v > 0)) return res.status(400).json({ message: "Importo > 0" });
  const item = {
    id: uuidv4(),
    date: req.body?.date || new Date().toISOString().slice(0, 10),
    amount: v,
    note: req.body?.note || "",
    supplier: req.body?.supplier || "",
  };
  g.medicalExpenses.push(item);
  g.timeline.push({
    id: uuidv4(),
    type: "medical-expense",
    title: item.supplier || "Spesa medica",
    detail: item.note,
    amount: item.amount,
    createdAt: `${item.date}T10:00`,
  });
  g.updatedAt = new Date().toISOString();
  saveDB();
  res.json(item);
});

router.post("/:id/structure-expenses", (req, res) => {
  const g = findGuardian(req.params.id);
  if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
  const v = Number(req.body?.amount || 0);
  if (!(v > 0)) return res.status(400).json({ message: "Importo > 0" });
  const item = {
    id: uuidv4(),
    date: req.body?.date || new Date().toISOString().slice(0, 10),
    amount: v,
    note: req.body?.note || "",
    structure: req.body?.structure || g.careStructure?.name || "",
  };
  g.structureExpenses.push(item);
  g.timeline.push({
    id: uuidv4(),
    type: "structure-expense",
    title: item.structure || "Spesa struttura",
    detail: item.note,
    amount: item.amount,
    createdAt: `${item.date}T11:00`,
  });
  g.updatedAt = new Date().toISOString();
  saveDB();
  res.json(item);
});

// (opzionale) Crea fattura intestata all'Amministrato
router.post("/:id/invoices", (req, res) => {
  req.body = { ...(req.body || {}), guardianId: req.params.id };
  res.status(501).json({ message: "Usa POST /api/fatture con guardianId per creare la fattura" });
});

export default router;
