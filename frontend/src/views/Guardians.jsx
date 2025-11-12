import React,{useEffect,useState} from "react";
import { api } from "../api";

function NewGuardianModal({onClose,onSaved}){
  const [fullName,setName]=useState("");
  return (
    <div className="modal"><div className="pane grid">
      <b>Nuovo amministrato</b>
      <input placeholder="Nome completo" value={fullName} onChange={e=>setName(e.target.value)}/>
      <div className="row" style={{justifyContent:"flex-end"}}>
        <button className="ghost" onClick={onClose}>Annulla</button>
        <button onClick={async()=>{await api.createGuardian({fullName}); onSaved&&onSaved(); onClose();}}>Crea</button>
      </div>
    </div></div>
  );
}

function MovementsModal({g,onClose}){
  const [summary,setSummary]=useState({});
  const [amount,setAmount]=useState("");
  const [note,setNote]=useState("");
  const [kind,setKind]=useState("incomes");

  async function load(){ setSummary(await api.guardianSummary(g.id)); }
  useEffect(()=>{ load(); },[]);

  async function add(){
    const v=Number(amount); if(!(v>0)) return;
    if(kind==="incomes")  await api.guardianAddIncome(g.id,{amount:v,note});
    if(kind==="expenses") await api.guardianAddExpense(g.id,{amount:v,note});
    if(kind==="deposits") await api.guardianAddDeposit(g.id,{amount:v,note});
    setAmount(""); setNote(""); await load();
  }

  return (
    <div className="modal"><div className="pane grid">
      <b>Movimenti — {g.fullName}</b>
      <div className="row" style={{gap:12}}>
        <div>Entrate: <b>€ {Number(summary.incomes||0).toFixed(2)}</b></div>
        <div>Uscite: <b>€ {Number(summary.expenses||0).toFixed(2)}</b></div>
        <div>Depositi: <b>€ {Number(summary.deposits||0).toFixed(2)}</b></div>
        <div>Saldo: <b>€ {Number(summary.balance||0).toFixed(2)}</b></div>
      </div>
      <div className="row">
        <select value={kind} onChange={e=>setKind(e.target.value)}>
          <option value="incomes">Entrata</option>
          <option value="expenses">Uscita</option>
          <option value="deposits">Deposito</option>
        </select>
        <input placeholder="Importo" value={amount} onChange={e=>setAmount(e.target.value)}/>
        <input placeholder="Nota" value={note} onChange={e=>setNote(e.target.value)}/>
        <button onClick={add}>Aggiungi</button>
      </div>
      <div className="row" style={{justifyContent:"flex-end"}}><button className="ghost" onClick={onClose}>Chiudi</button></div>
    </div></div>
  );
}

export default function Guardians(){
  const [list,setList]=useState([]);
  const [show,setShow]=useState(false);
  const [mov,setMov]=useState(null);

  async function load(){ setList(await api.guardians()); }
  useEffect(()=>{ load(); },[]);

  return (
    <div className="grid">
      <div className="row" style={{justifyContent:"space-between"}}>
        <h2>Amministrati di sostegno</h2>
        <button onClick={()=> setShow(true)}>➕ Nuovo amministrato</button>
      </div>
      <div className="grid">
        {list.map(g=>(
          <div key={g.id} className="card row" style={{justifyContent:"space-between"}}>
            <div>
              <div style={{fontWeight:700}}>{g.fullName}</div>
              <div style={{opacity:.7}}>{g.fiscalCode||""}</div>
            </div>
            <button className="ghost" onClick={()=> setMov(g)}>💳 Movimenti</button>
          </div>
        ))}
        {list.length===0 && <div className="card" style={{opacity:.6}}>Nessun amministrato.</div>}
      </div>
      {show && <NewGuardianModal onClose={()=>setShow(false)} onSaved={()=>load()}/>}
      {mov && <MovementsModal g={mov} onClose={()=> setMov(null)} />}
    </div>
  );
}
