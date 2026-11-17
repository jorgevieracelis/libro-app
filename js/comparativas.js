'use strict';
/* Comparativas por período: mensual, trimestral, semestral y anual (Más → Comparativas).
   Usa los meses que ya están cargados y todo se calcula en el teléfono. Va después de plan.js (usa monthTotals y monthCategoryTotals). */
const CMP_TIPOS=[['mes','Mensual',1],['trim','Trimestral',3],['sem','Semestral',6],['anio','Anual',12]];
let cmp={tipo:'mes',a:null,b:null};     /* a y b: índice del primer mes de cada período (año*12+mes) */
const cmpLen=()=>CMP_TIPOS.find(x=>x[0]===cmp.tipo)[2];
const cmpIdx=id=>Number(id.slice(0,4))*12+Number(id.slice(5,7))-1;
const cmpId=i=>Math.floor(i/12)+'-'+String(i%12+1).padStart(2,'0');
const cmpInicio=(id,len)=>{ const i=cmpIdx(id); return i-((i%12)%len); };         /* primer mes del período que contiene a id */
const cmpAbr=m=>MESES[m].slice(0,3).toLowerCase();
function cmpEtiqueta(s,len,corta){
  const y=Math.floor(s/12), m=s%12;
  if(len===1) return corta?cmpAbr(m):MESES[m]+' '+y;
  if(len===3) return corta?'T'+(m/3+1):'T'+(m/3+1)+' '+y+' ('+cmpAbr(m)+'–'+cmpAbr(m+2)+')';
  if(len===6) return corta?'S'+(m/6+1):'S'+(m/6+1)+' '+y+' ('+cmpAbr(m)+'–'+cmpAbr(m+5)+')';
  return String(y);
}
/* Suma ingresos, egresos y categorías de los meses cargados dentro del período. n = cuántos meses tiene cargados. */
function cmpAgregar(s,len){
  const r={n:0,len,ingresos:0,egresos:0,fondo:0,balance:0,cats:{}};
  for(let i=s;i<s+len;i++){
    const id=cmpId(i); if(!months[id]) continue;
    const t=monthTotals(id); r.n++; r.ingresos+=t.ingresos; r.egresos+=t.egresos; r.fondo+=t.fondo; r.balance+=t.balance;
    const c=monthCategoryTotals(months[id]); Object.keys(c).forEach(k=>{ r.cats[k]=(r.cats[k]||0)+num(c[k]); });
  }
  return r;
}
/* Períodos del tipo elegido que tienen al menos un mes cargado (el más nuevo primero). */
function cmpDisponibles(){
  const len=cmpLen(); return [...new Set(Object.keys(months).map(id=>cmpInicio(id,len)))].sort((a,b)=>b-a);
}
function cmpAjustar(){
  const len=cmpLen(), disp=cmpDisponibles();
  if(cmp.a==null||!disp.includes(cmp.a)) cmp.a=(cur&&disp.includes(cmpInicio(cur,len)))?cmpInicio(cur,len):disp[0];
  if(cmp.b==null||!disp.includes(cmp.b)||cmp.b===cmp.a){
    const ant=disp.filter(x=>x<cmp.a);
    cmp.b=disp.includes(cmp.a-len)?cmp.a-len:(ant.length?ant[0]:null);
  }
}
function cmpPar(x,y){ return {a:x,b:y,dif:x-y,pct:y>0?(x-y)/y:null}; }
function renderComparativas(){
  const v=document.getElementById('view-comp'); if(!v) return;
  v.replaceChildren();
  const disp=cmpDisponibles(), len=cmpLen();
  /* ---- controles ---- */
  const ctl=el('section','card'); const h=el('header'); const h2=el('h2'); h2.textContent='Comparativas'; h.append(h2); ctl.append(h);
  const p0=el('p','hint'); p0.textContent='Compara tus ingresos, egresos y categorías entre dos períodos: meses, trimestres, semestres o años.'; ctl.append(p0);
  const vs=el('div','calVistas'); vs.setAttribute('role','group'); vs.setAttribute('aria-label','Tipo de período');
  CMP_TIPOS.forEach(([k,t])=>{
    const b=el('button','btn'+(k===cmp.tipo?' primary':'')); b.type='button'; b.textContent=t; b.setAttribute('aria-pressed',String(k===cmp.tipo));
    b.addEventListener('click',()=>{ if(k===cmp.tipo) return; cmp.tipo=k; cmp.a=null; cmp.b=null; renderComparativas(); });
    vs.append(b);
  });
  ctl.append(vs);
  if(!disp.length){ const e=el('p','small'); e.textContent='Todavía no tienes meses cargados para comparar.'; ctl.append(e); v.append(ctl); return; }
  cmpAjustar();
  const mkSel=(et,val,cambiar,excluir)=>{
    const l=el('label','planLbl'); l.style.marginTop='8px'; const sp=el('span','small'); sp.textContent=et;
    const s=el('select'); s.setAttribute('aria-label',et);
    disp.filter(x=>x!==excluir).forEach(x=>{ const o=el('option'); o.value=String(x); o.textContent=cmpEtiqueta(x,len); if(x===val) o.selected=true; s.append(o); });
    s.addEventListener('change',()=>{ cambiar(Number(s.value)); renderComparativas(); });
    l.append(sp,s); return l;
  };
  ctl.append(mkSel('Período',cmp.a,x=>{ cmp.a=x; cmp.b=null; },null));
  if(disp.length>1) ctl.append(mkSel('Compararlo con',cmp.b,x=>{ cmp.b=x; },cmp.a));
  const rap=el('div','tools'); rap.style.marginTop='8px';
  const atajo=(txt,delta)=>{
    const b=el('button','btn'); b.type='button'; b.textContent=txt;
    b.addEventListener('click',()=>{ const t=cmp.a+delta; if(!disp.includes(t)){ toast('No tienes cargado ese período'); return; } cmp.b=t; renderComparativas(); });
    rap.append(b);
  };
  atajo('Período anterior',-len); if(len<12) atajo('Mismo período del año pasado',-12);
  ctl.append(rap); v.append(ctl);
  if(cmp.b==null){ const c=el('section','card'); c.style.marginTop='16px'; const e=el('p','small'); e.textContent='Para comparar necesitas al menos dos períodos con datos cargados. Cuando cargues otro mes (o importes un respaldo) lo verás aquí.'; c.append(e); v.append(c); return; }
  /* ---- resultado ---- */
  const A=cmpAgregar(cmp.a,len), B=cmpAgregar(cmp.b,len);
  const ing=cmpPar(A.ingresos,B.ingresos), egr=cmpPar(A.egresos,B.egresos), bal=cmpPar(A.balance,B.balance);
  const rc=el('section','card'); rc.style.marginTop='16px';
  const rh=el('header'); const rt=el('h2'); rt.textContent=cmpEtiqueta(cmp.a,len)+' contra '+cmpEtiqueta(cmp.b,len); rt.style.textTransform='none'; rh.append(rt); rc.append(rh);
  [[A,cmp.a],[B,cmp.b]].forEach(([x,s])=>{ if(x.n<len){ const w=el('p','hint'); w.textContent='Ojo: de '+cmpEtiqueta(s,len)+' solo tienes '+x.n+' de '+len+(len===1?' mes':' meses')+' cargado'+(x.n===1?'':'s')+', así que el total es parcial.'; rc.append(w); } });
  const fila=(nombre,x,masEsMalo)=>{
    const d=el('div'); d.style.cssText='display:grid; gap:2px; padding:9px 4px; border-top:1px solid var(--line)';
    const l=el('b'); l.textContent=nombre;
    const vv=el('span'); vv.style.cssText='font-variant-numeric:tabular-nums; overflow-wrap:anywhere';
    vv.append(cf.format(x.a)+' (antes '+cf.format(x.b)+') · ');
    if(x.dif===0) vv.append('igual');
    else { const f=el('span',((x.dif>0)!==masEsMalo)?'pos':'neg'); f.textContent=(x.dif>0?'▲ ':'▼ ')+cf.format(Math.abs(x.dif))+(x.pct!=null?' ('+pctTxt(Math.abs(x.pct))+')':''); vv.append(f); }
    d.append(l,vv); return d;
  };
  rc.append(fila('Ingresos',ing,false),fila('Egresos',egr,true),fila('Balance',bal,false));
  /* barras A contra B */
  const mx=Math.max(1,...[ing,egr,bal].flatMap(x=>[Math.abs(x.a),Math.abs(x.b)]));
  const lg=el('p','small'); lg.style.margin='12px 4px 0'; lg.innerHTML='<b style="color:var(--accent)">■</b> '+cmpEtiqueta(cmp.a,len,true)+'   <b style="color:var(--muted)">■</b> '+cmpEtiqueta(cmp.b,len,true); rc.append(lg);
  [['Ingresos',ing],['Egresos',egr],['Balance',bal]].forEach(([n,x])=>{
    const g=el('div','cmpBar'); const t=el('div','t'); const l=el('span'); l.textContent=n; t.append(l); g.append(t);
    const ba=el('div','b'+(x.a<0?' neg':'')); ba.style.width=Math.max(1,Math.abs(x.a)/mx*100)+'%';
    const bb=el('div','b o'); bb.style.width=Math.max(1,Math.abs(x.b)/mx*100)+'%';
    ba.title=cf.format(x.a); bb.title=cf.format(x.b); g.append(ba,bb); rc.append(g);
  });
  /* categorías */
  const cats=[...new Set([...Object.keys(A.cats),...Object.keys(B.cats)])].map(c=>({c,...cmpPar(num(A.cats[c]),num(B.cats[c]))})).filter(x=>x.a>0||x.b>0).sort((x,y)=>Math.abs(y.dif)-Math.abs(x.dif));
  if(cats.length){
    const th=el('p','small'); th.style.margin='14px 4px 4px'; th.innerHTML='<b>Por categoría</b> (las que más cambiaron primero)'; rc.append(th);
    cats.slice(0,10).forEach(x=>{
      const r=el('div','cmpCat'); const n=el('span'); n.textContent=x.c;
      const m=el('span'); m.textContent=cf.format(x.a); m.style.fontVariantNumeric='tabular-nums';
      const d=el('span',x.dif===0?'':(x.dif>0?'neg':'pos')); d.textContent=x.dif===0?'=':((x.dif>0?'▲ ':'▼ ')+cf.format(Math.abs(x.dif))); d.style.cssText='font-variant-numeric:tabular-nums; min-width:92px; text-align:right';
      r.append(n,m,d); rc.append(r);
    });
    if(cats.length>10){ const mo=el('p','hint'); mo.textContent='Y '+(cats.length-10)+' categorías más con cambios menores.'; rc.append(mo); }
  }
  const nota=el('p','hint'); nota.style.marginTop='8px'; nota.textContent='Si el período más reciente todavía no terminó, sus egresos pueden seguir subiendo.'; rc.append(nota);
  v.append(rc);
  /* ---- evolución: los últimos 6 períodos hasta el elegido ---- */
  const ec=el('section','card'); ec.style.marginTop='16px';
  const eh=el('header'); const et=el('h2'); et.textContent='Evolución de los últimos 6 períodos'; eh.append(et); ec.append(eh);
  const ser=[]; for(let k=5;k>=0;k--){ const s=cmp.a-k*len; ser.push({s,...cmpAgregar(s,len)}); }
  const mv=Math.max(1,...ser.flatMap(x=>[x.ingresos,x.egresos]));
  const evo=el('div','cmpEvo'); evo.setAttribute('role','img'); evo.setAttribute('aria-label','Barras de ingresos y egresos de los últimos 6 períodos');
  ser.forEach(x=>{
    const col=el('div','col'+(x.s===cmp.a?' sel':'')); const par=el('div','par');
    const bi=el('i'); bi.style.height=(x.n?Math.max(2,x.ingresos/mv*100):0)+'%'; bi.style.background='var(--inc)'; bi.title='Ingresos: '+cf.format(x.ingresos);
    const be=el('i'); be.style.height=(x.n?Math.max(2,x.egresos/mv*100):0)+'%'; be.style.background='var(--exp)'; be.title='Egresos: '+cf.format(x.egresos);
    par.append(bi,be); const sm=el('small'); sm.textContent=cmpEtiqueta(x.s,len,true)+(len>=3||len===12?'':' '+String(Math.floor(x.s/12)).slice(2)); col.append(par,sm); evo.append(col);
  });
  ec.append(evo);
  const lg2=el('p','small'); lg2.style.margin='8px 4px 0'; lg2.innerHTML='<b style="color:var(--inc)">■</b> Ingresos   <b style="color:var(--exp)">■</b> Egresos. Los períodos sin datos aparecen vacíos.'; ec.append(lg2);
  v.append(ec);
}
function buildComp(){ const v=el('div'); v.id='view-comp'; v.hidden=true; return v; }
