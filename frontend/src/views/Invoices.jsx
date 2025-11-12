import React, { useEffect, useMemo, useState } from "react";
import { api, fmtMoney } from "../api";

const LINE_TYPES = [
  { value: "onorario", label: "Onorario" },
  { value: "spesa", label: "Spese" },
  { value: "anticipo", label: "Anticipo" },
  { value: "rimborso", label: "Rimborso" },
];

const getLineTypeLabel = (type) => {
  if (!type) return "Voce";
  const normalized = String(type).toLowerCase();
  if (normalized === "manual") return "Onorario";
  const match = LINE_TYPES.find((t) => t.value === normalized);
  return match ? match.label : "Voce";
};

function SummaryCard({ title, value, accent = "default" }) {
  const colors = {
    default: { background: "#eef2ff", color: "#3730a3" },
    success: { background: "#dcfce7", color: "#166534" },
    warning: { background: "#fef3c7", color: "#92400e" },
  };
  const tone = colors[accent] || colors.default;
  return (
    <div
      className="card"
      style={{ background: tone.background, color: tone.color, padding: "16px 20px" }}
    >
      <div style={{ fontSize: 12, textTransform: "uppercase", opacity: 0.8 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>€ {fmtMoney(value)}</div>
    </div>
  );
}

function LineList({ invoice, onAdd, onRemove }) {
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("onorario");
  return (
    <div className="grid" style={{ gap: 8 }}>
      <div className="grid" style={{ gap: 4 }}>
        {(invoice.lines || []).map((line) => (
          <div key={line.id} className="row between" style={{ padding: "4px 0" }}>
            <div>
              <b>{getLineTypeLabel(line.type)}</b>
              {line.description && line.description !== getLineTypeLabel(line.type) && (
                <span> — {line.description}</span>
              )}
              <span> — € {fmtMoney(line.amount)}</span>
            </div>
            <button className="ghost" onClick={() => onRemove(line.id)}>
              ❌
            </button>
          </div>
        ))}
        {(invoice.lines || []).length === 0 && (
          <div style={{ opacity: 0.6 }}>Nessuna riga presente.</div>
        )}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {LINE_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input placeholder="Descrizione" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <input placeholder="Importo" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button
          onClick={() => {
            const v = Number(String(amount).replace(",", "."));
            if (!(v > 0)) return;
            onAdd({
              description: desc || getLineTypeLabel(type),
              amount: v,
              type,
            });
            setDesc("");
            setAmount("");
            setType("onorario");
          }}
        >
          ➕ Riga
        </button>
      </div>
    </div>
  );
}

function PaymentsList({ invoice, onAdd, onRemove }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  return (
    <div className="grid" style={{ gap: 8 }}>
      <div className="grid" style={{ gap: 4 }}>
        {(invoice.payments || []).map((p) => (
          <div key={p.id} className="row between" style={{ padding: "4px 0" }}>
            <div>
              {p.date} — € {fmtMoney(p.amount)}
            </div>
            <button className="ghost" onClick={() => onRemove(p.id)}>
              ❌
            </button>
          </div>
        ))}
        {(invoice.payments || []).length === 0 && <div style={{ opacity: 0.6 }}>Nessun pagamento registrato.</div>}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <input
          placeholder="Importo"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ flex: 1 }}
        />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button
          onClick={() => {
            const v = Number(String(amount).replace(",", "."));
            if (!(v > 0)) return;
            onAdd({ amount: v, date: date || undefined });
            setAmount("");
            setDate("");
          }}
        >
          ➕ Pagamento
        </button>
      </div>
    </div>
  );
}

function AttachExpensesModal({ invoice, onClose, onSaved }) {
  const [expenses, setExpenses] = useState([]);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    async function load() {
      if (!invoice?.caseId) {
        setExpenses([]);
        return;
      }
      const list = await api.caseExpenses(invoice.caseId);
      setExpenses(list.filter((e) => !e.billedInvoiceId));
    }
    load();
  }, [invoice?.caseId]);

  return (
    <div className="modal">
      <div className="pane grid" style={{ gap: 12, minWidth: 420 }}>
        <b>Collega spese alla fattura {invoice.number}</b>
        <div className="grid" style={{ gap: 8, maxHeight: 260, overflow: "auto" }}>
          {expenses.map((e) => {
            const checked = selected.has(e.id);
            return (
              <label key={e.id} className="row" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(ev) => {
                    const next = new Set(selected);
                    if (ev.target.checked) next.add(e.id);
                    else next.delete(e.id);
                    setSelected(next);
                  }}
                />
                <span>
                  {e.date} — {e.description || "spesa"} — € {fmtMoney(e.amount)}
                </span>
              </label>
            );
          })}
          {expenses.length === 0 && <div style={{ opacity: 0.6 }}>Nessuna spesa disponibile.</div>}
        </div>
        <div className="row end" style={{ gap: 8 }}>
          <button className="ghost" onClick={onClose}>
            Chiudi
          </button>
          <button
            onClick={async () => {
              if (!selected.size) return onClose();
              await api.attachExpensesToInvoice(invoice.id, Array.from(selected));
              onSaved?.();
              onClose();
            }}
          >
            Collega selezionate
          </button>
        </div>
      </div>
    </div>
  );
}

