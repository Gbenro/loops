import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { api } from "./api/client";
import { syncManager } from "./api/syncManager";
import { AuthModal } from "./components/AuthModal";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const COLORS = ["#FF6B35","#A78BFA","#60A5FA","#34D399","#F472B6","#FBBF24","#FB7185","#38BDF8"];
const TODAY_DATE = new Date();
const TODAY_STR  = dayStr(TODAY_DATE);

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
function pad(n){ return String(n).padStart(2,"0"); }
function dayStr(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function monStr(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }

function isoWeek(date){
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
  const y1=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return `${d.getUTCFullYear()}-W${pad(Math.ceil(((d-y1)/864e5+1)/7))}`;
}
function weekMonday(wStr){
  const [yr,wn]=wStr.split("-W");
  const jan4=new Date(+yr,0,4);
  const mon=new Date(jan4);
  mon.setDate(jan4.getDate()-(jan4.getDay()||7)+1+(parseInt(wn)-1)*7);
  return mon;
}
function isoWeekCount(y){const d=new Date(y,11,28);return parseInt(isoWeek(d).split("-W")[1]);}

function prevDay(s){return dayStr(addDays(new Date(s),-1));}
function nextDay(s){return dayStr(addDays(new Date(s),1));}
function prevWeek(s){const [y,w]=s.split("-W");const n=parseInt(w)-1;
  if(n<1){const py=parseInt(y)-1;return `${py}-W${pad(isoWeekCount(py))}`;}
  return `${y}-W${pad(n)}`;}
function nextWeek(s){const [y,w]=s.split("-W");const tot=isoWeekCount(parseInt(y));const n=parseInt(w)+1;
  if(n>tot){return `${parseInt(y)+1}-W01`;}return `${y}-W${pad(n)}`;}
function prevMon(s){const [y,m]=s.split("-");return monStr(new Date(+y,+m-2,1));}
function nextMon(s){const [y,m]=s.split("-");return monStr(new Date(+y,+m,1));}

function dayLabel(s){
  const tom=dayStr(addDays(TODAY_DATE,1)),yest=dayStr(addDays(TODAY_DATE,-1));
  if(s===TODAY_STR)return"Today";
  if(s===yest)return"Yesterday";
  if(s===tom)return"Tomorrow";
  const d=new Date(s+"T12:00:00");
  return d.toLocaleDateString("default",{weekday:"short",month:"short",day:"numeric"});
}
function weekLabel(s){
  const mon=weekMonday(s),sun=addDays(mon,6);
  return `${mon.toLocaleDateString("default",{month:"short",day:"numeric"})} – ${sun.toLocaleDateString("default",{month:"short",day:"numeric"})}`;
}
function monLabel(s){
  const [y,m]=s.split("-");
  return new Date(+y,+m-1,1).toLocaleString("default",{month:"long",year:"numeric"});
}

// ─── PROGRESS ─────────────────────────────────────────────────────────────────
function rawPct(loop){
  if(!loop.subtasks.length)return 0;
  return Math.round(loop.subtasks.filter(s=>s.done).length/loop.subtasks.length*100);
}
function cascadePct(loop,all){
  const ch=all.filter(l=>l.linkedTo===loop.id&&l.status!=="expired");
  const oD=loop.subtasks.filter(s=>s.done).length,oT=loop.subtasks.length;
  const cD=ch.filter(c=>cascadePct(c,all)===100).length,cT=ch.length;
  const tot=oT+cT;if(!tot)return 0;
  return Math.round((oD+cD)/tot*100);
}
function uid(){return `l${Date.now()}${Math.random().toString(36).slice(2,5)}`;}

// ─── SEED DATA ────────────────────────────────────────────────────────────────
function buildSeed(){
  const today=TODAY_STR;
  const thisWeek=isoWeek(TODAY_DATE);
  const thisMonth=monStr(TODAY_DATE);
  const yesterday=dayStr(addDays(TODAY_DATE,-1));
  const lastWeek=prevWeek(thisWeek);
  return [
    {id:"m1",tier:"monthly",type:"open",recurrence:null,status:"active",title:"Ship side project",color:"#FF6B35",period:thisMonth,linkedTo:null,rolledFrom:null,
     subtasks:[{id:"a1",text:"Define MVP scope",done:true},{id:"a2",text:"Write landing page",done:false},{id:"a3",text:"Launch & share",done:false}]},
    {id:"m2",tier:"monthly",type:"open",recurrence:null,status:"active",title:"Read 2 books",color:"#A78BFA",period:thisMonth,linkedTo:null,rolledFrom:null,
     subtasks:[{id:"b1",text:"Finish Atomic Habits",done:false},{id:"b2",text:"Start Deep Work",done:false}]},
    {id:"m3",tier:"monthly",type:"windowed",recurrence:null,status:"active",title:"Gym streak this month",color:"#34D399",period:thisMonth,linkedTo:null,rolledFrom:null,
     subtasks:[{id:"c1",text:"20 sessions logged",done:false}]},
    {id:"w_exp",tier:"weekly",type:"windowed",recurrence:null,status:"expired",title:"Write project brief",color:"#FF6B35",period:lastWeek,linkedTo:"m1",rolledFrom:null,
     subtasks:[{id:"x1",text:"Draft outline",done:true},{id:"x2",text:"Share for feedback",done:false}]},
    {id:"w1",tier:"weekly",type:"open",recurrence:null,status:"active",title:"Build auth system",color:"#FF6B35",period:thisWeek,linkedTo:"m1",rolledFrom:lastWeek,
     subtasks:[{id:"d1",text:"Set up Supabase",done:true},{id:"d2",text:"Login flow",done:false},{id:"d3",text:"Protect routes",done:false}]},
    {id:"w2",tier:"weekly",type:"open",recurrence:null,status:"active",title:"Read chapters 5–8",color:"#A78BFA",period:thisWeek,linkedTo:"m2",rolledFrom:null,
     subtasks:[{id:"e1",text:"Read ch. 5–6",done:true},{id:"e2",text:"Read ch. 7–8",done:false},{id:"e3",text:"Take notes",done:false}]},
    {id:"w3",tier:"weekly",type:"windowed",recurrence:"weekly",status:"active",title:"Gym 3× this week",color:"#34D399",period:thisWeek,linkedTo:"m3",rolledFrom:null,
     subtasks:[{id:"f1",text:"Monday session",done:true},{id:"f2",text:"Wednesday session",done:true},{id:"f3",text:"Friday session",done:false}]},
    {id:"dy_exp",tier:"daily",type:"windowed",recurrence:null,status:"expired",title:"Evening reflection",color:"#FBBF24",period:yesterday,linkedTo:null,rolledFrom:null,
     subtasks:[{id:"k1",text:"Journal 5 mins",done:false},{id:"k2",text:"Set tomorrow focus",done:false}]},
    {id:"d1",tier:"daily",type:"open",recurrence:null,status:"active",title:"Build login endpoint",color:"#FF6B35",period:today,linkedTo:"w1",rolledFrom:null,
     subtasks:[{id:"g1",text:"Write route handler",done:true},{id:"g2",text:"Add JWT",done:false},{id:"g3",text:"Write tests",done:false}]},
    {id:"d2",tier:"daily",type:"windowed",recurrence:"daily",status:"active",title:"Morning deep work",color:"#60A5FA",period:today,linkedTo:null,rolledFrom:null,
     subtasks:[{id:"h1",text:"No phone first hour",done:true},{id:"h2",text:"Single-task focus",done:true}]},
    {id:"d3",tier:"daily",type:"windowed",recurrence:"daily",status:"active",title:"Read 20 pages",color:"#A78BFA",period:today,linkedTo:"w2",rolledFrom:null,
     subtasks:[{id:"i1",text:"Read on lunch",done:false},{id:"i2",text:"Highlight ideas",done:false}]},
    {id:"d4",tier:"daily",type:"windowed",recurrence:"daily",status:"active",title:"Evening reflection",color:"#FBBF24",period:today,linkedTo:null,rolledFrom:null,
     subtasks:[{id:"j1",text:"Journal 5 mins",done:false},{id:"j2",text:"Set tomorrow focus",done:false}]},
  ];
}

// ─── PERSISTENCE ──────────────────────────────────────────────────────────────
function loadLoops(){
  return syncManager.loadLocal() || buildSeed();
}
function saveLoops(loops){
  syncManager.saveLocal(loops);
  syncManager.markPendingChanges(true);
}

// ─── ROLLOVER ─────────────────────────────────────────────────────────────────
function computePeriodSummary(loops,period,tier){
  const inPeriod=loops.filter(l=>l.tier===tier&&l.period===period);
  return {
    closed:  inPeriod.filter(l=>cascadePct(l,loops)===100),
    expired: inPeriod.filter(l=>l.type==="windowed"&&cascadePct(l,loops)<100&&l.status!=="expired"),
    rolling: inPeriod.filter(l=>l.type==="open"&&cascadePct(l,loops)<100&&l.status==="active"),
  };
}
function applyRollover(loops,fromPeriod,toPeriod,tier){
  const next=[...loops];
  const existing=loops.filter(l=>l.tier===tier&&l.period===toPeriod);
  // Mark windowed unclosed as expired
  next.forEach((l,i)=>{
    if(l.tier===tier&&l.period===fromPeriod&&l.type==="windowed"&&cascadePct(l,loops)<100&&l.status==="active")
      next[i]={...l,status:"expired"};
  });
  // Recurring → fresh instance
  const recurByTitle={};
  next.filter(l=>l.tier===tier&&l.recurrence===tier&&l.status!=="expired")
    .forEach(l=>{if(!recurByTitle[l.title]||l.period>recurByTitle[l.title].period)recurByTitle[l.title]=l;});
  Object.values(recurByTitle).forEach(tmpl=>{
    if(!existing.some(l=>l.title===tmpl.title&&l.recurrence===tier))
      next.push({...tmpl,id:uid(),period:toPeriod,status:"active",rolledFrom:null,
        subtasks:tmpl.subtasks.map(s=>({...s,id:uid(),done:false}))});
  });
  // Open unclosed → roll
  next.filter(l=>l.tier===tier&&l.period===fromPeriod&&l.type==="open"&&cascadePct(l,next)<100&&l.status==="active")
    .forEach(src=>{
      if(!existing.some(l=>l.rolledFrom===fromPeriod&&l.title===src.title))
        next.push({...src,id:uid(),period:toPeriod,rolledFrom:fromPeriod,status:"active",
          subtasks:src.subtasks.map(s=>({...s,id:uid()}))});
    });
  return next;
}

// ─── RING ─────────────────────────────────────────────────────────────────────
function Ring({pct,color,size,stroke,pulse=false,speed="3s",dim=false,children}){
  const r=(size-stroke)/2,circ=2*Math.PI*r,off=circ-(pct/100)*circ,closed=pct===100;
  return(
    <div style={{position:"relative",width:size,height:size,flexShrink:0,opacity:dim?.35:1}}>
      {pulse&&!closed&&!dim&&<div style={{position:"absolute",inset:-4,borderRadius:"50%",
        background:`radial-gradient(circle,${color}22 0%,transparent 70%)`,
        animation:`breathe ${speed} ease-in-out infinite`}}/>}
      <svg width={size} height={size} style={{transform:"rotate(-90deg)",display:"block"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={dim?"rgba(255,255,255,0.2)":closed?"#34D399":color}
          strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{transition:"stroke-dashoffset 0.7s cubic-bezier(0.34,1.56,0.64,1),stroke 0.4s"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}>
        {children}
      </div>
    </div>
  );
}

// ─── BADGES ──────────────────────────────────────────────────────────────────
const mkbadge=(bg,color,border,label)=>(
  <span style={{fontSize:9,fontFamily:"monospace",letterSpacing:"0.07em",padding:"2px 6px",borderRadius:5,
    background:bg,color,border:`1px solid ${border}`,whiteSpace:"nowrap"}}>{label}</span>
);
const TypeBadge=({type})=>type==="open"
  ?mkbadge("rgba(96,165,250,0.1)","#60A5FA","rgba(96,165,250,0.2)","∞ OPEN")
  :mkbadge("rgba(251,191,36,0.1)","#FBBF24","rgba(251,191,36,0.2)","◷ WINDOWED");
const RecurBadge=({r})=>mkbadge("rgba(52,211,153,0.08)","#34D399","rgba(52,211,153,0.18)",`↺ ${r.toUpperCase()}`);
const StatusBadge=({s})=>s==="expired"
  ?mkbadge("rgba(252,129,129,0.08)","#FC8181","rgba(252,129,129,0.2)","✕ EXPIRED")
  :s==="closed"?mkbadge("rgba(52,211,153,0.1)","#34D399","rgba(52,211,153,0.2)","✓ CLOSED"):null;

// ─── LOOP CARD ────────────────────────────────────────────────────────────────
function LoopCard({loop,all,isSelected,onClick}){
  const pct=cascadePct(loop,all),expired=loop.status==="expired";
  const parent=loop.linkedTo?all.find(l=>l.id===loop.linkedTo):null;
  return(
    <div onClick={()=>onClick(loop)}
      style={{background:isSelected?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.025)",
        border:`1px solid ${isSelected?loop.color+"55":"rgba(255,255,255,0.07)"}`,
        borderRadius:14,padding:"12px 14px",cursor:"pointer",
        display:"flex",alignItems:"center",gap:12,
        transition:"all 0.2s",opacity:expired?.35:1,position:"relative",
        WebkitTapHighlightColor:"transparent",minHeight:64}}>
      {loop.linkedTo&&<div style={{position:"absolute",left:-1,top:"20%",height:"60%",width:3,
        borderRadius:"0 2px 2px 0",background:parent?.color||loop.color,opacity:.55}}/>}
      <Ring pct={pct} color={loop.color} size={46} stroke={3.5} dim={expired}>
        <span style={{fontSize:9,fontWeight:700,fontFamily:"monospace",
          color:expired?"rgba(255,255,255,0.25)":pct===100?"#34D399":loop.color}}>
          {pct===100?"✓":`${pct}%`}
        </span>
      </Ring>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
          <span style={{fontSize:14,fontFamily:"'Cormorant Garamond',serif",fontWeight:600,
            color:expired?"rgba(255,255,255,0.28)":"#f0ece4",
            textDecoration:expired?"line-through":"none",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>
            {loop.title}
          </span>
          {loop.status!=="active"&&<StatusBadge s={loop.status}/>}
        </div>
        <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
          <TypeBadge type={loop.type}/>
          {loop.recurrence&&<RecurBadge r={loop.recurrence}/>}
          {loop.rolledFrom&&mkbadge("rgba(96,165,250,0.07)","rgba(96,165,250,0.55)","rgba(96,165,250,0.15)",`↻ rolled`)}
        </div>
      </div>
      <div style={{color:"rgba(255,255,255,0.15)",fontSize:16,paddingLeft:4}}>›</div>
    </div>
  );
}

// ─── PERIOD NAVIGATOR ─────────────────────────────────────────────────────────
function PeriodNav({view,day,week,month,onNav,onViewChange}){
  const label=view==="day"?dayLabel(day):view==="week"?weekLabel(week):monLabel(month);
  const isNow=view==="day"?day===TODAY_STR:view==="week"?week===isoWeek(TODAY_DATE):month===monStr(TODAY_DATE);
  return(
    <div style={{padding:"env(safe-area-inset-top, 16px) 16px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
      <div style={{display:"flex",gap:3,marginBottom:12,background:"rgba(255,255,255,0.04)",borderRadius:10,padding:3}}>
        {["day","week","month"].map(v=>(
          <button key={v} onClick={()=>onViewChange(v)} style={{
            flex:1,padding:"7px 0",border:"none",borderRadius:8,cursor:"pointer",
            fontFamily:"monospace",fontSize:10,letterSpacing:"0.08em",
            background:v===view?"rgba(255,255,255,0.1)":"transparent",
            color:v===view?"#f0ece4":"rgba(255,255,255,0.3)",transition:"all 0.15s",
            WebkitTapHighlightColor:"transparent"}}>
            {v.toUpperCase()}
          </button>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button onClick={()=>onNav("prev")} style={{background:"none",border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:9,width:34,height:34,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:18,
          WebkitTapHighlightColor:"transparent",flexShrink:0}}>‹</button>
        <div style={{textAlign:"center",flex:1,padding:"0 12px"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontWeight:700,letterSpacing:"-0.01em",lineHeight:1.2}}>
            {label}
          </div>
          {isNow&&<div style={{fontSize:8,color:"rgba(255,255,255,0.3)",fontFamily:"monospace",
            letterSpacing:"0.12em",marginTop:2}}>NOW</div>}
        </div>
        <button onClick={()=>onNav("next")} style={{background:"none",border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:9,width:34,height:34,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:18,
          WebkitTapHighlightColor:"transparent",flexShrink:0}}>›</button>
      </div>
    </div>
  );
}

// ─── END OF PERIOD ────────────────────────────────────────────────────────────
function EndOfPeriodModal({summary,periodLabel,tier,onClose}){
  const {closed,expired,rolling}=summary;
  const total=closed.length+expired.length+rolling.length;
  const pct=total?Math.round(closed.length/total*100):0;
  const accent={daily:"#60A5FA",weekly:"#A78BFA",monthly:"#FF6B35"}[tier];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:200,
      display:"flex",alignItems:"center",justifyContent:"center",padding:20,
      backdropFilter:"blur(10px)"}}>
      <div style={{background:"#13131a",border:`1px solid ${accent}33`,borderRadius:28,
        padding:"32px 28px",width:"100%",maxWidth:460,
        boxShadow:`0 0 80px ${accent}15`}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",fontFamily:"monospace",
            letterSpacing:"0.16em",marginBottom:8}}>{tier.toUpperCase()} COMPLETE</div>
          <h2 style={{margin:"0 0 4px",fontFamily:"'Cormorant Garamond',serif",fontSize:26,
            fontWeight:700,letterSpacing:"-0.02em"}}>{periodLabel}</h2>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",fontFamily:"monospace"}}>
            {closed.length} of {total} loops closed
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"center",marginBottom:28}}>
          <Ring pct={pct} color={pct===100?"#34D399":accent} size={110} stroke={8}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:24,fontWeight:800,fontFamily:"monospace",color:pct===100?"#34D399":accent}}>{pct}%</div>
              <div style={{fontSize:8,color:"rgba(255,255,255,0.3)",fontFamily:"monospace",letterSpacing:"0.08em"}}>CLOSED</div>
            </div>
          </Ring>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:24}}>
          {[
            {count:closed.length,label:"Closed",color:"#34D399",icon:"✓",loops:closed,empty:"Nothing yet"},
            {count:expired.length,label:"Expired",color:"#FC8181",icon:"✕",loops:expired,empty:"None missed!"},
            {count:rolling.length,label:"Rolling",color:accent,icon:"↻",loops:rolling,empty:"All clear"},
          ].map(({count,label,color,icon,loops,empty})=>(
            <div key={label} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
              borderRadius:14,padding:"12px 10px"}}>
              <div style={{fontSize:26,fontWeight:800,fontFamily:"monospace",color,lineHeight:1,marginBottom:2}}>{count}</div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:8}}>{icon} {label.toUpperCase()}</div>
              {count===0?(
                <div style={{fontSize:10,color:"rgba(255,255,255,0.2)",fontFamily:"monospace"}}>{empty}</div>
              ):loops.slice(0,2).map(l=>(
                <div key={l.id} style={{display:"flex",alignItems:"center",gap:4,marginBottom:3}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:l.color,flexShrink:0}}/>
                  <span style={{fontSize:10,color:"rgba(255,255,255,0.55)",fontFamily:"'Cormorant Garamond',serif",
                    fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.title}</span>
                </div>
              ))}
              {loops.length>2&&<div style={{fontSize:9,color:"rgba(255,255,255,0.2)",fontFamily:"monospace"}}>+{loops.length-2} more</div>}
            </div>
          ))}
        </div>
        <div style={{textAlign:"center",marginBottom:22}}>
          <p style={{margin:0,fontSize:14,fontFamily:"'Cormorant Garamond',serif",
            color:pct===100?"#34D399":"rgba(255,255,255,0.4)",fontStyle:"italic"}}>
            {pct===100?"Every loop closed. Clean slate ahead."
              :expired.length===0?"The work carries forward."
              :`${expired.length} missed. Note it and move on.`}
          </p>
        </div>
        <button onClick={onClose} style={{width:"100%",background:pct===100?"#34D399":accent,
          border:"none",borderRadius:14,padding:"15px 0",color:"#0c0c0f",fontWeight:700,
          fontSize:15,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
          WebkitTapHighlightColor:"transparent"}}>
          Begin next {tier} →
        </button>
      </div>
    </div>
  );
}

