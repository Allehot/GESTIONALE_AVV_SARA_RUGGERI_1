import React, { useEffect, useMemo, useState } from "react";
import { api, fmtMoney } from "../api";

function EditCaseModal({ it, onClose, onSaved }) {
  const [form, setForm] = useState({
    subject: it.subject || "",
    court: it.court || "",
    section: it.section || "",
    judge: it.judge || "",
    rgNumber: it.rgNumber || "",
    caseType: it.caseType || "civile",
    proceedingType: it.proceedingType || "giudiziale",
    status: it.status || "aperta",
    value: it.value || 0,
  });
  return (
    <div className="modal">
      <div className="pane grid">
        <b>Modifica pratica {it.number}</b>
        <input placeholder="Oggetto" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <input placeholder="Ufficio" value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} />
        <input placeholder="Sezione" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
        <input placeholder="Giudice" value={form.judge} onChange={(e) => setForm({ ...form, judge: e.target.value })} />
        <input placeholder="RG" value={form.rgNumber} onChange={(e) => setForm({ ...form, rgNumber: e.target.value })} />
        <div className="row">
          <select value={form.caseType} onChange={(e) => setForm({ ...form, caseType: e.target.value })}>
            <option value="civile">Civile</option>
            <option value="penale">Penale</option>
          </select>
          <select value={form.proceedingType} onChange={(e) => setForm({ ...form, proceedingType: e.target.value })}>
            <option value="giudiziale">Giudiziale</option>
            <option value="stragiudiziale">Stragiudiziale</option>
          </select>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="aperta">Aperta</option>
            <option value="sospesa">Sospesa</option>
            <option value="chiusa">Chiusa</option>
          </select>
          <input type="number" step="0.01" placeholder="Valore" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
        </div>
        <div className="row end">
          <button className="ghost" onClick={onClose}>Annulla</button>
          <button onClick={async () => { await api.updateCase(it.id, { ...form, value: Number(form.value || 0) }); onSaved && onSaved(); onClose(); }}>
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickInvoice({ it, clients, onDone }) {
  const [desc, setDesc] = useState("Onorario");
  const [amount, setAmount] = useState("");
  const client = useMemo(() => clients.find((c) => c.id === it.clientId), [clients, it.clientId]);
  return (
    <div className="card grid">
      <b>Nuova fattura (rapida)</b>
      <div className="row">
        <div style={{ minWidth: 200, opacity: .8 }}>{client ? client.name : "(cliente mancante)"}</div>
        <input placeholder="Descrizione" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <input placeholder="Importo" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button onClick={async () => {
          const v = Number(amount); if (!(v > 0)) return;
          await api.createInvoice({ clientId: it.clientId, caseId: it.id, lines: [{ description: desc, amount: v }] });
          setAmount("");
          onDone && onDone();
        }}>Emetti</button>
      </div>
    </div>
  );
}

function CaseDetail({ it, clients, onChanged }) {
  const [tab, setTab] = useState("summary");
  const [logs, setLogs] = useState([]);
  const [logText, setLogText] = useState("");

  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [deadlines, setDeadlines] = useState([]);

  const [expDesc, setExpDesc] = useState(""); const [expAmount, setExpAmount] = useState("");
  const [dlTitle, setDlTitle] = useState(""); const [dlDate, setDlDate] = useState(""); const [dlTime, setDlTime] = useState(""); const [dlType, setDlType] = useState("scadenza");

  const [editOpen, setEditOpen] = useState(false);

  async function loadAll() {
    const [lg, inv, ex, dl] = await Promise.all([
      api.caseLogs(it.id),
      api.caseInvoices(it.id),
      api.caseExpenses(it.id),
      api.caseDeadlines(it.id),
    ]);
    setLogs(lg); setInvoices(inv); setExpenses(ex); setDeadlines(dl);
  }
  useEffect(() => { loadAll(); }, [it.id]);

  const clientName = useMemo(() => {
    const c = clients.find((x) => x.id === it.clientId);
    return c ? c.name : "";
  }, [clients, it.clientId]);

  return (
    <div className="grid">
      <div className="row between">
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{it.number} — {it.subject || "(senza oggetto)"}</div>
          <div style={{ opacity: .7 }}>{clientName}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="ghost" onClick={() => setEditOpen(true)}>✏️ Modifica</button>
        </div>
      </div>

      <div className="tabs">
        <div className={"tab" + (tab === "summary" ? " active" : "")} onClick={() => setTab("summary")}>Riepilogo</div>
        <div className={"tab" + (tab === "history" ? " active" : "")} onClick={() => setTab("history")}>Cronologia</div>
        <div className={"tab" + (tab === "invoices" ? " active" : "")} onClick={() => setTab("invoices")}>Fatture</div>
        <div className={"tab" + (tab === "expenses" ? " active" : "")} onClick={() => setTab("expenses")}>Spese</div>
        <div className={"tab" + (tab === "deadlines" ? " active" : "")} onClick={() => setTab("deadlines")}>Scadenze</div>
      </div>

      {tab === "summary" && (
        <div className="grid">
          <div className="card grid">
            <b>Dati pratica</b>
            <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
              <div><span style={{ opacity: .6 }}>Ufficio:</span> <b>{it.court || "-"}</b></div>
              <div><span style={{ opacity: .6 }}>Giudice:</span> <b>{it.judge || "-"}</b></div>
              <div><span style={{ opacity: .6 }}>RG:</span> <b>{it.rgNumber || "-"}</b></div>
              <div><span style={{ opacity: .6 }}>Tipo:</span> <b>{it.caseType}</b></div>
              <div><span style={{ opacity: .6 }}>Procedimento:</span> <b>{it.proceedingType}</b></div>
              <div><span style={{ opacity: .6 }}>Stato:</span> <b>{it.status}</b></div>
              <div><span style={{ opacity: .6 }}>Valore:</span> <b>€ {fmtMoney(it.value)}</b></div>
            </div>
          </div>

          <QuickInvoice it={it} clients={clients} onDone={() => { loadAll(); onChanged && onChanged(); }} />

          <div className="card grid">
            <b>Azioni rapide</b>
            <div className="row" style={{ gap: 8 }}>
              {/* nuova spesa */}
              <input placeholder="Spesa: descrizione" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} />
              <input placeholder="Importo" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} />
              <button onClick={async () => {
                const v = Number(expAmount); if (!(v > 0)) return;
                await api.addCaseExpense(it.id, { description: expDesc, amount: v });
                setExpAmount(""); setExpDesc(""); loadAll();
              }}>Aggiungi spesa</button>

              {/* nuova scadenza */}
              <input type="date" value={dlDate} onChange={(e) => setDlDate(e.target.value)} />
              <input type="time" value={dlTime} onChange={(e) => setDlTime(e.target.value)} />
              <select value={dlType} onChange={(e) => setDlType(e.target.value)}>
                <option>udienza</option><option>deposito</option><option>termine</option><option>scadenza</option>
              </select>
              <input placeholder="Titolo scadenza" value={dlTitle} onChange={(e) => setDlTitle(e.target.value)} />
              <button onClick={async () => {
                if (!dlDate) return;
                await api.addCaseDeadline(it.id, { date: dlDate, time: dlTime, type: dlType, title: dlTitle || dlType });
                setDlDate(""); setDlTime(""); setDlTitle(""); setDlType("scadenza"); loadAll();
              }}>Aggiungi scadenza</button>
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="card grid">
          <b>Cronologia</b>
          <div className="grid">
            {logs.map((l) => (
              <div key={l.id} className="row between" style={{ borderBottom: "1px dashed #e5e7eb", padding: "6px 0" }}>
                <div><b>{l.action}</b> — <span style={{ opacity: .8 }}>{l.detail}</span></div>
                <div style={{ opacity: .6, fontSize: 12 }}>{new Date(l.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {logs.length === 0 && <div style={{ opacity: .6 }}>Nessun evento.</div>}
          </div>
          <div className="row end">
            <input placeholder="Nota / evento" value={logText} onChange={(e) => setLogText(e.target.value)} />
            <button onClick={async () => {
              if (!logText.trim()) return;
              await api.addCaseLog(it.id, { action: "nota-manuale", detail: logText });
              setLogText(""); loadAll();
            }}>Aggiungi nota</button>
          </div>
        </div>
      )}

      {tab === "invoices" && (
        <div className="card grid">
          <b>Fatture della pratica</b>
          <div className="grid">
            {invoices.map((inv) => {
              const tot = Number(inv.totals?.totale || 0);
              const paid = Number((inv.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(2));
              const residuo = Number((tot - paid).toFixed(2));
              return (
                <div key={inv.id} className="row between" style={{ borderBottom: "1px dashed #e5e7eb", padding: "6px 0" }}>
                  <div><b>{inv.number}</b> — € {fmtMoney(tot)} — <span style={{ opacity: .7 }}>{inv.status}</span> — Residuo € {fmtMoney(residuo)}</div>
                  <button className="ghost" onClick={async () => { const r = await api.invoicePdf(inv.id); if (r?.url) window.open(r.url, "_blank"); }}>PDF</button>
                </div>
              );
            })}
            {invoices.length === 0 && <div style={{ opacity: .6 }}>Nessuna fattura.</div>}
          </div>
        </div>
      )}

      {tab === "expenses" && (
        <div className="card grid">
          <b>Spese della pratica</b>
          <div className="grid">
            {expenses.map((e) => (
              <div key={e.id} className="row between" style={{ borderBottom: "1px dashed #e5e7eb", padding: "6px 0" }}>
                <div>{e.date} — {e.description || "spesa"} — € {fmtMoney(e.amount)}</div>
              </div>
            ))}
            {expenses.length === 0 && <div style={{ opacity: .6 }}>Nessuna spesa.</div>}
          </div>
        </div>
      )}

      {tab === "deadlines" && (
        <div className="card grid">
          <b>Scadenze della pratica</b>
          <div className="grid">
            {deadlines.map((d) => (
              <div key={d.id} className="row between" style={{ borderBottom: "1px dashed #e5e7eb", padding: "6px 0" }}>
                <div><b>{d.date} {d.time || ""}</b> — {d.title || d.type} <span style={{ opacity: .7 }}>{d.note || ""}</span></div>
              </div>
            ))}
            {deadlines.length === 0 && <div style={{ opacity: .6 }}>Nessuna scadenza.</div>}
          </div>
        </div>
      )}

      {editOpen && <EditCaseModal it={it} onClose={() => setEditOpen(false)} onSaved={() => { onChanged && onChanged(); }} />}
    </div>
  );
}

function NewCase({ clients, onClose, onSaved }) {
  const [form, setForm] = useState({ clientId: clients[0]?.id || "", subject: "", court: "" });
  return (
    <div className="modal">
      <div className="pane grid">
        <b>Nuova pratica</b>
        <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
          {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
        <input placeholder="Oggetto" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <input placeholder="Ufficio giudiziario" value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} />
        <div className="row end">
          <button className="ghost" onClick={onClose}>Annulla</button>
          <button onClick={async () => { await api.createCase(form); onSaved && onSaved(); onClose(); }}>Crea</button>
        </div>
      </div>
    </div>
  );
}

export default function Cases() {
  const [list, setList] = useState([]);
  const [clients, setClients] = useState([]);
  const [sel, setSel] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [q, setQ] = useState("");

  async function load() {
    const [p, c] = await Promise.all([api.cases(), api.clients()]);
    setList(p); setClients(c);
    if (!sel && p.length) setSel(p[0]);
    if (sel) {
      const fresh = p.find(x => x.id === sel.id);
      if (fresh) setSel(fresh);
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter(p =>
      (p.number || "").toLowerCase().includes(t) ||
      (p.subject || "").toLowerCase().includes(t) ||
      (clients.find(c => c.id === p.clientId)?.name || "").toLowerCase().includes(t)
    );
  }, [q, list, clients]);

  return (
    <div className="grid">
      <div className="row between">
        <h2>Pratiche</h2>
        <div className="row" style={{ gap: 8 }}>
          <input placeholder="Cerca..." value={q} onChange={(e) => setQ(e.target.value)} />
          <button onClick={() => setShowNew(true)}>➕ Nuova pratica</button>
        </div>
      </div>

      <div className="two-cols">
        <div className="card" style={{ maxHeight: "70vh", overflow: "auto" }}>
          {filtered.map((p) => {
            const client = clients.find(c => c.id === p.clientId);
            const active = sel?.id === p.id;
            return (
              <div key={p.id}
                   className="case-item"
                   onClick={() => setSel(p)}
                   style={{ background: active ? "#eef2ff" : "transparent" }}>
                <div style={{ fontWeight: 700 }}>{p.number}</div>
                <div style={{ opacity: .8 }}>{p.subject || "(senza oggetto)"}</div>
                <div style={{ opacity: .6, fontSize: 12 }}>{client?.name || ""}</div>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ opacity: .6 }}>Nessuna pratica.</div>}
        </div>

        <div>
          {sel ? (
            <CaseDetail it={sel} clients={clients} onChanged={() => load()} />
          ) : (
            <div className="card" style={{ opacity: .6 }}>Seleziona una pratica dall'elenco.</div>
          )}
        </div>
      </div>

      {showNew && <NewCase clients={clients} onClose={() => setShowNew(false)} onSaved={() => load()} />}
    </div>
  );
}
