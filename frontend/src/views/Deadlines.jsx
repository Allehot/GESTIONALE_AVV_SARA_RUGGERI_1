import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";

// ——— utility date ———
const toYMD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
};
const addDays = (d, n) => {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
};
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
// Monday=1 … Sunday=7
const isoWeekday = (d) => (d.getDay() === 0 ? 7 : d.getDay());
const startOfGrid = (d) => {
  const s = startOfMonth(d);
  const diff = isoWeekday(s) - 1; // to Monday
  return addDays(s, -diff);
};
const isSameDay = (a, b) => toYMD(a) === toYMD(b);

// ——— colori per tipo ———
const colorByType = (type) => {
  const t = String(type || "").toLowerCase();
  if (t.includes("udienza")) return "#ef4444";
  if (t.includes("deposit")) return "#8b5cf6";
  if (t.includes("termine")) return "#10b981";
  if (t.includes("scadenza")) return "#f59e0b";
  return "#3b82f6"; // default
};

function DayModal({ date, items, onClose, onSaved }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [type, setType] = useState("scadenza");
  const [note, setNote] = useState("");
  const [caseId, setCaseId] = useState("");
  const [cases, setCases] = useState([]);

  useEffect(() => { (async () => setCases(await api.cases()))(); }, []);

  return (
    <div className="modal">
      <div className="pane grid" style={{ minWidth: 420 }}>
        <b>Appuntamenti — {date}</b>

        <div className="grid" style={{ gap: 6 }}>
          {items.map((d) => (
            <div key={d.id} className="row between" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 6 }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {d.time || ""} {d.title || d.type}
                </div>
                <div style={{ opacity: .7 }}>{d.note || ""}</div>
              </div>
              <button className="ghost" onClick={async () => { await api.deleteDeadline(d.id); onSaved && onSaved(); }}>
                Elimina
              </button>
            </div>
          ))}
          {items.length === 0 && <div style={{ opacity: .6 }}>Nessun appuntamento.</div>}
        </div>

        <div style={{ height: 1, background: "#e5e7eb", margin: "6px 0" }} />

        <b>Nuovo appuntamento</b>
        <select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
          <option value="">(nessuna pratica)</option>
          {cases.map(c => <option key={c.id} value={c.id}>{c.number} — {c.subject}</option>)}
        </select>
        <div className="row">
          <input type="time" value={time} onChange={e => setTime(e.target.value)} />
          <select value={type} onChange={e => setType(e.target.value)}>
            <option>udienza</option>
            <option>deposito</option>
            <option>termine</option>
            <option>scadenza</option>
          </select>
        </div>
        <input placeholder="Titolo" value={title} onChange={e => setTitle(e.target.value)} />
        <input placeholder="Nota" value={note} onChange={e => setNote(e.target.value)} />

        <div className="row end">
          <button className="ghost" onClick={onClose}>Chiudi</button>
          <button onClick={async () => {
            await api.addDeadline({ caseId: caseId || null, date, time, type, title, note });
            setTitle(""); setTime(""); setNote("");
            onSaved && onSaved();
          }}>Aggiungi</button>
        </div>
      </div>
    </div>
  );
}