// ─── OVERLAYS ─────────────────────────────────────────────────────────────────
function Overlay({onClose,children}){
  return(
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:100,
      display:"flex",alignItems:"flex-end",justifyContent:"center",
      padding:"0 0 env(safe-area-inset-bottom,0)"}}>
      <div style={{background:"#16161c",border:"1px solid rgba(255,255,255,0.1)",
        borderRadius:"22px 22px 0 0",padding:"24px 22px 32px",
        width:"100%",maxWidth:500,maxHeight:"90vh",overflowY:"auto",position:"relative"}}>
        <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.15)",
          margin:"0 auto 20px",flexShrink:0}}/>
        <button onClick={onClose} style={{position:"absolute",top:20,right:20,background:"none",
          border:"none",color:"rgba(255,255,255,0.3)",fontSize:18,cursor:"pointer",
          WebkitTapHighlightColor:"transparent"}}>✕</button>
        {children}
      </div>
    </div>
  );
}
function FRow({label,children}){return(
  <div style={{marginBottom:14}}>
    <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:7}}>{label}</div>
    <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>{children}</div>
  </div>
);}
function Pill({active,onClick,children}){return(
  <button onClick={onClick} style={{padding:"7px 13px",border:`1px solid ${active?"rgba(255,255,255,0.22)":"rgba(255,255,255,0.09)"}`,
    borderRadius:9,background:active?"rgba(255,255,255,0.1)":"transparent",
    color:active?"#f0ece4":"rgba(255,255,255,0.35)",fontFamily:"monospace",fontSize:10,
    letterSpacing:"0.06em",cursor:"pointer",transition:"all 0.15s",
    WebkitTapHighlightColor:"transparent"}}>{children}</button>
);}
function OptionRow({active,onClick,label,sub,color}){return(
  <div onClick={onClick} style={{padding:"11px 14px",borderRadius:12,cursor:"pointer",
    background:active?"rgba(255,255,255,0.06)":"transparent",
    border:`1px solid ${active?color+"55":"rgba(255,255,255,0.07)"}`,
    display:"flex",alignItems:"center",gap:11,transition:"all 0.15s",
    WebkitTapHighlightColor:"transparent"}}>
    <div style={{width:8,height:8,borderRadius:"50%",background:active?color:"rgba(255,255,255,0.15)",flexShrink:0}}/>
    <div style={{flex:1}}>
      <div style={{fontSize:14,color:"#f0ece4",fontFamily:"'Cormorant Garamond',serif",fontWeight:600}}>{label}</div>
      {sub&&<div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"monospace",marginTop:1}}>{sub}</div>}
    </div>
    {active&&<div style={{color:color,fontSize:14}}>✓</div>}
  </div>
);}

