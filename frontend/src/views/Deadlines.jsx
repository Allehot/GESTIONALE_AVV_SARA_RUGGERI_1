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

const mapEventsByDate = (entries = []) => {
  const m = new Map();
  (entries || []).forEach((d) => {
    const key = String(d.date || "");
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(d);
  });
  for (const key of m.keys()) {
    m.set(
      key,
      m
        .get(key)
        .slice()
        .sort((a, b) => String(a.time || "").localeCompare(String(b.time || ""))),
    );
  }
  return m;
};

function DayModal({ date, items, onClose, onUpdated }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [type, setType] = useState("scadenza");
  const [note, setNote] = useState("");
  const [caseId, setCaseId] = useState("");
  const [cases, setCases] = useState([]);
  const [modalBusyId, setModalBusyId] = useState(null);

  useEffect(() => { (async () => setCases(await api.cases()))(); }, []);

  async function refresh() {
    if (typeof onUpdated !== "function") return;
    const maybe = onUpdated();
    if (maybe && typeof maybe.then === "function") {
      await maybe;
    }
  }

  return (
    <div className="modal">
      <div className="pane grid" style={{ minWidth: 420 }}>
        <b>Appuntamenti — {date}</b>

        <div className="grid" style={{ gap: 6 }}>
          {items.map((d) => {
            const completed = Boolean(d.completedAt || d.completed);
            return (
              <div
                key={d.id}
                className="row between"
                style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 6 }}
              >
                <div style={{ opacity: completed ? 0.6 : 1 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      textDecoration: completed ? "line-through" : "none",
                    }}
                  >
                    {d.time || ""} {d.title || d.type}
                  </div>
                  <div style={{ opacity: 0.7 }}>{d.note || ""}</div>
                  {completed && d.completedAt && (
                    <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                      Completata il {new Date(d.completedAt).toLocaleString("it-IT")}
                    </div>
                  )}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button
                    className="ghost"
                    disabled={modalBusyId === d.id}
                    onClick={async () => {
                      try {
                        setModalBusyId(d.id);
                        if (completed) {
                          await api.reopenDeadline(d.id);
                        } else {
                          await api.completeDeadline(d.id);
                        }
                        await refresh();
                      } finally {
                        setModalBusyId(null);
                      }
                    }}
                  >
                    {completed ? "Riattiva" : "Completa"}
                  </button>
                  <button
                    className="ghost"
                    disabled={modalBusyId === d.id}
                    onClick={async () => {
                      try {
                        setModalBusyId(d.id);
                        await api.deleteDeadline(d.id);
                        await refresh();
                      } finally {
                        setModalBusyId(null);
                      }
                    }}
                  >
                    Elimina
                  </button>
                </div>
              </div>
            );
          })}
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
            await refresh();
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
  const [showCompleted, setShowCompleted] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    try {
      const d = await api.deadlines();
      setItems(
        Array.isArray(d)
          ? d.map((item) => ({
              ...item,
              completed: Boolean(item.completedAt || item.completed),
            }))
          : [],
      );
    } catch (err) {
      console.error("Errore caricamento scadenze", err);
    }
  }
  useEffect(() => { load(); }, []);

  const visibleItems = useMemo(
    () => (showCompleted ? items : (items || []).filter((d) => !d.completed && !d.completedAt)),
    [items, showCompleted],
  );

  const eventsByDateAll = useMemo(() => mapEventsByDate(items), [items]);
  const eventsByDate = useMemo(() => mapEventsByDate(visibleItems), [visibleItems]);

  const hiddenCompletedCount = useMemo(
    () => (showCompleted ? 0 : Math.max(0, (items || []).length - (visibleItems || []).length)),
    [items, visibleItems, showCompleted],
  );

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
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <div className="row" style={{ gap: 8 }}>
            <a href="/api/calendar/ics" target="_blank" rel="noreferrer">
              <button className="ghost">📥 ICS</button>
            </a>
            <button className="ghost" onClick={() => setMonthRef(new Date(monthRef.getFullYear(), monthRef.getMonth() - 1, 1))}>◀︎</button>
            <button className="ghost" onClick={() => setMonthRef(new Date())}>Oggi</button>
            <button className="ghost" onClick={() => setMonthRef(new Date(monthRef.getFullYear(), monthRef.getMonth() + 1, 1))}>▶︎</button>
          </div>
          <label className="row" style={{ gap: 6, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            Mostra completati
          </label>
          {!showCompleted && hiddenCompletedCount > 0 && (
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              Nascoste {hiddenCompletedCount} scadenze completate
            </span>
          )}
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
            const moreCount = Math.max(0, g.events.length - 3);
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
                  {g.events.slice(0, 3).map((e) => {
                    const completed = Boolean(e.completedAt || e.completed);
                    const bg = completed ? "#d1d5db" : colorByType(e.type);
                    const textColor = completed ? "#111827" : "#fff";
                    return (
                      <span
                        key={e.id}
                        className="badge"
                        style={{
                          background: bg,
                          color: textColor,
                          textDecoration: completed ? "line-through" : "none",
                        }}
                      >
                        {(e.time || "").slice(0, 5)} {e.title || e.type}
                      </span>
                    );
                  })}
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
          {(visibleItems || [])
            .filter(d => {
              const dt = new Date(d.date);
              return dt.getFullYear() === monthRef.getFullYear() && dt.getMonth() === monthRef.getMonth();
            })
            .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
            .map(d => (
              <div key={d.id} className="row between" style={{ borderBottom: "1px dashed #e5e7eb", padding: "6px 0" }}>
                <div className="row" style={{ gap: 8, opacity: d.completedAt ? 0.6 : 1 }}>
                  <span
                    className="legend"
                    style={{
                      background: d.completedAt ? "#d1d5db" : colorByType(d.type),
                      border: d.completedAt ? "1px solid #9ca3af" : "none",
                    }}
                  />
                  <div style={{ width: 90 }}>{d.date} {d.time || ""}</div>
                  <div>
                    <b style={{ textDecoration: d.completedAt ? "line-through" : "none" }}>{d.title || d.type}</b>
                    <span style={{ opacity: .7 }}> {d.note || ""}</span>
                    {d.completedAt && (
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Completata il {new Date(d.completedAt).toLocaleString("it-IT")}
                      </div>
                    )}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button
                    className="ghost"
                    disabled={busyId === d.id}
                    onClick={async () => {
                      try {
                        setBusyId(d.id);
                        if (d.completedAt) {
                          await api.reopenDeadline(d.id);
                        } else {
                          await api.completeDeadline(d.id);
                        }
                        await load();
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    {d.completedAt ? "Riattiva" : "Completa"}
                  </button>
                  <button
                    className="ghost"
                    disabled={busyId === d.id}
                    onClick={async () => {
                      try {
                        setBusyId(d.id);
                        await api.deleteDeadline(d.id);
                        await load();
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    Elimina
                  </button>
                </div>
              </div>
            ))}
          {visibleItems.filter(d => {
            const dt = new Date(d.date);
            return dt.getFullYear() === monthRef.getFullYear() && dt.getMonth() === monthRef.getMonth();
          }).length === 0 && <div style={{ opacity: .6 }}>Nessun evento nel mese.</div>}
        </div>
      </div>

      {dayOpen && (
        <DayModal
          date={dayOpen}
          items={eventsByDateAll.get(dayOpen) || []}
          onClose={() => setDayOpen(null)}
          onUpdated={() => load()}
        />
      )}
    </div>
  );
}
