import express from "express";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { db, saveDB } from "../db.js";

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_ROOT = path.resolve(__dirname, "../../data/static");
const CLIENT_DOC_DIR = path.join(STATIC_ROOT, "clients");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

ensureDir(CLIENT_DOC_DIR);

async function removeDirRecursive(target) {
  if (!target) return;
  try {
    if (typeof fs.promises.rm === "function") {
      await fs.promises.rm(target, { recursive: true, force: true });
    } else if (typeof fs.promises.rmdir === "function") {
      await fs.promises.rmdir(target, { recursive: true });
    }
  } catch (err) {
    if (err && ["ENOENT", "ENOTDIR", "ENOTEMPTY"].includes(err.code)) return;
    throw err;
  }
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const clientId = req.params.id;
    const dir = path.join(CLIENT_DOC_DIR, clientId);
    try {
      ensureDir(dir);
      cb(null, dir);
    } catch (err) {
      cb(err, dir);
    }
  },
  filename(req, file, cb) {
    const originalName = path.basename(file.originalname || "documento");
    const safeOriginal = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_") || "documento";
    cb(null, `${Date.now()}-${safeOriginal}`);
  },
});

const upload = multer({ storage });

function ensureCollections() {
  db.clients ||= [];
  db.cases ||= [];
  db.invoices ||= [];
  db.expenses ||= [];
  db.clients.forEach(ensureClientDefaults);
}

function sanitize(value) {
  return String(value ?? "").trim();
}

function absoluteStaticUrl(req, relativePath) {
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

function normalizeClientType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "ufficio" ? "ufficio" : "fiducia";
}

function ensureClientDefaults(client) {
  if (!client) return;
  client.documents = Array.isArray(client.documents) ? client.documents : [];
  client.clientType = normalizeClientType(client.clientType);
}

function serializeDocument(doc, req) {
  if (!doc) return doc;
  const basePath = doc.filePath ? `/static/${String(doc.filePath).split(path.sep).join("/")}` : doc.url || "";
  return {
    ...doc,
    url: basePath ? absoluteStaticUrl(req, basePath) : "",
  };
}

function serializeClient(client, req) {
  ensureClientDefaults(client);
  return {
    ...client,
    documents: (client.documents || []).map((doc) => serializeDocument(doc, req)),
  };
}

function findClient(id) {
  ensureCollections();
  const client = db.clients.find((item) => item.id === id);
  if (!client) return null;
  ensureClientDefaults(client);
  return client;
}

router.get("/", (req, res) => {
  ensureCollections();
  res.json((db.clients || []).map((client) => serializeClient(client, req)));
});

router.get("/:id", (req, res) => {
  const client = findClient(req.params.id);
  if (!client) return res.status(404).json({ message: "Cliente non trovato" });
  res.json(serializeClient(client, req));
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
    clientType: normalizeClientType(body.clientType),
    createdAt: now,
    updatedAt: now,
    documents: [],
  };

  db.clients.push(client);
  saveDB();
  res.json(serializeClient(client, req));
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
    clientType: normalizeClientType(patch.clientType ?? current.clientType),
    updatedAt: new Date().toISOString(),
  };

  db.clients[idx] = next;
  saveDB();
  res.json(serializeClient(next, req));
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

  (removed.documents || []).forEach((doc) => {
    if (doc?.filePath) {
      const abs = path.join(STATIC_ROOT, doc.filePath);
      fs.promises.unlink(abs).catch(() => {});
    }
  });
  removeDirRecursive(path.join(CLIENT_DOC_DIR, removed.id)).catch(() => {});

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

router.get("/:id/documents", (req, res) => {
  ensureCollections();
  const client = findClient(req.params.id);
  if (!client) return res.status(404).json({ message: "Cliente non trovato" });
  res.json((client.documents || []).map((doc) => serializeDocument(doc, req)));
});

router.post("/:id/documents", upload.single("file"), (req, res) => {
  ensureCollections();
  const client = findClient(req.params.id);
  if (!client) return res.status(404).json({ message: "Cliente non trovato" });

  const body = req.body || {};
  const doc = {
    id: uuidv4(),
    title: sanitize(body.title) || "Documento",
    description: sanitize(body.description),
    date: body?.date || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    url: sanitize(body.url),
  };

  if (req.file) {
    const relPath = path.relative(STATIC_ROOT, req.file.path).split(path.sep).join("/");
    doc.url = `/static/${relPath}`;
    doc.filePath = relPath;
    doc.fileName = req.file.originalname;
    doc.fileSize = req.file.size;
  }

  if (!doc.url) {
    return res.status(400).json({ message: "Carica un file o specifica un URL" });
  }

  client.documents.push(doc);
  client.updatedAt = new Date().toISOString();
  saveDB();
  res.json(serializeDocument(doc, req));
});

router.delete("/:id/documents/:docId", (req, res) => {
  ensureCollections();
  const client = findClient(req.params.id);
  if (!client) return res.status(404).json({ message: "Cliente non trovato" });
  client.documents = Array.isArray(client.documents) ? client.documents : [];
  const ix = client.documents.findIndex((doc) => doc.id === req.params.docId);
  if (ix < 0) return res.status(404).json({ message: "Documento non trovato" });
  const [removed] = client.documents.splice(ix, 1);
  if (removed?.filePath) {
    const abs = path.join(STATIC_ROOT, removed.filePath);
    fs.promises.unlink(abs).catch(() => {});
  }
  client.updatedAt = new Date().toISOString();
  saveDB();
  res.json({ ok: true });
});

export default router;
