
import React,{useState} from "react";
import Dashboard from "./views/Dashboard.jsx";
import Deadlines from "./views/Deadlines.jsx";
import Clients from "./views/Clients.jsx";
import Cases from "./views/Cases.jsx";
import Invoices from "./views/Invoices.jsx";
import Guardians from "./views/Guardians.jsx";

const btn=(a)=>({padding:"10px 14px",borderRadius:10,border:"none",background:a?"#2b7fff":"#eef3ff",color:a?"#fff":"#2b7fff",fontWeight:600});

export default function App(){
  const [view,setView]=useState("dashboard");
  return (
    <div style={{display:"flex",minHeight:"100vh"}}>
      <aside style={{width:250,background:"#fff",padding:16,borderRight:"1px solid #eee",display:"flex",flexDirection:"column",gap:8}}>
        <div style={{fontWeight:800,marginBottom:8}}>📘 Gestionale</div>
        <button style={btn(view==='dashboard')} onClick={()=>setView('dashboard')}>📊 Dashboard</button>
        <button style={btn(view==='deadlines')} onClick={()=>setView('deadlines')}>🗓️ Scadenze</button>
        <button style={btn(view==='clients')} onClick={()=>setView('clients')}>👤 Clienti</button>
        <button style={btn(view==='cases')} onClick={()=>setView('cases')}>📁 Pratiche</button>
        <button style={btn(view==='invoices')} onClick={()=>setView('invoices')}>💼 Fatture</button>
        <button style={btn(view==='guardians')} onClick={()=>setView('guardians')}>👥 Amministrati</button>
      </aside>
      <main style={{flex:1,padding:20}}>
        {view==="dashboard" && <Dashboard/>}
        {view==="deadlines" && <Deadlines/>}
        {view==="clients" && <Clients/>}
        {view==="cases" && <Cases/>}
        {view==="invoices" && <Invoices/>}
        {view==="guardians" && <Guardians/>}
      </main>
    </div>
  );
}
