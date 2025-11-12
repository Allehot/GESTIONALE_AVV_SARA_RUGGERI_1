// backend/src/routes/cases.js
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { db, saveDB } from "../db.js";
import { parseMoney, round2 } from "../lib/money.js";

const router = express.Router();

function nextCaseNumber(caseType = "civile") {
  const year = new Date().getFullYear();
  const key = String(caseType).toLowerCase() === "penale" ? "casePenal" : "caseCivil";
  const prefix = key === "casePenal" ? "PR-PEN" : "PR-CIV";
  const n = Number(db.sequences?.[key] || 0) + 1;
  db.sequences = { ...(db.sequences || {}), [key]: n };
  return `${prefix}-${year}-${String(n).padStart(4, "0")}`;
}

// anteprima numero pratica (per UI)
router.get("/preview-number", (req, res) => {
  const year = new Date().getFullYear();
  const type = String(req.query.caseType || "civile").toLowerCase();
  const key = type === "penale" ? "casePenal" : "caseCivil";
  const prefix = key === "casePenal" ? "PR-PEN" : "PR-CIV";
  const next = Number(db.sequences?.[key] || 0) + 1;
  res.json({ number: `${prefix}-${year}-${String(next).padStart(4, "0")}` });
});

router.get("/", (req, res) => res.json(db.cases || []));

router.post("/", (req, res) => {
  const b = req.body || {};
  const caseType = (b.caseType || "civile").toLowerCase();
  const it = {
    id: uuidv4(),
    number: nextCaseNumber(caseType),
    clientId: b.clientId || null,
    subject: b.subject || "",
    court: b.court || "",
    section: b.section || "",
    judge: b.judge || "",
    rgNumber: b.rgNumber || "",
    caseType,
    proceedingType: (b.proceedingType || "giudiziale").toLowerCase(),
    status: "aperta",
    value: round2(parseMoney(b.value)),
    notes: "",
    createdAt: new Date().toISOString(),
  };
  (db.cases ||= []).push(it);
  (db.logs ||= []).push({
    id: uuidv4(),
    caseId: it.id,
    action: "creazione-pratica",
    detail: `Creata pratica: ${it.number} - ${it.subject || ""}`,
    createdAt: new Date().toISOString(),
  });
  saveDB();
  res.json(it);
});

router.get("/:id", (req, res) => {
  const it = (db.cases || []).find((x) => x.id === req.params.id);
  if (!it) return res.status(404).json({ message: "Pratica non trovata" });
  res.json(it);
});

router.put("/:id", (req, res) => {
  const ix = (db.cases || []).findIndex((x) => x.id === req.params.id);
  if (ix < 0) return res.status(404).json({ message: "Pratica non trovata" });
  const before = db.cases[ix];
  const patch = { ...req.body };
  if ("value" in patch) patch.value = round2(parseMoney(patch.value));
  db.cases[ix] = { ...before, ...patch, updatedAt: new Date().toISOString() };
  (db.logs ||= []).push({
    id: uuidv4(),
    caseId: db.cases[ix].id,
    action: "modifica-pratica",
    detail: "Pratica modificata",
    createdAt: new Date().toISOString(),
  });
  saveDB();
  res.json(db.cases[ix]);
});

router.delete("/:id", (req, res) => {
  const ix = (db.cases || []).findIndex((x) => x.id === req.params.id);
  if (ix < 0) return res.status(404).json({ message: "Pratica non trovata" });
  const id = db.cases[ix].id;
  db.cases.splice(ix, 1);
  (db.logs ||= []).push({
    id: uuidv4(), caseId: id, action: "elimina-pratica", detail: "Pratica eliminata", createdAt: new Date().toISOString(),
  });
  saveDB();
  res.json({ ok: true });
});

// LOG
router.get("/:id/logs", (req, res) => {
  const out = (db.logs || [])
    .filter((l) => l.caseId === req.params.id)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  res.json(out);
});

router.post("/:id/logs", (req, res) => {
  const l = {
    id: uuidv4(),
    caseId: req.params.id,
    action: req.body?.action || "nota",
    detail: req.body?.detail || "",
    createdAt: new Date().toISOString(),
  };
  (db.logs ||= []).push(l);
  saveDB();
  res.json(l);
});

// SPESE COLLEGATE
router.get("/:id/expenses", (req, res) => {
  res.json((db.expenses || []).filter((e) => e.caseId === req.params.id));
});

router.post("/:id/expenses", (req, res) => {
  const b = req.body || {};
  const v = round2(parseMoney(b.amount));
  if (!(v > 0)) return res.status(400).json({ message: "Importo > 0" });
  const item = {
    id: uuidv4(),
    caseId: req.params.id,
    date: b.date || new Date().toISOString().slice(0, 10),
    description: b.description || "",
    amount: v,
    type: b.type || "spesa",
    documentRef: b.documentRef || "",
    billedInvoiceId: null,
  };
  (db.expenses ||= []).push(item);
  (db.logs ||= []).push({
    id: uuidv4(), caseId: req.params.id, action: "spesa-aggiunta",
    detail: `${item.description || "spesa"} € ${v.toFixed(2)}`,
    createdAt: new Date().toISOString(),
  });
  saveDB();
  res.json(item);
});

// SCADENZE COLLEGATE
router.get("/:id/deadlines", (req, res) => {
  const out = (db.deadlines || []).filter((d) => d.caseId === req.params.id);
  res.json(out.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))));
});

router.post("/:id/deadlines", (req, res) => {
  const b = req.body || {};
  const d = {
    id: uuidv4(),
    caseId: req.params.id,
    date: b.date || new Date().toISOString().slice(0, 10),
    time: b.time || "",
    type: b.type || "scadenza",
    title: b.title || "",
    note: b.note || "",
    createdAt: new Date().toISOString(),
  };
  (db.deadlines ||= []).push(d);
  (db.logs ||= []).push({
    id: uuidv4(), caseId: req.params.id, action: "scadenza-creata",
    detail: `${d.type}: ${d.date} - ${d.title || ""}`, createdAt: new Date().toISOString(),
  });
  saveDB();
  res.json(d);
});

// FATTURE COLLEGATE
router.get("/:id/invoices", (req, res) => {
  res.json((db.invoices || []).filter((i) => i.caseId === req.params.id));
});

export default router;
