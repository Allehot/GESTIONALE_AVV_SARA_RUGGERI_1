const API = "/api";

async function request(url, opt) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opt,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data?.message || JSON.stringify(data);
    } catch (err) {
      message = await res.text();
    }
    throw new Error(message || "Richiesta non riuscita");
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  if (ct.includes("text/")) return res.text();
  return res.blob();
}

const json = (url, options) => request(url, { ...options, body: options?.body ? JSON.stringify(options.body) : undefined });

export const api = {
  // clients
  clients: () => request(`${API}/clienti`),
  createClient: (payload) => json(`${API}/clienti`, { method: "POST", body: payload }),
  client: (id) => request(`${API}/clienti/${id}`),
  updateClient: (id, payload) => json(`${API}/clienti/${id}`, { method: "PUT", body: payload }),
  deleteClient: (id) => json(`${API}/clienti/${id}`, { method: "DELETE" }),
  clientCases: (id) => request(`${API}/clienti/${id}/cases`),
  clientInvoices: (id) => request(`${API}/clienti/${id}/invoices`),
  clientExpenses: (id) => request(`${API}/clienti/${id}/expenses`),
  addClientExpense: (id, payload) => json(`${API}/clienti/${id}/expenses`, { method: "POST", body: payload }),
  deleteClientExpense: (clientId, expenseId) =>
    json(`${API}/clienti/${clientId}/expenses/${expenseId}`, { method: "DELETE" }),
  delExpense: (clientId, expenseId) =>
    json(`${API}/clienti/${clientId}/expenses/${expenseId}`, { method: "DELETE" }),
  clientDocuments: (id) => request(`${API}/clienti/${id}/documents`),
  uploadClientDocument: (id, payload) => {
    const url = `${API}/clienti/${id}/documents`;
    if (payload?.file) {
      const fd = new FormData();
      fd.append("title", payload.title || "");
      fd.append("description", payload.description || "");
      fd.append("date", payload.date || "");
      fd.append("file", payload.file);
      return request(url, { method: "POST", body: fd, headers: {} });
    }
    return json(url, { method: "POST", body: payload });
  },
  deleteClientDocument: (clientId, docId) =>
    json(`${API}/clienti/${clientId}/documents/${docId}`, { method: "DELETE" }),

  // cases
  cases: () => request(`${API}/casi`),
  case: (id) => request(`${API}/casi/${id}`),
  createCase: (payload) => json(`${API}/casi`, { method: "POST", body: payload }),
  updateCase: (id, payload) => json(`${API}/casi/${id}`, { method: "PUT", body: payload }),
  deleteCase: (id) => json(`${API}/casi/${id}`, { method: "DELETE" }),

  caseLogs: (id) => request(`${API}/casi/${id}/logs`),
  addCaseLog: (id, payload) => json(`${API}/casi/${id}/logs`, { method: "POST", body: payload }),
  caseTimeline: (id) => request(`${API}/casi/${id}/timeline`),
  caseExpenses: (id) => request(`${API}/casi/${id}/expenses`),
  addCaseExpense: (id, payload) => json(`${API}/casi/${id}/expenses`, { method: "POST", body: payload }),
  caseDeadlines: (id) => request(`${API}/casi/${id}/deadlines`),
  addCaseDeadline: (id, payload) => json(`${API}/casi/${id}/deadlines`, { method: "POST", body: payload }),
  caseInvoices: (id) => request(`${API}/casi/${id}/invoices`),

  previewCaseNumber: (caseType = "civile") => request(`${API}/casi/preview-number?caseType=${encodeURIComponent(caseType)}`),
  caseNumberingConfig: () => request(`${API}/casi/numbering-config`),
  updateCaseNumberingConfig: (payload) => json(`${API}/casi/numbering-config`, { method: "PUT", body: payload }),

  // deadlines globali
  deadlines: () => request(`${API}/deadlines`),
  addDeadline: (payload) => json(`${API}/deadlines`, { method: "POST", body: payload }),
  deleteDeadline: (id) => json(`${API}/deadlines/${id}`, { method: "DELETE" }),

  // invoices
  invoices: () => request(`${API}/fatture`),
  invoice: (id) => request(`${API}/fatture/${id}`),
  createInvoice: (payload) => json(`${API}/fatture`, { method: "POST", body: payload }),
  updateInvoice: (id, payload) => json(`${API}/fatture/${id}`, { method: "PUT", body: payload }),
  addPayment: (id, payload) => json(`${API}/fatture/${id}/payments`, { method: "POST", body: payload }),
  removePayment: (id, paymentId) => json(`${API}/fatture/${id}/payments/${paymentId}`, { method: "DELETE" }),
  addInvoiceLine: (id, payload) => json(`${API}/fatture/${id}/lines`, { method: "POST", body: payload }),
  removeInvoiceLine: (id, lineId) => json(`${API}/fatture/${id}/lines/${lineId}`, { method: "DELETE" }),
  attachExpensesToInvoice: (id, expenseIds) => json(`${API}/fatture/${id}/attach-expenses`, {
    method: "POST",
    body: { expenseIds },
  }),
  createInvoiceFromExpenses: (payload) => json(`${API}/fatture/genera-da-spese`, { method: "POST", body: payload }),
  invoicePdf: (id) => request(`${API}/fatture/${id}/pdf`),
  deleteInvoice: (id) => json(`${API}/fatture/${id}`, { method: "DELETE" }),

  // guardianships
  guardians: () => request(`${API}/guardianships`),
  guardian: (id) => request(`${API}/guardianships/${id}`),
  createGuardian: (payload) => json(`${API}/guardianships`, { method: "POST", body: payload }),
  guardianSummary: (id) => request(`${API}/guardianships/${id}/summary`),
  guardianAddIncome: (id, payload) => json(`${API}/guardianships/${id}/incomes`, { method: "POST", body: payload }),
  guardianAddExpense: (id, payload) => json(`${API}/guardianships/${id}/expenses`, { method: "POST", body: payload }),
  guardianAddDeposit: (id, payload) => json(`${API}/guardianships/${id}/deposits`, { method: "POST", body: payload }),
  guardianAddMovement: (id, payload) => json(`${API}/guardianships/${id}/movements`, { method: "POST", body: payload }),
  guardianTimeline: (id) => request(`${API}/guardianships/${id}/timeline`),
  guardianAddTimeline: (id, payload) => json(`${API}/guardianships/${id}/timeline`, { method: "POST", body: payload }),
  guardianAddMedicalExpense: (id, payload) => json(`${API}/guardianships/${id}/medical-expenses`, { method: "POST", body: payload }),
  guardianAddStructureExpense: (id, payload) => json(`${API}/guardianships/${id}/structure-expenses`, { method: "POST", body: payload }),
  guardianUpdateCareStructure: (id, payload) => json(`${API}/guardianships/${id}/care-structure`, { method: "PUT", body: payload }),
  guardianCreateFolder: (id, payload) => json(`${API}/guardianships/${id}/folders`, { method: "POST", body: payload }),
  guardianAddDocument: (id, folderId, payload) => {
    const url = `${API}/guardianships/${id}/folders/${folderId}/documents`;
    if (payload?.file) {
      const fd = new FormData();
      fd.append("title", payload.title || "");
      fd.append("description", payload.description || "");
      fd.append("date", payload.date || "");
      fd.append("file", payload.file);
      return request(url, { method: "POST", body: fd, headers: {} });
    }
    return json(url, { method: "POST", body: payload });
  },
  guardianDeleteDocument: (id, folderId, docId) =>
    json(`${API}/guardianships/${id}/folders/${folderId}/documents/${docId}`, { method: "DELETE" }),

  // reports
  reportDashboard: () => request(`${API}/reports/dashboard`),
  reportRecenti: () => request(`${API}/reports/recenti`),
  reportMesi: () => request(`${API}/reports/mesi`),
  dashboard: () => request(`${API}/reports/dashboard`),
  recenti: () => request(`${API}/reports/recenti`),
  mesi: () => request(`${API}/reports/mesi`),

  // files
  exportExcel: () => fetch(`${API}/files/export/excel`).then((r) => r.blob()),
  importExcel: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${API}/files/import/excel`, { method: "POST", body: fd }).then((r) => r.json());
  },
};

export const fmtMoney = (v) => Number(v || 0).toFixed(2);
