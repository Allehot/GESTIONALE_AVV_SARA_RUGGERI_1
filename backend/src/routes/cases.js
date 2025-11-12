// backend/src/routes/cases.js
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { db, saveDB, DEFAULT_CASE_NUMBERING } from "../db.js";
import { parseMoney, round2 } from "../lib/money.js";

const router = express.Router();

const CASE_TYPE_KEYS = {
  penale: "casePenal",
  civile: "caseCivil",
};

function getCaseNumberingSettings() {
  const cfg = db.settings?.caseNumbering || DEFAULT_CASE_NUMBERING;
  return {
    ...DEFAULT_CASE_NUMBERING,
    ...cfg,
    caseTypes: {
      ...DEFAULT_CASE_NUMBERING.caseTypes,
      ...(cfg.caseTypes || {}),
    },
    allowManual:
      typeof cfg.allowManual === "boolean"
        ? cfg.allowManual
        : DEFAULT_CASE_NUMBERING.allowManual,
    separator: cfg.separator || DEFAULT_CASE_NUMBERING.separator,
  };
}

function sequenceKeyFor(caseType, year = new Date().getFullYear()) {
  const normalized = String(caseType).toLowerCase();
  const base = CASE_TYPE_KEYS[normalized] || CASE_TYPE_KEYS.civile;
  return `${base}_${year}`;
}

function buildCaseNumber(caseType = "civile", counter) {
  const cfg = getCaseNumberingSettings();
  const type = String(caseType).toLowerCase() === "penale" ? "penale" : "civile";
  const typeCfg = cfg.caseTypes?.[type] || DEFAULT_CASE_NUMBERING.caseTypes[type];
  const year = new Date().getFullYear();
  const prefix = typeCfg?.prefix || DEFAULT_CASE_NUMBERING.caseTypes[type].prefix;
  const pad = Number(typeCfg?.pad) || DEFAULT_CASE_NUMBERING.caseTypes[type].pad;
  const separator = cfg.separator || "-";
  return `${prefix}${separator}${year}${separator}${String(counter).padStart(pad, "0")}`;
}

function nextCaseNumber(caseType = "civile") {
  const key = sequenceKeyFor(caseType);
  const current = Number(db.sequences?.[key] || 0) + 1;
  db.sequences = { ...(db.sequences || {}), [key]: current };
  return buildCaseNumber(caseType, current);
}

function previewCaseNumber(caseType = "civile") {
  const key = sequenceKeyFor(caseType);
  const current = Number(db.sequences?.[key] || 0) + 1;
  return buildCaseNumber(caseType, current);
}

// anteprima numero pratica (per UI)
router.get("/preview-number", (req, res) => {
  const type = String(req.query.caseType || "civile").toLowerCase();
  res.json({ number: previewCaseNumber(type) });
});

router.get("/numbering-config", (req, res) => {
  const cfg = getCaseNumberingSettings();
  const preview = {
    civile: previewCaseNumber("civile"),
    penale: previewCaseNumber("penale"),
  };
  res.json({ config: cfg, preview });
});

router.put("/numbering-config", (req, res) => {
  const body = req.body || {};
  const current = getCaseNumberingSettings();
  const nextCfg = {
    ...current,
    separator: body.separator || current.separator,
    allowManual:
      typeof body.allowManual === "boolean" ? body.allowManual : current.allowManual,
    caseTypes: {
      ...current.caseTypes,
      ...(body.caseTypes || {}),
    },
  };

  db.settings = { ...(db.settings || {}), caseNumbering: nextCfg };

  const year = new Date().getFullYear();
  Object.entries(body.caseTypes || {}).forEach(([type, cfg]) => {
    if (cfg?.nextNumber) {
      const key = sequenceKeyFor(type, year);
      const next = Number(cfg.nextNumber) - 1;
      if (next >= 0) {
        db.sequences = { ...(db.sequences || {}), [key]: next };
      }
    }
  });

  saveDB();
  res.json({ config: getCaseNumberingSettings(), preview: {
    civile: previewCaseNumber("civile"),
    penale: previewCaseNumber("penale"),
  } });
});

router.get("/", (req, res) => res.json(db.cases || []));