export default function Deadlines() {
  const [items, setItems] = useState([]);
  const [monthRef, setMonthRef] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [dayOpen, setDayOpen] = useState(null); // 'YYYY-MM-DD'

  async function load() {
    const d = await api.deadlines();
    setItems(Array.isArray(d) ? d : []);
  }
  useEffect(() => { load(); }, []);

  const eventsByDate = useMemo(() => {
    const m = new Map();
    (items || []).forEach(d => {
      const k = String(d.date || "");
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(d);
    });
    // ordina per orario
    for (const k of m.keys()) {
      m.set(k, m.get(k).sort((a, b) => String(a.time || "").localeCompare(String(b.time || ""))));
    }
    return m;
  }, [items]);

  const grid = useMemo(() => {
    const first = startOfGrid(monthRef);
    const arr = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(first, i);
      const ymd = toYMD(d);
      arr.push({
        date: d,
        ymd,
        inMonth: d.getMonth() === monthRef.getMonth(),
        isToday: isSameDay(d, new Date()),
        events: eventsByDate.get(ymd) || []
      });
    }
    return arr;
  }, [monthRef, eventsByDate]);

  const monthLabel = useMemo(() => {
    return monthRef.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  }, [monthRef]);

  const weekdays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  return (
    <div className="grid">
      <div className="row between">
        <h2>Calendario</h2>
        <div className="row" style={{ gap: 8 }}>
          <a href="/api/calendar/ics" target="_blank" rel="noreferrer">
            <button className="ghost">📥 ICS</button>
          </a>
          <button className="ghost" onClick={() => setMonthRef(new Date(monthRef.getFullYear(), monthRef.getMonth() - 1, 1))}>◀︎</button>
          <button className="ghost" onClick={() => setMonthRef(new Date())}>Oggi</button>
          <button className="ghost" onClick={() => setMonthRef(new Date(monthRef.getFullYear(), monthRef.getMonth() + 1, 1))}>▶︎</button>
        </div>
      </div>

      <div className="card cal">
        <div className="row between" style={{ marginBottom: 8 }}>
          <b style={{ textTransform: "capitalize" }}>{monthLabel}</b>
          <div className="row" style={{ gap: 12, fontSize: 12 }}>
            <span className="row" style={{ gap: 6 }}><span className="legend" style={{ background: "#ef4444" }} /> Udienza</span>
            <span className="row" style={{ gap: 6 }}><span className="legend" style={{ background: "#8b5cf6" }} /> Deposito</span>
            <span className="row" style={{ gap: 6 }}><span className="legend" style={{ background: "#10b981" }} /> Termine</span>
            <span className="row" style={{ gap: 6 }}><span className="legend" style={{ background: "#f59e0b" }} /> Scadenza</span>
            <span className="row" style={{ gap: 6 }}><span className="legend" style={{ background: "#3b82f6" }} /> Altro</span>
          </div>
        </div>

        <div className="cal-grid">
          {weekdays.map((d) => <div key={d} className="cal-head">{d}</div>)}

          {grid.map((g) => {
            const moreCount = Math.max(0, (g.events.length - 3));
            return (
              <div
                key={g.ymd}
                className={
                  "cal-cell" +
                  (g.inMonth ? "" : " cal-out") +
                  (g.isToday ? " cal-today" : "")
                }
                onClick={() => setDayOpen(g.ymd)}
              >
                <div className="row between" style={{ marginBottom: 4 }}>
                  <div style={{ fontWeight: 700 }}>{g.date.getDate()}</div>
                </div>
                <div>
                  {g.events.slice(0, 3).map((e) => (
                    <span key={e.id} className="badge" style={{ background: colorByType(e.type) }}>
                      {(e.time || "").slice(0, 5)} {e.title || e.type}
                    </span>
                  ))}
                  {moreCount > 0 && <div className="more">+{moreCount} altri…</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista “agenda” (facoltativa, utile per vedere tutto il mese) */}
      <div className="card">
        <b>Agenda mese</b>
        <div className="grid" style={{ marginTop: 6 }}>
          {(items || [])
            .filter(d => {
              const dt = new Date(d.date);
              return dt.getFullYear() === monthRef.getFullYear() && dt.getMonth() === monthRef.getMonth();
            })
            .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
            .map(d => (
              <div key={d.id} className="row between" style={{ borderBottom: "1px dashed #e5e7eb", padding: "6px 0" }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="legend" style={{ background: colorByType(d.type) }} />
                  <div style={{ width: 90 }}>{d.date} {d.time || ""}</div>
                  <div><b>{d.title || d.type}</b> <span style={{ opacity: .7 }}>{d.note || ""}</span></div>
                </div>
                <button className="ghost" onClick={async () => { await api.deleteDeadline(d.id); await load(); }}>
                  Elimina
                </button>
              </div>
            ))}
          {items.filter(d => {
            const dt = new Date(d.date);
            return dt.getFullYear() === monthRef.getFullYear() && dt.getMonth() === monthRef.getMonth();
          }).length === 0 && <div style={{ opacity: .6 }}>Nessun evento nel mese.</div>}
        </div>
      </div>

      {dayOpen && (
        <DayModal
          date={dayOpen}
          items={eventsByDate.get(dayOpen) || []}
          onClose={() => setDayOpen(null)}
          onSaved={() => { setDayOpen(null); load(); }}
        />
      )}
    </div>
  );
}
