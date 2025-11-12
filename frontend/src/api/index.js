const API = "/api";
async function j(url, opt) {
  const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opt });
  if (!r.ok) throw new Error(await r.text());
  const ct = r.headers.get("content-type") || "";
  return ct.includes("application/json") ? r.json() : r.blob();
}
export const api = {
  // clients
  clients: () => j(`${API}/clienti`),
  createClient: (p) => j(`${API}/clienti`, { method: "POST", body: JSON.stringify(p) }),
  clientExpenses: (id) => j(`${API}/clienti/${id}/expenses`),
  addClientExpense: (id, p) => j(`${API}/clienti/${id}/expenses`, { method: "POST", body: JSON.stringify(p) }),
  delExpense: (id) => j(`${API}/spese/${id}`, { method: "DELETE" }),

  // cases
  cases: () => j(`${API}/casi`),
  case: (id) => j(`${API}/casi/${id}`),
  createCase: (p) => j(`${API}/casi`, { method: "POST", body: JSON.stringify(p) }),
  updateCase: (id, p) => j(`${API}/casi/${id}`, { method: "PUT", body: JSON.stringify(p) }),
  deleteCase: (id) => j(`${API}/casi/${id}`, { method: "DELETE" }),

  caseLogs: (id) => j(`${API}/casi/${id}/logs`),
  addCaseLog: (id, p) => j(`${API}/casi/${id}/logs`, { method: "POST", body: JSON.stringify(p) }),

  caseExpenses: (id) => j(`${API}/casi/${id}/expenses`),
  addCaseExpense: (id, p) => j(`${API}/casi/${id}/expenses`, { method: "POST", body: JSON.stringify(p) }),

  caseDeadlines: (id) => j(`${API}/casi/${id}/deadlines`),
  addCaseDeadline: (id, p) => j(`${API}/casi/${id}/deadlines`, { method: "POST", body: JSON.stringify(p) }),

  caseInvoices: (id) => j(`${API}/casi/${id}/invoices`),

  // deadlines globali + ICS
  deadlines: () => j(`${API}/deadlines`),
  addDeadline: (p) => j(`${API}/deadlines`, { method: "POST", body: JSON.stringify(p) }),
  deleteDeadline: (id) => j(`${API}/deadlines/${id}`, { method: "DELETE" }),

  // invoices
  invoices: () => j(`${API}/fatture`),
  createInvoice: (p) => j(`${API}/fatture`, { method: "POST", body: JSON.stringify(p) }),
  addPayment: (id, p) => j(`${API}/fatture/${id}/payments`, { method: "POST", body: JSON.stringify(p) }),
  splitInvoice: (id, p) => j(`${API}/fatture/${id}/split`, { method: "POST", body: JSON.stringify(p) }),
  invoicePdf: (id) => j(`${API}/fatture/${id}/pdf`),

  // guardianships
  guardians: () => j(`${API}/guardianships`),
  createGuardian: (p) => j(`${API}/guardianships`, { method: "POST", body: JSON.stringify(p) }),
  guardianSummary: (id) => j(`${API}/guardianships/${id}/summary`),
  guardianAddIncome: (id, p) => j(`${API}/guardianships/${id}/incomes`, { method: "POST", body: JSON.stringify(p) }),
  guardianAddExpense: (id, p) => j(`${API}/guardianships/${id}/expenses`, { method: "POST", body: JSON.stringify(p) }),
  guardianAddDeposit: (id, p) => j(`${API}/guardianships/${id}/deposits`, { method: "POST", body: JSON.stringify(p) }),

  // reports
  reportDashboard: () => j(`${API}/reports/dashboard`),
  reportRecenti: () => j(`${API}/reports/recenti`),
  reportMesi: () => j(`${API}/reports/mesi`),
  
// CLIENTS
clients: () => j(`${API}/clienti`),
clientCases: (id) => j(`${API}/clienti/${id}/casi`),
clientInvoices: (id) => j(`${API}/clienti/${id}/fatture`),
createClientCase: (id, p) => j(`${API}/clienti/${id}/casi`, { method: "POST", body: JSON.stringify(p) }),

// INVOICES
createInvoice: (p) => j(`${API}/fatture`, { method: "POST", body: JSON.stringify(p) }),
invoiceExpenses: (id) => j(`${API}/fatture/${id}/expenses`),
attachExpensesToInvoice: (id, expenseIds) =>
  j(`${API}/fatture/${id}/attach-expenses`, { method: "POST", body: JSON.stringify({ expenseIds }) }),
createInvoiceFromExpenses: (p) => j(`${API}/fatture/genera-da-spese`, { method: "POST", body: JSON.stringify(p) }),
// numerazione pratica
previewCaseNumber: (caseType="civile") => j(`${API}/casi/preview-number?caseType=${encodeURIComponent(caseType)}`),

// pratiche
createCase: (p) => j(`${API}/casi`, { method: "POST", body: JSON.stringify(p) }),

// spese per pratica (già presenti)
caseExpenses: (id) => j(`${API}/casi/${id}/expenses`),

// fatture
createInvoiceFromExpenses: (p) => j(`${API}/fatture/genera-da-spese`, { method: "POST", body: JSON.stringify(p) }),
attachExpensesToInvoice: (id, expenseIds) => j(`${API}/fatture/${id}/attach-expenses`, { method: "POST", body: JSON.stringify({ expenseIds }) }),
addPayment: (id, p) => j(`${API}/fatture/${id}/payments`, { method: "POST", body: JSON.stringify(p) }),
  // files
  exportExcel: () => fetch(`${API}/files/export/excel`).then((r) => r.blob()),
  importExcel: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${API}/files/import/excel`, { method: "POST", body: fd }).then((r) => r.json());
  },
};


export const fmtMoney = (v) => Number(v || 0).toFixed(2);
