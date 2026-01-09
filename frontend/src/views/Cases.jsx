import React, { useEffect, useMemo, useState } from "react";
import { api, fmtMoney } from "../api";
import CaseEditModal from "../components/CaseEditModal.jsx";

const TIMELINE_LABELS = {
  log: "Nota",
  deadline: "Scadenza",
  invoice: "Fattura",
  payment: "Pagamento",
  expense: "Spesa",
  "care-structure": "Struttura",
};

function Badge({ label, tone = "default" }) {
  const tones = {
    default: { background: "#eef2ff", color: "#312e81" },
    warning: { background: "#fef3c7", color: "#92400e" },
    success: { background: "#dcfce7", color: "#166534" },
  };
  const style = tones[tone] || tones.default;
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: style.background,
        color: style.color,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

function NumberingSettingsModal({ config, preview, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    allowManual: config?.allowManual ?? true,
    separator: config?.separator || "-",
    civile: { prefix: config?.caseTypes?.civile?.prefix || "PR-CIV", pad: config?.caseTypes?.civile?.pad || 4, nextNumber: "" },
    penale: { prefix: config?.caseTypes?.penale?.prefix || "PR-PEN", pad: config?.caseTypes?.penale?.pad || 4, nextNumber: "" },
  }));

  useEffect(() => {
    setForm({
      allowManual: config?.allowManual ?? true,
      separator: config?.separator || "-",
      civile: {
        prefix: config?.caseTypes?.civile?.prefix || "PR-CIV",
        pad: config?.caseTypes?.civile?.pad || 4,
        nextNumber: "",
      },
      penale: {
        prefix: config?.caseTypes?.penale?.prefix || "PR-PEN",
        pad: config?.caseTypes?.penale?.pad || 4,
        nextNumber: "",
      },
    });
  }, [config]);

  return (
    <div className="modal">
      <div className="pane grid" style={{ gap: 16, minWidth: 480 }}>
        <b>Numerazione pratiche</b>
        <label className="row" style={{ alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={form.allowManual}
            onChange={(e) => setForm((prev) => ({ ...prev, allowManual: e.target.checked }))}
          />
          Permetti numerazione manuale
        </label>
        <label className="grid" style={{ gap: 4 }}>
          Separatore
          <input
            value={form.separator}
            onChange={(e) => setForm((prev) => ({ ...prev, separator: e.target.value || "-" }))}
          />
        </label>
        {["civile", "penale"].map((type) => (
          <div key={type} className="card grid" style={{ gap: 8 }}>
            <div className="row between" style={{ alignItems: "center" }}>
              <b>{type === "civile" ? "Pratiche civili" : "Pratiche penali"}</b>
              <Badge label={preview?.[type] || ""} />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input
                style={{ flex: 2 }}
                value={form[type].prefix}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [type]: { ...prev[type], prefix: e.target.value.toUpperCase() } }))
                }
                placeholder="Prefisso"
              />
              <input
                type="number"
                min={2}
                style={{ width: 120 }}
                value={form[type].pad}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [type]: { ...prev[type], pad: Number(e.target.value || 4) } }))
                }
                placeholder="Zeri"
              />
              <input
                type="number"
                min={1}
                style={{ width: 160 }}
                value={form[type].nextNumber}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [type]: { ...prev[type], nextNumber: e.target.value } }))
                }
                placeholder="Prossimo progressivo"
              />
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Prossimo numero generato: <b>{preview?.[type]}</b>
            </div>
          </div>
        ))}
        <div className="row end" style={{ gap: 8 }}>
          <button className="ghost" onClick={onClose}>
            Annulla
          </button>
          <button
            onClick={async () => {
              await api.updateCaseNumberingConfig({
                allowManual: form.allowManual,
                separator: form.separator || "-",
                caseTypes: {
                  civile: {
                    prefix: form.civile.prefix,
                    pad: Number(form.civile.pad) || 4,
                    nextNumber: form.civile.nextNumber ? Number(form.civile.nextNumber) : undefined,
                  },
                  penale: {
                    prefix: form.penale.prefix,
                    pad: Number(form.penale.pad) || 4,
                    nextNumber: form.penale.nextNumber ? Number(form.penale.nextNumber) : undefined,
                  },
                },
              });
              onSaved?.();
            }}
          >
            Salva configurazione
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
    <div className="card grid" style={{ gap: 8 }}>
      <b>Nuova fattura (rapida)</b>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <div style={{ minWidth: 200, opacity: 0.8 }}>{client ? client.name : "(cliente mancante)"}</div>
        <input placeholder="Descrizione" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <input placeholder="Importo" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button
          onClick={async () => {
            const v = Number(String(amount).replace(",", "."));
            if (!(v > 0)) return;
            await api.createInvoice({
              clientId: it.clientId,
              caseId: it.id,
              lines: [{ description: desc, amount: v }],
            });
            setAmount("");
            onDone?.();
          }}
        >
          Emetti
        </button>
      </div>
    </div>
  );
}

