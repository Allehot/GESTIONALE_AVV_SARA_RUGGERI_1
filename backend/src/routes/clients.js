import express from "express";
import { v4 as uuidv4 } from "uuid";

import { db, saveDB } from "../db.js";

const router = express.Router();

function ensureCollections() {
  db.clients ||= [];
  db.cases ||= [];
  db.invoices ||= [];
  db.expenses ||= [];
}

function sanitize(value) {
  return String(value ?? "").trim();
}

function findClient(id) {
  ensureCollections();
  return db.clients.find((client) => client.id === id) || null;
}

router.get("/", (req, res) => {
  ensureCollections();
  res.json(db.clients);
});

router.get("/:id", (req, res) => {
  const client = findClient(req.params.id);
  if (!client) return res.status(404).json({ message: "Cliente non trovato" });
  res.json(client);
});

router.post("/", (req, res) => {
  ensureCollections();
  const body = req.body || {};
  const name = sanitize(body.name || body.ragioneSociale || body.denominazione);
  if (!name) return res.status(400).json({ message: "Nome obbligatorio" });

  const duplicate = db.clients.some((c) => {
    const sameName = sanitize(c.name).toLowerCase() === name.toLowerCase();
    const fiscal = sanitize(c.fiscalCode);
    const incomingFiscal = sanitize(body.fiscalCode);
    return sameName && fiscal && fiscal === incomingFiscal;
  });
  if (duplicate) return res.status(409).json({ message: "Cliente già presente" });

  const now = new Date().toISOString();
  const client = {
    id: uuidv4(),
    name,
    fiscalCode: sanitize(body.fiscalCode),
    vatNumber: sanitize(body.vatNumber),
    email: sanitize(body.email),
    pec: sanitize(body.pec),
    phone: sanitize(body.phone),
    address: sanitize(body.address),
    notes: sanitize(body.notes),
    createdAt: now,
    updatedAt: now,
  };

  db.clients.push(client);
  saveDB();
  res.json(client);
});

router.put("/:id", (req, res) => {
  ensureCollections();
  const idx = db.clients.findIndex((c) => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ message: "Cliente non trovato" });

  const patch = req.body || {};
  const current = db.clients[idx];

  const next = {
    ...current,
    name: sanitize(patch.name ?? current.name),
    fiscalCode: sanitize(patch.fiscalCode ?? current.fiscalCode),
    vatNumber: sanitize(patch.vatNumber ?? current.vatNumber),
    email: sanitize(patch.email ?? current.email),
    pec: sanitize(patch.pec ?? current.pec),
    phone: sanitize(patch.phone ?? current.phone),
    address: sanitize(patch.address ?? current.address),
    notes: sanitize(patch.notes ?? current.notes),
    updatedAt: new Date().toISOString(),
  };

  db.clients[idx] = next;
  saveDB();
  res.json(next);
});

router.delete("/:id", (req, res) => {
  ensureCollections();
  const idx = db.clients.findIndex((c) => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ message: "Cliente non trovato" });

  const [removed] = db.clients.splice(idx, 1);

  // Scollega entità correlate mantenendo lo storico
  db.cases.forEach((item) => {
    if (item.clientId === removed.id) item.clientId = null;
  });
  db.invoices.forEach((inv) => {
    if (inv.clientId === removed.id) inv.clientId = null;
  });
  db.expenses.forEach((exp) => {
    if (exp.clientId === removed.id) exp.clientId = null;
  });

  saveDB();
  res.json({ ok: true });
});

router.get("/:id/cases", (req, res) => {
  ensureCollections();
  const client = findClient(req.params.id);
  if (!client) return res.status(404).json({ message: "Cliente non trovato" });

  const list = db.cases
    .filter((c) => c.clientId === client.id)
    .map((c) => ({
      id: c.id,
      number: c.number,
      subject: c.subject,
      status: c.status,
      createdAt: c.createdAt,
    }));
  res.json(list);
});

router.get("/:id/invoices", (req, res) => {
  ensureCollections();
  const client = findClient(req.params.id);
  if (!client) return res.status(404).json({ message: "Cliente non trovato" });

  const list = db.invoices
    .filter((inv) => inv.clientId === client.id)
    .map((inv) => ({
      id: inv.id,
      number: inv.number,
      date: inv.date,
      status: inv.status,
      totals: inv.totals || null,
    }));

  res.json(list);
});

router.get("/:id/expenses", (req, res) => {
  ensureCollections();
  const client = findClient(req.params.id);
  if (!client) return res.status(404).json({ message: "Cliente non trovato" });

  const caseIds = new Set(db.cases.filter((c) => c.clientId === client.id).map((c) => c.id));
  const items = db.expenses.filter(
    (expense) => expense.clientId === client.id || caseIds.has(expense.caseId),
  );
  res.json(items);
});

router.post("/:id/expenses", (req, res) => {
  ensureCollections();
  const client = findClient(req.params.id);
  if (!client) return res.status(404).json({ message: "Cliente non trovato" });

  const payload = req.body || {};
  const amount = Number(payload.amount || 0);
  if (!(amount > 0)) return res.status(400).json({ message: "Importo > 0" });

  const expense = {
    id: uuidv4(),
    clientId: client.id,
    caseId: payload.caseId || null,
    date: payload.date || new Date().toISOString().slice(0, 10),
    description: sanitize(payload.description) || "Spesa",
    amount,
    type: payload.type || "spesa",
    documentRef: sanitize(payload.documentRef),
    createdAt: new Date().toISOString(),
  };

  db.expenses.push(expense);
  saveDB();
  res.json(expense);
});

router.delete("/:id/expenses/:expenseId", (req, res) => {
  ensureCollections();
  const client = findClient(req.params.id);
  if (!client) return res.status(404).json({ message: "Cliente non trovato" });

  const idx = db.expenses.findIndex(
    (exp) => exp.id === req.params.expenseId && (exp.clientId === client.id || !exp.clientId),
  );
  if (idx < 0) return res.status(404).json({ message: "Spesa non trovata" });

  db.expenses.splice(idx, 1);
  saveDB();
  res.json({ ok: true });
});

export default router;
