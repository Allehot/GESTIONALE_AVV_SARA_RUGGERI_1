import React, { useEffect, useState } from "react";
const API_BASE = "/api";

// Stili base
const pageStyle = {
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  background: "#f4f4f5",
  minHeight: "100vh"
};
const topbarStyle = {
  background: "#111827",
  color: "#fff",
  padding: "10px 20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between"
};
const mainStyle = { display: "flex", minHeight: "calc(100vh - 52px)" };
const sidebarStyle = {
  width: 240,
  background: "#fff",
  borderRight: "1px solid #e5e7eb",
  padding: 16
};
const btn = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "6px 12px",
  borderRadius: 6,
  cursor: "pointer"
};
const card = {
  background: "#fff",
  borderRadius: 10,
  padding: 16,
  marginBottom: 16,
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
};

const statusColor = (t) => {
  if (!t) return "#e5e7eb";
  const tl = t.toLowerCase();
  if (tl.includes("udienza")) return "#fee2e2"; // rosso chiaro
  if (tl.includes("termine")) return "#fef9c3"; // giallo chiaro
  return "#e0f2fe"; // azzurrino per scadenza
};

function App() {
  // auth
  const [user, setUser] = useState(null);
  const [loginUser, setLoginUser] = useState("admin");
  const [loginPass, setLoginPass] = useState("admin");
  const [loginError, setLoginError] = useState("");

  // vista corrente
  const [view, setView] = useState("dashboard");

  // dati principali
  const [studio, setStudio] = useState(null);
  const [clients, setClients] = useState([]);
  const [cases, setCases] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // dashboard
  const [dashboard, setDashboard] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [monthly, setMonthly] = useState(null);

  // modali
  const [showNewClient, setShowNewClient] = useState(false);
  const [showNewCase, setShowNewCase] = useState(false);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [showNewDeadline, setShowNewDeadline] = useState(false);

  // dettaglio pratica
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseLogs, setCaseLogs] = useState([]);
  const [newCaseNote, setNewCaseNote] = useState("");

  // modale modifica scadenza (da calendario o lista)
  const [editDeadline, setEditDeadline] = useState(null);

  // import
  const [importType, setImportType] = useState("clients");
  const [importFile, setImportFile] = useState(null);

  // calendario: anno/mese navigabili
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth()); // 0-11

  // caricamento di tutti i dati
  async function loadAll() {
    const [
      resStudio,
      resClients,
      resCases,
      resDeadlines,
      resInvoices,
      resDash,
      resUpcoming,
      resMonthly
    ] = await Promise.all([
      fetch(`${API_BASE}/studio`),
      fetch(`${API_BASE}/clients`),
      fetch(`${API_BASE}/cases`),
      fetch(`${API_BASE}/deadlines`),
      fetch(`${API_BASE}/invoices`),
      fetch(`${API_BASE}/reports/dashboard`),
      fetch(`${API_BASE}/reports/upcoming-deadlines`),
      fetch(`${API_BASE}/reports/monthly`)
    ]);

    setStudio(await resStudio.json());
    setClients(await resClients.json());
    setCases(await resCases.json());
    setDeadlines(await resDeadlines.json());
    setInvoices(await resInvoices.json());
    setDashboard(await resDash.json());
    setUpcoming(await resUpcoming.json());
    setMonthly(await resMonthly.json());
  }

  useEffect(() => {
    if (user) {
      loadAll();
    }
  }, [user]);

  // login
  const doLogin = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: loginUser, password: loginPass })
    });
    if (!res.ok) {
      setLoginError("Credenziali non valide");
      return;
    }
    const data = await res.json();
    setUser(data.user);
    setLoginError("");
  };

  // CLIENTI ---------------------------------------------------
  const submitNewClient = async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      name: form.name.value,
      fiscalCode: form.fiscalCode.value,
      vatNumber: form.vatNumber.value,
      email: form.email.value,
      pec: form.pec.value,
      phone: form.phone.value,
      address: form.address.value,
      notes: form.notes.value
    };
    await fetch(`${API_BASE}/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setShowNewClient(false);
    await loadAll();
  };

  const editClient = async (cl) => {
    const name = window.prompt("Nome cliente", cl.name);
    if (!name) return;
    await fetch(`${API_BASE}/clients/${cl.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    await loadAll();
  };

  const deleteClient = async (cl) => {
    if (!window.confirm("Eliminare questo cliente?")) return;
    const res = await fetch(`${API_BASE}/clients/${cl.id}`, { method: "DELETE" });
    if (res.ok) {
      await loadAll();
    } else {
      const err = await res.json();
      alert(err.message || "Impossibile eliminare il cliente (ha pratiche o fatture collegate?)");
    }
  };

  // PRATICHE ---------------------------------------------------
  const submitNewCase = async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      subject: form.subject.value,
      clientId: form.clientId.value || null,
      caseType: form.caseType.value,
      proceedingType: form.proceedingType.value,
      court: form.court.value,
      rgNumber: form.rgNumber.value,
      status: "aperta"
    };
    await fetch(`${API_BASE}/cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setShowNewCase(false);
    await loadAll();
  };

  const openCase = async (c) => {
    const [resCase, resLogs] = await Promise.all([
      fetch(`${API_BASE}/cases/${c.id}`),
      fetch(`${API_BASE}/cases/${c.id}/logs`)
    ]);
    setSelectedCase(await resCase.json());
    setCaseLogs(await resLogs.json());
    setView("case-detail");
  };

  const editCase = async (c) => {
    const subject = window.prompt("Oggetto pratica:", c.subject);
    if (!subject) return;
    const proceedingType = window.prompt("Procedimento (giudiziale/stragiudiziale):", c.proceedingType || "stragiudiziale");
    const status = window.prompt("Stato (aperta/chiusa):", c.status || "aperta");
    await fetch(`${API_BASE}/cases/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, status, proceedingType })
    });
    await loadAll();
  };

  const deleteCase = async (c) => {
    if (!window.confirm("Eliminare la pratica e le scadenze collegate?")) return;
    await fetch(`${API_BASE}/cases/${c.id}`, { method: "DELETE" });
    await loadAll();
    setSelectedCase(null);
    setView("cases");
  };

  // CRONOSTORIA - nota manuale
  const addManualNote = async () => {
    if (!selectedCase || !newCaseNote.trim()) return;
    await fetch(`${API_BASE}/cases/${selectedCase.id}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ detail: newCaseNote })
    });
    const resLogs = await fetch(`${API_BASE}/cases/${selectedCase.id}/logs`);
    setCaseLogs(await resLogs.json());
    setNewCaseNote("");
  };

  // SCADENZE / UDIENZE ------------------------------------------
  const submitNewDeadline = async (e) => {
    e.preventDefault();
    const form = e.target;
    const caseId = form.caseId.value;
    if (!caseId) {
      alert("Seleziona una pratica");
      return;
    }
    const payload = {
      date: form.date.value,
      description: form.description.value,
      type: form.type.value
    };
    await fetch(`${API_BASE}/cases/${caseId}/deadlines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setShowNewDeadline(false);
    await loadAll();
    // se sono nel dettaglio pratica, la ricarico
    if (selectedCase && selectedCase.id === caseId) {
      const resCase = await fetch(`${API_BASE}/cases/${caseId}`);
      setSelectedCase(await resCase.json());
    }
  };

  const deleteDeadline = async (d) => {
    if (!window.confirm("Eliminare questa scadenza/udienza?")) return;
    await fetch(`${API_BASE}/deadlines/${d.id}`, { method: "DELETE" });
    await loadAll();
    // se è della pratica che sto vedendo, aggiorno
    if (selectedCase && d.caseId === selectedCase.id) {
      const resCase = await fetch(`${API_BASE}/cases/${selectedCase.id}`);
      setSelectedCase(await resCase.json());
      const resLogs = await fetch(`${API_BASE}/cases/${selectedCase.id}/logs`);
      setCaseLogs(await resLogs.json());
    }
    setEditDeadline(null);
  };

  const updateDeadline = async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      date: form.date.value,
      description: form.description.value,
      type: form.type.value
    };
    await fetch(`${API_BASE}/deadlines/${editDeadline.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setEditDeadline(null);
    await loadAll();
  };

  // FATTURE ---------------------------------------------------
  const submitNewInvoice = async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      clientId: form.clientId.value || null,
      caseId: form.caseId.value || null,
      date: form.date.value,
      notes: form.notes.value,
      manualLines: form.desc.value
        ? [{ description: form.desc.value, amount: Number(form.amount.value || 0) }]
        : []
    };
    await fetch(`${API_BASE}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setShowNewInvoice(false);
    await loadAll();
  };

  const deleteInvoice = async (inv) => {
    if (!window.confirm("Eliminare questa fattura?")) return;
    await fetch(`${API_BASE}/invoices/${inv.id}`, { method: "DELETE" });
    await loadAll();
  };

  // EXPORT -----------------------------------------------------
  const doExport = (what) => {
    window.open(`${API_BASE}/export/${what}.csv`, "_blank");
  };

  const doExportExcel = () => {
    window.open(`${API_BASE}/export/excel`, "_blank");
  };

  // IMPORT -----------------------------------------------------
  const doImport = async (e) => {
    e.preventDefault();
    if (!importFile) {
      alert("Seleziona un file CSV prima");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", importFile); // deve chiamarsi "file"
      const res = await fetch(`${API_BASE}/import/${importType}`, {
        method: "POST",
        body: fd
      });
      if (!res.ok) {
        const txt = await res.text();
        alert("Errore import: " + txt);
        return;
      }
      let data;
      try {
        data = await res.json();
      } catch (err) {
        alert("Import completato (risposta non JSON)");
        await loadAll();
        return;
      }
      alert(`Import OK: ${data.imported} record per ${data.type}`);
      await loadAll();
    } catch (err) {
      alert("Errore di rete: " + err.message);
    }
  };

  // handler calendario: mese precedente / successivo
  const goPrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  // se non autenticato → login
  if (!user) {
    return (
      <div
        style={{
          ...pageStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <form
          onSubmit={doLogin}
          style={{
            background: "#fff",
            padding: 24,
            borderRadius: 12,
            width: 320,
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)"
          }}
        >
          <h2>Gestionale Studio Legale</h2>
          <p style={{ fontSize: 12, color: "#6b7280" }}>Accedi (admin / admin)</p>
          <label>
            Utente
            <br />
            <input
              value={loginUser}
              onChange={(e) => setLoginUser(e.target.value)}
              style={{ width: "100%", marginBottom: 8 }}
            />
          </label>
          <label>
            Password
            <br />
            <input
              type="password"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              style={{ width: "100%", marginBottom: 8 }}
            />
          </label>
          {loginError && <p style={{ color: "red" }}>{loginError}</p>}
          <button type="submit" style={btn}>
            Entra
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* TOPBAR */}
      <header style={topbarStyle}>
        <div>
          <b>{studio ? studio.name : "Studio Legale"}</b>
        </div>
        <div>
          {studio && (
            <span style={{ fontSize: 12, marginRight: 16 }}>
              {studio.email} · {studio.phone}
            </span>
          )}
          <button onClick={() => setUser(null)} style={{ ...btn, background: "#ef4444" }}>
            Esci
          </button>
        </div>
      </header>

      {/* LAYOUT */}
      <div style={mainStyle}>
        {/* SIDEBAR */}
        <aside style={sidebarStyle}>
          <div style={{ marginBottom: 14, fontWeight: 600, fontSize: 13, color: "#6b7280" }}>Menu</div>
          <button onClick={() => setView("dashboard")} style={navBtn(view === "dashboard")}>
            Dashboard
          </button>
          <button onClick={() => setView("clients")} style={navBtn(view === "clients")}>
            Clienti
          </button>
          <button onClick={() => setView("cases")} style={navBtn(view === "cases")}>
            Pratiche
          </button>
          <button onClick={() => setView("invoices")} style={navBtn(view === "invoices")}>
            Fatture
          </button>
          <button onClick={() => setView("deadlines")} style={navBtn(view === "deadlines")}>
            Scadenze / Udienze
          </button>
          <button onClick={() => setView("studio")} style={navBtn(view === "studio")}>
            Dati studio
          </button>
          <button onClick={() => setView("import-export")} style={navBtn(view === "import-export")}>
            Import / Export
          </button>
        </aside>

        {/* CONTENT */}
        <main style={{ flex: 1, padding: 20, overflowY: "auto" }}>
          {/* DASHBOARD */}
          {view === "dashboard" && (
            <>
              <h1>Dashboard</h1>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <DashCard title="Clienti" value={dashboard ? dashboard.totalClients : "..."} />
                <DashCard title="Pratiche" value={dashboard ? dashboard.totalCases : "..."} />
                <DashCard title="Pratiche aperte" value={dashboard ? dashboard.totalOpenCases : "..."} />
                <DashCard title="Fatturato" value={dashboard ? euro(dashboard.invoicesAmount) : "..."} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20, marginTop: 20 }}>
                <div style={card}>
                  <CalendarView
                    items={deadlines}
                    year={calendarYear}
                    month={calendarMonth}
                    onSelectDeadline={(d) => setEditDeadline(d)}
                    onPrev={goPrevMonth}
                    onNext={goNextMonth}
                    onYearChange={setCalendarYear}
                    onMonthChange={setCalendarMonth}
                  />
                </div>
                <div style={card}>
                  <h3>Scadenze imminenti (15gg)</h3>
                  <ul style={{ listStyle: "none", padding: 0, maxHeight: 300, overflowY: "auto" }}>
                    {upcoming.map((u) => (
                      <li
                        key={u.id}
                        style={{
                          background: statusColor(u.type || ""),
                          marginBottom: 6,
                          borderRadius: 6,
                          padding: 6
                        }}
                      >
                        <b>{u.date}</b> – {u.type} – {u.description}{" "}
                        <button onClick={() => setEditDeadline(u)}>✏️</button>{" "}
                        <button onClick={() => deleteDeadline(u)}>🗑️</button>
                        {u.caseNumber && (
                          <div style={{ fontSize: 11 }}>
                            Pratica: {u.caseNumber} – {u.caseSubject}
                          </div>
                        )}
                      </li>
                    ))}
                    {upcoming.length === 0 && <li>Nessuna scadenza</li>}
                  </ul>
                  <hr />
                  <h4>Export rapido</h4>
                  <button
                    onClick={() => doExport("clients")}
                    style={{ ...btn, marginRight: 6, marginBottom: 4 }}
                  >
                    Clienti CSV
                  </button>
                  <button
                    onClick={() => doExport("cases")}
                    style={{ ...btn, marginRight: 6, marginBottom: 4 }}
                  >
                    Pratiche CSV
                  </button>
                  <button
                    onClick={() => doExport("invoices")}
                    style={{ ...btn, marginRight: 6, marginBottom: 4 }}
                  >
                    Fatture CSV
                  </button>
                  <button onClick={doExportExcel} style={{ ...btn, background: "#0f766e" }}>
                    Excel completo
                  </button>
                  {monthly && (
                    <>
                      <h4 style={{ marginTop: 10 }}>Statistiche mese</h4>
                      <p>
                        Pratiche create: <b>{monthly.casesThisMonth}</b>
                      </p>
                      <p>
                        Fatture emesse: <b>{monthly.invoicesThisMonth}</b>
                      </p>
                      <p>
                        Importo fatture: <b>{euro(monthly.invoicesAmountThisMonth)}</b>
                      </p>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* CLIENTI */}
          {view === "clients" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1>Clienti</h1>
                <div>
                  <button
                    style={{ ...btn, marginRight: 6 }}
                    onClick={() => doExport("clients")}
                  >
                    Export CSV
                  </button>
                  <button style={btn} onClick={() => setShowNewClient(true)}>
                    + Nuovo cliente
                  </button>
                </div>
              </div>
              <div style={card}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left" }}>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Telefono</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((cl) => (
                      <tr key={cl.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td>{cl.name}</td>
                        <td>{cl.email}</td>
                        <td>{cl.phone}</td>
                        <td>
                          <button onClick={() => editClient(cl)}>✏️</button>{" "}
                          <button onClick={() => deleteClient(cl)}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                    {clients.length === 0 && (
                      <tr>
                        <td colSpan="4">Nessun cliente</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* PRATICHE */}
          {view === "cases" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1>Pratiche</h1>
                <div>
                  <button
                    style={{ ...btn, marginRight: 6 }}
                    onClick={() => doExport("cases")}
                  >
                    Export CSV
                  </button>
                  <button style={btn} onClick={() => setShowNewCase(true)}>
                    + Nuova pratica
                  </button>
                </div>
              </div>
              <div style={card}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th>Numero</th>
                      <th>Oggetto</th>
                      <th>Cliente</th>
                      <th>Tipo</th>
                      <th>Procedimento</th>
                      <th>Stato</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((c) => (
                      <tr
                        key={c.id}
                        style={{ borderBottom: "1px solid #e5e7eb", cursor: "pointer" }}
                        onClick={() => openCase(c)}
                      >
                        <td>{c.number}</td>
                        <td>{c.subject}</td>
                        <td>{c.clientName}</td>
                        <td>{c.caseType}</td>
                        <td>{c.proceedingType}</td>
                        <td>{c.status}</td>
                        <td>
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              editCase(c);
                            }}
                          >
                            ✏️
                          </button>{" "}
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              deleteCase(c);
                            }}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                    {cases.length === 0 && (
                      <tr>
                        <td colSpan="7">Nessuna pratica</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* DETTAGLIO PRATICA */}
          {view === "case-detail" && selectedCase && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1>Pratica {selectedCase.number}</h1>
                <div>
                  <button onClick={() => editCase(selectedCase)} style={{ ...btn, marginRight: 8 }}>
                    Modifica
                  </button>
                  <button onClick={() => deleteCase(selectedCase)} style={{ ...btn, background: "#ef4444" }}>
                    Elimina
                  </button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20 }}>
                <div>
                  <div style={card}>
                    <h3>Dati pratica</h3>
                    <p>
                      <b>Oggetto:</b> {selectedCase.subject}
                    </p>
                    <p>
                      <b>Cliente:</b> {selectedCase.client ? selectedCase.client.name : "-"}
                    </p>
                    <p>
                      <b>Tipo:</b> {selectedCase.caseType}
                    </p>
                    <p>
                      <b>Procedimento:</b> {selectedCase.proceedingType}
                    </p>
                    {selectedCase.proceedingType === "giudiziale" && (
                      <>
                        <p>
                          <b>Tribunale:</b> {selectedCase.court || "-"}
                        </p>
                        <p>
                          <b>RG:</b> {selectedCase.rgNumber || "-"}
                        </p>
                      </>
                    )}
                  </div>
                  <div style={card}>
                    <h3>Scadenze collegate</h3>
                    <button style={{ ...btn, marginBottom: 8 }} onClick={() => setShowNewDeadline(true)}>
                      + Aggiungi scadenza/udienza
                    </button>
                    <ul style={{ listStyle: "none", padding: 0 }}>
                      {selectedCase.deadlines && selectedCase.deadlines.length > 0 ? (
                        selectedCase.deadlines.map((d) => (
                          <li
                            key={d.id}
                            style={{
                              background: statusColor(d.type || ""),
                              padding: 6,
                              borderRadius: 6,
                              marginBottom: 4
                            }}
                          >
                            <b>{d.date}</b> – {d.type} – {d.description}{" "}
                            <button onClick={() => setEditDeadline(d)}>✏️</button>{" "}
                            <button onClick={() => deleteDeadline(d)}>🗑️</button>
                          </li>
                        ))
                      ) : (
                        <li>Nessuna scadenza</li>
                      )}
                    </ul>
                  </div>
                  <div style={card}>
                    <h3>Fatture collegate</h3>
                    <ul>
                      {selectedCase.invoices && selectedCase.invoices.length > 0 ? (
                        selectedCase.invoices.map((inv) => (
                          <li key={inv.id}>
                            {inv.number} – {inv.date} –{" "}
                            {inv.totals ? euro(inv.totals.totale) : "-"}{" "}
                            <button onClick={() => deleteInvoice(inv)}>🗑️</button>{" "}
                            <a
                              href={`${API_BASE}/invoices/${inv.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              📄
                            </a>
                          </li>
                        ))
                      ) : (
                        <li>Nessuna fattura</li>
                      )}
                    </ul>
                  </div>
                </div>
                <div>
                  <div style={card}>
                    <h3>Cronostoria</h3>
                    <div style={{ maxHeight: 250, overflowY: "auto", marginBottom: 10 }}>
                      {caseLogs.length > 0 ? (
                        caseLogs.map((l) => (
                          <div key={l.id} style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>
                              {new Date(l.createdAt).toLocaleString()}
                            </div>
                            <div>
                              <b>{l.action}</b> – {l.detail}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p>Nessun evento registrato</p>
                      )}
                    </div>
                    <textarea
                      value={newCaseNote}
                      onChange={(e) => setNewCaseNote(e.target.value)}
                      style={{ width: "100%", minHeight: 60 }}
                      placeholder="Aggiungi nota (es. telefonata col cliente)"
                    />
                    <button style={{ ...btn, marginTop: 6 }} onClick={addManualNote}>
                      Aggiungi nota
                    </button>
                  </div>
                  <div style={card}>
                    <h3>Riepilogo economico</h3>
                    <p>
                      Spese sostenute: <b>{euro(selectedCase.summary?.totalExpenses || 0)}</b>
                    </p>
                    <p>
                      Fatture emesse: <b>{euro(selectedCase.summary?.totalInvoices || 0)}</b>
                    </p>
                    <p>
                      Tempo attività: <b>{selectedCase.summary?.totalMinutes || 0}</b> minuti
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* FATTURE */}
          {view === "invoices" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1>Fatture</h1>
                <div>
                  <button
                    style={{ ...btn, marginRight: 6 }}
                    onClick={() => doExport("invoices")}
                  >
                    Export CSV
                  </button>
                  <button style={btn} onClick={() => setShowNewInvoice(true)}>
                    + Nuova fattura
                  </button>
                </div>
              </div>
              <div style={card}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th>Numero</th>
                      <th>Data</th>
                      <th>Cliente</th>
                      <th>Pratica</th>
                      <th>Totale</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td>{inv.number}</td>
                        <td>{inv.date}</td>
                        <td>{inv.clientName}</td>
                        <td>{inv.caseNumber}</td>
                        <td>{inv.totals ? euro(inv.totals.totale) : "-"}</td>
                        <td>
                          <a
                            href={`${API_BASE}/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            📄
                          </a>{" "}
                          <button onClick={() => deleteInvoice(inv)}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                    {invoices.length === 0 && (
                      <tr>
                        <td colSpan="6">Nessuna fattura</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* SCADENZE */}
          {view === "deadlines" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1>Scadenze / Udienze</h1>
                <button style={btn} onClick={() => setShowNewDeadline(true)}>
                  + Nuova scadenza
                </button>
              </div>
              <div style={card}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Descrizione</th>
                      <th>Pratica</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {deadlines.map((d) => {
                      const cas = cases.find((c) => c.id === d.caseId);
                      return (
                        <tr key={d.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td>{d.date}</td>
                          <td>{d.type}</td>
                          <td>{d.description}</td>
                          <td>{cas ? `${cas.number} - ${cas.subject}` : ""}</td>
                          <td>
                            <button onClick={() => setEditDeadline(d)}>✏️</button>{" "}
                            <button onClick={() => deleteDeadline(d)}>🗑️</button>
                          </td>
                        </tr>
                      );
                    })}
                    {deadlines.length === 0 && (
                      <tr>
                        <td colSpan="5">Nessuna scadenza</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* DATI STUDIO */}
          {view === "studio" && studio && (
            <>
              <h1>Dati studio (intestazione fatture)</h1>
              <div style={card}>
                <StudioForm studio={studio} onSaved={loadAll} />
              </div>
            </>
          )}

          {/* IMPORT / EXPORT */}
          {view === "import-export" && (
            <>
              <h1>Import / Export</h1>

              {/* EXPORT */}
              <div style={card}>
                <h3>Export</h3>
                <p style={{ fontSize: 12, color: "#6b7280" }}>
                  Scarica i dati attuali in formato CSV o Excel. Il CSV puoi poi riaprirlo e reimportarlo.
                </p>
                <button
                  onClick={() => doExport("clients")}
                  style={{ ...btn, marginRight: 6, marginBottom: 6 }}
                >
                  Clienti CSV
                </button>
                <button
                  onClick={() => doExport("cases")}
                  style={{ ...btn, marginRight: 6, marginBottom: 6 }}
                >
                  Pratiche CSV
                </button>
                <button
                  onClick={() => doExport("invoices")}
                  style={{ ...btn, marginRight: 6, marginBottom: 6 }}
                >
                  Fatture CSV
                </button>
                <button onClick={doExportExcel} style={{ ...btn, background: "#0f766e" }}>
                  Excel completo
                </button>
              </div>

              {/* IMPORT */}
              <div style={card}>
                <h3>Import da CSV</h3>
                <p style={{ fontSize: 12, color: "#6b7280" }}>
                  Consiglio: prima fai l’export, aggiungi righe nel CSV, poi reimporti. Separatore: <b>;</b>.
                </p>
                <form onSubmit={doImport}>
                  <label>
                    Tipo da importare
                    <br />
                    <select value={importType} onChange={(e) => setImportType(e.target.value)}>
                      <option value="clients">Clienti</option>
                      <option value="cases">Pratiche</option>
                      <option value="invoices">Fatture</option>
                    </select>
                  </label>
                  <br />
                  <br />
                  <label>
                    File CSV
                    <br />
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => {
                        const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                        setImportFile(f);
                      }}
                    />
                  </label>
                  <br />
                  <br />
                  <button type="submit" style={btn}>
                    Importa
                  </button>
                </form>
                <p style={{ fontSize: 11, color: "#6b7280", marginTop: 10 }}>
                  Se non succede niente: controlla la console del browser (F12 → Console) e la finestra del
                  backend (dove c’è <code>npm start</code>).
                </p>
              </div>
            </>
          )}
        </main>
      </div>

      {/* MODALI -------------------------------------------------*/}

      {/* nuovo cliente */}
      {showNewClient && (
        <Modal onClose={() => setShowNewClient(false)} title="Nuovo cliente">
          <form onSubmit={submitNewClient}>
            <label>
              Nome<br />
              <input name="name" required style={{ width: "100%" }} />
            </label>
            <br />
            <label>
              Codice fiscale<br />
              <input name="fiscalCode" style={{ width: "100%" }} />
            </label>
            <br />
            <label>
              P.IVA<br />
              <input name="vatNumber" style={{ width: "100%" }} />
            </label>
            <br />
            <label>
              Email<br />
              <input name="email" type="email" style={{ width: "100%" }} />
            </label>
            <br />
            <label>
              PEC<br />
              <input name="pec" style={{ width: "100%" }} />
            </label>
            <br />
            <label>
              Telefono<br />
              <input name="phone" style={{ width: "100%" }} />
            </label>
            <br />
            <label>
              Indirizzo<br />
              <input name="address" style={{ width: "100%" }} />
            </label>
            <br />
            <label>
              Note<br />
              <textarea name="notes" style={{ width: "100%" }} />
            </label>
            <br />
            <button type="submit" style={btn}>
              Salva
            </button>
          </form>
        </Modal>
      )}

      {/* nuova pratica */}
      {showNewCase && (
        <Modal onClose={() => setShowNewCase(false)} title="Nuova pratica">
          <form onSubmit={submitNewCase}>
            <label>
              Oggetto<br />
              <input name="subject" required style={{ width: "100%" }} />
            </label>
            <br />
            <label>
              Cliente<br />
              <select name="clientId" style={{ width: "100%" }}>
                <option value="">-- nessuno --</option>
                {clients.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.name}
                  </option>
                ))}
              </select>
            </label>
            <br />
            <label>
              Tipo pratica<br />
              <select name="caseType" style={{ width: "100%" }}>
                <option value="civile">Civile</option>
                <option value="penale">Penale</option>
                <option value="lavoro">Lavoro</option>
                <option value="amministrativo">Amministrativo</option>
                <option value="altro">Altro</option>
              </select>
            </label>
            <br />
            <label>
              Procedimento<br />
              <select name="proceedingType" defaultValue="stragiudiziale" style={{ width: "100%" }}>
                <option value="stragiudiziale">Stragiudiziale</option>
                <option value="giudiziale">Giudiziale</option>
              </select>
            </label>
            <br />
            <label>
              Tribunale (se giudiziale)<br />
              <input name="court" style={{ width: "100%" }} />
            </label>
            <br />
            <label>
              Numero RG<br />
              <input name="rgNumber" style={{ width: "100%" }} />
            </label>
            <br />
            <button type="submit" style={btn}>
              Crea
            </button>
          </form>
        </Modal>
      )}

      {/* nuova fattura */}
      {showNewInvoice && (
        <Modal onClose={() => setShowNewInvoice(false)} title="Nuova fattura">
          <form onSubmit={submitNewInvoice}>
            <label>
              Cliente<br />
              <select name="clientId" style={{ width: "100%" }}>
                <option value="">-- nessuno --</option>
                {clients.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.name}
                  </option>
                ))}
              </select>
            </label>
            <br />
            <label>
              Pratica<br />
              <select name="caseId" style={{ width: "100%" }}>
                <option value="">-- nessuna --</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.number} - {c.subject}
                  </option>
                ))}
              </select>
            </label>
            <br />
            <label>
              Data<br />
              <input name="date" type="date" defaultValue={todayIso()} style={{ width: "100%" }} />
            </label>
            <br />
            <label>
              Voce manuale (concordato)<br />
              <input name="desc" style={{ width: "100%" }} placeholder="es. concordato per parere" />
            </label>
            <br />
            <label>
              Importo<br />
              <input name="amount" type="number" step="0.01" style={{ width: "100%" }} />
            </label>
            <br />
            <label>
              Note<br />
              <textarea name="notes" style={{ width: "100%" }} />
            </label>
            <br />
            <button type="submit" style={btn}>
              Emetti
            </button>
          </form>
        </Modal>
      )}

      {/* nuova scadenza */}
      {showNewDeadline && (
        <Modal onClose={() => setShowNewDeadline(false)} title="Nuova scadenza / udienza">
          <form onSubmit={submitNewDeadline}>
            <label>
              Pratica<br />
              <select name="caseId" style={{ width: "100%" }}>
                <option value="">-- seleziona --</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.number} - {c.subject}
                  </option>
                ))}
              </select>
            </label>
            <br />
            <label>
              Data<br />
              <input type="date" name="date" defaultValue={todayIso()} style={{ width: "100%" }} />
            </label>
            <br />
            <label>
              Tipo<br />
              <select name="type" style={{ width: "100%" }}>
                <option value="udienza">Udienza</option>
                <option value="scadenza">Scadenza</option>
                <option value="termine">Termine</option>
              </select>
            </label>
            <br />
            <label>
              Descrizione<br />
              <input name="description" style={{ width: "100%" }} />
            </label>
            <br />
            <button type="submit" style={btn}>
              Salva
            </button>
          </form>
        </Modal>
      )}

      {/* modifica scadenza */}
      {editDeadline && (
        <Modal onClose={() => setEditDeadline(null)} title="Modifica scadenza / udienza">
          <form onSubmit={updateDeadline}>
            <label>
              Data<br />
              <input
                type="date"
                name="date"
                defaultValue={editDeadline.date}
                style={{ width: "100%" }}
              />
            </label>
            <br />
            <label>
              Tipo<br />
              <select name="type" defaultValue={editDeadline.type} style={{ width: "100%" }}>
                <option value="udienza">Udienza</option>
                <option value="scadenza">Scadenza</option>
                <option value="termine">Termine</option>
              </select>
            </label>
            <br />
            <label>
              Descrizione<br />
              <input
                name="description"
                defaultValue={editDeadline.description}
                style={{ width: "100%" }}
              />
            </label>
            <br />
            <button type="submit" style={btn}>
              Aggiorna
            </button>{" "}
            <button
              type="button"
              onClick={() => deleteDeadline(editDeadline)}
              style={{ ...btn, background: "#ef4444" }}
            >
              Elimina
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

// componenti di supporto
function navBtn(active) {
  return {
    width: "100%",
    textAlign: "left",
    background: active ? "#dbeafe" : "transparent",
    border: "none",
    padding: "6px 8px",
    borderRadius: 6,
    marginBottom: 4,
    cursor: "pointer"
  };
}

function DashCard({ title, value }) {
  return (
    <div style={{ ...card, minWidth: 160 }}>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: 20,
          width: 420,
          maxHeight: "90vh",
          overflowY: "auto"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer" }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StudioForm({ studio, onSaved }) {
  const [form, setForm] = useState(studio);

  const change = (k, v) => {
    setForm({ ...form, [k]: v });
  };

  const save = async (e) => {
    e.preventDefault();
    await fetch(`${API_BASE}/studio`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    if (onSaved) onSaved();
  };

  return (
    <form onSubmit={save}>
      <label>
        Nome studio<br />
        <input value={form.name || ""} onChange={(e) => change("name", e.target.value)} style={{ width: "100%" }} />
      </label>
      <br />
      <label>
        Indirizzo<br />
        <input
          value={form.address || ""}
          onChange={(e) => change("address", e.target.value)}
          style={{ width: "100%" }}
        />
      </label>
      <br />
      <label>
        Email<br />
        <input value={form.email || ""} onChange={(e) => change("email", e.target.value)} style={{ width: "100%" }} />
      </label>
      <br />
      <label>
        Telefono<br />
        <input value={form.phone || ""} onChange={(e) => change("phone", e.target.value)} style={{ width: "100%" }} />
      </label>
      <br />
      <label>
        P.IVA<br />
        <input
          value={form.vatNumber || ""}
          onChange={(e) => change("vatNumber", e.target.value)}
          style={{ width: "100%" }}
        />
      </label>
      <br />
      <label>
        Codice fiscale<br />
        <input
          value={form.fiscalCode || ""}
          onChange={(e) => change("fiscalCode", e.target.value)}
          style={{ width: "100%" }}
        />
      </label>
      <br />
      <label>
        Cassa (%)<br />
        <input
          type="number"
          value={form.cassaPerc ?? 0}
          onChange={(e) => change("cassaPerc", Number(e.target.value))}
        />
      </label>
      <br />
      <label>
        IVA (%)<br />
        <input
          type="number"
          value={form.ivaPerc ?? 0}
          onChange={(e) => change("ivaPerc", Number(e.target.value))}
        />
      </label>
      <br />
      <label>
        Ritenuta (%)<br />
        <input
          type="number"
          value={form.ritenutaPerc ?? 0}
          onChange={(e) => change("ritenutaPerc", Number(e.target.value))}
        />
      </label>
      <br />
      <label>
        Marca da bollo (€)<br />
        <input
          type="number"
          step="0.01"
          value={form.bollo ?? 0}
          onChange={(e) => change("bollo", Number(e.target.value))}
        />
      </label>
      <br />
      <button type="submit" style={btn}>
        Salva
      </button>
    </form>
  );
}

// helper
function euro(v) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(v);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// calendario riutilizzabile
function CalendarView({ items, year, month, onSelectDeadline, onPrev, onNext, onYearChange, onMonthChange }) {
  // items: array di { date: "YYYY-MM-DD", ... }

  const first = new Date(year, month, 1);
  const startDay = first.getDay() === 0 ? 7 : first.getDay(); // lun=1 ... dom=7
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 1; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  const monthNames = [
    "Gennaio",
    "Febbraio",
    "Marzo",
    "Aprile",
    "Maggio",
    "Giugno",
    "Luglio",
    "Agosto",
    "Settembre",
    "Ottobre",
    "Novembre",
    "Dicembre"
  ];

  // filtra items per questo mese (così non cicliamo tutto sotto)
  const monthItems = items.filter((it) => it.date && it.date.startsWith(monthStr));

  // per la select anni faccio un range semplice
  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 3; y <= currentYear + 3; y++) years.push(y);

  return (
    <div>
      {/* toolbar calendario */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={onPrev} style={{ ...btn, padding: "2px 10px" }}>
            ◀
          </button>
          <button onClick={onNext} style={{ ...btn, padding: "2px 10px" }}>
            ▶
          </button>
          <select value={month} onChange={(e) => onMonthChange(Number(e.target.value))}>
            {monthNames.map((m, idx) => (
              <option key={m} value={idx}>
                {m}
              </option>
            ))}
          </select>
          <select value={year} onChange={(e) => onYearChange(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 11, alignItems: "center" }}>
          <span style={{ width: 12, height: 12, background: "#fee2e2", display: "inline-block" }} /> udienza
          <span style={{ width: 12, height: 12, background: "#e0f2fe", display: "inline-block" }} /> scadenza
          <span style={{ width: 12, height: 12, background: "#fef9c3", display: "inline-block" }} /> termine
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
          <div key={d} style={{ fontSize: 11, textAlign: "center", color: "#6b7280" }}>
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          const dayStr = d ? `${monthStr}-${String(d).padStart(2, "0")}` : null;
          const dayItems = d ? monthItems.filter((it) => it.date === dayStr) : [];
          return (
            <div
              key={i}
              style={{
                minHeight: 70,
                background: "#f9fafb",
                borderRadius: 8,
                padding: 4,
                border: "1px solid #e5e7eb",
                fontSize: 11
              }}
            >
              <div style={{ textAlign: "right", fontWeight: 500, marginBottom: 4 }}>{d || ""}</div>
              {dayItems.map((it) => (
                <div
                    key={it.id}
                    onClick={() => onSelectDeadline(it)}
                    style={{
                      background: statusColor(it.type || ""),
                      borderRadius: 4,
                      padding: "2px 4px",
                      marginBottom: 2,
                      cursor: "pointer"
                    }}
                    title={it.description}
                  >
                    {it.type || "scad."}
                  </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
