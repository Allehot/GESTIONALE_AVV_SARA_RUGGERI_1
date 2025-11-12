
import React,{useEffect,useState} from "react";
import { api, fmtMoney } from "../api";

function NewInvoiceModal({clients,cases,onClose,onSaved}){
  const [clientId,setClient]=useState(clients[0]?.id||"");
  const clientCases = cases.filter(p=> p.clientId===clientId);
  const [caseId,setCase]=useState(clientCases[0]?.id||"");
  const [desc,setDesc]=useState("");
  const [amount,setAmount]=useState("");
  useEffect(()=>{ const cc=cases.filter(p=> p.clientId===clientId); if(cc.length) setCase(cc[0].id); },[clientId]);
  return (
    <div className="modal"><div className="pane grid">
      <b>Nuova fattura</b>
      <select value={clientId} onChange={e=>setClient(e.target.value)}>
        {clients.map(c=>(<option key={c.id} value={c.id}>{c.name}</option>))}
      </select>
      <select value={caseId} onChange={e=>setCase(e.target.value)}>
        {cases.filter(p=>p.clientId===clientId).map(p=>(<option key={p.id} value={p.id}>{p.number} - {p.subject}</option>))}
      </select>
      <input placeholder="Descrizione" value={desc} onChange={e=>setDesc(e.target.value)}/>
      <input placeholder="Importo" value={amount} onChange={e=>setAmount(e.target.value)}/>
      <div className="row" style={{justifyContent:"flex-end"}}>
        <button className="ghost" onClick={onClose}>Annulla</button>
        <button onClick={async()=>{
          await api.createInvoice({clientId,caseId,lines:[{type:"manual",description:desc,amount:Number(amount)}]});
          onSaved&&onSaved(); onClose();
        }}>Crea</button>
      </div>
    </div></div>
  );
}

function PayModal({invoice,onClose,onSaved}){
  const [amount,setAmount]=useState("");
  return (
    <div className="modal"><div className="pane grid">
      <b>Registra pagamento — {invoice.number}</b>
      <input placeholder="Importo" value={amount} onChange={e=>setAmount(e.target.value)}/>
      <div className="row" style={{justifyContent:"flex-end"}}>
        <button className="ghost" onClick={onClose}>Annulla</button>
        <button onClick={async()=>{ await api.pay(invoice.id,{amount:Number(amount)}); onSaved&&onSaved(); onClose(); }}>Registra</button>
      </div>
    </div></div>
  );
}

function SplitModal({invoice,onClose,onSaved}){
  const [n,setN]=useState(2);
  const [useDates,setUseDates]=useState(false);
  const [d1,setD1]=useState(""); const [d2,setD2]=useState(""); const [d3,setD3]=useState("");
  return (
    <div className="modal"><div className="pane grid">
      <b>Dividi fattura — {invoice.number}</b>
      <div className="row"><input type="number" min="2" value={n} onChange={e=>setN(e.target.value)}/><span>parti uguali</span></div>
      <label><input type="checkbox" checked={useDates} onChange={e=>setUseDates(e.target.checked)}/> imposta scadenze</label>
      {useDates && (
        <div className="grid">
          <input type="date" value={d1} onChange={e=>setD1(e.target.value)} />
          {n>2 && <input type="date" value={d2} onChange={e=>setD2(e.target.value)} />}
          {n>3 && <input type="date" value={d3} onChange={e=>setD3(e.target.value)} />}
        </div>
      )}
      <div className="row" style={{justifyContent:"flex-end"}}>
        <button className="ghost" onClick={onClose}>Annulla</button>
        <button onClick={async()=>{
          const parts = [d1,d2,d3].filter(Boolean).map(x=>({dueDate:x}));
          await api.split(invoice.id,{ mode:"equal", partsCount:Number(n), parts });
          onSaved&&onSaved(); onClose();
        }}>✂️ Split</button>
      </div>
	  <button onClick={async ()=>{
  // prendo spese della pratica dell’invoice non ancora fatturate
  const caseExpenses = await api.caseExpenses(inv.caseId);
  const unbilled = (caseExpenses || []).filter(e => !e.billedInvoiceId);
  if (!unbilled.length) return alert("Nessuna spesa disponibile");
  // esempio minimal: allego tutte
  const ids = unbilled.map(e=>e.id);
  const r = await api.attachExpensesToInvoice(inv.id, ids);
  alert(`Collegate ${ids.length} spese. Nuovo totale € ${Number(r.invoice?.totals?.totale||0).toFixed(2)}`);
  // ricarica lista
}} >Collega spese</button>

    </div></div>
  );
}

export default function Invoices(){
  const [list,setList]=useState([]);
  const [clients,setClients]=useState([]);
  const [cases,setCases]=useState([]);
  const [showNew,setShowNew]=useState(false);
  const [payInv,setPayInv]=useState(null);
  const [splitInv,setSplitInv]=useState(null);

  async function load(){ const [invs,cl,cs] = await Promise.all([api.invoices(), api.clients(), api.cases()]); setList(invs); setClients(cl); setCases(cs); }
  useEffect(()=>{ load(); },[]);
  const cname = id => clients.find(c=>c.id===id)?.name || "—";

  return (
    <div className="grid">
      <div className="row" style={{justifyContent:"space-between"}}>
        <h2>Fatture</h2>
        <button onClick={()=> setShowNew(true)}>➕ Nuova fattura</button>
      </div>
      <div className="grid">
        {list.map(inv=>(
          <div key={inv.id} className="card" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr auto",alignItems:"center",gap:8}}>
            <div><b>{inv.number}</b><div style={{opacity:.7}}>{cname(inv.clientId)}</div></div>
            <div>{inv.date}</div>
            <div>€ {fmtMoney(inv.totals?.totale||0)}</div>
            <div style={{textAlign:"right"}}>{inv.status||""}</div>
            <div className="row">
              <button className="ghost" onClick={()=> setPayInv(inv)}>💶 Pagamento</button>
              <button className="ghost" onClick={()=> setSplitInv(inv)}>✂️ Split</button>
              <button className="ghost" onClick={async()=>{ const r=await api.pdf(inv.id); if(r?.url) window.open(r.url,"_blank"); }}>🧾 PDF</button>
            </div>
          </div>
        ))}
      </div>

      {showNew && <NewInvoiceModal clients={clients} cases={cases} onClose={()=>setShowNew(false)} onSaved={()=>load()}/>}
      {payInv && <PayModal invoice={payInv} onClose={()=>setPayInv(null)} onSaved={()=>load()}/>}
      {splitInv && <SplitModal invoice={splitInv} onClose={()=>setSplitInv(null)} onSaved={()=>load()}/>}
    </div>
  );
}
