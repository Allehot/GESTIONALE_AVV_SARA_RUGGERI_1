
import express from "express";
import { db, saveDB } from "../db.js";
import { v4 as uuidv4 } from "uuid";
const router = express.Router();

router.get("/", (req, res) => res.json(db.clients || []));

router.post("/", (req, res) => {
  const b = req.body || {};
  const it = {
    id: uuidv4(),
    name: (b.name || b.ragioneSociale || "Nuovo cliente").trim(),
    fiscalCode: (b.fiscalCode || "").trim(),
    vatNumber: (b.vatNumber || "").trim(),
    email: (b.email || "").trim(),
    pec: (b.pec || "").trim(),
    phone: (b.phone || "").trim(),
    address: (b.address || "").trim(),
    notes: (b.notes || "").trim(),
  };
  (db.clients ||= []).push(it);
  saveDB();
  res.json(it);
});

// ... (resto del file uguale a prima: GET/:id, PUT/:id, DELETE/:id, /:id/casi, /:id/fatture, /:id/expenses)
//const router = express.Router();

// elenco
router.get("/", (req,res)=>{
  res.json(db.clients || []);
});

// dettaglio
router.get("/:id", (req,res)=>{
  const c = (db.clients||[]).find(x=> x.id===req.params.id);
  if(!c) return res.status(404).json({message:"Cliente non trovato"});
  res.json(c);
});

// crea
router.post("/", (req,res)=>{
  const body = req.body || {};
  const name = (body.name || body.ragioneSociale || body.denominazione || "").toString().trim();
  if(!name) return res.status(400).json({ message:"Nome obbligatorio" });

  const exists = (db.clients||[]).some(c=> (c.name||"").toLowerCase()===name.toLowerCase() && (c.fiscalCode||"")===(body.fiscalCode||""));
  if(exists) return res.status(409).json({ message:"Cliente già presente" });

  const c = {
    id: uuidv4(),
    name,
    fiscalCode: body.fiscalCode || "",
    vatNumber: body.vatNumber || "",
    email: body.email || "",
    pec: body.pec || "",
    phone: body.phone || "",
    address: body.address || "",
    notes: body.notes || ""
  };
  (db.clients ||= []).push(c);
  saveDB();
  res.json(c);
});

// spese del cliente
router.get("/:id/expenses", (req,res)=>{
  const caseIds = new Set((db.cases||[]).filter(p=>p.clientId===req.params.id).map(p=>p.id));
  const out = (db.expenses||[]).filter(e => e.clientId===req.params.id || caseIds.has(e.caseId));
  res.json(out);
});

router.post("/:id/expenses", (req,res)=>{
  const payload = req.body || {};
  const v = Number(payload.amount||0);
  if(!(v>0)) return res.status(400).json({message:"Importo > 0"});
  const item = {
    id: uuidv4(),
    clientId: req.params.id,
    caseId: payload.caseId || null,
    date: payload.date || new Date().toISOString().slice(0,10),
    description: payload.description || "",
    amount: v,
    type: payload.type || "spesa",
    documentRef: payload.documentRef || ""
  };
  (db.expenses ||= []).push(item);
  saveDB();
  res.json(item);
});

export default router;
