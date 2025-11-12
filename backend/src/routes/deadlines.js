// backend/src/routes/deadlines.js
import express from "express";
import { db, saveDB } from "../db.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// Lista (filtri opzionali: caseId, from, to)
router.get("/", (req, res) => {
  const { caseId, from, to } = req.query || {};
  let arr = db.deadlines || [];
  if (caseId) arr = arr.filter(d => d.caseId === caseId);
  if (from)   arr = arr.filter(d => String(d.date||"") >= String(from));
  if (to)     arr = arr.filter(d => String(d.date||"") <= String(to));
  res.json(arr.sort((a,b)=> String(a.date||"").localeCompare(String(b.date||""))));
});

router.post("/", (req, res) => {
  const b = req.body || {};
  const d = {
    id: uuidv4(),
    caseId: b.caseId || null,
    date: b.date || new Date().toISOString().slice(0,10),
    time: b.time || "",              // HH:mm (opzionale)
    type: b.type || "scadenza",      // es: udienza, deposito, termine perentorio…
    title: b.title || "",
    note: b.note || "",
    createdAt: new Date().toISOString()
  };
  (db.deadlines ||= []).push(d);
  saveDB();
  res.json(d);
});

router.put("/:id", (req, res) => {
  const ix = (db.deadlines||[]).findIndex(x => x.id === req.params.id);
  if (ix < 0) return res.status(404).json({ message: "Non trovata" });
  db.deadlines[ix] = { ...db.deadlines[ix], ...req.body, updatedAt: new Date().toISOString() };
  saveDB();
  res.json(db.deadlines[ix]);
});

router.delete("/:id", (req, res) => {
  const ix = (db.deadlines||[]).findIndex(x => x.id === req.params.id);
  if (ix < 0) return res.status(404).json({ message: "Non trovata" });
  db.deadlines.splice(ix, 1);
  saveDB();
  res.json({ ok: true });
});

export default router;
