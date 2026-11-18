'use strict';
/* Evolución de precios (Más → Precios): qué subió y qué bajó en el súper, el alquiler y lo que el usuario cargue en egresos.
   No guarda nada nuevo: arma el historial con los meses que ya están cargados (mismo nombre = mismo artículo, sin importar
   mayúsculas ni tildes). Va después de comparativas.js (usa monthLabel, cf, pctTxt, normTxt, QS/ALLQ y months). */
const PR_RUBROS=[['todo','Todo'],['super','Supermercado'],['fijos','Egresos fijos'],['var','Egresos variables'],['susc','Plataformas']];
const PR_NOMBRE={super:'Supermercado',fijos:'Egreso fijo',var:'Egreso variable',susc:'Plataforma'};
const PR_CMP=[['ant','La vez anterior'],['3','Hace 3 meses'],['6','Hace 6 meses'],['12','Hace un año']];
const PR_ORDEN=[['sube','Los que más subieron'],['baja','Los que más bajaron'],['nombre','Por nombre']];
let pr={rubro:'todo',cmp:'ant',orden:'sube',q:''};
const prIdx=id=>Number(id.slice(0,4))*12+Number(id.slice(5,7))-1;

/* Líneas con precio de un mes: compras del súper (precio por unidad) y egresos fijos, variables y plataformas (monto de la línea). */
function prLineasMes(md){
  const out=[];
  ALLQ.forEach(q=>{
    const d=md&&md[q]; if(!d) return;
    (d.compras||[]).forEach(r=>{ const n=String(r.n||'').trim(); if(n&&num(r.m)>0) out.push({rubro:'super',n,p:num(r.m)}); });
    [['egresos','fijos'],['anticipados','var'],['plataformas','susc']].forEach(([sec,rub])=>(d[sec]||[]).forEach(r=>{
      const n=String(r.n||'').trim(); if(n&&num(r.m)>0) out.push({rubro:rub,n,p:num(r.m)});
    }));
  });
  return out;
}
/* Historial de cada artículo: un precio por mes (promedio de las líneas con ese nombre en ese mes), del más viejo al más nuevo. */
function prSeries(){
  const ids=Object.keys(months).filter(id=>/^\d{4}-\d{2}$/.test(id)&&months[id]).sort();
  const mapa=new Map();
  ids.forEach(id=>{
    const acc=new Map();
    prLineasMes(months[id]).forEach(l=>{
      const k=l.rubro+'|'+normTxt(l.n); let a=acc.get(k);
      if(!a){ a={rubro:l.rubro,n:l.n,s:0,c:0}; acc.set(k,a); }
      a.s+=l.p; a.c++; a.n=l.n;
    });
    acc.forEach((a,k)=>{
      let it=mapa.get(k); if(!it){ it={k,rubro:a.rubro,n:a.n,pts:[]}; mapa.set(k,it); }
      it.n=a.n; it.pts.push({id,p:a.s/a.c,c:a.c});
    });
  });
  return [...mapa.values()];
}
/* Compara el último precio con el de la vez anterior ('ant') o con el de hace N meses ('3', '6', '12'). null si no hay con qué comparar. */
function prCambio(it,cmp){
  const pts=it.pts; if(!pts||pts.length<2) return null;
  const last=pts[pts.length-1]; let base=null;
  if(cmp==='ant') base=pts[pts.length-2];
  else { const lim=prIdx(last.id)-Number(cmp); for(let i=pts.length-2;i>=0;i--){ if(prIdx(pts[i].id)<=lim){ base=pts[i]; break; } } }
  if(!base||!(base.p>0)) return null;
  const dif=last.p-base.p, pct=dif/base.p;
  return {last,base,dif,pct,dir:Math.abs(pct)<0.005?0:(dif>0?1:-1)};
}
/* Precio anterior de una línea con ese nombre en esa sección (el más reciente de un mes anterior al indicado). */
function prPrevio(sec,nombre,mesId){
  const k=normTxt(nombre); if(!k||!mesId) return null;
  const ids=Object.keys(months).filter(id=>id<mesId&&months[id]).sort().reverse();
  for(const id of ids){
    let s=0,c=0;
    ALLQ.forEach(q=>{ const arr=(months[id][q]&&months[id][q][sec])||[]; arr.forEach(r=>{ if(normTxt(r.n)===k&&num(r.m)>0){ s+=num(r.m); c++; } }); });
    if(c) return {id,p:s/c};
  }
  return null;
}
/* Cambio del monto que se está escribiendo contra la vez anterior; null si no hay anterior o es igual (menos de 0,5 %). */
function prBadge(sec,nombre,monto,mesId){
  const ant=prPrevio(sec,nombre,mesId||cur); if(!ant||!(num(monto)>0)) return null;
  const pct=(num(monto)-ant.p)/ant.p; if(Math.abs(pct)<0.005) return null;
  return {pct,ant,dir:pct>0?1:-1};
}
/* Etiqueta junto al monto de una línea: ▲ rojo si subió, ▼ verde si bajó. */
function prPintarDelta(host,sec,nombre,monto){
  host.className='pdelta'; host.textContent='';
  const b=prBadge(sec,nombre,monto);
  if(!b){ host.hidden=true; return; }
  host.hidden=false; host.classList.add(b.dir>0?'up':'dn');
  host.textContent=(b.dir>0?'▲ +':'▼ −')+pctTxt(Math.abs(b.pct));
  host.title='Antes: '+cf.format(b.ant.p)+' ('+monthLabel(b.ant.id)+')';
}

