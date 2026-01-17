import React, { useEffect, useMemo, useState } from "react";
import { api, fmtMoney } from "../api";
import CaseDetail from "../components/CaseDetail.jsx";

function Banner({ text, type = "error" }) {
  if (!text) return null;
  const bg = type === "error" ? "#ffe8e8" : "#e8ffef";
  const col = type === "error" ? "#b3261e" : "#0a7a2a";
  return (
    <div style={{ background: bg, color: col, padding: 10, borderRadius: 10 }}>
      {text}
    </div>
  );
}

function NewClientModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "",
    fiscalCode: "",
    vatNumber: "",
    email: "",
    phone: "",
    address: "",
    clientType: "fiducia",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    setBusy(true);
    try {
      const payload = {
        name: form.name?.trim(),
        fiscalCode: form.fiscalCode?.trim(),
        vatNumber: form.vatNumber?.trim(),
        email: form.email?.trim(),
        phone: form.phone?.trim(),
        address: form.address?.trim(),
        clientType: form.clientType,
      };
      if (!payload.name) throw new Error("Inserisci il nome / ragione sociale");
      await api.createClient(payload);
      onSaved && onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Errore salvataggio cliente");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal">
      <div className="pane grid">
        <b>Nuovo cliente</b>
        <Banner text={err} />
        <input
          placeholder="Nome / Ragione sociale *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <select
          value={form.clientType}
          onChange={(e) => setForm({ ...form, clientType: e.target.value })}
        >
          <option value="fiducia">Cliente di fiducia</option>
          <option value="ufficio">Cliente d'ufficio</option>
        </select>
        <input
          placeholder="Codice fiscale"
          value={form.fiscalCode}
          onChange={(e) => setForm({ ...form, fiscalCode: e.target.value })}
        />
        <input
          placeholder="Partita IVA"
          value={form.vatNumber}
          onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
        />
        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          placeholder="Telefono"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          placeholder="Indirizzo"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
          <button className="ghost" onClick={onClose} disabled={busy}>
            Annulla
          </button>
          <button onClick={save} disabled={busy || !form.name.trim()}>
            Crea
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpensesModal({ client, onClose }) {
  const [list, setList] = useState([]);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    try {
      setErr("");
      setList(await api.clientExpenses(client.id));
    } catch (e) {
      console.error(e);
      setErr("Errore caricamento spese");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    try {
      setErr("");
      const v = Number(amount);
      if (!(v > 0)) throw new Error("Inserisci importo > 0");
      await api.addClientExpense(client.id, { description: desc, amount: v });
      setAmount("");
      setDesc("");
      await load();
    } catch (e) {
      setErr(e.message || "Errore aggiunta spesa");
    }
  }

  async function del(id) {
    try {
      setErr("");
      await api.deleteClientExpense(client.id, id);
      await load();
    } catch (e) {
      setErr("Errore eliminazione spesa");
    }
  }

  return (
    <div className="modal">
      <div className="pane grid">
        <b>Spese cliente — {client.name}</b>
        <Banner text={err} />
        <div className="grid">
          {list.map((e) => (
            <div
              key={e.id}
              className="row"
              style={{ justifyContent: "space-between" }}
            >
              <div>
                {e.date} — {e.description || "spesa"} — € {fmtMoney(e.amount)}
              </div>
              <button className="ghost" onClick={() => del(e.id)}>
                Elimina
              </button>
            </div>
          ))}
          {list.length === 0 && (
            <div style={{ opacity: 0.6 }}>Nessuna spesa.</div>
          )}
        </div>
        <div className="row">
          <input
            placeholder="Descrizione"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <input
            placeholder="Importo"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button onClick={add}>Aggiungi</button>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="ghost" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientDocumentsModal({ client, onClose, onUpdated }) {
  const [docs, setDocs] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", date: "", file: null, url: "" });
  const [fileKey, setFileKey] = useState(0);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setForm({ title: "", description: "", date: "", file: null, url: "" });
    setFileKey((k) => k + 1);
  };

  async function loadDocs() {
    setLoading(true);
    setErr("");
    try {
      const list = await api.clientDocuments(client.id);
      setDocs(list);
    } catch (e) {
      console.error(e);
      setErr("Errore caricamento documenti");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocs();
  }, [client.id]);

  async function uploadDoc() {
    setErr("");
    if (!form.file && !form.url.trim()) {
      setErr("Carica un file o inserisci un link");
      return;
    }
    setSaving(true);
    try {
      await api.uploadClientDocument(client.id, {
        title: form.title,
        description: form.description,
        date: form.date,
        file: form.file || undefined,
        url: form.url.trim() || undefined,
      });
      resetForm();
      await loadDocs();
      onUpdated?.();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Errore caricamento documento");
    } finally {
      setSaving(false);
    }
  }

  async function removeDoc(id) {
    if (!window.confirm("Eliminare il documento?")) return;
    setErr("");
    try {
      await api.deleteClientDocument(client.id, id);
      await loadDocs();
      onUpdated?.();
    } catch (e) {
      console.error(e);
      setErr("Errore eliminazione documento");
    }
  }

  return (
    <div className="modal">
      <div className="pane grid" style={{ gap: 12, minWidth: 480 }}>
        <b>Documenti — {client.name}</b>
        <Banner text={err} />
        <div className="grid" style={{ gap: 8, maxHeight: 260, overflow: "auto" }}>
          {loading && <div style={{ opacity: 0.6 }}>Caricamento…</div>}
          {!loading &&
            docs.map((doc) => (
              <div
                key={doc.id}
                className="row between"
                style={{ borderBottom: "1px dashed #e5e7eb", padding: "6px 0" }}
              >
                <div className="grid" style={{ gap: 2 }}>
                  <div>
                    <b>{doc.title}</b> — {doc.date || ""}
                  </div>
                  {doc.description && <div style={{ fontSize: 12, opacity: 0.7 }}>{doc.description}</div>}
                  {doc.fileName && <div style={{ fontSize: 12, opacity: 0.6 }}>{doc.fileName}</div>}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {doc.url && (
                    <a className="ghost" href={doc.url} target="_blank" rel="noreferrer">
                      Apri
                    </a>
                  )}
                  <button className="ghost" onClick={() => removeDoc(doc.id)}>
                    ❌
                  </button>
                </div>
              </div>
            ))}
          {!loading && docs.length === 0 && <div style={{ opacity: 0.6 }}>Nessun documento.</div>}
        </div>
        <div className="grid" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input
              placeholder="Titolo"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
              placeholder="Descrizione"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              key={fileKey}
              type="file"
              onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
            />
            {form.file && <span style={{ fontSize: 12 }}>{form.file.name}</span>}
            <input
              placeholder="Oppure incolla un link"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              style={{ flex: 1, minWidth: 200 }}
            />
            <button onClick={uploadDoc} disabled={saving}>
              ➕ Aggiungi documento
            </button>
          </div>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="ghost" onClick={onClose} disabled={saving}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientDeadlineModal({ client, onClose }) {
  const [cases, setCases] = useState([]);
  const [form, setForm] = useState({
    caseId: "",
    date: "",
    time: "",
    type: "udienza",
    title: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCases() {
      try {
        const arr = await api.clientCases(client.id);
        setCases(arr);
      } catch (err) {
        console.error(err);
      }
    }
    loadCases();
  }, [client.id]);

  async function save() {
    if (!form.date) {
      setError("Seleziona una data");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await api.addDeadline({
        clientId: client.id,
        caseId: form.caseId || null,
        date: form.date,
        time: form.time || null,
        type: form.type,
        title: form.title || form.type,
        note: form.note || "",
      });
      setMessage("Scadenza registrata correttamente");
      setForm({ ...form, date: "", time: "", title: "", note: "" });
    } catch (err) {
      setError(err.message || "Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal">
      <div className="pane grid" style={{ gap: 12, minWidth: 420 }}>
        <b>Nuova scadenza per {client.name}</b>
        {message && <Banner text={message} type="success" />}
        {error && <Banner text={error} />}
        <select value={form.caseId} onChange={(e) => setForm({ ...form, caseId: e.target.value })}>
          <option value="">Collega a pratica (opzionale)</option>
          {cases.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number} — {p.subject}
            </option>
          ))}
        </select>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input type="time" value={form.time || ""} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="udienza">Udienza</option>
            <option value="termine">Termine</option>
            <option value="deposito">Deposito</option>
            <option value="scadenza">Scadenza</option>
          </select>
          <input
            placeholder="Titolo"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <textarea
          rows={3}
          placeholder="Note interne"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="ghost" onClick={onClose} disabled={saving}>
            Chiudi
          </button>
          <button onClick={save} disabled={saving}>
            Salva scadenza
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientCasesModal({ client, clients, onClose, onUpdated }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCase, setEditingCase] = useState(null);

  async function loadCases() {
    setLoading(true);
    try {
      const list = await api.clientCases(client.id);
      setCases(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCases();
  }, [client.id]);

  return (
    <div className="modal">
      <div className="pane grid" style={{ gap: 12, minWidth: 520 }}>
        <div className="row between">
          <b>Pratiche di {client.name}</b>
          <button className="ghost" onClick={onClose}>
            Chiudi
          </button>
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {loading && <div style={{ opacity: 0.6 }}>Caricamento pratiche…</div>}
          {!loading && cases.length === 0 && <div style={{ opacity: 0.6 }}>Nessuna pratica collegata.</div>}
          {!loading &&
            cases.map((c) => (
              <div key={c.id} className="row between" style={{ padding: "6px 0", borderBottom: "1px dashed #e5e7eb" }}>
                <div>
                  <b>{c.number}</b> — {c.subject || "(senza oggetto)"}
                  <div style={{ fontSize: 12, opacity: 0.6 }}>{c.status || "aperta"}</div>
                </div>
                <button
                  className="ghost"
                  onClick={async () => {
                    try {
                      const detail = await api.case(c.id);
                      setEditingCase(detail);
                    } catch (err) {
                      console.error(err);
                      alert("Impossibile aprire la pratica");
                    }
                  }}
                >
                  ✏️ Modifica
                </button>
              </div>
            ))}
        </div>
        {editingCase && (
          <div className="modal">
            <div
              className="pane grid"
              style={{ gap: 16, minWidth: 900, maxWidth: "95vw", maxHeight: "85vh", overflow: "auto" }}
            >
              <div className="row between">
                <b>Dettaglio pratica</b>
                <button className="ghost" onClick={() => setEditingCase(null)}>
                  Chiudi
                </button>
              </div>
              <CaseDetail
                it={editingCase}
                clients={clients}
                onChanged={async (payload) => {
                  if (payload?.deleted) {
                    setEditingCase(null);
                    loadCases();
                    onUpdated?.();
                    return;
                  }
                  try {
                    const detail = await api.case(editingCase.id);
                    setEditingCase(detail);
                  } catch (err) {
                    console.error(err);
                  }
                  loadCases();
                  onUpdated?.();
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Clients() {
  const [list, setList] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [clientExp, setClientExp] = useState(null);
  const [deadlineFor, setDeadlineFor] = useState(null);
  const [docsClient, setDocsClient] = useState(null);
  const [casesClient, setCasesClient] = useState(null);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");

  async function load() {
    try {
      setErr("");
      setList(await api.clients());
    } catch (e) {
      console.error(e);
      setErr("Errore caricamento clienti");
    }
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const arr = Array.isArray(list) ? [...list] : [];
    const q = query.trim().toLowerCase();
    const items = q
      ? arr.filter((c) => {
          const fields = [
            c.name,
            c.fiscalCode,
            c.vatNumber,
            c.email,
            c.phone,
            c.address,
            c.clientType === "ufficio" ? "ufficio" : "fiducia",
          ];
          return fields.some((f) => String(f || "").toLowerCase().includes(q));
        })
      : arr;

    const sortByName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "it");
    const getTs = (c) => new Date(c.updatedAt || c.createdAt || 0).getTime();
    const sorters = {
      name: sortByName,
      recent: (a, b) => getTs(b) - getTs(a),
      vat: (a, b) => Number(Boolean(b.vatNumber)) - Number(Boolean(a.vatNumber)) || sortByName(a, b),
    };
    const fn = sorters[sort] || sorters.name;
    return items.sort(fn);
  }, [list, query, sort]);

  const total = list.length;
  const countVat = filtered.filter((c) => c.vatNumber).length;
  const countContacts = filtered.filter((c) => c.email || c.phone).length;
  const countNotes = filtered.filter((c) => c.notes).length;
  const pct = (n) => (filtered.length ? Math.round((n / filtered.length) * 100) : 0);

  async function handleDeleteClient(client) {
    if (!window.confirm(`Eliminare il cliente ${client.name}?`)) return;
    try {
      await api.deleteClient(client.id);
      if (clientExp?.id === client.id) setClientExp(null);
      if (deadlineFor?.id === client.id) setDeadlineFor(null);
      if (docsClient?.id === client.id) setDocsClient(null);
      if (casesClient?.id === client.id) setCasesClient(null);
      await load();
    } catch (e) {
      console.error(e);
      alert(e.message || "Errore eliminazione cliente");
    }
  }

  return (
    <div className="grid">
      <div className="card" style={{ display: "grid", gap: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0 }}>Clienti</h2>
            <p style={{ margin: "6px 0 0", color: "var(--text-secondary)" }}>
              Gestisci anagrafiche, spese collegate e esportazioni in un unico luogo.
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button
              className="ghost"
              onClick={async () => {
                try {
                  const blob = await api.exportExcel();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "export-clienti.xlsx";
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  alert("Export fallito");
                }
              }}
            >
              ⬇️ Export Excel
            </button>
            <input
              id="excelIn"
              type="file"
              accept=".xlsx"
              style={{ display: "none" }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  await api.importExcel(f);
                  await load();
                } catch {
                  alert("Import fallito");
                }
              }}
            />
            <button
              className="ghost"
              onClick={() => document.getElementById("excelIn").click()}
            >
              ⬆️ Import Excel
            </button>
            <button onClick={() => setShowNew(true)}>➕ Nuovo cliente</button>
          </div>
        </div>

        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div className="row" style={{ flex: 1, minWidth: 220 }}>
            <input
              style={{ flex: 1 }}
              placeholder="Cerca per nome, codice fiscale, email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name">Ordina per nome</option>
              <option value="recent">Più recenti</option>
              <option value="vat">Con partita IVA</option>
            </select>
          </div>
          <div style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
            {filtered.length} risultati filtrati
          </div>
        </div>
      </div>

      <Banner text={err} />

      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-title">Clienti filtrati</div>
          <div className="stat-value">{filtered.length}</div>
          <div className="stat-sub">su {total} registrati</div>
        </div>
        <div className="card stat-card">
          <div className="stat-title">Con partita IVA</div>
          <div className="stat-value">{countVat}</div>
          <div className="stat-sub">{pct(countVat)}% del filtro</div>
        </div>
        <div className="card stat-card">
          <div className="stat-title">Contatti diretti</div>
          <div className="stat-value">{countContacts}</div>
          <div className="stat-sub">{pct(countContacts)}% con email o telefono</div>
        </div>
        <div className="card stat-card">
          <div className="stat-title">Note archiviate</div>
          <div className="stat-value">{countNotes}</div>
          <div className="stat-sub">{pct(countNotes)}% con note interne</div>
        </div>
      </div>

      <div className="grid">
        {filtered.map((c) => (
          <div key={c.id} className="card client-card">
            <div>
              <div className="client-card__name">{c.name}</div>
              <div className="client-card__meta">
                {c.fiscalCode && <span className="client-chip">CF {c.fiscalCode}</span>}
                {c.vatNumber && <span className="client-chip">P.IVA {c.vatNumber}</span>}
                {c.email && <span className="client-chip">✉️ {c.email}</span>}
                {c.phone && <span className="client-chip">☎️ {c.phone}</span>}
                {c.address && <span className="client-chip">📍 {c.address}</span>}
                <span className="client-chip">
                  {c.clientType === "ufficio" ? "D'ufficio" : "Di fiducia"}
                </span>
              </div>
              {c.notes && (
                <div style={{ marginTop: 10, color: "var(--text-secondary)" }}>
                  “{c.notes}”
                </div>
              )}
            </div>

            <div className="row" style={{ gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button className="ghost" onClick={() => setClientExp(c)}>💸 Spese</button>
              <button className="ghost" onClick={() => setDeadlineFor(c)}>🗓️ Scadenza</button>
              <button
                className="ghost"
                onClick={() => setCasesClient(c)}
              >
                📂 Pratiche
              </button>
              <button
                className="ghost"
                onClick={async () => {
                  const arr = await api.clientInvoices(c.id);
                  alert(
                    `Fatture:\n${
                      arr
                        .map(
                          (f) =>
                            `${f.number} € ${Number(
                              f.totals?.totale || 0
                            ).toFixed(2)}`
                        )
                        .join("\n") || "(nessuna)"
                    }`
                  );
                }}
              >
                🧾 Fatture
              </button>
              <button className="ghost" onClick={() => setDocsClient(c)}>
                📁 Documenti
              </button>
              <button
                className="ghost"
                style={{ color: "#b91c1c" }}
                onClick={() => handleDeleteClient(c)}
              >
                🗑️ Elimina
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card" style={{ opacity: 0.65 }}>
            Nessun risultato per il filtro attuale.
          </div>
        )}
      </div>

      {showNew && (
        <NewClientModal
          onClose={() => setShowNew(false)}
          onSaved={() => load()}
        />
      )}
      {clientExp && (
        <ExpensesModal client={clientExp} onClose={() => setClientExp(null)} />
      )}
      {deadlineFor && (
        <ClientDeadlineModal client={deadlineFor} onClose={() => setDeadlineFor(null)} />
      )}
      {casesClient && (
        <ClientCasesModal
          client={casesClient}
          clients={list}
          onClose={() => setCasesClient(null)}
          onUpdated={() => load()}
        />
      )}
      {docsClient && (
        <ClientDocumentsModal
          client={docsClient}
          onClose={() => setDocsClient(null)}
          onUpdated={() => load()}
        />
      )}
    </div>
  );
}
