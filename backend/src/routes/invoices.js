// backend/src/routes/invoices.js
import express from "express";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { db, saveDB } from "../db.js";
import { parseMoney, round2 } from "../lib/money.js";

const router = express.Router();
const _num = (x) => round2(parseMoney(x));

function totals(lines, studio = {}) {
  const imponibile = round2(lines.reduce((s, l) => s + _num(l.amount), 0));
  const cassa = round2(imponibile * (Number(studio.cassaPerc || 0) / 100));
  const iva = round2((imponibile + cassa) * (Number(studio.ivaPerc || 0) / 100));
  const ritenuta = round2(imponibile * (Number(studio.ritenutaPerc || 0) / 100));
  const bollo = imponibile >= 77.47 ? round2(studio.bollo || 2) : 0;
  const totale = round2(imponibile + cassa + iva + bollo - ritenuta);
  return { imponibile, cassa, iva, ritenuta, bollo, totale };
}
function nextNumber() {
  const n = Number(db.sequences?.invoice || 0) + 1;
  db.sequences = { ...(db.sequences || {}), invoice: n };
  return `FAT-${new Date().getFullYear()}-${String(n).padStart(4, "0")}`;
}
function computePaid(inv) {
  return round2((inv.payments || []).reduce((s, p) => s + _num(p.amount), 0));
}
function computeResiduo(inv) {
  return round2(_num(inv.totals?.totale) - computePaid(inv));
}
function applyStatus(inv) {
  const res = computeResiduo(inv);
  const tot = _num(inv.totals?.totale);
  if (res <= 0) inv.status = "pagata";
  else if (computePaid(inv) > 0 && computePaid(inv) < tot) inv.status = "parziale";
  else inv.status = "emessa";
}

// LISTA
router.get("/", (req, res) => res.json(db.invoices || []));

// CREATE (accetta lines[] e/o expenseIds[])
router.post("/", (req, res) => {
  const b = req.body || {};
  const client = (db.clients || []).find((c) => c.id === b.clientId);
  if (!client) return res.status(400).json({ message: "clientId mancante o non valido" });

  if (b.caseId) {
    const p = (db.cases || []).find((x) => x.id === b.caseId);
    if (!p) return res.status(400).json({ message: "caseId non valido" });
    if (p.clientId !== client.id) return res.status(400).json({ message: "La pratica non appartiene al cliente" });
  }

  let lines = Array.isArray(b.lines) ? b.lines.map((l) => ({ type: l.type || "manual", description: l.description || "", amount: _num(l.amount) })) : [];
  const expenseIds = Array.isArray(b.expenseIds) ? b.expenseIds : [];
  if (expenseIds.length) {
    const picked = (db.expenses || []).filter((e) => expenseIds.includes(e.id));
    picked.forEach((e) => {
      lines.push({ type: e.type || "spesa", description: e.description || "Spesa pratica", amount: _num(e.amount) });
    });
  }

  const inv = {
    id: uuidv4(),
    number: nextNumber(),
    date: b.date || new Date().toISOString().slice(0, 10),
    dueDate: b.dueDate || null,
    clientId: client.id,
    caseId: b.caseId || null,
    guardianId: b.guardianId || null,
    lines,
    notes: b.notes || "",
    totals: totals(lines, db.studio || {}),
    status: "emessa",
    payments: [],
    attachedExpenseIds: expenseIds.length ? expenseIds : [],
  };
  (db.invoices ||= []).push(inv);

  // marca spese fatturate
  if (inv.attachedExpenseIds.length) {
    (db.expenses || []).forEach((e) => {
      if (inv.attachedExpenseIds.includes(e.id)) e.billedInvoiceId = inv.id;
    });
  }
  // log pratica
  if (inv.caseId) {
    (db.logs ||= []).push({
      id: uuidv4(),
      caseId: inv.caseId,
      action: "fattura-emessa",
      detail: `Fattura ${inv.number} per € ${inv.totals.totale.toFixed(2)}`,
      createdAt: new Date().toISOString(),
    });
  }
  saveDB();
  res.json(inv);
});

// attach spese dopo creazione
router.post("/:id/attach-expenses", (req, res) => {
  const inv = (db.invoices || []).find((i) => i.id === req.params.id);
  if (!inv) return res.status(404).json({ message: "Fattura non trovata" });
  const ids = Array.isArray(req.body?.expenseIds) ? req.body.expenseIds : [];
  const valid = (db.expenses || []).filter((e) => {
    if (!ids.includes(e.id)) return false;
    if (inv.caseId && e.caseId !== inv.caseId) return false;
    return true;
  });
  // aggiungi righe, marca spese e ricalcola totali
  valid.forEach((e) => inv.lines.push({ type: e.type || "spesa", description: e.description || "Spesa pratica", amount: _num(e.amount) }));
  inv.attachedExpenseIds = Array.from(new Set([...(inv.attachedExpenseIds || []), ...valid.map((e) => e.id)]));
  (db.expenses || []).forEach((e) => { if (inv.attachedExpenseIds.includes(e.id)) e.billedInvoiceId = inv.id; });
  inv.totals = totals(inv.lines, db.studio || {});
  applyStatus(inv);
  saveDB();
  res.json({ ok: true, invoice: inv });
});