/* ---------- Pantalla ---------- */
function prSpark(pts,dir){
  const v=pts.slice(-8).map(x=>x.p); if(v.length<2) return null;
  const mn=Math.min(...v), mx=Math.max(...v), W=84, H=26, pad=3;
  const X=i=>pad+i*(W-2*pad)/(v.length-1), Y=x=>mx===mn?H/2:H-pad-(x-mn)/(mx-mn)*(H-2*pad);
  const ns='http://www.w3.org/2000/svg'; const s=document.createElementNS(ns,'svg'); s.setAttribute('viewBox','0 0 '+W+' '+H); s.setAttribute('class','prSpark'); s.setAttribute('aria-hidden','true');
  const pl=document.createElementNS(ns,'polyline'); pl.setAttribute('points',v.map((x,i)=>X(i).toFixed(1)+','+Y(x).toFixed(1)).join(' ')); pl.setAttribute('fill','none'); pl.setAttribute('stroke','var(--muted)'); pl.setAttribute('stroke-width','1.8'); pl.setAttribute('stroke-linejoin','round'); pl.setAttribute('stroke-linecap','round'); s.append(pl);
  const c=document.createElementNS(ns,'circle'); c.setAttribute('cx',X(v.length-1).toFixed(1)); c.setAttribute('cy',Y(v[v.length-1]).toFixed(1)); c.setAttribute('r','3.2'); c.setAttribute('fill',dir>0?'var(--neg)':(dir<0?'var(--pos)':'var(--muted)')); s.append(c);
  return s;
}
function prChip(c,grande){
  const s=el('span','prChg '+(c.dir>0?'up':(c.dir<0?'dn':'eq'))+(grande?' big':''));
  s.textContent=c.dir===0?'＝ igual':(c.dir>0?'▲ +':'▼ −')+pctTxt(Math.abs(c.pct));
  return s;
}
function prDetalle(it){
  const body=el('div');
  const sp=prSpark(it.pts,0); if(sp){ sp.style.cssText='width:100%; height:56px'; body.append(sp); }
  const lista=el('div','prHist');
  it.pts.slice().reverse().forEach((pt,i,arr)=>{
    const prev=arr[i+1]; const r=el('div','prHistRow');
    const m=el('span'); m.textContent=monthLabel(pt.id); const p=el('b'); p.textContent=cf.format(pt.p);
    r.append(m,p);
    if(prev){ const pct=(pt.p-prev.p)/prev.p, dir=Math.abs(pct)<0.005?0:(pct>0?1:-1); r.append(prChip({dir,pct})); } else r.append(el('span'));
    lista.append(r);
  });
  body.append(lista);
  if(it.rubro==='super'){ const n=el('p','hint'); n.textContent='Precio por unidad. Si compraste el artículo en varias cadenas ese mes, es el promedio.'; body.append(n); }
  else { const n=el('p','hint'); n.textContent='En servicios como luz, agua o gas el monto cambia por consumo, no solo por precio.'; body.append(n); }
  modal(it.n+' · '+PR_NOMBRE[it.rubro],body,[{label:'Cerrar'}]);
}
function renderPrecios(){
  const v=document.getElementById('view-precios'); if(!v) return;
  v.replaceChildren();
  const todos=prSeries();
  const c=el('section','card'); const h=el('header'); const h2=el('h2'); h2.textContent='Evolución de precios'; h.append(h2); c.append(h);
  const p0=el('p','hint'); p0.textContent='Mira qué subió y qué bajó entre un mes y otro: artículos del súper, el alquiler, las plataformas o cualquier egreso que cargues con el mismo nombre. ▲ rojo = subió, ▼ verde = bajó.'; c.append(p0);
  v.append(c);
  if(!todos.length){ const e=el('p','small'); e.textContent='Todavía no hay precios cargados. Anota egresos o compras con su monto y, al repetirlos el mes siguiente, aquí verás cómo cambian.'; c.append(e); return; }
  /* filtros */
  const fr=el('div','prFiltros'); fr.setAttribute('role','group'); fr.setAttribute('aria-label','Qué mirar');
  PR_RUBROS.forEach(([k,t])=>{ const b=el('button','btn'+(k===pr.rubro?' primary':'')); b.type='button'; b.textContent=t; b.setAttribute('aria-pressed',String(k===pr.rubro)); b.addEventListener('click',()=>{ pr.rubro=k; renderPrecios(); }); fr.append(b); });
  c.append(fr);
  const mkSel=(et,lista,val,cambiar)=>{ const l=el('label','planLbl'); l.style.marginTop='8px'; const sp=el('span','small'); sp.textContent=et; const s=el('select'); s.setAttribute('aria-label',et);
    lista.forEach(([k,t])=>{ const o=el('option'); o.value=k; o.textContent=t; if(k===val) o.selected=true; s.append(o); }); s.addEventListener('change',()=>{ cambiar(s.value); renderPrecios(); }); l.append(sp,s); return l; };
  c.append(mkSel('Comparar con',PR_CMP,pr.cmp,x=>{ pr.cmp=x; }), mkSel('Ordenar',PR_ORDEN,pr.orden,x=>{ pr.orden=x; }));
  const bq=el('input','txt'); bq.type='search'; bq.placeholder='Buscar un artículo…'; bq.setAttribute('aria-label','Buscar un artículo'); bq.value=pr.q; bq.style.cssText='width:100%; margin-top:10px'; bq.autocomplete='off';
  c.append(bq);
  /* lista */
  const items=todos.filter(it=>pr.rubro==='todo'||it.rubro===pr.rubro);
  const calc=items.map(it=>({it,c:prCambio(it,pr.cmp)}));
  const con=calc.filter(x=>x.c), sin=calc.filter(x=>!x.c);
  const sube=con.filter(x=>x.c.dir>0).length, baja=con.filter(x=>x.c.dir<0).length, igual=con.filter(x=>x.c.dir===0).length;
  const res=el('div','prResumen');
  [['up','▲ '+sube+(sube===1?' subió':' subieron')],['dn','▼ '+baja+(baja===1?' bajó':' bajaron')],['eq','＝ '+igual+' igual'+(igual===1?'':'es')]].forEach(([k,t])=>{ const s=el('span','prChg '+k); s.textContent=t; res.append(s); });
  c.append(res);
  const lista=el('div','prLista'); lista.id='prLista'; c.append(lista);
  const pintar=()=>{
    lista.replaceChildren();
    const q=normTxt(pr.q);
    let arr=con.filter(x=>!q||normTxt(x.it.n).includes(q));
    if(pr.orden==='sube') arr.sort((a,b)=>b.c.pct-a.c.pct); else if(pr.orden==='baja') arr.sort((a,b)=>a.c.pct-b.c.pct); else arr.sort((a,b)=>a.it.n.localeCompare(b.it.n,'es'));
    arr.forEach(({it,c:cm})=>{
      const b=el('button','prRow'); b.type='button';
      const t=el('span','prNom'); const nb=el('b'); nb.textContent=it.n; const rb=el('small'); rb.textContent=PR_NOMBRE[it.rubro]; t.append(nb,rb);
      const pm=el('span','prPrecio'); const pb=el('b'); pb.textContent=cf.format(cm.last.p); const ps=el('small'); ps.textContent='antes '+cf.format(cm.base.p)+' · '+monthLabel(cm.base.id); pm.append(pb,ps);
      const sp=prSpark(it.pts,cm.dir);
      b.append(t,prChip(cm),pm); if(sp) b.append(sp);
      b.setAttribute('aria-label',it.n+': '+cf.format(cm.last.p)+', '+(cm.dir>0?'subió ':(cm.dir<0?'bajó ':'igual '))+pctTxt(Math.abs(cm.pct))+' respecto a '+monthLabel(cm.base.id));
      b.addEventListener('click',()=>prDetalle(it));
      lista.append(b);
    });
    if(!arr.length){ const e=el('p','small'); e.style.padding='8px 4px'; e.textContent=con.length?'Ningún artículo coincide con la búsqueda.':'Con este tipo de comparación todavía no hay artículos con dos precios. Prueba con «La vez anterior».'; lista.append(e); }
  };
  bq.addEventListener('input',()=>{ pr.q=bq.value; pintar(); });
  pintar();
  if(sin.length){
    const d=el('details','prSin'); const sm=el('summary','small'); sm.textContent=sin.length+(sin.length===1?' artículo con un solo precio':' artículos con un solo precio')+' (aún no se pueden comparar)';
    const ul=el('p','hint'); ul.textContent=sin.map(x=>x.it.n).sort((a,b)=>a.localeCompare(b,'es')).join(' · '); d.append(sm,ul); c.append(d);
  }
  const nota=el('p','hint'); nota.style.marginTop='10px'; nota.textContent='Se compara el monto de cada línea con el mismo nombre. En servicios como luz o agua el monto cambia por consumo, no solo por precio. Toca un artículo para ver todo su historial.'; c.append(nota);
}
function buildPrecios(){ const v=el('div'); v.id='view-precios'; v.hidden=true; return v; }
