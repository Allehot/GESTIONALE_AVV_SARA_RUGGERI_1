
import React, { useEffect, useMemo, useState } from "react";
import Dashboard from "./views/Dashboard.jsx";
import Deadlines from "./views/Deadlines.jsx";
import Clients from "./views/Clients.jsx";
import Cases from "./views/Cases.jsx";
import Invoices from "./views/Invoices.jsx";
import Guardians from "./views/Guardians.jsx";

const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "📊",
    description: "Numeri chiave e scadenze imminenti dello studio.",
  },
  {
    id: "deadlines",
    label: "Scadenze",
    icon: "🗓️",
    description: "Calendario condiviso per udienze, termini e promemoria.",
  },
  {
    id: "clients",
    label: "Clienti",
    icon: "👤",
    description: "Anagrafica completa con strumenti di gestione rapida.",
  },
  {
    id: "cases",
    label: "Pratiche",
    icon: "📁",
    description: "Gestione avanzata dei fascicoli e del loro ciclo di vita.",
  },
  {
    id: "invoices",
    label: "Fatture",
    icon: "💼",
    description: "Emissione, incassi e monitoraggio stato fatture.",
  },
  {
    id: "guardians",
    label: "Amministrati",
    icon: "👥",
    description: "Sintesi delle amministrazioni di sostegno e movimenti.",
  },
];

const getInitialView = () => {
  if (typeof window === "undefined") return "dashboard";
  return window.localStorage.getItem("gestion:current-view") || "dashboard";
};

export default function App() {
  const [view, setView] = useState(getInitialView);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("gestion:current-view", view);
    }
  }, [view]);

  const activeItem = useMemo(
    () => NAV_ITEMS.find((item) => item.id === view) || NAV_ITEMS[0],
    [view],
  );

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("it-IT", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = `Gestionale · ${activeItem.label}`;
    }
  }, [activeItem.label]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__logo">
          <div className="sidebar__icon">📘</div>
          <div>
            <div className="sidebar__title">Gestionale</div>
            <div className="sidebar__subtitle">Studio Avv. Ruggeri</div>
          </div>
        </div>

        <nav className="sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-button${item.id === view ? " active" : ""}`}
              onClick={() => setView(item.id)}
            >
              <span className="nav-button__icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-button__label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <h1 className="topbar__title">{activeItem.label}</h1>
            {activeItem.description && (
              <p className="topbar__subtitle">{activeItem.description}</p>
            )}
          </div>
          <div className="topbar__meta">
            <span className="topbar__date">{todayLabel}</span>
          </div>
        </header>

        <section className="content">
          {view === "dashboard" && <Dashboard />}
          {view === "deadlines" && <Deadlines />}
          {view === "clients" && <Clients />}
          {view === "cases" && <Cases />}
          {view === "invoices" && <Invoices />}
          {view === "guardians" && <Guardians />}
        </section>
      </main>
    </div>
  );
}
