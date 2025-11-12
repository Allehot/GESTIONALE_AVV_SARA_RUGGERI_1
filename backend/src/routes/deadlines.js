// backend/src/routes/deadlines.js
import express from "express";
import { db, saveDB } from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

function ensureDeadlineDefaults(deadline) {
  if (!deadline) return deadline;
  if (typeof deadline.completed !== "boolean") {
    deadline.completed = Boolean(deadline.completedAt);
  }
  if (deadline.completed) {
    deadline.completedAt = deadline.completedAt || deadline.updatedAt || deadline.createdAt || new Date().toISOString();
  } else {
    deadline.completedAt = null;
  }
  return deadline;
}

function normalizeList(list) {
  return (Array.isArray(list) ? list : []).map((item) => ensureDeadlineDefaults(item));
}

// Lista (filtri opzionali: caseId, from, to, status)
router.get("/", (req, res) => {
  const { caseId, from, to, status, includeCompleted } = req.query || {};
  let arr = normalizeList(db.deadlines);
  if (caseId) arr = arr.filter((d) => d.caseId === caseId);
  if (from) arr = arr.filter((d) => String(d.date || "") >= String(from));
  if (to) arr = arr.filter((d) => String(d.date || "") <= String(to));

  const statusNormalized = String(status || "").toLowerCase();
  const includeCompletedNormalized = String(includeCompleted || "").toLowerCase();
  if (statusNormalized === "active" || includeCompletedNormalized === "false") {
    arr = arr.filter((d) => !d.completed);
  } else if (statusNormalized === "completed") {
    arr = arr.filter((d) => d.completed);
  }

  res.json(arr.sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""))));
});

router.post("/", (req, res) => {
  const b = req.body || {};
  const d = {
    id: uuidv4(),
    caseId: b.caseId || null,
    clientId: b.clientId || null,
    date: b.date || new Date().toISOString().slice(0,10),
    time: b.time || "",              // HH:mm (opzionale)
    type: b.type || "scadenza",      // es: udienza, deposito, termine perentorio…
    title: b.title || "",
    note: b.note || "",
    createdAt: new Date().toISOString(),
    updatedAt: null,
    completed: false,
    completedAt: null,
  };
  (db.deadlines ||= []).push(d);
  saveDB();
  res.json(ensureDeadlineDefaults(d));
});

router.put("/:id", (req, res) => {
  const ix = (db.deadlines||[]).findIndex(x => x.id === req.params.id);
  if (ix < 0) return res.status(404).json({ message: "Non trovata" });
  const prev = ensureDeadlineDefaults(db.deadlines[ix]);
  const patch = { ...req.body };

  if ("completed" in patch) {
    patch.completed = Boolean(patch.completed);
  }
  if ("completedAt" in patch) {
    if (!patch.completedAt) {
      patch.completedAt = null;
    } else {
      const dt = new Date(patch.completedAt);
      patch.completedAt = Number.isNaN(dt.getTime()) ? null : dt.toISOString();
    }
  }

  const next = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  if (!next.completed && patch.completedAt === undefined) {
    next.completedAt = null;
  }
  if (next.completed && !next.completedAt) {
    next.completedAt = new Date().toISOString();
  }

  db.deadlines[ix] = next;
  saveDB();
  res.json(ensureDeadlineDefaults(db.deadlines[ix]));
});

router.delete("/:id", (req, res) => {
  const ix = (db.deadlines||[]).findIndex(x => x.id === req.params.id);
  if (ix < 0) return res.status(404).json({ message: "Non trovata" });
  db.deadlines.splice(ix, 1);
  saveDB();
  res.json({ ok: true });
});

router.post("/:id/complete", (req, res) => {
  const it = (db.deadlines || []).find((d) => d.id === req.params.id);
  if (!it) return res.status(404).json({ message: "Non trovata" });
  ensureDeadlineDefaults(it);
  if (!it.completed) {
    it.completed = true;
    it.completedAt = new Date().toISOString();
    it.updatedAt = new Date().toISOString();
  }
  saveDB();
  res.json(ensureDeadlineDefaults(it));
});

router.post("/:id/reopen", (req, res) => {
  const it = (db.deadlines || []).find((d) => d.id === req.params.id);
  if (!it) return res.status(404).json({ message: "Non trovata" });
  ensureDeadlineDefaults(it);
  if (it.completed) {
    it.completed = false;
    it.completedAt = null;
    it.updatedAt = new Date().toISOString();
  }
  saveDB();
  res.json(ensureDeadlineDefaults(it));
});

export default router;
