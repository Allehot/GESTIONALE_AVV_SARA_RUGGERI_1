import React, { useEffect, useMemo, useState } from "react";
import { api, fmtMoney } from "../api";

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
      await api.delExpense(id);
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

export default function Clients() {
  const [list, setList] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [clientExp, setClientExp] = useState(null);
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
          const fields = [c.name, c.fiscalCode, c.vatNumber, c.email, c.phone, c.address];
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
              </div>
              {c.notes && (
                <div style={{ marginTop: 10, color: "var(--text-secondary)" }}>
                  “{c.notes}”
                </div>
              )}
            </div>

            <div className="row" style={{ gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button className="ghost" onClick={() => setClientExp(c)}>💸 Spese</button>
              <button
                className="ghost"
                onClick={async () => {
                  const arr = await api.clientCases(c.id);
                  alert(
                    `Pratiche:\n${
                      arr.map((p) => `${p.number} - ${p.subject}`).join("\n") ||
                      "(nessuna)"
                    }`
                  );
                }}
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
    </div>
  );
}
