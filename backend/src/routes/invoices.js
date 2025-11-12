// backend/src/routes/invoices.js
import express from "express";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";
import { db, saveDB } from "../db.js";
import { parseMoney, round2 } from "../lib/money.js";

const router = express.Router();
const _num = (x) => round2(parseMoney(x));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_ROOT = path.resolve(__dirname, "../../data/static");
const INVOICE_DIR = path.join(STATIC_ROOT, "invoices");

function ensureStaticDir() {
  fs.mkdirSync(INVOICE_DIR, { recursive: true });
}

function buildAbsoluteUrl(req, relativePath) {
  if (!relativePath) return relativePath;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  const normalized = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  const host = req.get("host");
  if (!host) return normalized;
  const protocol = req.protocol || "http";
  try {
    return new URL(normalized, `${protocol}://${host}`).toString();
  } catch {
    return normalized;
  }
}

function safeInvoiceFilename(number) {
  return String(number || "fattura").replace(/[^a-zA-Z0-9-_]/g, "_");
}

const LINE_TYPE_LABELS = {
  manual: "Onorario",
  onorario: "Onorario",
  spesa: "Spese",
  rimborso: "Rimborso",
  anticipo: "Anticipo",
};

function sanitizeLineType(type) {
  if (!type) return "manual";
  const key = String(type).toLowerCase();
  if (LINE_TYPE_LABELS[key]) return key;
  return "manual";
}

function lineTypeLabel(type) {
  const key = sanitizeLineType(type);
  return LINE_TYPE_LABELS[key] || "Voce";
}

function invoiceSequenceKey() {
  const year = new Date().getFullYear();
  return `invoice_${year}`;
}

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
  const key = invoiceSequenceKey();
  const n = Number(db.sequences?.[key] || 0) + 1;
  db.sequences = { ...(db.sequences || {}), [key]: n };
  return `FAT-${new Date().getFullYear()}-${String(n).padStart(4, "0")}`;
}

function computePaid(inv) {
  return round2((inv.payments || []).reduce((s, p) => s + _num(p.amount), 0));
}

function computeResiduo(inv) {
  return round2(_num(inv.totals?.totale) - computePaid(inv));
}

function normalizeLines(lines = []) {
  return lines.map((l) => ({
    id: l.id || uuidv4(),
    type: sanitizeLineType(l.type || "manual"),
    description: l.description || "",
    amount: _num(l.amount),
  }));
}

function applyStatus(inv) {
  const res = computeResiduo(inv);
  const tot = _num(inv.totals?.totale);
  if (res <= 0) inv.status = "pagata";
  else if (computePaid(inv) > 0 && computePaid(inv) < tot) inv.status = "parziale";
  else inv.status = "emessa";
  inv.overdue = Boolean(inv.dueDate) && res > 0 && new Date(inv.dueDate) < new Date();
}

function recalc(inv) {
  inv.lines = normalizeLines(inv.lines || []);
  inv.totals = totals(inv.lines, db.studio || {});
  applyStatus(inv);
}

function serializeInvoice(inv) {
  recalc(inv);
  return {
    ...inv,
    totals: { ...inv.totals },
    paid: computePaid(inv),
    residuo: computeResiduo(inv),
    overdue: inv.overdue,
  };
}

function ensureInvoice(inv) {
  inv.lines = normalizeLines(inv.lines || []);
  inv.payments ||= [];
  inv.attachedExpenseIds ||= [];
  recalc(inv);
}

// LISTA
router.get("/", (req, res) => {
  res.json((db.invoices || []).map((inv) => serializeInvoice(inv)));
});

