
import express from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { db, saveDB } from "../db.js";

function normalizeClientType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "ufficio" ? "ufficio" : "fiducia";
}

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// Export excel
router.get("/export/excel", async (req,res)=>{
  const wb = new ExcelJS.Workbook();
  const addSheet = (name, rows, headers) => {
    const ws = wb.addWorksheet(name);
    ws.addRow(headers);
    rows.forEach(r=> ws.addRow(headers.map(h=> r[h])));
  };
  addSheet("clients", db.clients||[], ["id","name","fiscalCode","vatNumber","email","phone","address","notes","clientType"]);
  addSheet("cases", db.cases||[], ["id","number","clientId","subject","court","status","createdAt"]);
  addSheet("invoices", db.invoices||[], ["id","number","date","clientId","caseId","status"]);
  addSheet("expenses", db.expenses||[], ["id","clientId","caseId","date","description","amount","type"]);
  addSheet("guardianships", db.guardianships||[], [
    "id",
    "fullName",
    "birthDate",
    "fiscalCode",
    "residence",
    "status",
    "supportLevel",
    "court",
    "judge",
    "balance",
    "createdAt",
    "updatedAt",
  ]);
  const buf = await wb.xlsx.writeBuffer();
  res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition",'attachment; filename="export.xlsx"');
  res.send(Buffer.from(buf));
});

// Import excel (append basic entities)
router.post("/import/excel", upload.single("file"), async (req,res)=>{
  if (!req.file) return res.status(400).json({ message:"File mancante" });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(req.file.buffer);
  const take = (wsName)=> {
    const ws = wb.getWorksheet(wsName);
    if (!ws) return [];
    const header = ws.getRow(1).values.slice(1);
    const rows = [];
    for(let i=2;i<=ws.rowCount;i++){
      const row = ws.getRow(i).values.slice(1);
      const obj = {};
      header.forEach((h, idx)=> obj[h] = row[idx]);
      rows.push(obj);
    }
    return rows;
  };
  const clients = take("clients");
  const casesArr = take("cases");
  const invoices = take("invoices");
  const expenses = take("expenses");
  const guardiansSheet = take("guardianships");
  const guardians = guardiansSheet.length ? guardiansSheet : take("guardians");
  // naive merge by id uniqueness
  const pushUnique = (arr, items, normalize)=>{
    const ids = new Set(arr.map(x=> x.id));
    items.forEach(raw=> {
      if (!raw?.id) return;
      const item = normalize ? normalize(raw) : raw;
      if (!item?.id || ids.has(item.id)) return;
      arr.push(item);
      ids.add(item.id);
    });
  };
  pushUnique((db.clients ||= []), clients, (raw) => ({
    ...raw,
    clientType: normalizeClientType(raw.clientType),
  }));
  pushUnique((db.cases ||= []), casesArr);
  pushUnique((db.invoices ||= []), invoices);
  pushUnique((db.expenses ||= []), expenses);
  pushUnique((db.guardianships ||= []), guardians, (g)=>{
    const now = new Date();
    const toIsoDate = (value)=>{
      if (!value) return "";
      if (value instanceof Date) return value.toISOString().slice(0,10);
      const str = String(value).trim();
      if (!str) return "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
      const parsed = new Date(str);
      return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0,10);
    };
    const toIsoDateTime = (value)=>{
      if (!value) return null;
      if (value instanceof Date) return value.toISOString();
      const str = String(value).trim();
      if (!str) return null;
      const parsed = new Date(str);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    };
    const guardian = {
      id: String(g.id).trim(),
      fullName: String(g.fullName || g.name || "").trim(),
      birthDate: toIsoDate(g.birthDate),
      fiscalCode: String(g.fiscalCode || "").trim(),
      residence: String(g.residence || "").trim(),
      status: String(g.status || "attivo").trim() || "attivo",
      supportLevel: String(g.supportLevel || g.support || "").trim(),
      court: String(g.court || "").trim(),
      judge: String(g.judge || "").trim(),
      balance: Number(g.balance || 0) || 0,
      createdAt: toIsoDateTime(g.createdAt) || now.toISOString(),
      updatedAt: toIsoDateTime(g.updatedAt) || now.toISOString(),
      notes: [],
      documents: [],
      inventory: [],
      incomes: [],
      expenses: [],
      movements: [],
      deposits: [],
      folders: [],
      timeline: [],
      careStructure: null,
      medicalExpenses: [],
      structureExpenses: [],
    };
    return guardian;
  });
  saveDB();
  res.json({ ok:true, imported: { clients: clients.length, cases: casesArr.length, invoices: invoices.length, expenses: expenses.length, guardianships: guardians.length } });
});

// DELETE expense (public path: /api/spese/:id via server mount)
router.delete("/../spese/:id", (req,res)=> res.status(404).json({message:"Use /api/spese/:id"})); // ignore

// Expose delete expense correctly
router.delete("/../../spese/:id", (req,res)=> res.status(404).json({message:"Use /api/spese/:id"})); // ignore

// A clean, mounted route from server (we'll mount as /api/files, not ideal). Let's provide a real path:
router.delete("/exp/:id", (req,res)=>{
  const id = req.params.id;
  const ix = (db.expenses||[]).findIndex(e=> e.id===id);
  if (ix<0) return res.status(404).json({message:"Spesa non trovata"});
  db.expenses.splice(ix,1);
  saveDB();
  res.json({ ok:true });
});

export default router;