// ─── CREATE MODAL ─────────────────────────────────────────────────────────────
function CreateModal({onClose,onSave,all,defaultDay,defaultWeek,defaultMonth}){
  const [tier,setTier]=useState("daily");
  const [type,setType]=useState("windowed");
  const [recur,setRecur]=useState(null);
  const [title,setTitle]=useState("");
  const [color,setColor]=useState(COLORS[0]);
  const [linked,setLinked]=useState(null);
  const handleTier=t=>{setTier(t);setLinked(null);setRecur(null);setType(t==="monthly"?"open":"windowed");};
  const parentTier=tier==="daily"?"weekly":tier==="weekly"?"monthly":null;
  const parents=parentTier?all.filter(l=>l.tier===parentTier&&l.status==="active"):[];
  const save=()=>{
    if(!title.trim())return;
    const period=tier==="monthly"?defaultMonth:tier==="weekly"?defaultWeek:defaultDay;
    onSave({id:uid(),tier,type,recurrence:recur,status:"active",title:title.trim(),color,
      period,linkedTo:linked,rolledFrom:null,subtasks:[]});
    onClose();
  };
  return(
    <Overlay onClose={onClose}>
      <h3 style={{margin:"0 0 18px",fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700}}>Open a new loop</h3>
      <FRow label="TIER">{["daily","weekly","monthly"].map(t=><Pill key={t} active={tier===t} onClick={()=>handleTier(t)}>{t.toUpperCase()}</Pill>)}</FRow>
      <FRow label="TYPE"><Pill active={type==="windowed"} onClick={()=>setType("windowed")}>◷ WINDOWED</Pill><Pill active={type==="open"} onClick={()=>setType("open")}>∞ OPEN-ENDED</Pill></FRow>
      <FRow label="RECURRENCE">
        <Pill active={!recur} onClick={()=>setRecur(null)}>NONE</Pill>
        {tier==="daily"&&<Pill active={recur==="daily"} onClick={()=>setRecur("daily")}>↺ DAILY</Pill>}
        {tier==="weekly"&&<Pill active={recur==="weekly"} onClick={()=>setRecur("weekly")}>↺ WEEKLY</Pill>}
        {tier==="monthly"&&<Pill active={recur==="monthly"} onClick={()=>setRecur("monthly")}>↺ MONTHLY</Pill>}
      </FRow>
      <FRow label="TITLE">
        <input autoFocus value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()}
          placeholder={tier==="monthly"?"Monthly goal…":tier==="weekly"?"Weekly focus…":"Today's loop…"}
          style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:10,padding:"12px 14px",color:"#f0ece4",fontSize:16,outline:"none",
            fontFamily:"'Cormorant Garamond',serif",width:"100%",boxSizing:"border-box"}}/>
      </FRow>
      <FRow label="COLOR">
        {COLORS.map(c=><div key={c} onClick={()=>setColor(c)} style={{
          width:26,height:26,borderRadius:"50%",background:c,cursor:"pointer",
          outline:color===c?`3px solid ${c}`:"3px solid transparent",
          outlineOffset:2,transition:"all 0.15s",WebkitTapHighlightColor:"transparent"}}/>)}
      </FRow>
      {parents.length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:9}}>
            LINK TO {parentTier?.toUpperCase()} <span style={{opacity:.5}}>(OPTIONAL)</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:150,overflowY:"auto"}}>
            <OptionRow active={!linked} onClick={()=>setLinked(null)} label="Free loop" sub="no parent" color="rgba(255,255,255,0.3)"/>
            {parents.map(p=><OptionRow key={p.id} active={linked===p.id} onClick={()=>setLinked(p.id)}
              label={p.title} sub={`${cascadePct(p,all)}% complete`} color={p.color}/>)}
          </div>
        </div>
      )}
      <button onClick={save} style={{width:"100%",background:color,border:"none",borderRadius:13,
        padding:"15px 0",color:"#0c0c0f",fontWeight:700,fontSize:15,cursor:"pointer",
        fontFamily:"'DM Sans',sans-serif",opacity:title.trim()?1:.4,transition:"opacity 0.15s",
        WebkitTapHighlightColor:"transparent",marginTop:4}}>
        Open loop
      </button>
    </Overlay>
  );
}