function CaseDetail({ it, clients, onChanged }) {
  const [tab, setTab] = useState("summary");
  const [timeline, setTimeline] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [deadlines, setDeadlines] = useState([]);

  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [dlTitle, setDlTitle] = useState("");
  const [dlDate, setDlDate] = useState("");
  const [dlTime, setDlTime] = useState("");
  const [dlType, setDlType] = useState("scadenza");

  const [eventTitle, setEventTitle] = useState("");
  const [eventCategory, setEventCategory] = useState("nota");
  const [eventDetail, setEventDetail] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");

  const [editOpen, setEditOpen] = useState(false);

  const dependencySummary = useMemo(() => {
    const parts = [];
    if (invoices.length) {
      parts.push(`${invoices.length} fattur${invoices.length === 1 ? "a" : "e"}`);
    }
    if (expenses.length) {
      parts.push(`${expenses.length} spes${expenses.length === 1 ? "a" : "e"}`);
    }
    if (deadlines.length) {
      parts.push(`${deadlines.length} scadenz${deadlines.length === 1 ? "a" : "e"}`);
    }
    return parts;
  }, [invoices, expenses, deadlines]);

  const deleteBlocked = invoices.length > 0;
  const cleanupSummary = useMemo(() => {
    const parts = [];
    if (expenses.length) {
      parts.push(`${expenses.length} spes${expenses.length === 1 ? "a" : "e"}`);
    }
    if (deadlines.length) {
      parts.push(`${deadlines.length} scadenz${deadlines.length === 1 ? "a" : "e"}`);
    }
    return parts;
  }, [expenses, deadlines]);

  async function loadAll() {
    const [tl, inv, ex, dl] = await Promise.all([
      api.caseTimeline(it.id),
      api.caseInvoices(it.id),
      api.caseExpenses(it.id),
      api.caseDeadlines(it.id),
    ]);
    setTimeline(tl);
    setInvoices(inv);
    setExpenses(ex);
    setDeadlines(dl);
  }

  useEffect(() => {
    loadAll();
  }, [it.id]);

  const clientName = useMemo(() => {
    const c = clients.find((x) => x.id === it.clientId);
    return c ? c.name : "";
  }, [clients, it.clientId]);
  const client = useMemo(() => clients.find((x) => x.id === it.clientId) || null, [clients, it.clientId]);
  const [importKey, setImportKey] = useState(0);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row between" style={{ alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            {it.number} — {it.subject || "(senza oggetto)"}
          </div>
          <div style={{ opacity: 0.7 }}>{clientName}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="ghost" onClick={() => setEditOpen(true)}>
            ✏️ Modifica
          </button>
          <button
            className="ghost"
            style={{ color: "#b91c1c" }}
            disabled={deleteBlocked}
            title={
              deleteBlocked
                ? `Impossibile eliminare: presenti ${dependencySummary.join(", ")}. Gestire prima le fatture collegate.`
                : undefined
            }
            onClick={async () => {
              if (deleteBlocked) {
                alert(
                  `Impossibile eliminare la pratica: risultano ancora ${dependencySummary.join(", ")}. ` +
                    "Rimuovere o riassegnare prima le fatture collegate."
                );
                return;
              }
              const cleanupText = cleanupSummary.length
                ? `\nVerranno rimosse automaticamente anche ${cleanupSummary.join(", ")}.`
                : "";
              if (!window.confirm(`Eliminare la pratica ${it.number}?${cleanupText}`)) return;
              try {
                await api.deleteCase(it.id);
                onChanged?.({ deleted: true });
              } catch (e) {
                console.error(e);
                alert(e.message || "Errore eliminazione pratica");
              }
            }}
          >
            🗑️ Elimina
          </button>
        </div>
      </div>

      {(deleteBlocked || cleanupSummary.length > 0) && (
        <div
          className="card"
          style={{
            border: "1px solid #facc15",
            background: "#fefce8",
            color: "#854d0e",
            padding: 12,
            fontSize: 14,
          }}
        >
          {deleteBlocked
            ? `Per eliminare la pratica occorre prima gestire: ${dependencySummary.join(", ")}.`
            : `Eliminando la pratica verranno rimossi anche: ${cleanupSummary.join(", ")}.`}
        </div>
      )}

      <div className="tabs">
        <div className={`tab${tab === "summary" ? " active" : ""}`} onClick={() => setTab("summary")}>
          Riepilogo
        </div>
        <div className={`tab${tab === "timeline" ? " active" : ""}`} onClick={() => setTab("timeline")}>
          Cronologia
        </div>
        <div className={`tab${tab === "invoices" ? " active" : ""}`} onClick={() => setTab("invoices")}>
          Fatture
        </div>
        <div className={`tab${tab === "expenses" ? " active" : ""}`} onClick={() => setTab("expenses")}>
          Spese
        </div>
        <div className={`tab${tab === "deadlines" ? " active" : ""}`} onClick={() => setTab("deadlines")}>
          Scadenze
        </div>
      </div>

      {tab === "summary" && (
        <div className="grid" style={{ gap: 16 }}>
          <div className="card grid" style={{ gap: 12 }}>
            <b>Dati pratica</b>
            <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
              <div>
                <span style={{ opacity: 0.6 }}>Ufficio:</span> <b>{it.court || "-"}</b>
              </div>
              <div>
                <span style={{ opacity: 0.6 }}>Giudice:</span> <b>{it.judge || "-"}</b>
              </div>
              <div>
                <span style={{ opacity: 0.6 }}>RG:</span> <b>{it.rgNumber || "-"}</b>
              </div>
              <div>
                <span style={{ opacity: 0.6 }}>Tipo:</span> <b>{it.caseType}</b>
              </div>
              <div>
                <span style={{ opacity: 0.6 }}>Procedimento:</span> <b>{it.proceedingType}</b>
              </div>
              <div>
                <span style={{ opacity: 0.6 }}>Stato:</span> <b>{it.status}</b>
              </div>
              <div>
                <span style={{ opacity: 0.6 }}>Valore:</span> <b>€ {fmtMoney(it.value)}</b>
              </div>
            </div>
          </div>

          <div className="card grid" style={{ gap: 12 }}>
            <b>Cliente</b>
            {client ? (
              <div className="grid" style={{ gap: 6 }}>
                <div>
                  <span style={{ opacity: 0.6 }}>Nome:</span> <b>{client.name}</b>
                </div>
                <div style={{ color: "var(--text-secondary)" }}>
                  {[
                    client.fiscalCode ? `CF ${client.fiscalCode}` : null,
                    client.vatNumber ? `P.IVA ${client.vatNumber}` : null,
                    client.email,
                    client.phone,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="ghost"
                    onClick={() => {
                      const payload = {
                        name: client.name || "",
                        fiscalCode: client.fiscalCode || "",
                        vatNumber: client.vatNumber || "",
                        email: client.email || "",
                        phone: client.phone || "",
                        address: client.address || "",
                        notes: client.notes || "",
                        clientType: client.clientType || "fiducia",
                      };
                      const blob = new Blob([JSON.stringify(payload, null, 2)], {
                        type: "application/json",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `cliente-${client.name || it.number}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    ⬇️ Esporta cliente
                  </button>
                  <input
                    key={importKey}
                    type="file"
                    accept="application/json"
                    style={{ display: "none" }}
                    id={`client-import-${it.id}`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async () => {
                        try {
                          const data = JSON.parse(String(reader.result || "{}"));
                          await api.updateClient(client.id, {
                            name: data.name,
                            fiscalCode: data.fiscalCode,
                            vatNumber: data.vatNumber,
                            email: data.email,
                            phone: data.phone,
                            address: data.address,
                            notes: data.notes,
                            clientType: data.clientType,
                          });
                          setImportKey((k) => k + 1);
                          onChanged?.();
                        } catch (err) {
                          console.error(err);
                          alert("Import cliente non valido");
                        }
                      };
                      reader.readAsText(file);
                    }}
                  />
                  <button
                    className="ghost"
                    onClick={() => document.getElementById(`client-import-${it.id}`)?.click()}
                  >
                    ⬆️ Importa cliente
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ opacity: 0.6 }}>Cliente non disponibile.</div>
            )}
          </div>

          <QuickInvoice it={it} clients={clients} onDone={() => loadAll().then(() => onChanged?.())} />

          <div className="card grid" style={{ gap: 12 }}>
            <b>Azioni rapide</b>
            <div className="grid" style={{ gap: 12 }}>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input placeholder="Spesa: descrizione" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} />
                <input placeholder="Importo" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} />
                <button
                  onClick={async () => {
                    const v = Number(String(expAmount).replace(",", "."));
                    if (!(v > 0)) return;
                    await api.addCaseExpense(it.id, { description: expDesc, amount: v });
                    setExpAmount("");
                    setExpDesc("");
                    loadAll();
                  }}
                >
                  Aggiungi spesa
                </button>
              </div>

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input type="date" value={dlDate} onChange={(e) => setDlDate(e.target.value)} />
                <input type="time" value={dlTime} onChange={(e) => setDlTime(e.target.value)} />
                <select value={dlType} onChange={(e) => setDlType(e.target.value)}>
                  <option value="udienza">Udienza</option>
                  <option value="deposito">Deposito</option>
                  <option value="termine">Termine</option>
                  <option value="scadenza">Scadenza</option>
                </select>
                <input
                  placeholder="Titolo scadenza"
                  value={dlTitle}
                  onChange={(e) => setDlTitle(e.target.value)}
                />
                <button
                  onClick={async () => {
                    if (!dlDate) return;
                    await api.addCaseDeadline(it.id, {
                      date: dlDate,
                      time: dlTime,
                      type: dlType,
                      title: dlTitle || dlType,
                    });
                    setDlDate("");
                    setDlTime("");
                    setDlTitle("");
                    setDlType("scadenza");
                    loadAll();
                  }}
                >
                  Aggiungi scadenza
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "timeline" && (
        <div className="card grid" style={{ gap: 12 }}>
          <b>Cronologia completa</b>
          <div className="grid" style={{ gap: 8 }}>
            {timeline.map((item) => {
              const label = item.category || TIMELINE_LABELS[item.type] || item.type;
              const dateLabel = item.createdAt
                ? new Date(item.createdAt).toLocaleString()
                : item.date || "";
              return (
                <div
                  key={item.id}
                  className="row between"
                  style={{
                    borderBottom: "1px dashed #e5e7eb",
                    padding: "6px 0",
                    alignItems: "flex-start",
                  }}
                >
                  <div className="grid" style={{ gap: 4 }}>
                    <Badge label={label} />
                    <div>
                      <b>{item.action || item.detail || item.title}</b>
                      {item.detail && item.action && item.detail !== item.action && (
                        <span style={{ marginLeft: 6, opacity: 0.7 }}>{item.detail}</span>
                      )}
                      {item.note && <div style={{ opacity: 0.8 }}>{item.note}</div>}
                      {item.amount !== undefined && (
                        <div style={{ opacity: 0.7 }}>€ {fmtMoney(item.amount)}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ opacity: 0.6, fontSize: 12 }}>{dateLabel}</div>
                </div>
              );
            })}
            {timeline.length === 0 && <div style={{ opacity: 0.6 }}>Ancora nessun evento registrato.</div>}
          </div>
          <div className="card grid" style={{ gap: 8, background: "#f9fafb" }}>
            <b>Nuovo evento manuale</b>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <input placeholder="Titolo" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} />
              <select value={eventCategory} onChange={(e) => setEventCategory(e.target.value)}>
                <option value="nota">Nota</option>
                <option value="udienza">Udienza</option>
                <option value="termine">Termine</option>
                <option value="documento">Documento</option>
                <option value="attività">Attività</option>
              </select>
              <input placeholder="Dettagli" value={eventDetail} onChange={(e) => setEventDetail(e.target.value)} />
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
              <button
                onClick={async () => {
                  if (!eventTitle) return;
                  const timestamp = eventDate
                    ? new Date(`${eventDate}T${eventTime || "09:00"}`).toISOString()
                    : new Date().toISOString();
                  await api.addCaseLog(it.id, {
                    action: eventTitle,
                    detail: eventDetail,
                    category: eventCategory,
                    createdAt: timestamp,
                    author: "manuale",
                  });
                  setEventTitle("");
                  setEventCategory("nota");
                  setEventDetail("");
                  setEventDate("");
                  setEventTime("");
                  loadAll();
                }}
              >
                Aggiungi evento
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "invoices" && (
        <div className="card grid" style={{ gap: 8 }}>
          <b>Fatture della pratica</b>
          <div className="grid" style={{ gap: 8 }}>
            {invoices.map((inv) => {
              const tot = Number(inv.totals?.totale || 0);
              const paid = Number(
                (inv.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(2)
              );
              const residuo = Number((tot - paid).toFixed(2));
              return (
                <div
                  key={inv.id}
                  className="row between"
                  style={{ borderBottom: "1px dashed #e5e7eb", padding: "6px 0" }}
                >
                  <div>
                    <b>{inv.number}</b> — € {fmtMoney(tot)} — <span style={{ opacity: 0.7 }}>{inv.status}</span> — Residuo €
                    {" "}
                    {fmtMoney(residuo)}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      className="ghost"
                      onClick={async () => {
                        const r = await api.invoicePdf(inv.id);
                        if (r?.url) window.open(r.url, "_blank");
                      }}
                    >
                      PDF
                    </button>
                    <button
                      className="ghost"
                      style={{ color: "#b91c1c" }}
                      onClick={async () => {
                        if (!window.confirm(`Eliminare la fattura ${inv.number}?`)) return;
                        try {
                          await api.deleteInvoice(inv.id);
                          await loadAll();
                          onChanged?.();
                        } catch (e) {
                          console.error(e);
                          alert(e.message || "Errore eliminazione fattura");
                        }
                      }}
                    >
                      ❌
                    </button>
                  </div>
                </div>
              );
            })}
            {invoices.length === 0 && <div style={{ opacity: 0.6 }}>Nessuna fattura.</div>}
          </div>
        </div>
      )}

      {tab === "expenses" && (
        <div className="card grid" style={{ gap: 8 }}>
          <b>Spese della pratica</b>
          <div className="grid" style={{ gap: 8 }}>
            {expenses.map((e) => (
              <div
                key={e.id}
                className="row between"
                style={{ borderBottom: "1px dashed #e5e7eb", padding: "6px 0" }}
              >
                <div>
                  {e.date} — {e.description || "spesa"} — € {fmtMoney(e.amount)}
                </div>
                <button
                  className="ghost"
                  style={{ color: "#b91c1c" }}
                  onClick={async () => {
                    if (!window.confirm("Eliminare questa spesa?")) return;
                    try {
                      await api.deleteCaseExpense(it.id, e.id);
                      loadAll();
                    } catch (err) {
                      console.error(err);
                      alert(err.message || "Errore eliminazione spesa");
                    }
                  }}
                >
                  Elimina
                </button>
              </div>
            ))}
            {expenses.length === 0 && <div style={{ opacity: 0.6 }}>Nessuna spesa.</div>}
          </div>
        </div>
      )}

      {tab === "deadlines" && (
        <div className="card grid" style={{ gap: 8 }}>
          <b>Scadenze della pratica</b>
          <div className="grid" style={{ gap: 8 }}>
            {deadlines.map((d) => (
              <div
                key={d.id}
                className="row between"
                style={{ borderBottom: "1px dashed #e5e7eb", padding: "6px 0" }}
              >
                <div>
                  <b>
                    {d.date} {d.time || ""}
                  </b>{" "}
                  — {d.title || d.type}
                  {d.note && <span style={{ opacity: 0.7 }}> — {d.note}</span>}
                </div>
              </div>
            ))}
            {deadlines.length === 0 && <div style={{ opacity: 0.6 }}>Nessuna scadenza.</div>}
          </div>
        </div>
      )}

      {editOpen && (
        <CaseEditModal
          it={it}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            onChanged?.();
            loadAll();
          }}
        />
      )}
    </div>
  );
}

function NewCaseModal({ clients, numbering, onClose, onSaved }) {
  const [form, setForm] = useState({
    clientId: clients[0]?.id || "",
    subject: "",
    court: "",
    caseType: "civile",
    manualNumber: "",
    useManual: false,
  });
  const [preview, setPreview] = useState("");

  useEffect(() => {
    async function loadPreview() {
      if (!form.caseType) return;
      try {
        const res = await api.previewCaseNumber(form.caseType);
        setPreview(res.number);
      } catch (err) {
        console.error(err);
      }
    }
    loadPreview();
  }, [form.caseType]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, clientId: clients[0]?.id || prev.clientId }));
  }, [clients]);

  const allowManual = numbering?.config?.allowManual ?? true;

  return (
    <div className="modal">
      <div className="pane grid" style={{ gap: 12, minWidth: 420 }}>
        <b>Nuova pratica</b>
        <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Oggetto"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
        />
        <input
          placeholder="Ufficio giudiziario"
          value={form.court}
          onChange={(e) => setForm({ ...form, court: e.target.value })}
        />
        <div className="row" style={{ gap: 8 }}>
          <select value={form.caseType} onChange={(e) => setForm({ ...form, caseType: e.target.value })}>
            <option value="civile">Civile</option>
            <option value="penale">Penale</option>
          </select>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, opacity: 0.6 }}>Prossimo numero</div>
            <div style={{ fontWeight: 700 }}>{preview}</div>
          </div>
        </div>
        {allowManual && (
          <label className="row" style={{ alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.useManual}
              onChange={(e) => setForm({ ...form, useManual: e.target.checked })}
            />
            Inserimento manuale
          </label>
        )}
        {allowManual && form.useManual && (
          <input
            placeholder="Numero personalizzato"
            value={form.manualNumber}
            onChange={(e) => setForm({ ...form, manualNumber: e.target.value })}
          />
        )}
        <div className="row end" style={{ gap: 8 }}>
          <button className="ghost" onClick={onClose}>
            Annulla
          </button>
          <button
            onClick={async () => {
              const payload = {
                clientId: form.clientId,
                subject: form.subject,
                court: form.court,
                caseType: form.caseType,
              };
              if (allowManual && form.useManual && form.manualNumber) {
                payload.manualNumber = form.manualNumber;
              }
              await api.createCase(payload);
              onSaved?.();
              onClose();
            }}
          >
            Crea
          </button>
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
  const [showNumbering, setShowNumbering] = useState(false);
  const [numbering, setNumbering] = useState({ config: null, preview: null });
  const [q, setQ] = useState("");

  async function load(options = {}) {
    const [p, c] = await Promise.all([api.cases(), api.clients()]);
    setList(p);
    setClients(c);
    setSel((prev) => {
      if (options.keepSelection === false) return p[0] || null;
      if (!prev) return p[0] || null;
      const fresh = p.find((x) => x.id === prev.id);
      return fresh || (p[0] || null);
    });
  }

  async function loadNumbering() {
    try {
      const res = await api.caseNumberingConfig();
      setNumbering(res);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    load();
    loadNumbering();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((p) => {
      const client = clients.find((c) => c.id === p.clientId);
      return (
        (p.number || "").toLowerCase().includes(t) ||
        (p.subject || "").toLowerCase().includes(t) ||
        (client?.name || "").toLowerCase().includes(t)
      );
    });
  }, [q, list, clients]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row between" style={{ alignItems: "center" }}>
        <h2>Pratiche</h2>
        <div className="row" style={{ gap: 8 }}>
          <input placeholder="Cerca..." value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="ghost" onClick={() => setShowNumbering(true)}>
            ⚙️ Numerazione
          </button>
          <button onClick={() => setShowNew(true)}>➕ Nuova pratica</button>
        </div>
      </div>

      <div className="two-cols" style={{ gap: 16 }}>
        <div className="card" style={{ maxHeight: "70vh", overflow: "auto", padding: 0 }}>
          {filtered.map((p) => {
            const client = clients.find((c) => c.id === p.clientId);
            const active = sel?.id === p.id;
            return (
              <div
                key={p.id}
                className="case-item"
                onClick={() => setSel(p)}
                style={{
                  background: active ? "#eef2ff" : "transparent",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <div style={{ fontWeight: 700 }}>{p.number}</div>
                <div style={{ opacity: 0.8 }}>{p.subject || "(senza oggetto)"}</div>
                <div style={{ opacity: 0.6, fontSize: 12 }}>{client?.name || ""}</div>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ padding: 16, opacity: 0.6 }}>Nessuna pratica.</div>}
        </div>

        <div>
          {sel ? (
            <CaseDetail
              it={sel}
              clients={clients}
              onChanged={(payload) => {
                if (payload?.deleted) {
                  load({ keepSelection: false });
                } else {
                  load();
                }
              }}
            />
          ) : (
            <div className="card" style={{ opacity: 0.6 }}>Seleziona una pratica dall'elenco.</div>
          )}
        </div>
      </div>

      {showNew && (
        <NewCaseModal
          clients={clients}
          numbering={numbering}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            load();
          }}
        />
      )}

      {showNumbering && (
        <NumberingSettingsModal
          config={numbering?.config}
          preview={numbering?.preview}
          onClose={() => setShowNumbering(false)}
          onSaved={async () => {
            await loadNumbering();
            setShowNumbering(false);
          }}
        />
      )}
    </div>
  );
}
