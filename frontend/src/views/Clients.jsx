import React, { useEffect, useState } from "react";
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

  return (
    <div className="grid">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>Clienti</h2>
        <div className="row" style={{ gap: 8 }}>
          <button
            className="ghost"
            onClick={async () => {
              try {
                const blob = await api.exportExcel();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "export.xlsx";
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

      <Banner text={err} />

      <div className="grid">
        {list.map((c) => (
          <div key={c.id} className="card row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700 }}>{c.name}</div>
              <div style={{ opacity: 0.7 }}>{c.fiscalCode || c.vatNumber || ""}</div>
            </div>

            <div className="row" style={{ gap: 6 }}>
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
        {list.length === 0 && (
          <div className="card" style={{ opacity: 0.6 }}>
            Nessun cliente.
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
