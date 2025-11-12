
import React,{useEffect,useState} from "react";
import { api, fmtMoney } from "../api";

export default function Dashboard(){
  const [kpi,setKpi]=useState({});
  const [mesi,setMesi]=useState([]);
  const [recent,setRecent]=useState([]);

  useEffect(()=>{
    (async()=>{
      setKpi(await api.dashboard());
      setMesi(await api.mesi());
      setRecent(await api.recenti());
    })();
  },[]);

  return (
    <div className="grid">
      <div className="grid" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
        {[
          {label:"Clienti", value:kpi.clienti||0},
          {label:"Pratiche", value:kpi.pratiche||0},
          {label:"Fatture", value:kpi.fattureTotali||0},
        ].map((x,i)=>(
          <div key={i} className="card">
            <div style={{opacity:.7,fontSize:12}}>{x.label}</div>
            <div style={{fontWeight:800,fontSize:24}}>{x.value}</div>
          </div>
        ))}
      </div>

      <div className="grid" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
        {[
          {label:"Fatturato", value:"€ "+fmtMoney(kpi.importoFatture||0)},
          {label:"Insoluti", value:"€ "+fmtMoney(kpi.insoluti||0)},
          {label:"Scadenze mese", value:kpi.scadenzeMese||0},
        ].map((x,i)=>(
          <div key={i} className="card">
            <div style={{opacity:.7,fontSize:12}}>{x.label}</div>
            <div style={{fontWeight:800,fontSize:24}}>{x.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <b>Prossime scadenze (30 giorni)</b>
        <div className="grid" style={{marginTop:8}}>
          {recent.length===0 ? <div style={{opacity:.7}}>Nessuna.</div> :
            recent.map((r,i)=>(<div key={i} style={{borderTop:"1px solid #eee",padding:"6px 0"}}>{r.date} — {r.title}</div>))
          }
        </div>
      </div>
    </div>
  );
}