function EditInvoiceModal({ invoice, onClose, onSaved }) {
  const [form, setForm] = useState({
    date: invoice.date || "",
    dueDate: invoice.dueDate || "",
    notes: invoice.notes || "",
  });
  return (
    <div className="modal">
      <div className="pane grid" style={{ gap: 12, minWidth: 380 }}>
        <b>Modifica fattura {invoice.number}</b>
        <label className="grid" style={{ gap: 4 }}>
          Data documento
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </label>
        <label className="grid" style={{ gap: 4 }}>
          Scadenza pagamento
          <input type="date" value={form.dueDate || ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </label>
        <textarea
          rows={4}
          placeholder="Note"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <div className="row end" style={{ gap: 8 }}>
          <button className="ghost" onClick={onClose}>
            Annulla
          </button>
          <button
            onClick={async () => {
              await api.updateInvoice(invoice.id, form);
              onSaved?.();
              onClose();
            }}
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}

function NewInvoiceModal({ clients, cases, onClose, onSaved }) {
  const [clientId, setClient] = useState(clients[0]?.id || "");
  const [caseId, setCase] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState([{ description: "Onorario", amount: "", type: "onorario" }]);

  const caseOptions = useMemo(() => cases.filter((p) => p.clientId === clientId), [cases, clientId]);

  useEffect(() => {
    if (caseOptions.length) setCase(caseOptions[0].id);
    else setCase("");
  }, [clientId, caseOptions]);

  return (
    <div className="modal">
      <div className="pane grid" style={{ gap: 12, minWidth: 420 }}>
        <b>Nuova fattura</b>
        <select value={clientId} onChange={(e) => setClient(e.target.value)}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={caseId} onChange={(e) => setCase(e.target.value)}>
          <option value="">Senza pratica</option>
          {caseOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number} — {p.subject}
            </option>
          ))}
        </select>
        <label className="grid" style={{ gap: 4 }}>
          Scadenza pagamento
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <div className="grid" style={{ gap: 8 }}>
          {lines.map((line, idx) => (
            <div key={idx} className="row" style={{ gap: 8 }}>
              <select
                value={line.type || "onorario"}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...next[idx], type: e.target.value };
                  setLines(next);
                }}
              >
                {LINE_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                placeholder="Descrizione"
                value={line.description}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...next[idx], description: e.target.value };
                  setLines(next);
                }}
              />
              <input
                placeholder="Importo"
                value={line.amount}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...next[idx], amount: e.target.value };
                  setLines(next);
                }}
              />
              {lines.length > 1 && (
                <button
                  className="ghost"
                  onClick={() => {
                    const next = lines.filter((_, i) => i !== idx);
                    setLines(next.length ? next : [{ description: "", amount: "", type: "onorario" }]);
                  }}
                >
                  ❌
                </button>
              )}
            </div>
          ))}
          <button
            className="ghost"
            onClick={() => setLines([...lines, { description: "", amount: "", type: "onorario" }])}
          >
            ➕ Aggiungi riga
          </button>
        </div>
        <div className="row end" style={{ gap: 8 }}>
          <button className="ghost" onClick={onClose}>
            Annulla
          </button>
          <button
            onClick={async () => {
              const payload = {
                clientId,
                caseId: caseId || null,
                dueDate: dueDate || null,
                lines: lines
                  .map((l) => ({
                    description: l.description || getLineTypeLabel(l.type || "onorario"),
                    amount: Number(String(l.amount).replace(",", ".")),
                    type: l.type || "onorario",
                  }))
                  .filter((l) => l.amount > 0),
              };
              if (!payload.lines.length) return;
              await api.createInvoice(payload);
              onSaved?.();
              onClose();
            }}
          >
            Crea fattura
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoiceCard({
  invoice,
  clients,
  cases,
  onRefresh,
  onAttach,
  onEdit,
}) {
  const [expanded, setExpanded] = useState(false);
  const client = clients.find((c) => c.id === invoice.clientId);
  const caseItem = cases.find((c) => c.id === invoice.caseId);
  const statusTone = invoice.status === "pagata" ? "success" : invoice.overdue ? "warning" : "default";

  return (
    <div className="card grid" style={{ gap: 12 }}>
      <div className="row between" style={{ alignItems: "center" }}>
        <div className="grid" style={{ gap: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{invoice.number}</div>
          <div style={{ opacity: 0.8 }}>{client?.name || "Senza cliente"}</div>
          {caseItem && <div style={{ opacity: 0.6 }}>{caseItem.number} — {caseItem.subject}</div>}
        </div>
        <div className="grid" style={{ textAlign: "right", gap: 4 }}>
          <div>Data: {invoice.date}</div>
          {invoice.dueDate && <div style={{ opacity: 0.7 }}>Scade: {invoice.dueDate}</div>}
          <Badge label={invoice.status} tone={statusTone} />
        </div>
      </div>
      <div className="row between" style={{ alignItems: "center" }}>
        <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
          <div>
            Totale <b>€ {fmtMoney(invoice.totals?.totale || 0)}</b>
          </div>
          <div>
            Incassato <b>€ {fmtMoney(invoice.paid || 0)}</b>
          </div>
          <div>
            Residuo <b>€ {fmtMoney(invoice.residuo || 0)}</b>
          </div>
          {invoice.overdue && (
            <div style={{ color: "#b91c1c", fontWeight: 600 }}>In ritardo</div>
          )}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Chiudi" : "Dettagli"}
          </button>
          <button className="ghost" onClick={() => onAttach(invoice)}>
            📎 Spese
          </button>
          <button className="ghost" onClick={() => onEdit(invoice)}>
            ✏️ Modifica
          </button>
          <button
            className="ghost"
            onClick={async () => {
              const r = await api.invoicePdf(invoice.id);
              if (r?.url) window.open(r.url, "_blank");
            }}
          >
            🧾 PDF
          </button>
          <button
            className="ghost"
            style={{ color: "#b91c1c" }}
            onClick={async () => {
              if (!window.confirm(`Eliminare la fattura ${invoice.number}?`)) return;
              try {
                await api.deleteInvoice(invoice.id);
                onRefresh();
              } catch (e) {
                console.error(e);
                alert(e.message || "Errore eliminazione fattura");
              }
            }}
          >
            🗑️ Elimina
          </button>
        </div>
      </div>
      {expanded && (
        <div className="grid" style={{ gap: 16, borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
          <div className="grid" style={{ gap: 8 }}>
            <b>Righe fattura</b>
            <LineList
              invoice={invoice}
              onAdd={async (line) => {
                await api.addInvoiceLine(invoice.id, line);
                onRefresh();
              }}
              onRemove={async (lineId) => {
                await api.removeInvoiceLine(invoice.id, lineId);
                onRefresh();
              }}
            />
          </div>
          <div className="grid" style={{ gap: 8 }}>
            <b>Pagamenti</b>
            <PaymentsList
              invoice={invoice}
              onAdd={async (payload) => {
                await api.addPayment(invoice.id, payload);
                onRefresh();
              }}
              onRemove={async (paymentId) => {
                await api.removePayment(invoice.id, paymentId);
                onRefresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ label, tone = "default" }) {
  const palette = {
    default: { background: "#eef2ff", color: "#312e81" },
    success: { background: "#dcfce7", color: "#166534" },
    warning: { background: "#fef3c7", color: "#92400e" },
  };
  const style = palette[tone] || palette.default;
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        textTransform: "uppercase",
        background: style.background,
        color: style.color,
      }}
    >
      {label}
    </span>
  );
}

export default function Invoices() {
  const [list, setList] = useState([]);
  const [clients, setClients] = useState([]);
  const [cases, setCases] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [attachFor, setAttachFor] = useState(null);
  const [editInvoice, setEditInvoice] = useState(null);
  const [filter, setFilter] = useState("tutte");
  const [search, setSearch] = useState("");

  async function load() {
    const [invs, cl, cs] = await Promise.all([api.invoices(), api.clients(), api.cases()]);
    setList(invs);
    setClients(cl);
    setCases(cs);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return list.filter((inv) => {
      const matchesStatus = filter === "tutte" || inv.status === filter;
      if (!matchesStatus) return false;
      if (!term) return true;
      const client = clients.find((c) => c.id === inv.clientId);
      const caseItem = cases.find((c) => c.id === inv.caseId);
      return (
        inv.number.toLowerCase().includes(term) ||
        (client?.name || "").toLowerCase().includes(term) ||
        (caseItem?.number || "").toLowerCase().includes(term)
      );
    });
  }, [list, filter, search, clients, cases]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, inv) => {
        acc.totale += Number(inv.totals?.totale || 0);
        acc.paid += Number(inv.paid || 0);
        acc.residuo += Number(inv.residuo || 0);
        return acc;
      },
      { totale: 0, paid: 0, residuo: 0 }
    );
  }, [filtered]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row between" style={{ alignItems: "center" }}>
        <h2>Fatture</h2>
        <div className="row" style={{ gap: 8 }}>
          <input placeholder="Cerca numero/cliente" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="tutte">Tutte</option>
            <option value="emessa">Emesse</option>
            <option value="parziale">Parziali</option>
            <option value="pagata">Pagate</option>
          </select>
          <button onClick={() => setShowNew(true)}>➕ Nuova fattura</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
        <SummaryCard title="Fatturato" value={totals.totale} />
        <SummaryCard title="Incassato" value={totals.paid} accent="success" />
        <SummaryCard title="Residuo" value={totals.residuo} accent="warning" />
      </div>

      <div className="grid" style={{ gap: 16 }}>
        {filtered.map((inv) => (
          <InvoiceCard
            key={inv.id}
            invoice={inv}
            clients={clients}
            cases={cases}
            onRefresh={load}
            onAttach={(invoice) => setAttachFor(invoice)}
            onEdit={(invoice) => setEditInvoice(invoice)}
          />
        ))}
        {filtered.length === 0 && <div className="card" style={{ opacity: 0.6 }}>Nessuna fattura trovata.</div>}
      </div>

      {showNew && (
        <NewInvoiceModal
          clients={clients}
          cases={cases}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            load();
          }}
        />
      )}

      {attachFor && (
        <AttachExpensesModal
          invoice={attachFor}
          onClose={() => setAttachFor(null)}
          onSaved={() => load()}
        />
      )}

      {editInvoice && (
        <EditInvoiceModal
          invoice={editInvoice}
          onClose={() => setEditInvoice(null)}
          onSaved={() => {
            setEditInvoice(null);
            load();
          }}
        />
      )}
    </div>
  );
}
