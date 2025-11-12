// backend/src/routes/guardianships.js
import express from "express";
import { db, saveDB } from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

router.get("/", (req, res) => res.json(db.guardianships || []));

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
    notes: [], documents: [], inventory: [],
    incomes: [], expenses: [], movements: [], deposits: [],
    balance: 0
  };
  (db.guardianships ||= []).push(g);
  saveDB();
  res.json(g);
});

router.get("/:id/summary", (req, res) => {
  const g = (db.guardianships||[]).find(x => x.id === req.params.id);
  if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
  const sum = arr => (arr||[]).reduce((s,x)=> s + Number(x.amount||0), 0);
  const incomes  = sum(g.incomes);
  const expenses = sum(g.expenses);
  const deposits = sum(g.deposits);
  const balance  = incomes - expenses + deposits;
  res.json({ incomes, expenses, deposits, balance });
});

function pushTx(req, res, key){
  const g = (db.guardianships||[]).find(x => x.id === req.params.id);
  if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
  const v = Number(req.body?.amount || 0);
  if (!(v>0)) return res.status(400).json({ message: "Importo > 0" });
  const item = { id: uuidv4(), date: req.body?.date || new Date().toISOString().slice(0,10), amount: v, note: req.body?.note || "" };
  (g[key] ||= []).push(item);
  g.updatedAt = new Date().toISOString();
  saveDB();
  res.json(item);
}

function delTx(req, res, key){
  const g = (db.guardianships||[]).find(x => x.id === req.params.id);
  if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
  const ix = (g[key]||[]).findIndex(x => x.id === req.params.txId);
  if (ix < 0) return res.status(404).json({ message: "Movimento non trovato" });
  g[key].splice(ix,1);
  g.updatedAt = new Date().toISOString();
  saveDB();
  res.json({ ok: true });
}

["incomes","expenses","deposits","movements"].forEach(k => {
  router.get(`/:id/${k}`, (req,res) => {
    const g = (db.guardianships||[]).find(x => x.id === req.params.id);
    if (!g) return res.status(404).json({ message: "Amministrato non trovato" });
    res.json(g[k] || []);
  });
  router.post(`/:id/${k}`, (req,res) => pushTx(req,res,k));
  router.delete(`/:id/${k}/:txId`, (req,res) => delTx(req,res,k));
});
// Fatture legate all'Amministrato
router.get("/:id/invoices", (req, res) => {
  const out = (db.invoices || []).filter(i => i.guardianId === req.params.id);
  res.json(out);
});

// (opzionale) Crea fattura intestata all'Amministrato
router.post("/:id/invoices", (req, res) => {
  req.body = { ...(req.body || {}), guardianId: req.params.id };
  // delega: usa la logica del router fatture
  res.status(501).json({ message: "Usa POST /api/fatture con guardianId per creare la fattura" });
});

export default router;
