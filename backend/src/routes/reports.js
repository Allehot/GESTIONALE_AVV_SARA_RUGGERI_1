
import express from "express";
import { db } from "../db.js";

const router = express.Router();
const A = x => Array.isArray(x) ? x : (x ? [x] : []);
const num = (v) => (isFinite(+v) ? +v : 0);
const invTotal = (i)=> i?.totals?.totale!=null ? num(i.totals.totale) : A(i.lines).reduce((s,l)=> s+num(l?.amount),0);
const invPaid = (i)=> A(i.payments).reduce((s,p)=> s + num(p?.amount), 0);

router.get("/dashboard", (req,res)=>{
  const invs = db.invoices || [];
  const fatture = invs.length;
  const fatturato = invs.reduce((s,i)=> s + invTotal(i), 0);
  const incassato = invs.reduce((s,i)=> s + invPaid(i), 0);
  const insoluti  = Math.max(0, fatturato - incassato);

  const overdue = [];
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const clientsById = new Map((db.clients || []).map((c)=> [c.id, c]));

  invs.forEach((inv)=>{
    if (!inv?.dueDate) return;
    const due = new Date(inv.dueDate);
    if (Number.isNaN(due.getTime())) return;
    const residuo = +(invTotal(inv) - invPaid(inv)).toFixed(2);
    if (residuo <= 0) return;
    if (due >= startOfToday) return;
    const client = clientsById.get(inv.clientId);
    const existing = overdue.find((o)=> o.clientId === inv.clientId) || overdue[overdue.push({
      clientId: inv.clientId,
      clientName: client?.name || "Cliente",
      totalResiduo: 0,
      invoices: [],
    }) - 1];
    existing.totalResiduo = +(existing.totalResiduo + residuo).toFixed(2);
    existing.invoices.push({
      id: inv.id,
      number: inv.number,
      dueDate: inv.dueDate,
      residuo,
    });
  });

  overdue.sort((a,b)=> b.totalResiduo - a.totalResiduo);

  const activeDeadlines = (db.deadlines || []).filter((x) => !x.completed && !x.completedAt);

  res.json({
    clienti: (db.clients||[]).length,
    pratiche: (db.cases||[]).length,
    fattureTotali: fatture,
    importoFatture: +fatturato.toFixed(2),
    insoluti: +insoluti.toFixed(2),
    scadenzeMese: activeDeadlines.filter(x=> String(x.date||"").slice(0,7) === new Date().toISOString().slice(0,7)).length,
    morosi: overdue.slice(0, 10),
  });
});

router.get("/recenti", (req,res)=>{
  const now = new Date();
  const in30 = new Date(now.getTime()+30*24*3600*1000);
  const casesById = new Map((db.cases||[]).map((c)=> [c.id, c]));
  const clientsById = new Map((db.clients||[]).map((c)=> [c.id, c]));
  const list = (db.deadlines||[])
    .filter((x)=> !x.completed && !x.completedAt)
    .filter(x=> !!x.date && !isNaN(new Date(x.date)))
    .map(x=> {
      const caseInfo = x.caseId ? casesById.get(x.caseId) : null;
      const client = x.clientId ? clientsById.get(x.clientId) : (caseInfo ? clientsById.get(caseInfo.clientId) : null);
      return {
        id: x.id,
        title: x.title||x.type||"scadenza",
        date: x.date,
        time: x.time || "",
        type: x.type || "scadenza",
        caseNumber: caseInfo?.number || "",
        caseSubject: caseInfo?.subject || "",
        clientName: client?.name || "",
      };
    })
    .filter(x=> { const d=new Date(x.date); return d>=now && d<=in30; })
    .sort((a,b)=> new Date(a.date)-new Date(b.date));
  res.json(list.slice(0,50));
});

router.get("/mesi", (req,res)=>{
  const now = new Date();
  const out = [];
  for(let i=11;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const tot = (db.invoices||[]).filter(inv=> String(inv.date||"").startsWith(ym)).reduce((s,inv)=> s + invTotal(inv), 0);
    out.push({ label: d.toLocaleString("it-IT",{month:"short"}), total: +tot.toFixed(2) });
  }
  res.json(out);
});

export default router;
