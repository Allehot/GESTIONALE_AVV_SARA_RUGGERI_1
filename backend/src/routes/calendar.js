
import express from "express";
import { db } from "../db.js";

const router = express.Router();

const TZID = "Europe/Rome";
function esc(s){ return String(s||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\,").replace(/;/g,"\;"); }
function formatDateTime(dateStr, timeStr){
  const base = new Date(`${dateStr}T${timeStr || "00:00"}`);
  if (Number.isNaN(base.getTime())) return null;
  const pad = (v) => String(v).padStart(2,"0");
  return `${base.getUTCFullYear()}${pad(base.getUTCMonth()+1)}${pad(base.getUTCDate())}T${pad(base.getUTCHours())}${pad(base.getUTCMinutes())}00Z`;
}
function formatDate(dateStr){ return String(dateStr||"").replaceAll("-",""); }

function toICS(list){
  const L = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gestionale Studio//IT",
    "CALSCALE:GREGORIAN",
    `X-WR-TIMEZONE:${TZID}`,
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Scadenze Studio",
  ];

  list.forEach((d)=>{
    if (!d?.date) return;
    const uid = `${d.id || Math.random().toString(36).slice(2)}@gestionale`;
    const dtStart = d.time ? formatDateTime(d.date, d.time) : null;
    const dtEnd = d.time ? formatDateTime(d.date, d.time || "00:00") : null;
    const dtStartLine = dtStart ? `DTSTART:${dtStart}` : `DTSTART;VALUE=DATE:${formatDate(d.date)}`;
    const dtEndLine = dtEnd ? `DTEND:${dtEnd}` : null;
    const lines = [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${formatDateTime(new Date().toISOString().slice(0,10), new Date().toISOString().slice(11,16))}`,
      dtStartLine,
      dtEndLine,
      `SUMMARY:${esc(d.title||d.type||"Scadenza")}`,
    ].filter(Boolean);

    const descParts = [];
    if (d.note) descParts.push(`Note: ${esc(d.note)}`);
    if (d.delegate) descParts.push(`Delegato: ${esc(d.delegate)}`);
    if (d.hearingNotes) descParts.push(`Note udienza: ${esc(d.hearingNotes)}`);
    if (descParts.length) lines.push(`DESCRIPTION:${descParts.join("\\n")}`);
    if (d.caseId) lines.push(`CATEGORIES:Caso ${esc(d.caseId)}`);
    lines.push("STATUS:CONFIRMED");
    lines.push("BEGIN:VALARM");
    lines.push("TRIGGER:-PT30M");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:Promemoria ${esc(d.title||d.type||"scadenza")}`);
    lines.push("END:VALARM");
    lines.push("END:VEVENT");

    L.push(...lines);
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