function LinkModal({loop,all,onClose,onLink}){
  const parentTier=loop.tier==="daily"?"weekly":loop.tier==="weekly"?"monthly":null;
  const candidates=parentTier?all.filter(l=>l.tier===parentTier&&l.status==="active"):[];
  const [chosen,setChosen]=useState(loop.linkedTo);
  return(
    <Overlay onClose={onClose}>
      <h3 style={{margin:"0 0 6px",fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700}}>Link loop</h3>
      <p style={{margin:"0 0 18px",fontSize:11,color:"rgba(255,255,255,0.3)",fontFamily:"monospace"}}>
        Select a {parentTier} loop this feeds into
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        <OptionRow active={!chosen} onClick={()=>setChosen(null)} label="Free loop" sub="no parent" color="rgba(255,255,255,0.3)"/>
        {candidates.map(p=><OptionRow key={p.id} active={chosen===p.id} onClick={()=>setChosen(p.id)}
          label={p.title} sub={`${cascadePct(p,all)}%`} color={p.color}/>)}
      </div>
      <button onClick={()=>onLink(loop.id,chosen)} style={{marginTop:20,width:"100%",
        background:"#f0ece4",border:"none",borderRadius:13,padding:"15px 0",
        color:"#0c0c0f",fontWeight:700,fontSize:15,cursor:"pointer",
        fontFamily:"'DM Sans',sans-serif",WebkitTapHighlightColor:"transparent"}}>
        Save link
      </button>
    </Overlay>
  );
}

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────
function DetailPanel({loop,all,onToggle,onAddStep,onOpenLink,onBack}){
  const [newStep,setNewStep]=useState("");
  const pct=cascadePct(loop,all),expired=loop.status==="expired";
  const parent=loop.linkedTo?all.find(l=>l.id===loop.linkedTo):null;
  const children=all.filter(l=>l.linkedTo===loop.id);
  const pulseSpd=loop.tier==="daily"?"2s":loop.tier==="weekly"?"4s":"7s";

  return(
    <div style={{height:"100%",overflowY:"auto",padding:"0 0 env(safe-area-inset-bottom,24px)"}}>
      {/* Mobile back header */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px 0",
        borderBottom:"1px solid rgba(255,255,255,0.06)",paddingBottom:14,marginBottom:20}}>
        <button onClick={onBack} style={{background:"none",border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:9,padding:"6px 12px",color:"rgba(255,255,255,0.5)",cursor:"pointer",
          fontFamily:"monospace",fontSize:11,WebkitTapHighlightColor:"transparent"}}>‹ back</button>
        <span style={{fontSize:10,color:"rgba(255,255,255,0.2)",fontFamily:"monospace",letterSpacing:"0.1em"}}>
          {loop.tier.toUpperCase()}
        </span>
      </div>

      <div style={{padding:"0 18px 24px",display:"flex",flexDirection:"column",gap:20}}>
        {/* Header */}
        <div style={{display:"flex",gap:18,alignItems:"flex-start"}}>
          <Ring pct={pct} color={loop.color} size={96} stroke={7} pulse={!expired} speed={pulseSpd} dim={expired}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:pct===100?20:16,fontWeight:800,fontFamily:"monospace",
                color:expired?"rgba(255,255,255,0.2)":pct===100?"#34D399":loop.color}}>
                {pct===100?"✓":`${pct}%`}
              </div>
              {children.length>0&&pct<100&&<div style={{fontSize:7,color:"rgba(255,255,255,0.2)",fontFamily:"monospace"}}>cascade</div>}
            </div>
          </Ring>
          <div style={{flex:1,paddingTop:2}}>
            <h2 style={{margin:"0 0 8px",fontSize:20,fontFamily:"'Cormorant Garamond',serif",fontWeight:700,
              lineHeight:1.2,color:expired?"rgba(255,255,255,0.28)":"#f0ece4",
              textDecoration:expired?"line-through":"none"}}>{loop.title}</h2>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
              <TypeBadge type={loop.type}/>
              {loop.recurrence&&<RecurBadge r={loop.recurrence}/>}
              {loop.status!=="active"&&<StatusBadge s={loop.status}/>}
              {loop.rolledFrom&&mkbadge("rgba(96,165,250,0.07)","rgba(96,165,250,0.6)","rgba(96,165,250,0.15)",`↻ rolled`)}
            </div>
            {loop.tier!=="monthly"&&!expired&&(
              <button onClick={()=>onOpenLink(loop)} style={{
                background:"transparent",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,
                padding:"5px 12px",color:"rgba(255,255,255,0.35)",fontSize:10,cursor:"pointer",
                fontFamily:"monospace",letterSpacing:"0.07em",WebkitTapHighlightColor:"transparent"}}>
                {loop.linkedTo&&parent?`↑ ${parent.title}`:"+  link to larger loop"}
              </button>
            )}
          </div>
        </div>

        {/* Feeds into */}
        {parent&&(
          <div style={{background:"rgba(255,255,255,0.025)",border:`1px solid ${parent.color}33`,
            borderRadius:13,padding:"12px 15px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.22)",fontFamily:"monospace",letterSpacing:"0.1em",flexShrink:0}}>FEEDS INTO</div>
            <div style={{flex:1,fontSize:14,color:parent.color,fontFamily:"'Cormorant Garamond',serif",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{parent.title}</div>
            <Ring pct={cascadePct(parent,all)} color={parent.color} size={32} stroke={2.5}>
              <span style={{fontSize:7,color:parent.color,fontFamily:"monospace",fontWeight:700}}>{cascadePct(parent,all)}%</span>
            </Ring>
          </div>
        )}

        <div style={{height:1,background:"rgba(255,255,255,0.05)"}}/>

        {/* Own steps */}
        {loop.subtasks.length>0&&(
          <div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.2)",fontFamily:"monospace",letterSpacing:"0.14em",marginBottom:10}}>
              OWN STEPS {children.length>0&&<span style={{opacity:.5}}>· {rawPct(loop)}% own progress</span>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {loop.subtasks.map(s=>(
                <div key={s.id} onClick={()=>!expired&&onToggle(loop.id,s.id)} style={{
                  display:"flex",alignItems:"center",gap:12,padding:"13px 14px",borderRadius:13,
                  cursor:expired?"default":"pointer",minHeight:50,
                  background:s.done?"rgba(52,211,153,0.04)":"rgba(255,255,255,0.025)",
                  border:`1px solid ${s.done?"rgba(52,211,153,0.15)":"rgba(255,255,255,0.06)"}`,
                  transition:"all 0.2s",WebkitTapHighlightColor:"transparent"}}>
                  <div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,
                    border:`2px solid ${s.done?"#34D399":loop.color+"66"}`,
                    background:s.done?"#34D399":"transparent",
                    display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.25s"}}>
                    {s.done&&<span style={{fontSize:10,fontWeight:900,color:"#0c0c0f"}}>✓</span>}
                  </div>
                  <span style={{fontSize:14,color:s.done?"rgba(255,255,255,0.28)":"rgba(255,255,255,0.85)",
                    textDecoration:s.done?"line-through":"none",transition:"all 0.2s",flex:1}}>{s.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subloops */}
        {children.length>0&&(
          <div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.2)",fontFamily:"monospace",letterSpacing:"0.14em",marginBottom:10}}>
              SUBLOOPS · {children.filter(c=>cascadePct(c,all)===100).length}/{children.length} CLOSED
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {children.map(c=>{const cp=cascadePct(c,all);return(
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",
                  borderRadius:13,background:"rgba(255,255,255,0.02)",border:`1px solid ${c.color}22`}}>
                  <Ring pct={cp} color={c.color} size={32} stroke={2.5}>
                    <span style={{fontSize:8,color:c.color,fontFamily:"monospace",fontWeight:700}}>{cp===100?"✓":`${cp}%`}</span>
                  </Ring>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,color:cp===100?"rgba(255,255,255,0.28)":"#f0ece4",
                      fontFamily:"'Cormorant Garamond',serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                      textDecoration:c.status==="expired"?"line-through":"none"}}>{c.title}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.2)",fontFamily:"monospace",marginTop:2,display:"flex",gap:4}}>
                      <TypeBadge type={c.type}/>{c.recurrence&&<RecurBadge r={c.recurrence}/>}
                    </div>
                  </div>
                </div>
              );})}
            </div>
          </div>
        )}

        {/* Add step */}
        {!expired&&(
          <div style={{display:"flex",gap:8}}>
            <input value={newStep} onChange={e=>setNewStep(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&newStep.trim()){onAddStep(loop.id,newStep.trim());setNewStep("");}}}
              placeholder="Add a step…"
              style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:11,padding:"13px 15px",color:"#f0ece4",fontSize:15,outline:"none",
                fontFamily:"'DM Sans',sans-serif"}}/>
            <button onClick={()=>{if(newStep.trim()){onAddStep(loop.id,newStep.trim());setNewStep("");}}}
              style={{background:loop.color,border:"none",borderRadius:11,padding:"13px 18px",
                color:"#0c0c0f",fontWeight:800,fontSize:16,cursor:"pointer",
                WebkitTapHighlightColor:"transparent"}}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SIDEBAR LIST ─────────────────────────────────────────────────────────────
function SidebarList({loops,all,selectedId,onSelect,view,day,week,month,onNav,onViewChange,onCreate,momentum,monthLoops}){
  const closedCount=loops.filter(l=>cascadePct(l,all)===100).length;
  const expiredCount=loops.filter(l=>l.status==="expired").length;
  const tierLabel=view==="day"?"TODAY":view==="week"?"THIS WEEK":"THIS MONTH";

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflowY:"hidden"}}>
      <PeriodNav view={view} day={day} week={week} month={month} onNav={onNav} onViewChange={onViewChange}/>
      {/* Momentum */}
      <div style={{padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)",
        display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <Ring pct={momentum} color="#f0ece4" size={36} stroke={3}>
          <span style={{fontSize:7,fontFamily:"monospace",fontWeight:700,color:"#f0ece4"}}>{momentum}%</span>
        </Ring>
        <div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontFamily:"monospace"}}>
            {monthLoops.filter(l=>cascadePct(l,all)===100).length}/{monthLoops.length} monthly closed
          </div>
          {expiredCount>0&&<div style={{fontSize:9,color:"rgba(252,129,129,0.55)",fontFamily:"monospace",marginTop:1}}>
            {expiredCount} expired this view
          </div>}
        </div>
      </div>
      {/* List */}
      <div style={{flex:1,overflowY:"auto",padding:"12px 12px 0"}}>
        <div style={{fontSize:9,color:"rgba(255,255,255,0.2)",fontFamily:"monospace",
          letterSpacing:"0.16em",marginBottom:9,paddingLeft:2,
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{display:"flex",alignItems:"center",gap:6}}>
            {view==="day"&&<div style={{width:4,height:4,borderRadius:"50%",
              background:"#f0ece4",animation:"breathe 2s ease-in-out infinite"}}/>}
            {tierLabel}
          </span>
          <span style={{opacity:.4}}>{closedCount}/{loops.length}</span>
        </div>
        {loops.length===0?(
          <div style={{textAlign:"center",padding:"32px 16px"}}>
            <div style={{fontSize:36,opacity:.1,marginBottom:10}}>◯</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.2)",fontFamily:"monospace",lineHeight:1.7}}>
              No loops this {view}
            </div>
            <button onClick={onCreate} style={{marginTop:14,background:"transparent",
              border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,padding:"7px 16px",
              color:"rgba(255,255,255,0.35)",fontSize:11,cursor:"pointer",fontFamily:"monospace",
              letterSpacing:"0.08em",WebkitTapHighlightColor:"transparent"}}>+ open one</button>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:7,paddingBottom:12}}>
            {loops.map(l=>(
              <LoopCard key={l.id} loop={l} all={all}
                isSelected={selectedId===l.id} onClick={onSelect}/>
            ))}
          </div>
        )}
      </div>
      {/* Create */}
      <div style={{padding:"10px 12px",borderTop:"1px solid rgba(255,255,255,0.05)",flexShrink:0,
        paddingBottom:"calc(10px + env(safe-area-inset-bottom, 0px))"}}>
        <button onClick={onCreate} style={{
          width:"100%",background:"rgba(255,255,255,0.03)",
          border:"1px dashed rgba(255,255,255,0.12)",borderRadius:12,
          padding:"13px 0",color:"rgba(255,255,255,0.35)",fontSize:13,cursor:"pointer",
          fontFamily:"'DM Sans',sans-serif",letterSpacing:"0.02em",transition:"all 0.2s",
          WebkitTapHighlightColor:"transparent"}}>
          + open a new loop
        </button>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function App(){
  const [loops,    setLoops]    = useState(loadLoops);
  const [selected, setSelected] = useState(null);
  const [showDetail,setShowDetail]=useState(false); // mobile: are we in detail view?
  const [view,     setView]     = useState("day");
  const [selDay,   setSelDay]   = useState(TODAY_STR);
  const [selWeek,  setSelWeek]  = useState(isoWeek(TODAY_DATE));
  const [selMonth, setSelMonth] = useState(monStr(TODAY_DATE));
  const [modal,    setModal]    = useState(null);
  const [endOfPeriod,setEndOfPeriod]=useState(null);

  // Auth and sync state
  const [isAuthenticated, setIsAuthenticated] = useState(api.isAuthenticated());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'synced' | 'offline' | 'error'
  const syncTimeoutRef = useRef(null);

  // Persist on change
  useEffect(()=>{ saveLoops(loops); },[loops]);

  // Sync with server when authenticated and loops change
  useEffect(() => {
    if (!isAuthenticated) return;

    // Clear existing timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce sync by 2 seconds
    syncTimeoutRef.current = setTimeout(async () => {
      setSyncStatus('syncing');
      const result = await syncManager.syncWithServer(loops);

      if (result.synced) {
        setSyncStatus('synced');
        // Only update if server returned different data
        if (JSON.stringify(result.loops) !== JSON.stringify(loops)) {
          setLoops(result.loops);
        }
      } else if (result.authError) {
        setIsAuthenticated(false);
        setSyncStatus('error');
      } else if (result.offline) {
        setSyncStatus('offline');
      }
    }, 2000);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [loops, isAuthenticated]);

  // Initial sync on mount if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setSyncStatus('syncing');
      syncManager.syncWithServer(loops).then(result => {
        if (result.synced && result.loops) {
          setLoops(result.loops);
          setSyncStatus('synced');
        } else if (result.offline) {
          setSyncStatus('offline');
        }
      });
    }
  }, []);

  // Network status listeners
  useEffect(() => {
    const handleOnline = () => {
      if (isAuthenticated && syncManager.hasPendingChanges()) {
        setSyncStatus('syncing');
        syncManager.syncWithServer(loops).then(result => {
          if (result.synced) {
            setSyncStatus('synced');
            if (result.loops) setLoops(result.loops);
          }
        });
      }
    };

    const handleOffline = () => {
      if (isAuthenticated) {
        setSyncStatus('offline');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isAuthenticated, loops]);

  // Auth handlers
  const handleAuth = async (mode, email, password) => {
    if (mode === 'signup') {
      await api.signup(email, password);
    }
    await api.login(email, password);
    setIsAuthenticated(true);

    // Migrate local data to server
    setSyncStatus('syncing');
    const result = await syncManager.migrateLocalToServer();
    if (result.loops && result.loops.length > 0) {
      setLoops(result.loops);
    }
    setShowAuthModal(false);
    setSyncStatus('synced');
  };

  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
    setSyncStatus('idle');
  };

  const handleViewChange=v=>{
    setView(v);
    setShowDetail(false);
    setSelected(null);
  };

  const navigate=useCallback((dir)=>{
    if(dir==="prev"){
      if(view==="day"){const nd=prevDay(selDay);setSelDay(nd);setSelWeek(isoWeek(new Date(nd+"T12:00:00")));setSelMonth(nd.slice(0,7));}
      else if(view==="week"){const nw=prevWeek(selWeek);setSelWeek(nw);setSelMonth(monStr(weekMonday(nw)));}
      else setSelMonth(prevMon(selMonth));
      return;
    }
    // Forward → end of period check
    if(view==="day"){
      const nd=nextDay(selDay);
      const summary=computePeriodSummary(loops,selDay,"daily");
      if(summary.closed.length+summary.expired.length+summary.rolling.length>0){
        setEndOfPeriod({summary,periodLabel:dayLabel(selDay),tier:"daily",
          fromPeriod:selDay,toPeriod:nd,
          newDay:nd,newWeek:isoWeek(new Date(nd+"T12:00:00")),newMonth:nd.slice(0,7)});
      } else {
        setLoops(prev=>applyRollover(prev,selDay,nd,"daily"));
        setSelDay(nd);setSelWeek(isoWeek(new Date(nd+"T12:00:00")));setSelMonth(nd.slice(0,7));
      }
    } else if(view==="week"){
      const nw=nextWeek(selWeek);
      const summary=computePeriodSummary(loops,selWeek,"weekly");
      if(summary.closed.length+summary.expired.length+summary.rolling.length>0){
        setEndOfPeriod({summary,periodLabel:weekLabel(selWeek),tier:"weekly",
          fromPeriod:selWeek,toPeriod:nw,
          newDay:selDay,newWeek:nw,newMonth:monStr(weekMonday(nw))});
      } else {
        setLoops(prev=>applyRollover(prev,selWeek,nw,"weekly"));
        setSelWeek(nw);setSelMonth(monStr(weekMonday(nw)));
      }
    } else {
      const nm=nextMon(selMonth);
      const summary=computePeriodSummary(loops,selMonth,"monthly");
      if(summary.closed.length+summary.expired.length+summary.rolling.length>0){
        setEndOfPeriod({summary,periodLabel:monLabel(selMonth),tier:"monthly",
          fromPeriod:selMonth,toPeriod:nm,
          newDay:selDay,newWeek:selWeek,newMonth:nm});
      } else {
        setLoops(prev=>applyRollover(prev,selMonth,nm,"monthly"));
        setSelMonth(nm);
      }
    }
  },[view,selDay,selWeek,selMonth,loops]);

  const confirmEnd=useCallback(()=>{
    if(!endOfPeriod)return;
    const {fromPeriod,toPeriod,tier,newDay,newWeek,newMonth}=endOfPeriod;
    setLoops(prev=>applyRollover(prev,fromPeriod,toPeriod,tier));
    setSelDay(newDay);setSelWeek(newWeek);setSelMonth(newMonth);
    setEndOfPeriod(null);setSelected(null);setShowDetail(false);
  },[endOfPeriod]);

  const sidebarLoops=useMemo(()=>{
    if(view==="day")   return loops.filter(l=>l.tier==="daily"  &&l.period===selDay);
    if(view==="week")  return loops.filter(l=>l.tier==="weekly" &&l.period===selWeek);
    if(view==="month") return loops.filter(l=>l.tier==="monthly"&&l.period===selMonth);
    return [];
  },[loops,view,selDay,selWeek,selMonth]);

  const monthLoops=loops.filter(l=>l.tier==="monthly"&&l.period===selMonth);
  const momentum=monthLoops.length
    ?Math.round(monthLoops.reduce((s,l)=>s+cascadePct(l,loops),0)/monthLoops.length):0;

  const syncedSelected=useMemo(()=>loops.find(l=>l.id===selected?.id)||selected,[loops,selected]);

  const handleSelectLoop=useCallback(loop=>{
    setSelected(loop);
    setShowDetail(true);
  },[]);

  const handleBack=useCallback(()=>{
    setShowDetail(false);
  },[]);

  const toggleStep=(loopId,stepId)=>{
    setLoops(prev=>{
      const next=prev.map(l=>l.id===loopId
        ?{...l,subtasks:l.subtasks.map(s=>s.id===stepId?{...s,done:!s.done}:s)}:l);
      const upd=next.find(l=>l.id===loopId);
      if(upd&&selected?.id===loopId)setTimeout(()=>setSelected({...upd}),0);
      return next;
    });
  };
  const addStep=(loopId,text)=>{
    setLoops(prev=>prev.map(l=>l.id===loopId
      ?{...l,subtasks:[...l.subtasks,{id:uid(),text,done:false}]}:l));
  };
  const createLoop=loop=>{setLoops(prev=>[loop,...prev]);setSelected(loop);setShowDetail(true);};
  const linkLoop=(loopId,parentId)=>{
    setLoops(prev=>prev.map(l=>l.id===loopId?{...l,linkedTo:parentId}:l));
    setModal(null);
  };

  return(
    <div style={{height:"100dvh",background:"#0c0c0f",color:"#f0ece4",
      fontFamily:"'DM Sans',sans-serif",overflow:"hidden",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;-webkit-font-smoothing:antialiased}
        @keyframes breathe{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}
        body{margin:0;overscroll-behavior:none;background:#0c0c0f}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
        input{-webkit-appearance:none}
      `}</style>

      {/* Sync status indicator */}
      <div style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        right: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        zIndex: 50,
      }}>
        {isAuthenticated ? (
          <>
            <div style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: syncStatus === 'synced' ? '#34D399'
                : syncStatus === 'syncing' ? '#FBBF24'
                : syncStatus === 'offline' ? '#FC8181'
                : 'rgba(255,255,255,0.2)',
              animation: syncStatus === 'syncing' ? 'breathe 1s ease-in-out infinite' : 'none',
              boxShadow: syncStatus === 'synced' ? '0 0 6px #34D39966' : 'none',
            }} title={syncStatus} />
            <button
              onClick={handleLogout}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.25)',
                fontSize: 9,
                fontFamily: 'monospace',
                cursor: 'pointer',
                letterSpacing: '0.05em',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              logout
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            style={{
              background: 'rgba(167,139,250,0.12)',
              border: '1px solid rgba(167,139,250,0.25)',
              borderRadius: 7,
              padding: '5px 12px',
              color: '#A78BFA',
              fontSize: 9,
              fontFamily: 'monospace',
              cursor: 'pointer',
              letterSpacing: '0.08em',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            sync
          </button>
        )}
      </div>

      {/* Mobile: slide between list and detail */}
      <div style={{position:"relative",width:"100%",height:"100%"}}>
        {/* LIST PANEL */}
        <div style={{
          position:"absolute",inset:0,
          transform:showDetail?"translateX(-100%)":"translateX(0)",
          transition:"transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          willChange:"transform",
          paddingTop:"env(safe-area-inset-top,0)",
        }}>
          <SidebarList
            loops={sidebarLoops} all={loops} selectedId={syncedSelected?.id}
            onSelect={handleSelectLoop} view={view} day={selDay} week={selWeek} month={selMonth}
            onNav={navigate} onViewChange={handleViewChange}
            onCreate={()=>setModal("create")}
            momentum={momentum} monthLoops={monthLoops}
          />
        </div>

        {/* DETAIL PANEL */}
        <div style={{
          position:"absolute",inset:0,
          transform:showDetail?"translateX(0)":"translateX(100%)",
          transition:"transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          willChange:"transform",
          overflowY:"auto",
          paddingTop:"env(safe-area-inset-top,0)",
        }}>
          {syncedSelected?(
            <DetailPanel
              loop={syncedSelected} all={loops}
              onToggle={toggleStep} onAddStep={addStep}
              onOpenLink={loop=>setModal({type:"link",loop})}
              onBack={handleBack}
            />
          ):(
            <div style={{height:"100%",display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center",gap:12}}>
              <div style={{fontSize:48,opacity:.06}}>◯</div>
              <div style={{color:"rgba(255,255,255,0.12)",fontFamily:"monospace",fontSize:11,letterSpacing:"0.1em"}}>
                SELECT A LOOP
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      {modal==="create"&&(
        <CreateModal onClose={()=>setModal(null)} onSave={createLoop} all={loops}
          defaultDay={selDay} defaultWeek={selWeek} defaultMonth={selMonth}/>
      )}
      {modal?.type==="link"&&(
        <LinkModal loop={modal.loop} all={loops} onClose={()=>setModal(null)} onLink={linkLoop}/>
      )}
      {endOfPeriod&&(
        <EndOfPeriodModal summary={endOfPeriod.summary} periodLabel={endOfPeriod.periodLabel}
          tier={endOfPeriod.tier} onClose={confirmEnd}/>
      )}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuth}
        />
      )}
    </div>
  );
}