router.get("/:id", (req, res) => {
  const inv = (db.invoices || []).find((i) => i.id === req.params.id);
  if (!inv) return res.status(404).json({ message: "Fattura non trovata" });
  res.json(serializeInvoice(inv));
});

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

  const manualNumber = String(b.number || "").trim();
  if (manualNumber) {
    const exists = (db.invoices || []).some((inv) => String(inv.number || "").toLowerCase() === manualNumber.toLowerCase());
    if (exists) return res.status(400).json({ message: "Numero fattura già utilizzato" });
  }

  let lines = Array.isArray(b.lines) ? normalizeLines(b.lines) : [];
  const expenseIds = Array.isArray(b.expenseIds) ? b.expenseIds : [];
  if (expenseIds.length) {
    const picked = (db.expenses || []).filter((e) => expenseIds.includes(e.id));
    picked.forEach((e) => {
      lines.push({
        id: uuidv4(),
        type: sanitizeLineType(e.type || "spesa"),
        description: e.description || "Spesa pratica",
        amount: _num(e.amount),
      });
    });
  }

  const inv = {
    id: uuidv4(),
    number: manualNumber || nextNumber(),
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
  ensureInvoice(inv);
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
      category: "fattura",
      createdAt: new Date().toISOString(),
    });
  }
  saveDB();
  res.json(serializeInvoice(inv));
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
  valid.forEach((e) =>
    inv.lines.push({ id: uuidv4(), type: e.type || "spesa", description: e.description || "Spesa pratica", amount: _num(e.amount) })
  );
  inv.attachedExpenseIds = Array.from(new Set([...(inv.attachedExpenseIds || []), ...valid.map((e) => e.id)]));
  (db.expenses || []).forEach((e) => {
    if (inv.attachedExpenseIds.includes(e.id)) e.billedInvoiceId = inv.id;
  });
  recalc(inv);
  saveDB();
  res.json({ ok: true, invoice: serializeInvoice(inv) });
});

