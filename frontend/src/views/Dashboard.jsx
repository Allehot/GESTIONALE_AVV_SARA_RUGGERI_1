
import React,{useEffect,useState} from "react";
import { api, fmtMoney } from "../api";

export default function Dashboard(){
  const [kpi,setKpi]=useState({});
  const [recent,setRecent]=useState([]);
  const [morosi,setMorosi]=useState([]);

  useEffect(()=>{
    (async()=>{
      const dashboard = await api.dashboard();
      setKpi(dashboard);
      setMorosi(dashboard.morosi || []);
      setRecent(await api.recenti());
    })();
  },[]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:16}}>
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

      <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16}}>
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

      <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:16}}>
        <div className="card" style={{ display:"grid", gap:12 }}>
          <b>Prossime scadenze (30 giorni)</b>
          <div className="grid" style={{ gap:8 }}>
            {recent.length===0 ? (
              <div style={{opacity:.7}}>Nessuna scadenza programmata.</div>
            ) : (
              recent.map((r)=>(
                <div key={r.id} style={{borderTop:"1px solid #eee",padding:"6px 0"}}>
                  <div style={{fontWeight:600}}>{r.date}{r.time ? ` · ${r.time}`: ""}</div>
                  <div>{r.title}</div>
                  {(r.clientName || r.caseNumber) && (
                    <div style={{fontSize:12,opacity:.7}}>
                      {r.clientName && <span>{r.clientName}</span>}
                      {r.clientName && r.caseNumber && <span> · </span>}
                      {r.caseNumber && <span>{r.caseNumber}</span>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card" style={{ display:"grid", gap:12 }}>
          <b>Clienti con fatture scadute</b>
          <div className="grid" style={{ gap:8 }}>
            {morosi.length===0 ? (
              <div style={{opacity:.7}}>Tutti in regola.</div>
            ) : (
              morosi.map((m)=>(
                <div key={m.clientId} style={{borderTop:"1px solid #eee",padding:"6px 0"}}>
                  <div style={{fontWeight:600}}>{m.clientName}</div>
                  <div style={{fontSize:12,opacity:.7}}>Residuo € {fmtMoney(m.totalResiduo)}</div>
                  <ul style={{ margin: "4px 0 0 16px", fontSize: 12, opacity: 0.75 }}>
                    {m.invoices.slice(0,3).map((inv)=> (
                      <li key={inv.id}>
                        {inv.number} · scad. {inv.dueDate} · € {fmtMoney(inv.residuo)}
                      </li>
                    ))}
                    {m.invoices.length>3 && <li>… altre {m.invoices.length-3}</li>}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