router.post("/", (req, res) => {
  const b = req.body || {};
  const caseType = (b.caseType || "civile").toLowerCase();
  const cfg = getCaseNumberingSettings();
  const manualNumber = cfg.allowManual ? String(b.manualNumber || b.number || "").trim() : "";
  let number;
  if (manualNumber) {
    const exists = (db.cases || []).some((c) => String(c.number).toLowerCase() === manualNumber.toLowerCase());
    if (exists) return res.status(400).json({ message: "Numero pratica già utilizzato" });
    number = manualNumber;
  } else {
    number = nextCaseNumber(caseType);
  }
  const it = {
    id: uuidv4(),
    number,
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
    customNumber: Boolean(manualNumber),
  };
  (db.cases ||= []).push(it);
  (db.logs ||= []).push({
    id: uuidv4(),
    caseId: it.id,
    action: "creazione-pratica",
    detail: `Creata pratica: ${it.number} - ${it.subject || ""}`,
    category: "creazione",
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
    category: "modifica",
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
    id: uuidv4(),
    caseId: id,
    action: "elimina-pratica",
    detail: "Pratica eliminata",
    category: "chiusura",
    createdAt: new Date().toISOString(),
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
  const when = req.body?.createdAt ? new Date(req.body.createdAt) : new Date();
  const l = {
    id: uuidv4(),
    caseId: req.params.id,
    action: req.body?.action || "nota-manuale",
    detail: req.body?.detail || "",
    category: req.body?.category || "nota",
    author: req.body?.author || "utente",
    createdAt: when.toISOString(),
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
    id: uuidv4(),
    caseId: req.params.id,
    action: "spesa-aggiunta",
    detail: `${item.description || "spesa"} € ${v.toFixed(2)}`,
    category: "spesa",
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
  const c = (db.cases || []).find((x) => x.id === req.params.id);
  const d = {
    id: uuidv4(),
    caseId: req.params.id,
    clientId: c?.clientId || null,
    date: b.date || new Date().toISOString().slice(0, 10),
    time: b.time || "",
    type: b.type || "scadenza",
    title: b.title || "",
    note: b.note || "",
    createdAt: new Date().toISOString(),
  };
  (db.deadlines ||= []).push(d);
  (db.logs ||= []).push({
    id: uuidv4(),
    caseId: req.params.id,
    action: "scadenza-creata",
    detail: `${d.type}: ${d.date} - ${d.title || ""}`,
    category: "scadenza",
    createdAt: new Date().toISOString(),
  });
  saveDB();
  res.json(d);
});

function buildTimeline(caseId) {
  const logs = (db.logs || [])
    .filter((l) => l.caseId === caseId)
    .map((l) => ({
      id: `log-${l.id}`,
      type: "log",
      action: l.action,
      detail: l.detail,
      category: l.category || "nota",
      createdAt: l.createdAt || new Date().toISOString(),
      author: l.author || "sistema",
    }));

  const deadlines = (db.deadlines || [])
    .filter((d) => d.caseId === caseId)
    .map((d) => ({
      id: `deadline-${d.id}`,
      type: "deadline",
      detail: d.title || d.type,
      date: d.date,
      time: d.time || "",
      note: d.note || "",
      createdAt: `${d.date}${d.time ? `T${d.time}` : "T00:00"}`,
    }));

  const expenses = (db.expenses || [])
    .filter((e) => e.caseId === caseId)
    .map((e) => ({
      id: `expense-${e.id}`,
      type: "expense",
      detail: e.description || "Spesa",
      amount: e.amount,
      createdAt: `${e.date || new Date().toISOString().slice(0, 10)}T00:00`,
    }));

  const invoices = (db.invoices || [])
    .filter((inv) => inv.caseId === caseId)
    .flatMap((inv) => {
      const items = [
        {
          id: `invoice-${inv.id}`,
          type: "invoice",
          detail: `Fattura ${inv.number}`,
          amount: inv.totals?.totale || 0,
          status: inv.status,
          createdAt: `${inv.date || new Date().toISOString().slice(0, 10)}T12:00`,
        },
      ];
      (inv.payments || []).forEach((p) => {
        items.push({
          id: `invoice-payment-${inv.id}-${p.id}`,
          type: "payment",
          detail: `Pagamento fattura ${inv.number}`,
          amount: p.amount,
          createdAt: `${p.date || new Date().toISOString().slice(0, 10)}T13:00`,
        });
      });
      return items;
    });

  const timeline = [...logs, ...deadlines, ...expenses, ...invoices];
  return timeline.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

router.get("/:id/timeline", (req, res) => {
  const caseId = req.params.id;
  const exists = (db.cases || []).some((c) => c.id === caseId);
  if (!exists) return res.status(404).json({ message: "Pratica non trovata" });
  res.json(buildTimeline(caseId));
});


// FATTURE COLLEGATE
router.get("/:id/invoices", (req, res) => {
  res.json((db.invoices || []).filter((i) => i.caseId === req.params.id));
});

export default router;
