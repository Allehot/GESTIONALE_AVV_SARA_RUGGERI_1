
import express from "express";
import { db } from "../db.js";

const router = express.Router();
const A = x => Array.isArray(x) ? x : (x ? [x] : []);
const num = (v) => (isFinite(+v) ? +v : 0);
const invTotal = (i)=> i?.totals?.totale!=null ? num(i.totals.totale) : A(i.lines).reduce((s,l)=> s+num(l?.amount),0);

router.get("/dashboard", (req,res)=>{
  const invs = db.invoices || [];
  const fatture = invs.length;
  const fatturato = invs.reduce((s,i)=> s + invTotal(i), 0);
  const incassato = invs.reduce((s,i)=> s + A(i.payments).reduce((x,p)=> x + num(p.amount), 0), 0);
  const insoluti  = Math.max(0, fatturato - incassato);
  res.json({
    clienti: (db.clients||[]).length,
    pratiche: (db.cases||[]).length,
    fattureTotali: fatture,
    importoFatture: +fatturato.toFixed(2),
    insoluti: +insoluti.toFixed(2),
    scadenzeMese: (db.deadlines||[]).filter(x=> String(x.date||"").slice(0,7) === new Date().toISOString().slice(0,7)).length
  });
});

router.get("/recenti", (req,res)=>{
  const now = new Date();
  const in30 = new Date(now.getTime()+30*24*3600*1000);
  const list = (db.deadlines||[])
    .filter(x=> !!x.date && !isNaN(new Date(x.date)))
    .map(x=> ({ title: x.title||x.type||"scadenza", date: x.date }))
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
