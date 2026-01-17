import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import CaseDetail from "../components/CaseDetail.jsx";

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

function NewCaseModal({ clients, numbering, onClose, onSaved }) {
  const [form, setForm] = useState({
    clientId: clients[0]?.id || "",
    subject: "",
    court: "",
    caseType: "civile",
    manualNumber: "",
    useManual: false,
    legalAid: false,
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
        <label className="row" style={{ alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={form.legalAid}
            onChange={(e) => setForm({ ...form, legalAid: e.target.checked })}
          />
          Gratuito patrocinio
        </label>
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
                legalAid: form.legalAid,
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