// crea direttamente da spese
router.post("/genera-da-spese", (req, res) => {
  const b = req.body || {};
  const client = (db.clients || []).find((c) => c.id === b.clientId);
  if (!client) return res.status(400).json({ message: "clientId mancante o non valido" });
  const ids = Array.isArray(b.expenseIds) ? b.expenseIds : [];
  if (!ids.length) return res.status(400).json({ message: "Nessuna spesa selezionata" });
  const picked = (db.expenses || []).filter((e) => ids.includes(e.id));

  let lines = picked.map((e) => ({ type: e.type || "spesa", description: e.description || "Spesa pratica", amount: _num(e.amount) }));
  if (Array.isArray(b.extraLines)) {
    lines = lines.concat(b.extraLines.map((l) => ({ type: l.type || "manual", description: l.description || "", amount: _num(l.amount) })));
  }

  const inv = {
    id: uuidv4(),
    number: nextNumber(),
    date: b.date || new Date().toISOString().slice(0, 10),
    dueDate: b.dueDate || null,
    clientId: client.id,
    caseId: b.caseId || null,
    guardianId: b.guardianId || null,
    lines,
    notes: b.notes || "",
    totals: totals(lines, db.studio || {}),
    status: "emessa",
    payments: [],
    attachedExpenseIds: picked.map((e) => e.id),
  };
  (db.invoices ||= []).push(inv);
  picked.forEach((e) => (e.billedInvoiceId = inv.id));

  if (inv.caseId) {
    (db.logs ||= []).push({
      id: uuidv4(),
      caseId: inv.caseId,
      action: "fattura-emessa",
      detail: `Fattura ${inv.number} per € ${inv.totals.totale.toFixed(2)}`,
      createdAt: new Date().toISOString(),
    });
  }
  saveDB();
  res.json(inv);
});

// pagamenti (robusto: virgole, cap a residuo, status aggiornato)
router.post("/:id/payments", (req, res) => {
  const inv = (db.invoices || []).find((i) => i.id === req.params.id);
  if (!inv) return res.status(404).json({ message: "Fattura non trovata" });

  const requested = _num(req.body?.amount);
  if (!(requested > 0)) return res.status(400).json({ message: "Importo > 0" });

  const residuo = computeResiduo(inv);
  const amount = requested > residuo ? residuo : requested;

  const p = { id: uuidv4(), date: req.body?.date || new Date().toISOString().slice(0, 10), amount };
  (inv.payments ||= []).push(p);
  applyStatus(inv);

  // log pratica
  if (inv.caseId) {
    (db.logs ||= []).push({
      id: uuidv4(),
      caseId: inv.caseId,
      action: "pagamento-fattura",
      detail: `Pagamento € ${amount.toFixed(2)} su fattura ${inv.number}`,
      createdAt: new Date().toISOString(),
    });
  }
  saveDB();
  res.json({ ok: true, invoice: inv });
});

// split invariato (già robusto) — omesso qui per brevità se l'hai già

// PDF minimale
router.get("/:id/pdf", (req, res) => {
  const inv = (db.invoices || []).find((i) => i.id === req.params.id);
  if (!inv) return res.status(404).json({ message: "Fattura non trovata" });

  const dir = path.resolve(process.cwd(), "public", "pdf");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${inv.number}.pdf`);

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(fs.createWriteStream(file));
  doc.fontSize(18).text(`Fattura ${inv.number}`);
  doc.fontSize(12).text(`Data: ${inv.date}`);
  const client = (db.clients || []).find((c) => c.id === inv.clientId);
  doc.moveDown().text(`Cliente: ${client?.name || ""}`);
  if (inv.caseId) {
    const p = (db.cases || []).find((x) => x.id === inv.caseId);
    doc.text(`Pratica: ${p?.number || ""} - ${p?.subject || ""}`);
  }
  doc.moveDown().text("Righe:");
  inv.lines.forEach((l) => doc.text(`- ${l.description} — € ${_num(l.amount).toFixed(2)}`));
  doc.moveDown();
  const t = inv.totals;
  doc.text(`Imponibile € ${t.imponibile.toFixed(2)}  Cassa € ${t.cassa.toFixed(2)}  IVA € ${t.iva.toFixed(2)}`);
  doc.text(`Ritenuta € ${t.ritenuta.toFixed(2)}  Bollo € ${t.bollo.toFixed(2)}`);
  doc.moveDown().fontSize(16).text(`TOTALE € ${t.totale.toFixed(2)}`, { align: "right" });
  doc.end();

  res.json({ url: `/pdf/${inv.number}.pdf` });
});

export default router;
