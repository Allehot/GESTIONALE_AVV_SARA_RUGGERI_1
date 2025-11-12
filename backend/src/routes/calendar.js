
import express from "express";
import { db } from "../db.js";

const router = express.Router();

function esc(s){ return String(s||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\,").replace(/;/g,"\;"); }
function toICS(list){
  const L = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Gestionale Studio//IT"];
  list.forEach(d=>{
    if (!d?.date) return;
    const ymd = String(d.date).replaceAll("-","");
    L.push("BEGIN:VEVENT");
    L.push(`UID:${d.id||Math.random().toString(36).slice(2)}@gestionale`);
    L.push(`DTSTART;VALUE=DATE:${ymd}`);
    L.push(`SUMMARY:${esc(d.title||d.type||"Scadenza")}`);
    L.push("END:VEVENT");
  });
  L.push("END:VCALENDAR");
  return L.join("\r\n");
}

router.get("/ics", (req,res)=>{
  const list = (db.deadlines||[]).filter((d) => !d.completed && !d.completedAt);
  const ics = toICS(list);
  res.setHeader("Content-Type","text/calendar; charset=utf-8");
  res.send(ics);
});

export default router;
