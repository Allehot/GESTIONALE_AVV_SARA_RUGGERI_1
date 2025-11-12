import React, { useEffect, useState } from "react";
import { api, fmtMoney } from "../api";

function SummaryRow({ label, value }) {
  return (
    <div className="row" style={{ justifyContent: "space-between" }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <b>€ {fmtMoney(value)}</b>
    </div>
  );
}

function Timeline({ events }) {
  if (!events.length) return <div style={{ opacity: 0.6 }}>Nessun evento registrato.</div>;
  return (
    <div className="grid" style={{ gap: 8 }}>
      {events.map((ev) => (
        <div key={ev.id} className="row between" style={{ borderBottom: "1px dashed #e5e7eb", padding: "6px 0" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{ev.title || ev.type}</div>
            {ev.detail && <div style={{ opacity: 0.75 }}>{ev.detail}</div>}
            {ev.amount !== undefined && (
              <div style={{ fontSize: 12, opacity: 0.7 }}>€ {fmtMoney(ev.amount)}</div>
            )}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            {ev.date ? `${ev.date}` : new Date(ev.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

function Documents({ guardian, onRefresh }) {
  const [newFolderName, setNewFolderName] = useState("");
  const [newDoc, setNewDoc] = useState({ title: "", description: "", file: null, date: "" });
  const [fileKey, setFileKey] = useState(0);
  const [folderId, setFolderId] = useState(guardian.folders[0]?.id || "");

  useEffect(() => {
    if (!guardian.folders.find((f) => f.id === folderId)) {
      setFolderId(guardian.folders[0]?.id || "");
    }
  }, [guardian.folders, folderId]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <input
          placeholder="Nome cartella"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
        />
        <button
          onClick={async () => {
            if (!newFolderName.trim()) return;
            await api.guardianCreateFolder(guardian.id, { name: newFolderName });
            setNewFolderName("");
            onRefresh();
          }}
        >
          ➕ Cartella
        </button>
      </div>

      <div className="grid" style={{ gap: 8 }}>
        <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
          {guardian.folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        {guardian.folders
          .filter((f) => f.id === folderId)
          .map((folder) => (
            <div key={folder.id} className="grid" style={{ gap: 8 }}>
              <div className="grid" style={{ gap: 4 }}>
                {folder.documents.map((doc) => (
                  <div key={doc.id} className="row between" style={{ padding: "4px 0" }}>
                    <div>
                      <b>{doc.title}</b> — {doc.date}
                      {doc.description && <span style={{ opacity: 0.7 }}> — {doc.description}</span>}
                    </div>
                    {doc.url && (
                      <a className="ghost" href={doc.url} target="_blank" rel="noreferrer">
                        {doc.fileName ? `Apri ${doc.fileName}` : "Apri"}
                      </a>
                    )}
                    <button
                      className="ghost"
                      onClick={async () => {
                        await api.guardianDeleteDocument(guardian.id, folder.id, doc.id);
                        onRefresh();
                      }}
                    >
                      ❌
                    </button>
                  </div>
                ))}
                {folder.documents.length === 0 && <div style={{ opacity: 0.6 }}>Nessun documento.</div>}
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input
                  placeholder="Titolo"
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                />
                <input
                  placeholder="Descrizione"
                  value={newDoc.description}
                  onChange={(e) => setNewDoc({ ...newDoc, description: e.target.value })}
                />
                <input
                  key={fileKey}
                  type="file"
                  onChange={(e) => setNewDoc({ ...newDoc, file: e.target.files?.[0] || null })}
                />
                {newDoc.file && <span style={{ fontSize: 12 }}>{newDoc.file.name}</span>}
                <input
                  type="date"
                  value={newDoc.date}
                  onChange={(e) => setNewDoc({ ...newDoc, date: e.target.value })}
                />
                <button
                  onClick={async () => {
                    if (!folderId) return;
                    if (!newDoc.file) {
                      alert("Seleziona un file da caricare");
                      return;
                    }
                    await api.guardianAddDocument(guardian.id, folderId, newDoc);
                    setNewDoc({ title: "", description: "", file: null, date: "" });
                    setFileKey((k) => k + 1);
                    onRefresh();
                  }}
                >
                  ➕ Documento
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function StructureTab({ guardian, onRefresh }) {
  const structure = guardian.careStructure || {};
  const [form, setForm] = useState({
    name: structure.name || "",
    address: structure.address || "",
    contact: structure.contact || "",
    notes: structure.notes || "",
    startDate: structure.startDate || "",
    dailyRate: structure.dailyRate || "",
    monthlyCost: structure.monthlyCost || "",
  });
  const [medical, setMedical] = useState({ supplier: "", note: "", amount: "", date: "" });
  const [structureExpense, setStructureExpense] = useState({ structure: structure.name || "", note: "", amount: "", date: "" });

  useEffect(() => {
    setForm({
      name: structure.name || "",
      address: structure.address || "",
      contact: structure.contact || "",
      notes: structure.notes || "",
      startDate: structure.startDate || "",
      dailyRate: structure.dailyRate || "",
      monthlyCost: structure.monthlyCost || "",
    });
    setStructureExpense((prev) => ({ ...prev, structure: structure.name || prev.structure }));
  }, [guardian.careStructure]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card grid" style={{ gap: 12 }}>
        <b>Struttura di ricovero</b>
        <input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Indirizzo" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <input placeholder="Contatti" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
        <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        <div className="row" style={{ gap: 8 }}>
          <input
            placeholder="Costo giornaliero"
            value={form.dailyRate}
            onChange={(e) => setForm({ ...form, dailyRate: e.target.value })}
          />
          <input
            placeholder="Costo mensile"
            value={form.monthlyCost}
            onChange={(e) => setForm({ ...form, monthlyCost: e.target.value })}
          />
        </div>
        <textarea
          rows={3}
          placeholder="Note"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <div className="row end" style={{ gap: 8 }}>
          <button
            onClick={async () => {
              await api.guardianUpdateCareStructure(guardian.id, form);
              onRefresh();
            }}
          >
            Salva struttura
          </button>
        </div>
      </div>

      <div className="card grid" style={{ gap: 12 }}>
        <b>Spese mediche</b>
        <div className="grid" style={{ gap: 4 }}>
          {(guardian.medicalExpenses || []).map((m) => (
            <div key={m.id} className="row between" style={{ padding: "4px 0" }}>
              <div>
                {m.date} — {m.supplier || "Spesa medica"} — € {fmtMoney(m.amount)}
                {m.note && <span style={{ opacity: 0.7 }}> — {m.note}</span>}
              </div>
            </div>
          ))}
          {(guardian.medicalExpenses || []).length === 0 && <div style={{ opacity: 0.6 }}>Nessuna spesa registrata.</div>}
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Fornitore"
            value={medical.supplier}
            onChange={(e) => setMedical({ ...medical, supplier: e.target.value })}
          />
          <input
            placeholder="Importo"
            value={medical.amount}
            onChange={(e) => setMedical({ ...medical, amount: e.target.value })}
          />
          <input
            placeholder="Note"
            value={medical.note}
            onChange={(e) => setMedical({ ...medical, note: e.target.value })}
          />
          <input type="date" value={medical.date} onChange={(e) => setMedical({ ...medical, date: e.target.value })} />
          <button
            onClick={async () => {
              const v = Number(String(medical.amount).replace(",", "."));
              if (!(v > 0)) return;
              await api.guardianAddMedicalExpense(guardian.id, {
                ...medical,
                amount: v,
              });
              setMedical({ supplier: "", note: "", amount: "", date: "" });
              onRefresh();
            }}
          >
            ➕ Spesa medica
          </button>
        </div>
      </div>

      <div className="card grid" style={{ gap: 12 }}>
        <b>Spese struttura</b>
        <div className="grid" style={{ gap: 4 }}>
          {(guardian.structureExpenses || []).map((m) => (
            <div key={m.id} className="row between" style={{ padding: "4px 0" }}>
              <div>
                {m.date} — {m.structure || "Struttura"} — € {fmtMoney(m.amount)}
                {m.note && <span style={{ opacity: 0.7 }}> — {m.note}</span>}
              </div>
            </div>
          ))}
          {(guardian.structureExpenses || []).length === 0 && <div style={{ opacity: 0.6 }}>Nessuna spesa registrata.</div>}
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Struttura"
            value={structureExpense.structure}
            onChange={(e) => setStructureExpense({ ...structureExpense, structure: e.target.value })}
          />
          <input
            placeholder="Importo"
            value={structureExpense.amount}
            onChange={(e) => setStructureExpense({ ...structureExpense, amount: e.target.value })}
          />
          <input
            placeholder="Note"
            value={structureExpense.note}
            onChange={(e) => setStructureExpense({ ...structureExpense, note: e.target.value })}
          />
          <input
            type="date"
            value={structureExpense.date}
            onChange={(e) => setStructureExpense({ ...structureExpense, date: e.target.value })}
          />
          <button
            onClick={async () => {
              const v = Number(String(structureExpense.amount).replace(",", "."));
              if (!(v > 0)) return;
              await api.guardianAddStructureExpense(guardian.id, {
                ...structureExpense,
                amount: v,
              });
              setStructureExpense({ structure: structure.name || "", note: "", amount: "", date: "" });
              onRefresh();
            }}
          >
            ➕ Spesa struttura
          </button>
        </div>
      </div>
    </div>
  );
}

function MovementsTab({ guardian, onRefresh }) {
  const [kind, setKind] = useState("incomes");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");

  const list = guardian[kind] || [];

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid" style={{ gap: 8 }}>
        {list.map((item) => (
          <div key={item.id} className="row between" style={{ padding: "4px 0", borderBottom: "1px dashed #e5e7eb" }}>
            <div>
              {item.date} — € {fmtMoney(item.amount)}
              {item.note && <span style={{ opacity: 0.7 }}> — {item.note}</span>}
            </div>
          </div>
        ))}
        {list.length === 0 && <div style={{ opacity: 0.6 }}>Nessun movimento registrato.</div>}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="incomes">Entrata</option>
          <option value="expenses">Uscita</option>
          <option value="deposits">Deposito</option>
          <option value="movements">Movimento</option>
        </select>
        <input placeholder="Importo" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input placeholder="Nota" value={note} onChange={(e) => setNote(e.target.value)} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button
          onClick={async () => {
            const v = Number(String(amount).replace(",", "."));
            if (!(v > 0)) return;
            const payload = { amount: v, note, date: date || undefined };
            if (kind === "incomes") await api.guardianAddIncome(guardian.id, payload);
            if (kind === "expenses") await api.guardianAddExpense(guardian.id, payload);
            if (kind === "deposits") await api.guardianAddDeposit(guardian.id, payload);
            if (kind === "movements") await api.guardianAddMovement(guardian.id, payload);
            setAmount("");
            setNote("");
            setDate("");
            onRefresh();
          }}
        >
          ➕ Movimento
        </button>
      </div>
    </div>
  );
}

function GuardianTimeline({ guardian, timeline, onRefresh }) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [type, setType] = useState("nota");
  const [date, setDate] = useState("");

  return (
    <div className="card grid" style={{ gap: 12, padding: 16 }}>
      <b>Cronologia</b>
      <Timeline events={timeline} />
      <div className="card grid" style={{ gap: 8, background: "#f9fafb", padding: 12 }}>
        <b>Nuovo evento</b>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input placeholder="Titolo" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input placeholder="Dettagli" value={detail} onChange={(e) => setDetail(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="nota">Nota</option>
            <option value="udienza">Udienza</option>
            <option value="scadenza">Scadenza</option>
            <option value="visita">Visita</option>
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button
            onClick={async () => {
              if (!title.trim()) return;
              await api.guardianAddTimeline(guardian.id, {
                title,
                detail,
                type,
                date: date || undefined,
              });
              setTitle("");
              setDetail("");
              setType("nota");
              setDate("");
              onRefresh();
            }}
          >
            ➕ Evento
          </button>
        </div>
      </div>
    </div>
  );
}

function GuardianDetail({ guardian, summary, timeline, onRefresh }) {
  const [tab, setTab] = useState("summary");
  const totals = summary || { incomes: 0, expenses: 0, deposits: 0, medical: 0, structure: 0, balance: 0 };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card grid" style={{ gap: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{guardian.fullName}</div>
        <div style={{ opacity: 0.7 }}>{guardian.fiscalCode}</div>
        <div style={{ opacity: 0.6 }}>{guardian.residence}</div>
      </div>

      <div className="tabs">
        <div className={`tab${tab === "summary" ? " active" : ""}`} onClick={() => setTab("summary")}>Riepilogo</div>
        <div className={`tab${tab === "movements" ? " active" : ""}`} onClick={() => setTab("movements")}>Movimenti</div>
        <div className={`tab${tab === "documents" ? " active" : ""}`} onClick={() => setTab("documents")}>Documenti</div>
        <div className={`tab${tab === "timeline" ? " active" : ""}`} onClick={() => setTab("timeline")}>Cronologia</div>
        <div className={`tab${tab === "structure" ? " active" : ""}`} onClick={() => setTab("structure")}>Struttura</div>
      </div>

      {tab === "summary" && (
        <div className="grid" style={{ gap: 16 }}>
          <div className="card grid" style={{ gap: 8 }}>
            <b>Situazione economica</b>
            <SummaryRow label="Entrate" value={totals.incomes} />
            <SummaryRow label="Uscite" value={totals.expenses} />
            <SummaryRow label="Depositi" value={totals.deposits} />
            <SummaryRow label="Spese mediche" value={totals.medical} />
            <SummaryRow label="Spese struttura" value={totals.structure} />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span style={{ opacity: 0.7 }}>Saldo</span>
              <span style={{ fontWeight: 800, color: totals.balance >= 0 ? "#166534" : "#b91c1c" }}>
                € {fmtMoney(totals.balance)}
              </span>
            </div>
          </div>
          <div className="card grid" style={{ gap: 8 }}>
            <b>Dati giudiziari</b>
            <div>Tribunale: <b>{guardian.court || "-"}</b></div>
            <div>Giudice: <b>{guardian.judge || "-"}</b></div>
            <div>Supporto: <b>{guardian.supportLevel || "-"}</b></div>
          </div>
        </div>
      )}

      {tab === "movements" && <MovementsTab guardian={guardian} onRefresh={onRefresh} />}

      {tab === "documents" && (
        <div className="card" style={{ padding: 16 }}>
          {guardian.folders.length === 0 ? (
            <div className="grid" style={{ gap: 12 }}>
              <div style={{ opacity: 0.6 }}>Nessuna cartella ancora creata.</div>
              <Documents guardian={{ ...guardian, folders: [] }} onRefresh={onRefresh} />
            </div>
          ) : (
            <Documents guardian={guardian} onRefresh={onRefresh} />
          )}
        </div>
      )}

      {tab === "timeline" && (
        <GuardianTimeline guardian={guardian} timeline={timeline} onRefresh={onRefresh} />
      )}

      {tab === "structure" && <StructureTab guardian={guardian} onRefresh={onRefresh} />}
    </div>
  );
}

export default function Guardians() {
  const [list, setList] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [summary, setSummary] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [newName, setNewName] = useState("");

  async function loadList() {
    const guardians = await api.guardians();
    setList(guardians);
    if (!selectedId && guardians.length) setSelectedId(guardians[0].id);
  }

  async function loadDetail(id) {
    if (!id) return;
    const [g, s, t] = await Promise.all([
      api.guardian(id),
      api.guardianSummary(id),
      api.guardianTimeline(id),
    ]);
    setDetail(g);
    setSummary(s);
    setTimeline(t);
  }

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId]);

  const handleRefresh = async () => {
    await loadDetail(selectedId);
    await loadList();
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row between" style={{ alignItems: "center" }}>
        <h2>Amministrati di sostegno</h2>
        <div className="row" style={{ gap: 8 }}>
          <input
            placeholder="Nuovo amministrato"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            onClick={async () => {
              if (!newName.trim()) return;
              await api.createGuardian({ fullName: newName });
              setNewName("");
              loadList();
            }}
          >
            ➕ Crea
          </button>
        </div>
      </div>

      <div className="two-cols" style={{ gap: 16 }}>
        <div className="card" style={{ padding: 0, maxHeight: "70vh", overflow: "auto" }}>
          {list.map((g) => (
            <div
              key={g.id}
              className="case-item"
              onClick={() => setSelectedId(g.id)}
              style={{
                background: g.id === selectedId ? "#eef2ff" : "transparent",
                borderBottom: "1px solid #f3f4f6",
              }}
            >
              <div style={{ fontWeight: 700 }}>{g.fullName}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>{g.fiscalCode || ""}</div>
            </div>
          ))}
          {list.length === 0 && <div style={{ padding: 16, opacity: 0.6 }}>Nessun amministrato.</div>}
        </div>

        <div>
          {detail ? (
            <GuardianDetail
              guardian={detail}
              summary={summary}
              timeline={timeline}
              onRefresh={handleRefresh}
            />
          ) : (
            <div className="card" style={{ opacity: 0.6 }}>Seleziona un amministrato per visualizzare i dettagli.</div>
          )}
        </div>
      </div>
    </div>
  );
}