// crea direttamente da spese
router.post("/genera-da-spese", (req, res) => {
  const b = req.body || {};
  const client = (db.clients || []).find((c) => c.id === b.clientId);
  if (!client) return res.status(400).json({ message: "clientId mancante o non valido" });
  const ids = Array.isArray(b.expenseIds) ? b.expenseIds : [];
  if (!ids.length) return res.status(400).json({ message: "Nessuna spesa selezionata" });
  const picked = (db.expenses || []).filter((e) => ids.includes(e.id));

  const manualNumber = String(b.number || "").trim();
  if (manualNumber) {
    const exists = (db.invoices || []).some((inv) => String(inv.number || "").toLowerCase() === manualNumber.toLowerCase());
    if (exists) return res.status(400).json({ message: "Numero fattura già utilizzato" });
  }

  let lines = picked.map((e) => ({
    id: uuidv4(),
    type: sanitizeLineType(e.type || "spesa"),
    description: e.description || "Spesa pratica",
    amount: _num(e.amount),
  }));
  if (Array.isArray(b.extraLines)) {
    lines = lines.concat(normalizeLines(b.extraLines));
  }

  const inv = {
    id: uuidv4(),
    number: manualNumber || nextNumber(),
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
  ensureInvoice(inv);
  (db.invoices ||= []).push(inv);
  picked.forEach((e) => (e.billedInvoiceId = inv.id));

  if (inv.caseId) {
    (db.logs ||= []).push({
      id: uuidv4(),
      caseId: inv.caseId,
      action: "fattura-emessa",
      detail: `Fattura ${inv.number} per € ${inv.totals.totale.toFixed(2)}`,
      category: "fattura",
      createdAt: new Date().toISOString(),
    });
  }
  saveDB();
  res.json(serializeInvoice(inv));
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
  recalc(inv);

  if (inv.caseId) {
    (db.logs ||= []).push({
      id: uuidv4(),
      caseId: inv.caseId,
      action: "pagamento-fattura",
      detail: `Pagamento € ${amount.toFixed(2)} su fattura ${inv.number}`,
      category: "pagamento",
      createdAt: new Date().toISOString(),
    });
  }
  saveDB();
  res.json({ ok: true, invoice: serializeInvoice(inv) });
});

router.delete("/:id/payments/:paymentId", (req, res) => {
  const inv = (db.invoices || []).find((i) => i.id === req.params.id);
  if (!inv) return res.status(404).json({ message: "Fattura non trovata" });
  const ix = (inv.payments || []).findIndex((p) => p.id === req.params.paymentId);
  if (ix < 0) return res.status(404).json({ message: "Pagamento non trovato" });
  const removed = inv.payments.splice(ix, 1)[0];
  recalc(inv);
  if (inv.caseId) {
    (db.logs ||= []).push({
      id: uuidv4(),
      caseId: inv.caseId,
      action: "pagamento-rimosso",
      detail: `Rimosso pagamento da € ${removed.amount.toFixed(2)} sulla fattura ${inv.number}`,
      category: "pagamento",
      createdAt: new Date().toISOString(),
    });
  }
  saveDB();
  res.json({ ok: true, invoice: serializeInvoice(inv) });
});

router.post("/:id/lines", (req, res) => {
  const inv = (db.invoices || []).find((i) => i.id === req.params.id);
  if (!inv) return res.status(404).json({ message: "Fattura non trovata" });
  const line = {
    id: uuidv4(),
    type: sanitizeLineType(req.body?.type || "manual"),
    description: req.body?.description || "",
    amount: _num(req.body?.amount),
  };
  if (!(line.amount > 0)) return res.status(400).json({ message: "Importo > 0" });
  (inv.lines ||= []).push(line);
  recalc(inv);
  if (inv.caseId) {
    (db.logs ||= []).push({
      id: uuidv4(),
      caseId: inv.caseId,
      action: "fattura-linea",
      detail: `Aggiunta riga ${line.description || line.type} € ${line.amount.toFixed(2)}`,
      category: "fattura",
      createdAt: new Date().toISOString(),
    });
  }
  saveDB();
  res.json({ ok: true, invoice: serializeInvoice(inv) });
});

router.delete("/:id/lines/:lineId", (req, res) => {
  const inv = (db.invoices || []).find((i) => i.id === req.params.id);
  if (!inv) return res.status(404).json({ message: "Fattura non trovata" });
  const ix = (inv.lines || []).findIndex((l) => l.id === req.params.lineId);
  if (ix < 0) return res.status(404).json({ message: "Riga non trovata" });
  const [removed] = inv.lines.splice(ix, 1);
  recalc(inv);
  if (inv.caseId) {
    (db.logs ||= []).push({
      id: uuidv4(),
      caseId: inv.caseId,
      action: "fattura-linea-rimossa",
      detail: `Rimossa riga ${removed.description || removed.type}`,
      category: "fattura",
      createdAt: new Date().toISOString(),
    });
  }
  saveDB();
  res.json({ ok: true, invoice: serializeInvoice(inv) });
});

router.put("/:id", (req, res) => {
  const inv = (db.invoices || []).find((i) => i.id === req.params.id);
  if (!inv) return res.status(404).json({ message: "Fattura non trovata" });
  const patch = req.body || {};
  if (patch.date) inv.date = patch.date;
  if (patch.dueDate !== undefined) inv.dueDate = patch.dueDate;
  if (patch.notes !== undefined) inv.notes = patch.notes;
  if (Array.isArray(patch.lines)) inv.lines = normalizeLines(patch.lines);
  recalc(inv);
  saveDB();
  res.json(serializeInvoice(inv));
});

router.get("/:id/payments", (req, res) => {
  const inv = (db.invoices || []).find((i) => i.id === req.params.id);
  if (!inv) return res.status(404).json({ message: "Fattura non trovata" });
  res.json(inv.payments || []);
});

// PDF minimale
router.get("/:id/pdf", (req, res) => {
  const inv = (db.invoices || []).find((i) => i.id === req.params.id);
  if (!inv) return res.status(404).json({ message: "Fattura non trovata" });

  ensureStaticDir();
  const safeNumber = safeInvoiceFilename(inv.number);
  const file = path.join(INVOICE_DIR, `${safeNumber}.pdf`);

  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(file);
  doc.pipe(stream);

  const client = (db.clients || []).find((c) => c.id === inv.clientId);
  const studio = db.studio || {};

  doc.fontSize(20).fillColor("#111827").text(studio.name || "Studio Legale", { align: "right" });
  if (studio.address) doc.fontSize(10).fillColor("#4b5563").text(studio.address, { align: "right" });
  if (studio.phone)
    doc.fontSize(10).fillColor("#4b5563").text(`Tel. ${studio.phone}`, { align: "right" });
  if (studio.email)
    doc.fontSize(10).fillColor("#4b5563").text(studio.email, { align: "right" });

  doc.moveDown();
  doc
    .fontSize(22)
    .fillColor("#111827")
    .text(`Fattura ${inv.number}`, { align: "left" });
  doc.moveDown(0.2);
  doc
    .fontSize(11)
    .fillColor("#1f2937")
    .text(`Data emissione: ${inv.date}`);
  if (inv.dueDate) doc.text(`Scadenza pagamento: ${inv.dueDate}`);

  doc.moveDown(0.5);
  doc.fontSize(12).fillColor("#111827").text("Destinatario", { underline: true });
  doc.fontSize(11).fillColor("#1f2937").text(client?.name || "");
  if (client?.address) doc.text(client.address);
  if (client?.fiscalCode) doc.text(`CF: ${client.fiscalCode}`);
  if (client?.vatNumber) doc.text(`P.IVA: ${client.vatNumber}`);

  if (inv.caseId) {
    const p = (db.cases || []).find((x) => x.id === inv.caseId);
    if (p) {
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor("#111827").text("Pratica", { underline: true });
      doc
        .fontSize(11)
        .fillColor("#1f2937")
        .text(`${p.number || ""} — ${p.subject || ""}`);
    }
  }

  doc.moveDown();
  doc.fontSize(12).fillColor("#111827").text("Dettaglio prestazioni", { underline: true });
  doc.moveDown(0.3);

  const grouped = inv.lines.reduce((acc, line) => {
    const key = sanitizeLineType(line.type);
    (acc[key] ||= []).push(line);
    return acc;
  }, {});

  const startX = doc.x;
  Object.entries(grouped).forEach(([type, lines]) => {
    doc
      .fontSize(11)
      .fillColor("#1f2937")
      .text(lineTypeLabel(type), { continued: false, underline: true });
    doc.moveDown(0.15);
    lines.forEach((line) => {
      doc
        .fontSize(10)
        .fillColor("#4b5563")
        .text(line.description || lineTypeLabel(line.type), startX, doc.y, { width: 360 });
      doc
        .fontSize(10)
        .fillColor("#111827")
        .text(`€ ${_num(line.amount).toFixed(2)}`, 0, doc.y - 12, {
          align: "right",
        });
      doc.moveDown(0.4);
    });
    doc.moveDown(0.2);
  });

  doc.moveDown();
  doc.fontSize(12).fillColor("#111827").text("Riepilogo importi", { underline: true });
  doc.moveDown(0.3);

  const summaryRows = [
    ["Imponibile", inv.totals.imponibile],
    ["Cassa", inv.totals.cassa],
    ["IVA", inv.totals.iva],
    ["Ritenuta", -inv.totals.ritenuta],
    ["Marca da bollo", inv.totals.bollo],
  ];

  summaryRows.forEach(([label, value]) => {
    if (!value) return;
    doc
      .fontSize(10)
      .fillColor("#4b5563")
      .text(label, startX, doc.y, { width: 360 });
    doc
      .fontSize(10)
      .fillColor("#111827")
      .text(`€ ${_num(value).toFixed(2)}`, 0, doc.y - 12, { align: "right" });
    doc.moveDown(0.35);
  });

  doc
    .moveDown()
    .fontSize(16)
    .fillColor("#111827")
    .text(`Totale da pagare € ${inv.totals.totale.toFixed(2)}`, { align: "right" });

  if (inv.notes) {
    doc.moveDown();
    doc.fontSize(10).fillColor("#4b5563").text(inv.notes, { width: 500 });
  }

  doc.end();

  stream.on("finish", () => {
    const publicPath = `/static/invoices/${path.basename(file)}`;
    res.json({
      url: buildAbsoluteUrl(req, publicPath),
      path: publicPath,
    });
  });
  stream.on("error", (err) => {
    console.error(err);
    res.status(500).json({ message: "Errore generazione PDF" });
  });
});

router.delete("/:id", (req, res) => {
  const ix = (db.invoices || []).findIndex((i) => i.id === req.params.id);
  if (ix < 0) return res.status(404).json({ message: "Fattura non trovata" });
  const [removed] = db.invoices.splice(ix, 1);

  (db.expenses || []).forEach((exp) => {
    if (exp.billedInvoiceId === removed.id) delete exp.billedInvoiceId;
  });

  if (removed.caseId) {
    (db.logs ||= []).push({
      id: uuidv4(),
      caseId: removed.caseId,
      action: "fattura-eliminata",
      detail: `Eliminata fattura ${removed.number}`,
      category: "fattura",
      createdAt: new Date().toISOString(),
    });
  }

  const safeNumber = safeInvoiceFilename(removed.number);
  const pdfPath = path.join(INVOICE_DIR, `${safeNumber}.pdf`);
  fs.promises.unlink(pdfPath).catch(() => {});

  saveDB();
  res.json({ ok: true });
});

export default router;
