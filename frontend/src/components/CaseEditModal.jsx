import React, { useState } from "react";
import { api } from "../api";

export default function CaseEditModal({ it, onClose, onSaved }) {
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
    legalAid: Boolean(it.legalAid),
  });
  return (
    <div className="modal">
      <div className="pane grid" style={{ gap: 12, minWidth: 420 }}>
        <b>Modifica pratica {it.number}</b>
        <input
          placeholder="Oggetto"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
        />
        <input
          placeholder="Ufficio"
          value={form.court}
          onChange={(e) => setForm({ ...form, court: e.target.value })}
        />
        <input
          placeholder="Sezione"
          value={form.section}
          onChange={(e) => setForm({ ...form, section: e.target.value })}
        />
        <input
          placeholder="Giudice"
          value={form.judge}
          onChange={(e) => setForm({ ...form, judge: e.target.value })}
        />
        <input
          placeholder="RG"
          value={form.rgNumber}
          onChange={(e) => setForm({ ...form, rgNumber: e.target.value })}
        />
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
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
          <input
            type="number"
            step="0.01"
            placeholder="Valore"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
          />
        </div>
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
              await api.updateCase(it.id, { ...form, value: Number(form.value || 0) });
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
