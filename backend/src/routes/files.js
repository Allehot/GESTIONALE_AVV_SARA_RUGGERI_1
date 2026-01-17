
import express from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { randomUUID } from "crypto";
import { db, saveDB } from "../db.js";

function normalizeClientType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "ufficio" ? "ufficio" : "fiducia";
}

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

const toIsoDate = (value) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value).trim();
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

const toIsoDateTime = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const str = String(value).trim();
  if (!str) return null;
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

// Export excel
router.get("/export/excel", async (req,res)=>{
  const wb = new ExcelJS.Workbook();
  const headerStyle = {
    font: { bold: true, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } },
    alignment: { vertical: "middle", horizontal: "center" },
  };

  const addSheet = (name, rows, headers) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.addRow(headers).eachCell((cell) => {
      cell.style = headerStyle;
    });
    rows.forEach(r=> ws.addRow(headers.map(h=> r[h])));
    headers.forEach((h, idx) => {
      const column = ws.getColumn(idx + 1);
      column.width = Math.max(12, Math.min(40, h.length + 6));
    });
  };
  addSheet("clients", db.clients||[], ["id","name","fiscalCode","vatNumber","email","phone","address","notes","clientType"]);
  addSheet("cases", db.cases||[], ["id","number","clientId","subject","court","status","createdAt","legalAid"]);
  addSheet("invoices", db.invoices||[], ["id","number","date","clientId","caseId","status"]);
  addSheet("expenses", db.expenses||[], ["id","clientId","caseId","date","description","amount","type"]);
  addSheet("deadlines", db.deadlines||[], [
    "id",
    "caseId",
    "clientId",
    "date",
    "time",
    "type",
    "title",
    "note",
    "delegate",
    "hearingNotes",
    "createdAt",
    "updatedAt",
    "completed",
    "completedAt",
  ]);
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
  const deadlines = take("deadlines");
  const guardiansSheet = take("guardianships");
  const guardians = guardiansSheet.length ? guardiansSheet : take("guardians");
  // naive merge by id uniqueness
  const pushUnique = (arr, items, normalize)=>{
    const ids = new Set(arr.map(x=> x.id));
    items.forEach(raw=> {
      if (!raw) return;
      const item = normalize ? normalize(raw) : raw;
      if (!item?.id) item.id = randomUUID();
      if (ids.has(item.id)) return;
      arr.push(item);
      ids.add(item.id);
    });
  };
  pushUnique((db.clients ||= []), clients, (raw) => ({
    ...raw,
    clientType: normalizeClientType(raw.clientType),
  }));
  pushUnique((db.cases ||= []), casesArr, (c) => ({
    ...c,
    id: String(c.id || randomUUID()).trim(),
    createdAt: toIsoDateTime(c.createdAt) || new Date().toISOString(),
    updatedAt: toIsoDateTime(c.updatedAt),
    legalAid: Boolean(c.legalAid),
  }));
  pushUnique((db.invoices ||= []), invoices, (inv) => ({
    ...inv,
    id: String(inv.id || randomUUID()).trim(),
    date: toIsoDate(inv.date),
    createdAt: toIsoDateTime(inv.createdAt) || new Date().toISOString(),
    updatedAt: toIsoDateTime(inv.updatedAt),
  }));
  pushUnique((db.expenses ||= []), expenses, (exp) => ({
    ...exp,
    id: String(exp.id || randomUUID()).trim(),
    date: toIsoDate(exp.date),
  }));
  pushUnique((db.deadlines ||= []), deadlines, (d) => ({
    id: String(d.id || randomUUID()).trim(),
    caseId: d.caseId || null,
    clientId: d.clientId || null,
    date: toIsoDate(d.date) || new Date().toISOString().slice(0, 10),
    time: String(d.time || "").slice(0, 5),
    type: String(d.type || "scadenza").trim() || "scadenza",
    title: String(d.title || "").trim(),
    note: String(d.note || "").trim(),
    delegate: String(d.delegate || "").trim(),
    hearingNotes: String(d.hearingNotes || "").trim(),
    createdAt: toIsoDateTime(d.createdAt) || new Date().toISOString(),
    updatedAt: toIsoDateTime(d.updatedAt),
    completed: Boolean(d.completed || d.completedAt),
    completedAt: toIsoDateTime(d.completedAt),
  }));
  pushUnique((db.guardianships ||= []), guardians, (g)=>{
    const now = new Date();
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
  res.json({
    ok: true,
    imported: {
      clients: clients.length,
      cases: casesArr.length,
      invoices: invoices.length,
      expenses: expenses.length,
      deadlines: deadlines.length,
      guardianships: guardians.length,
    },
  });
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
